import { FieldValue } from 'firebase-admin/firestore';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requireCompleteProfile, requireUser } from '../_lib/authz';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';
import { requireCourseExists, requireInstructorOrPlatform } from '../_lib/courseAccess';
import { emitDomainEvent } from '../_lib/domainEvents';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 20 * 1024;

function sanitizeFeedback(input?: string): string | undefined {
  if (typeof input !== 'string') return undefined;
  let s = input.trim();
  if (!s) return undefined;

  // Strip common HTML/script payloads and tags; store plaintext only.
  s = s.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<[^>]+>/g, '');

  // Remove control chars (except newlines/tabs) and normalize whitespace.
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  s = s.trim();

  return s || undefined;
}

type Body = {
  courseId: string;
  assignmentId: string;
  studentId: string;
  score: number;
  feedback?: string;
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
    const studentId = (body.studentId ?? '').trim();
    const score = Number(body.score);
    const feedback = sanitizeFeedback(body.feedback);

    if (!courseId || !assignmentId || !studentId || !Number.isFinite(score) || score < 0 || score > 1_000_000) {
      return res.status(400).json({ error: 'Invalid payload', requestId: ctx.requestId });
    }
    if (feedback && feedback.length > 20000) {
      return res.status(400).json({ error: 'Invalid feedback', requestId: ctx.requestId });
    }

    await requireInstructorOrPlatform({ courseId, actorUid: caller.uid, actorRole: caller.role });

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    const { courseRef } = await requireCourseExists(courseId);
    const assignmentRef = courseRef.collection('assignments').doc(assignmentId);
    const submissionRef = assignmentRef.collection('submissions').doc(studentId);

    const gradeId = `assignment_${assignmentId}_${studentId}`;
    const gradeRef = courseRef.collection('grades').doc(gradeId);
    const gradebookRef = courseRef.collection('gradebook').doc(studentId);

    const txResult = await db.runTransaction(async (tx) => {
      // Reads first (Firestore transaction constraint)
      const assignmentSnap = await tx.get(assignmentRef);
      if (!assignmentSnap.exists) {
        const err = new Error('Assignment not found');
        (err as any).status = 404;
        throw err;
      }
      const assignment = assignmentSnap.data() as any;
      const pointsPossible = Number(assignment?.pointsPossible ?? 0);
      if (!Number.isFinite(pointsPossible) || pointsPossible < 0) {
        const err = new Error('Invalid assignment pointsPossible');
        (err as any).status = 500;
        throw err;
      }
      if (score > pointsPossible) {
        const err = new Error('Score exceeds pointsPossible');
        (err as any).status = 400;
        throw err;
      }

      const submissionSnap = await tx.get(submissionRef);
      if (!submissionSnap.exists) {
        const err = new Error('Submission not found');
        (err as any).status = 404;
        throw err;
      }
      const submission = submissionSnap.data() as any;

      const gradeSnapBefore = await tx.get(gradeRef);
      const existedBefore = gradeSnapBefore.exists;

      const gradebookSnap = await tx.get(gradebookRef);
      const gb = gradebookSnap.exists ? (gradebookSnap.data() as any) : {};

      const priorGrade = submission?.grade ?? null;
      const priorScore = priorGrade && typeof priorGrade.score === 'number' ? priorGrade.score : null;
      const priorRevision = Number(submission?.gradeRevision ?? 0);
      const nextRevision = Number.isFinite(priorRevision) ? priorRevision + 1 : 1;

      const prevScoreNum = priorScore == null ? 0 : Number(priorScore);
      const deltaScore = score - (Number.isFinite(prevScoreNum) ? prevScoreNum : 0);

      const prevTotalScore = Number(gb?.totalScore ?? 0);
      const nextTotalScore = (Number.isFinite(prevTotalScore) ? prevTotalScore : 0) + deltaScore;

      const prevTotalPossible = Number(gb?.totalPossible ?? 0);
      const nextTotalPossible = (Number.isFinite(prevTotalPossible) ? prevTotalPossible : 0) + (existedBefore ? 0 : pointsPossible);

      // Update submission grade (server-authoritative)
      tx.set(
        submissionRef,
        {
          grade: {
            score,
            feedback,
            gradedAt: FieldValue.serverTimestamp(),
            gradedBy: caller.uid,
          },
          gradeRevision: nextRevision,
          updatedAt: FieldValue.serverTimestamp(),
          updatedAtBy: caller.uid,
        },
        { merge: true }
      );

      // Canonical grade record (deterministic ID)
      tx.set(
        gradeRef,
        {
          studentId,
          sourceType: 'assignment',
          sourceId: assignmentId,
          sourceVersion: Number(submission?.assignmentVersionAtSubmission ?? assignment?.version ?? 1),
          score,
          pointsPossible,
          gradedAt: FieldValue.serverTimestamp(),
          gradedBy: caller.uid,
          gradeRevision: nextRevision,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(
        gradebookRef,
        {
          studentId,
          totalScore: nextTotalScore,
          totalPossible: nextTotalPossible,
          computedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          updatedAtBy: caller.uid,
        },
        { merge: true }
      );

      return {
        pointsPossible,
        before: { score: priorScore, gradeRevision: priorRevision },
        after: { score, gradeRevision: nextRevision },
        gradeId,
      };
    });

    await writeAuditLog({
      action: 'submission.grade.set',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      targetUid: studentId,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: {
        courseId,
        assignmentId,
        gradeId: txResult.gradeId,
        pointsPossible: txResult.pointsPossible,
        before: txResult.before,
        after: txResult.after,
      },
    });

    await emitDomainEvent({
      type: 'grade.mutated',
      courseId,
      actorUid: caller.uid,
      actorRole: caller.role,
      aggregate: { kind: 'grade', id: txResult.gradeId, version: txResult.after.gradeRevision },
      payload: {
        courseId,
        sourceType: 'assignment',
        sourceId: assignmentId,
        studentId,
        before: txResult.before,
        after: txResult.after,
      },
      idempotencyKey: `grade.mutated:assignment:${courseId}:${assignmentId}:${studentId}:r${txResult.after.gradeRevision}`,
      requestId: ctx.requestId,
    });

    return res.status(200).json({ ok: true, ...txResult.after });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
