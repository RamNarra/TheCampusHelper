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
  testId: string;
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
    const testId = (body.testId ?? '').trim();
    if (!courseId || !testId) {
      return res.status(400).json({ error: 'Invalid payload', requestId: ctx.requestId });
    }

    await requireInstructorOrPlatform({ courseId, actorUid: caller.uid, actorRole: caller.role });

    // Fanout guardrail: block publish if we cannot safely rate-limit fanout.
    const limiterKey = `calendarFanout:test.publish:${caller.uid}:${courseId}:${testId}`;
    if (await rateLimitExceeded(limiterKey, { failClosed: true })) {
      return res.status(429).json({ error: 'Too Many Requests', requestId: ctx.requestId });
    }

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    const { courseRef, course } = await requireCourseExists(courseId);
    const testRef = courseRef.collection('tests').doc(testId);

    let pointsPossible = 0;
    let windowStartMillis: number | undefined;
    let windowEndMillis: number | undefined;

    const beforeAfter = await db.runTransaction(async (tx) => {
      const testSnap = await tx.get(testRef);
      if (!testSnap.exists) {
        const err = new Error('Test not found');
        (err as any).status = 404;
        throw err;
      }
      const test = testSnap.data() as any;
      const mode: 'scheduled' | 'practice' = test?.mode === 'scheduled' ? 'scheduled' : 'practice';
      pointsPossible = Number(test?.pointsPossible ?? 0);
      windowStartMillis = typeof test?.windowStartMillis === 'number' ? test.windowStartMillis : undefined;
      windowEndMillis = typeof test?.windowEndMillis === 'number' ? test.windowEndMillis : undefined;

      const beforeStatus = String(test?.status ?? 'draft');

      // Safety: for assessed tests, require non-zero points.
      const isAssessed = test?.isAssessed === true || mode === 'scheduled';
      if (isAssessed && (!Number.isFinite(pointsPossible) || pointsPossible <= 0)) {
        const err = new Error('Cannot publish assessed test with no questions/points');
        (err as any).status = 409;
        throw err;
      }

      tx.set(
        testRef,
        {
          status: 'published',
          publishedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          updatedAtBy: caller.uid,
        },
        { merge: true }
      );

      return { mode, before: { status: beforeStatus }, after: { status: 'published' } };
    });

    const mode = beforeAfter.mode;

    // Calendar emission for scheduled tests.
    let calendarEventId: string | null = null;
    if (mode === 'scheduled' && windowStartMillis !== undefined && windowEndMillis !== undefined) {
      calendarEventId = makeDeterministicEventId(`course:${courseId}:test:${testId}:window`);
      await emitCourseCalendarEvent({
        eventId: calendarEventId,
        courseId,
        type: 'test_window',
        title: 'Test Window',
        description: undefined,
        startMillis: windowStartMillis,
        endMillis: windowEndMillis,
        createdBy: caller.uid,
        courseName: String(course?.name ?? ''),
      });
    }

    await writeAuditLog({
      action: 'test.publish',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { courseId, testId, pointsPossible, ...beforeAfter, calendarEventId },
    });

    await emitDomainEvent({
      type: 'test.published',
      courseId,
      actorUid: caller.uid,
      actorRole: caller.role,
      aggregate: { kind: 'test', id: testId },
      payload: { courseId, testId, calendarEventId },
      idempotencyKey: `test.published:${courseId}:${testId}`,
      requestId: ctx.requestId,
    });

    return res.status(200).json({ ok: true, calendarEventId });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
