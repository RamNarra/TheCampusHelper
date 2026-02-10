import { FieldValue } from 'firebase-admin/firestore';
import { rateLimitExceeded } from '../../lib/rateLimit';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requireCompleteProfile, requireUser } from '../_lib/authz';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';
import { requireCourseExists, requireInstructorOrPlatform } from '../_lib/courseAccess';
import { emitDomainEvent } from '../_lib/domainEvents';
import { emitCourseCalendarEvent, makeDeterministicEventId } from '../_lib/calendarFanout';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 10 * 1024;

type Body = {
  courseId: string;
  assignmentId: string;
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
    const assignmentId = (body.assignmentId ?? '').trim();
    if (!courseId || !assignmentId) {
      return res.status(400).json({ error: 'Invalid payload', requestId: ctx.requestId });
    }

    await requireInstructorOrPlatform({ courseId, actorUid: caller.uid, actorRole: caller.role });

    // Fanout guardrail: block publish if we cannot safely rate-limit fanout.
    const limiterKey = `calendarFanout:assignment.publish:${caller.uid}:${courseId}:${assignmentId}`;
    if (await rateLimitExceeded(limiterKey, { failClosed: true })) {
      return res.status(429).json({ error: 'Too Many Requests', requestId: ctx.requestId });
    }

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    const { courseRef, course } = await requireCourseExists(courseId);
    const assignmentRef = courseRef.collection('assignments').doc(assignmentId);

    let afterVersion = 1;
    let title = '';
    let dueMillis: number | undefined;

    const beforeAfter = await db.runTransaction(async (tx) => {
      const snap = await tx.get(assignmentRef);
      if (!snap.exists) {
        const err = new Error('Assignment not found');
        (err as any).status = 404;
        throw err;
      }
      const data = snap.data() as any;
      title = String(data?.title ?? '');
      dueMillis = typeof data?.dueMillis === 'number' ? data.dueMillis : undefined;

      const beforeStatus = String(data?.status ?? 'draft');
      const beforeVersion = Number(data?.version ?? 1);
      afterVersion = Number.isFinite(beforeVersion) ? beforeVersion + 1 : 2;

      tx.set(
        assignmentRef,
        {
          status: 'published',
          version: afterVersion,
          publishedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          updatedAtBy: caller.uid,
        },
        { merge: true }
      );

      return {
        before: { status: beforeStatus, version: beforeVersion },
        after: { status: 'published', version: afterVersion },
      };
    });

    // Calendar emission (event-first): if dueMillis exists, emit deterministic calendar event.
    let calendarEventId: string | null = null;
    if (dueMillis !== undefined && Number.isFinite(dueMillis)) {
      calendarEventId = makeDeterministicEventId(`course:${courseId}:assignment:${assignmentId}:due`);
      await emitCourseCalendarEvent({
        eventId: calendarEventId,
        courseId,
        type: 'assignment_deadline',
        title: title ? `Assignment Due: ${title}` : 'Assignment Due',
        description: undefined,
        startMillis: dueMillis,
        endMillis: dueMillis + 60 * 60 * 1000,
        createdBy: caller.uid,
        courseName: String(course?.name ?? ''),
      });
    }

    await writeAuditLog({
      action: 'assignment.publish',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: {
        courseId,
        assignmentId,
        ...beforeAfter,
        calendarEventId,
      },
    });

    await emitDomainEvent({
      type: 'assignment.published',
      courseId,
      actorUid: caller.uid,
      actorRole: caller.role,
      aggregate: { kind: 'assignment', id: assignmentId, version: afterVersion },
      payload: { courseId, assignmentId, version: afterVersion, calendarEventId },
      idempotencyKey: `assignment.published:${courseId}:${assignmentId}:v${afterVersion}`,
      requestId: ctx.requestId,
    });

    return res.status(200).json({ ok: true, version: afterVersion, calendarEventId });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
