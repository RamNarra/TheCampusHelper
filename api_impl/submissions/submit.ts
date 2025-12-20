import { FieldValue } from 'firebase-admin/firestore';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requireUser } from '../_lib/authz';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';
import { requireActiveEnrollmentOrPlatform, requireCourseExists } from '../_lib/courseAccess';
import { emitDomainEvent } from '../_lib/domainEvents';
import { isHttpUrl } from '../_lib/sanitize';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 60 * 1024;

type Body = {
  courseId: string;
  assignmentId: string;
  content: {
    text?: string;
    links?: string[];
  };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = getRequestContext(req);

  res.setHeader('Cache-Control', 'no-store');
  applyCors(req, res, { origin: ctx.origin });
  if (ctx.origin && !isOriginAllowed(ctx.origin)) {
    return res.status(403).json({ error: 'Forbidden Origin', requestId: ctx.requestId });
  }

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    assertJson(req);
    assertBodySize(req, MAX_BODY_SIZE);

    const caller = await requireUser(req);
    const body = (req.body || {}) as Body;

    const courseId = (body.courseId ?? '').trim();
    const assignmentId = (body.assignmentId ?? '').trim();
    if (!courseId || !assignmentId) {
      return res.status(400).json({ error: 'Invalid payload', requestId: ctx.requestId });
    }

    await requireActiveEnrollmentOrPlatform({ courseId, actorUid: caller.uid, actorRole: caller.role });

    const contentText = typeof body.content?.text === 'string' ? body.content.text.trim() : '';
    if (contentText.length > 50000) {
      return res.status(400).json({ error: 'Invalid text', requestId: ctx.requestId });
    }
    const linksRaw = Array.isArray(body.content?.links) ? body.content.links : [];
    const links = linksRaw
      .map((l) => (typeof l === 'string' ? l.trim() : ''))
      .filter((l) => l && isHttpUrl(l))
      .slice(0, 10);

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    const { courseRef } = await requireCourseExists(courseId);
    const assignmentRef = courseRef.collection('assignments').doc(assignmentId);
    const submissionRef = assignmentRef.collection('submissions').doc(caller.uid);

    const nowMillis = Date.now();

    let assignmentVersionAtSubmission = 1;
    let dueMillis: number | undefined;

    const result = await db.runTransaction(async (tx) => {
      const assignmentSnap = await tx.get(assignmentRef);
      if (!assignmentSnap.exists) {
        const err = new Error('Assignment not found');
        (err as any).status = 404;
        throw err;
      }
      const assignment = assignmentSnap.data() as any;
      const status = String(assignment?.status ?? 'draft');
      if (status !== 'published') {
        const err = new Error('Assignment is not published');
        (err as any).status = 409;
        throw err;
      }

      assignmentVersionAtSubmission = Number(assignment?.version ?? 1);
      dueMillis = typeof assignment?.dueMillis === 'number' ? assignment.dueMillis : undefined;
      const allowLate = assignment?.allowLate === true;

      const late = dueMillis !== undefined && nowMillis > dueMillis;
      if (late && !allowLate) {
        const err = new Error('Late submissions are not allowed');
        (err as any).status = 409;
        throw err;
      }

      const existingSnap = await tx.get(submissionRef);
      const existing = existingSnap.exists ? (existingSnap.data() as any) : null;

      const nextStatus = existing ? 'resubmitted' : 'submitted';

      tx.set(
        submissionRef,
        {
          userId: caller.uid,
          status: nextStatus,
          content: {
            text: contentText || undefined,
            links,
          },
          late,
          assignmentVersionAtSubmission,
          submittedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          updatedAtBy: caller.uid,
          createdAt: existing?.createdAt ?? FieldValue.serverTimestamp(),
          createdBy: existing?.createdBy ?? caller.uid,
        },
        { merge: true }
      );

      return { status: nextStatus, late, wasResubmission: !!existing };
    });

    await writeAuditLog({
      action: 'submission.submit',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: {
        courseId,
        assignmentId,
        status: result.status,
        late: result.late,
        assignmentVersionAtSubmission,
        dueMillis: dueMillis ?? null,
      },
    });

    await emitDomainEvent({
      type: 'submission.submitted',
      courseId,
      actorUid: caller.uid,
      actorRole: caller.role,
      aggregate: { kind: 'submission', id: `${assignmentId}:${caller.uid}`, version: assignmentVersionAtSubmission },
      payload: { courseId, assignmentId, studentId: caller.uid, assignmentVersionAtSubmission },
      idempotencyKey: `submission.submitted:${courseId}:${assignmentId}:${caller.uid}:v${assignmentVersionAtSubmission}`,
      requestId: ctx.requestId,
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
