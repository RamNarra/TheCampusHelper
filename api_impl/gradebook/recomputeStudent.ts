import { FieldValue } from 'firebase-admin/firestore';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requireCompleteProfile, requireUser } from '../_lib/authz';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';
import { requireCourseExists, requireInstructorOrPlatform } from '../_lib/courseAccess';
import { emitDomainEvent } from '../_lib/domainEvents';
import { sanitizeOptionalReason } from '../_lib/sanitize';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 10 * 1024;
const MAX_GRADES_SCAN = 1000;
const DRIFT_WARN_POINTS = 1; // log flag when delta is meaningfully large

type Body = {
  courseId: string;
  studentId: string;
  reason?: string;
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
    const studentId = (body.studentId ?? '').trim();
    const reason = sanitizeOptionalReason(body.reason);

    if (!courseId || !studentId) {
      return res.status(400).json({ error: 'Invalid payload', requestId: ctx.requestId });
    }

    await requireInstructorOrPlatform({ courseId, actorUid: caller.uid, actorRole: caller.role });

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    const { courseRef } = await requireCourseExists(courseId);

    const gradesSnap = await courseRef
      .collection('grades')
      .where('studentId', '==', studentId)
      .limit(MAX_GRADES_SCAN + 1)
      .get();

    if (gradesSnap.size > MAX_GRADES_SCAN) {
      return res.status(413).json({ error: 'Too many grades to recompute', requestId: ctx.requestId });
    }

    let totalScore = 0;
    let totalPossible = 0;
    for (const d of gradesSnap.docs) {
      const g = d.data() as any;
      const s = Number(g?.score ?? 0);
      const p = Number(g?.pointsPossible ?? 0);
      if (Number.isFinite(s)) totalScore += s;
      if (Number.isFinite(p)) totalPossible += p;
    }

    const gradebookRef = courseRef.collection('gradebook').doc(studentId);

    const gradebookBeforeSnap = await gradebookRef.get();
    const beforeTotalScore = gradebookBeforeSnap.exists ? Number((gradebookBeforeSnap.data() as any)?.totalScore ?? 0) : 0;
    const beforeTotalPossible = gradebookBeforeSnap.exists ? Number((gradebookBeforeSnap.data() as any)?.totalPossible ?? 0) : 0;
    const safeBeforeScore = Number.isFinite(beforeTotalScore) ? beforeTotalScore : 0;
    const safeBeforePossible = Number.isFinite(beforeTotalPossible) ? beforeTotalPossible : 0;
    const deltaTotalScore = totalScore - safeBeforeScore;
    const deltaTotalPossible = totalPossible - safeBeforePossible;
    const driftFlagged =
      Math.abs(deltaTotalScore) >= DRIFT_WARN_POINTS || Math.abs(deltaTotalPossible) >= DRIFT_WARN_POINTS;

    await gradebookRef.set(
      {
        studentId,
        totalScore,
        totalPossible,
        computedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtBy: caller.uid,
      },
      { merge: true }
    );

    await writeAuditLog({
      action: 'gradebook.recompute',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      targetUid: studentId,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: {
        courseId,
        studentId,
        before: { totalScore: safeBeforeScore, totalPossible: safeBeforePossible },
        after: { totalScore, totalPossible },
        delta: { totalScore: deltaTotalScore, totalPossible: deltaTotalPossible },
        driftFlagged,
        reason,
      },
    });

    await emitDomainEvent({
      type: 'gradebook.student.recomputed',
      courseId,
      actorUid: caller.uid,
      actorRole: caller.role,
      aggregate: { kind: 'gradebook', id: studentId },
      payload: { courseId, studentId, totalScore, totalPossible, reason, deltaTotalScore, deltaTotalPossible, driftFlagged },
      idempotencyKey: `gradebook.student.recomputed:${courseId}:${studentId}:${totalScore}:${totalPossible}`,
      requestId: ctx.requestId,
    });

    return res.status(200).json({ ok: true, totalScore, totalPossible });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
