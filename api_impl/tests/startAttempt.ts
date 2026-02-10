import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requireCompleteProfile, requireUser } from '../_lib/authz';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';
import { requireActiveEnrollmentOrPlatform, requireCourseExists } from '../_lib/courseAccess';
import { emitDomainEvent } from '../_lib/domainEvents';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 10 * 1024;
const MAX_EXISTING_ATTEMPTS_SCAN = 25;

type Body = {
  courseId: string;
  testId: string;
};

type VersionQuestion = {
  id: string;
  type: 'mcq';
  prompt: string;
  options: Array<{ id: string; text: string }>;
  correctOptionId: string;
  points: number;
};

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(s: string): number {
  const h = crypto.createHash('sha256').update(s).digest();
  // use first 4 bytes as uint32
  return h.readUInt32LE(0);
}

function shuffleInPlace<T>(arr: T[], rng: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

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

    await requireActiveEnrollmentOrPlatform({ courseId, actorUid: caller.uid, actorRole: caller.role });

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    const { courseRef } = await requireCourseExists(courseId);
    const testRef = courseRef.collection('tests').doc(testId);

    const nowMillis = Date.now();

    const txResult = await db.runTransaction(async (tx) => {
      const testSnap = await tx.get(testRef);
      if (!testSnap.exists) {
        const err = new Error('Test not found');
        (err as any).status = 404;
        throw err;
      }

      const test = testSnap.data() as any;
      const status = String(test?.status ?? 'draft');
      if (status !== 'published') {
        const err = new Error('Test is not published');
        (err as any).status = 409;
        throw err;
      }

      const mode = test?.mode === 'scheduled' ? 'scheduled' : 'practice';
      const attemptsAllowed = Number(test?.attemptsAllowed ?? 1);
      const durationMinutes = Number(test?.durationMinutes ?? 0);
      const activeVersion = Number(test?.activeVersion ?? 1);
      const shuffle = test?.shuffle !== false;

      const windowStartMillis = typeof test?.windowStartMillis === 'number' ? test.windowStartMillis : undefined;
      const windowEndMillis = typeof test?.windowEndMillis === 'number' ? test.windowEndMillis : undefined;

      if (!Number.isFinite(attemptsAllowed) || attemptsAllowed < 1 || attemptsAllowed > 10) {
        const err = new Error('Invalid attemptsAllowed');
        (err as any).status = 500;
        throw err;
      }

      if (mode === 'scheduled') {
        if (!Number.isFinite(windowStartMillis) || !Number.isFinite(windowEndMillis) || !Number.isFinite(durationMinutes)) {
          const err = new Error('Invalid scheduled test configuration');
          (err as any).status = 500;
          throw err;
        }
        if (nowMillis < (windowStartMillis as number) || nowMillis > (windowEndMillis as number)) {
          const err = new Error('Test window is not open');
          (err as any).status = 409;
          throw err;
        }
        if (durationMinutes <= 0 || durationMinutes > 24 * 60) {
          const err = new Error('Invalid durationMinutes');
          (err as any).status = 500;
          throw err;
        }
      }

      // Enforce attemptsAllowed atomically inside transaction.
      const attemptsQuery = testRef
        .collection('attempts')
        .where('userId', '==', caller.uid)
        .limit(MAX_EXISTING_ATTEMPTS_SCAN);
      const attemptsSnap = await tx.get(attemptsQuery);
      const attemptsUsed = attemptsSnap.size;

      if (attemptsUsed >= attemptsAllowed) {
        const err = new Error('No remaining attempts');
        (err as any).status = 409;
        throw err;
      }

      const attemptNo = attemptsUsed + 1;
      const attemptId = `${caller.uid}__${attemptNo}`;
      const attemptRef = testRef.collection('attempts').doc(attemptId);

      // Load secure version content (server-side only)
      const versionRef = testRef.collection('versions').doc(String(activeVersion));
      const versionSnap = await tx.get(versionRef);
      if (!versionSnap.exists) {
        const err = new Error('Test version not found');
        (err as any).status = 500;
        throw err;
      }

      const version = versionSnap.data() as any;
      const questions = (Array.isArray(version?.questions) ? version.questions : []) as VersionQuestion[];
      if (questions.length === 0) {
        const err = new Error('Test has no questions');
        (err as any).status = 409;
        throw err;
      }

      const formSeed = crypto.randomBytes(16).toString('hex');
      const rng = mulberry32(seedFromString(`${formSeed}:${testId}:${attemptId}:${activeVersion}`));

      const servedQuestions = questions.map((q) => ({
        id: String(q.id),
        prompt: String(q.prompt ?? ''),
        points: Number(q.points ?? 1),
        options: Array.isArray(q.options) ? q.options.map((o) => ({ id: String(o.id), text: String(o.text) })) : [],
      }));

      if (shuffle) {
        shuffleInPlace(servedQuestions, rng);
        for (const q of servedQuestions) {
          shuffleInPlace(q.options, rng);
        }
      }

      const formSnapshot = servedQuestions.map((q) => ({
        questionId: q.id,
        optionIds: q.options.map((o) => o.id),
      }));

      const expiresAtMillis =
        mode === 'scheduled'
          ? nowMillis + durationMinutes * 60 * 1000
          : nowMillis + 7 * 24 * 60 * 60 * 1000;

      tx.create(attemptRef, {
        userId: caller.uid,
        attemptNo,
        status: 'started',
        startedAt: FieldValue.serverTimestamp(),
        expiresAtMillis,
        testVersion: activeVersion,
        formSeed,
        formSnapshot,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: caller.uid,
      });

      return {
        attemptId,
        attemptNo,
        expiresAtMillis,
        test: {
          testId,
          title: String(test?.title ?? ''),
          mode,
          durationMinutes: mode === 'scheduled' ? durationMinutes : null,
          pointsPossible: Number(test?.pointsPossible ?? null),
        },
        servedQuestions,
        testVersion: activeVersion,
      };
    });

    await writeAuditLog({
      action: 'test.attempt.start',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: {
        courseId,
        testId,
        attemptId: txResult.attemptId,
        attemptNo: txResult.attemptNo,
        testVersion: txResult.testVersion,
        expiresAtMillis: txResult.expiresAtMillis,
      },
    });

    await emitDomainEvent({
      type: 'test.attempt.started',
      courseId,
      actorUid: caller.uid,
      actorRole: caller.role,
      aggregate: { kind: 'attempt', id: txResult.attemptId, version: txResult.testVersion },
      payload: {
        courseId,
        testId,
        attemptId: txResult.attemptId,
        attemptNo: txResult.attemptNo,
        testVersion: txResult.testVersion,
      },
      idempotencyKey: `test.attempt.started:${courseId}:${testId}:${txResult.attemptId}:v${txResult.testVersion}`,
      requestId: ctx.requestId,
    });

    return res.status(200).json({
      ok: true,
      attemptId: txResult.attemptId,
      expiresAtMillis: txResult.expiresAtMillis,
      test: txResult.test,
      form: {
        questions: txResult.servedQuestions,
      },
    });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
