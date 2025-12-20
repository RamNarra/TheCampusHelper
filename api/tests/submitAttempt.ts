import { FieldValue } from 'firebase-admin/firestore';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requireUser } from '../_lib/authz';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';
import { requireActiveEnrollmentOrPlatform, requireCourseExists } from '../_lib/courseAccess';
import { emitDomainEvent } from '../_lib/domainEvents';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 80 * 1024;

type Body = {
  courseId: string;
  testId: string;
  attemptId: string;
  answers: Record<string, string>; // questionId -> optionId
};

type VersionQuestion = {
  id: string;
  type: 'mcq';
  correctOptionId: string;
  points: number;
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
    const testId = (body.testId ?? '').trim();
    const attemptId = (body.attemptId ?? '').trim();
    const answers = body.answers && typeof body.answers === 'object' ? body.answers : {};

    if (!courseId || !testId || !attemptId) {
      return res.status(400).json({ error: 'Invalid payload', requestId: ctx.requestId });
    }

    await requireActiveEnrollmentOrPlatform({ courseId, actorUid: caller.uid, actorRole: caller.role });

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    const nowMillis = Date.now();

    const { courseRef } = await requireCourseExists(courseId);
    const testRef = courseRef.collection('tests').doc(testId);
    const attemptRef = testRef.collection('attempts').doc(attemptId);

    const txResult = await db.runTransaction(async (tx) => {
      const [testSnap, attemptSnapTx] = await Promise.all([tx.get(testRef), tx.get(attemptRef)]);
      if (!testSnap.exists) {
        const err = new Error('Test not found');
        (err as any).status = 404;
        throw err;
      }
      if (!attemptSnapTx.exists) {
        const err = new Error('Attempt not found');
        (err as any).status = 404;
        throw err;
      }

      const test = testSnap.data() as any;
      const attempt = attemptSnapTx.data() as any;

      if (attempt?.userId !== caller.uid) {
        const err = new Error('Forbidden');
        (err as any).status = 403;
        throw err;
      }

      if (String(attempt?.status ?? '') !== 'started') {
        const err = new Error('Attempt is not active');
        (err as any).status = 409;
        throw err;
      }

      const expiresAtMillis = Number(attempt?.expiresAtMillis ?? 0);
      if (!Number.isFinite(expiresAtMillis) || nowMillis > expiresAtMillis) {
        const err = new Error('Attempt expired');
        (err as any).status = 409;
        throw err;
      }

      const testVersion = Number(attempt?.testVersion ?? 1);
      const formSnapshot = Array.isArray(attempt?.formSnapshot) ? (attempt.formSnapshot as any[]) : [];
      if (!Number.isFinite(testVersion) || formSnapshot.length === 0) {
        const err = new Error('Invalid attempt state');
        (err as any).status = 500;
        throw err;
      }

      const versionRef = testRef.collection('versions').doc(String(testVersion));
      const versionSnap = await tx.get(versionRef);
      if (!versionSnap.exists) {
        const err = new Error('Test version not found');
        (err as any).status = 500;
        throw err;
      }

      const version = versionSnap.data() as any;
      const questions = (Array.isArray(version?.questions) ? version.questions : []) as VersionQuestion[];
      const questionById = new Map<string, VersionQuestion>();
      for (const q of questions) {
        if (q && typeof q.id === 'string') questionById.set(String(q.id), q);
      }

      let score = 0;
      const breakdown: Array<{ questionId: string; correct: boolean; pointsAwarded: number }> = [];
      const answersSnapshot: Record<string, string> = {};

      for (const entry of formSnapshot) {
        const qid = String(entry?.questionId ?? '').trim();
        if (!qid) continue;

        const q = questionById.get(qid);
        if (!q) continue;

        const allowedOptionIds = Array.isArray(entry?.optionIds) ? entry.optionIds.map((x: any) => String(x)) : [];
        const selected = typeof answers[qid] === 'string' ? answers[qid].trim() : '';
        const selectedAllowed = selected && allowedOptionIds.includes(selected);

        if (selectedAllowed) answersSnapshot[qid] = selected;

        const correct = selectedAllowed && selected === String(q.correctOptionId);
        const pts = Number(q.points ?? 1);
        const awarded = correct ? (Number.isFinite(pts) ? pts : 1) : 0;
        score += awarded;
        breakdown.push({ questionId: qid, correct, pointsAwarded: awarded });
      }

      const pointsPossible = Number(test?.pointsPossible ?? score);
      const isAssessed = test?.isAssessed === true || test?.mode === 'scheduled';

      const gradeId = `test_${testId}_${caller.uid}`;
      const gradeRef = courseRef.collection('grades').doc(gradeId);
      const gradebookRef = courseRef.collection('gradebook').doc(caller.uid);

      const gradeSnapBefore = isAssessed ? await tx.get(gradeRef) : null;
      const gradebookSnap = isAssessed ? await tx.get(gradebookRef) : null;
      const gb = gradebookSnap && gradebookSnap.exists ? (gradebookSnap.data() as any) : {};

      tx.set(
        attemptRef,
        {
          status: 'graded',
          submittedAt: FieldValue.serverTimestamp(),
          answersSnapshot,
          score,
          breakdown,
          gradedAt: FieldValue.serverTimestamp(),
          gradedBy: 'system',
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      let gradeRevision = 0;
      if (isAssessed) {
        const existedBefore = !!gradeSnapBefore?.exists;
        const priorRevision = existedBefore ? Number((gradeSnapBefore!.data() as any)?.gradeRevision ?? 0) : 0;
        gradeRevision = Number.isFinite(priorRevision) ? priorRevision + 1 : 1;

        const prevScore = existedBefore ? Number((gradeSnapBefore!.data() as any)?.score ?? 0) : 0;
        const deltaScore = score - (Number.isFinite(prevScore) ? prevScore : 0);

        const prevTotalScore = Number(gb?.totalScore ?? 0);
        const nextTotalScore = (Number.isFinite(prevTotalScore) ? prevTotalScore : 0) + deltaScore;

        const prevTotalPossible = Number(gb?.totalPossible ?? 0);
        const nextTotalPossible = (Number.isFinite(prevTotalPossible) ? prevTotalPossible : 0) + (existedBefore ? 0 : pointsPossible);

        tx.set(
          gradeRef,
          {
            studentId: caller.uid,
            sourceType: 'test',
            sourceId: testId,
            sourceVersion: testVersion,
            score,
            pointsPossible,
            gradedAt: FieldValue.serverTimestamp(),
            gradedBy: 'system',
            gradeRevision,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        tx.set(
          gradebookRef,
          {
            studentId: caller.uid,
            totalScore: nextTotalScore,
            totalPossible: nextTotalPossible,
            computedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            updatedAtBy: 'system',
          },
          { merge: true }
        );
      }

      return {
        score,
        pointsPossible,
        isAssessed,
        gradeId: isAssessed ? gradeId : null,
        gradeRevision: isAssessed ? gradeRevision : null,
        testVersion,
      };
    });

    await writeAuditLog({
      action: 'test.attempt.submit',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: {
        courseId,
        testId,
        attemptId,
        testVersion: txResult.testVersion,
        score: txResult.score,
        pointsPossible: txResult.pointsPossible,
        isAssessed: txResult.isAssessed,
        gradeId: txResult.gradeId,
        gradeRevision: txResult.gradeRevision,
      },
    });

    await emitDomainEvent({
      type: 'test.attempt.submitted',
      courseId,
      actorUid: caller.uid,
      actorRole: caller.role,
      aggregate: { kind: 'attempt', id: attemptId, version: txResult.testVersion },
      payload: { courseId, testId, attemptId, testVersion: txResult.testVersion, score: txResult.score },
      idempotencyKey: `test.attempt.submitted:${courseId}:${testId}:${attemptId}:v${txResult.testVersion}`,
      requestId: ctx.requestId,
    });

    if (txResult.isAssessed && txResult.gradeId && txResult.gradeRevision != null) {
      await emitDomainEvent({
        type: 'grade.mutated',
        courseId,
        actorUid: caller.uid,
        actorRole: caller.role,
        aggregate: { kind: 'grade', id: txResult.gradeId, version: txResult.gradeRevision },
        payload: {
          courseId,
          sourceType: 'test',
          sourceId: testId,
          studentId: caller.uid,
          score: txResult.score,
          pointsPossible: txResult.pointsPossible,
        },
        idempotencyKey: `grade.mutated:test:${courseId}:${testId}:${caller.uid}:r${txResult.gradeRevision}`,
        requestId: ctx.requestId,
      });
    }

    return res.status(200).json({ ok: true, score: txResult.score, pointsPossible: txResult.pointsPossible, isAssessed: txResult.isAssessed });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
