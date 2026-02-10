import { FieldValue } from 'firebase-admin/firestore';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requireCompleteProfile, requireUser } from '../_lib/authz';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';
import { requireCourseExists, requireInstructorOrPlatform } from '../_lib/courseAccess';
import { emitDomainEvent } from '../_lib/domainEvents';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 10 * 1024;

type Body = {
  courseId: string;
  visibility: 'enrolled_only' | 'public_catalog';
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
    await requireCompleteProfile(caller);
    const body = (req.body || {}) as Body;

    const courseId = (body.courseId ?? '').trim();
    const visibility = body.visibility;
    if (!courseId || (visibility !== 'enrolled_only' && visibility !== 'public_catalog')) {
      return res.status(400).json({ error: 'Invalid payload', requestId: ctx.requestId });
    }

    await requireInstructorOrPlatform({ courseId, actorUid: caller.uid, actorRole: caller.role });

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    const { courseRef } = await requireCourseExists(courseId);

    const beforeSnap = await courseRef.get();
    const before = beforeSnap.data() as any;

    await courseRef.set(
      {
        visibility,
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtBy: caller.uid,
      },
      { merge: true }
    );

    await writeAuditLog({
      action: 'course.visibility.set',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: {
        courseId,
        before: { visibility: before?.visibility ?? 'enrolled_only' },
        after: { visibility },
      },
    });

    await emitDomainEvent({
      type: 'course.visibility.set',
      courseId,
      actorUid: caller.uid,
      actorRole: caller.role,
      aggregate: { kind: 'course', id: courseId },
      payload: { visibility },
      idempotencyKey: `course.visibility.set:${courseId}:${visibility}`,
      requestId: ctx.requestId,
    });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
