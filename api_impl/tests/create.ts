import { FieldValue } from 'firebase-admin/firestore';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requireCompleteProfile, requireUser } from '../_lib/authz';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';
import { requireCourseExists, requireInstructorOrPlatform } from '../_lib/courseAccess';
import { emitDomainEvent } from '../_lib/domainEvents';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 120 * 1024;

type Question = {
  id: string;
  type: 'mcq';
  prompt: string;
  options: Array<{ id: string; text: string }>;
  correctOptionId: string;
  points: number;
};

type Body = {
  courseId: string;
  title: string;
  description?: string;
  mode: 'scheduled' | 'practice';
  windowStartMillis?: number;
  windowEndMillis?: number;
  durationMinutes?: number;
  attemptsAllowed?: number;
  shuffle?: boolean;
  isAssessed?: boolean;
  questions?: Question[];
};

function normalizeQuestions(input: unknown): { questions: Question[]; pointsPossible: number } {
  const list = Array.isArray(input) ? (input as any[]) : [];
  const questions: Question[] = [];

  let total = 0;
  for (const raw of list) {
    const id = typeof raw?.id === 'string' ? raw.id.trim() : '';
    const type = raw?.type;
    const prompt = typeof raw?.prompt === 'string' ? raw.prompt.trim() : '';
    const points = Number(raw?.points ?? 1);
    const optionsRaw: any[] = Array.isArray(raw?.options) ? raw.options : [];
    const options: Array<{ id: string; text: string }> = optionsRaw
      .map((o: any) => ({
        id: typeof o?.id === 'string' ? o.id.trim() : '',
        text: typeof o?.text === 'string' ? o.text.trim() : '',
      }))
      .filter((o) => o.id && o.text)
      .slice(0, 10);

    const correctOptionId = typeof raw?.correctOptionId === 'string' ? raw.correctOptionId.trim() : '';

    if (!id || id.length > 80) continue;
    if (type !== 'mcq') continue;
    if (!prompt || prompt.length > 5000) continue;
    if (!Number.isFinite(points) || points <= 0 || points > 1000) continue;
    if (options.length < 2) continue;
    if (!options.some((o) => o.id === correctOptionId)) continue;

    total += points;
    questions.push({ id, type, prompt, options, correctOptionId, points });
  }

  if (questions.length > 200) {
    return { questions: questions.slice(0, 200), pointsPossible: total };
  }

  return { questions, pointsPossible: total };
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
    const title = (body.title ?? '').trim();
    const description = typeof body.description === 'string' ? body.description.trim() : undefined;
    const mode = body.mode;

    if (!courseId || !title || (mode !== 'scheduled' && mode !== 'practice')) {
      return res.status(400).json({ error: 'Invalid payload', requestId: ctx.requestId });
    }
    if (title.length > 200) return res.status(400).json({ error: 'Invalid title', requestId: ctx.requestId });
    if (description && description.length > 20000) {
      return res.status(400).json({ error: 'Invalid description', requestId: ctx.requestId });
    }

    const windowStartMillis = body.windowStartMillis == null ? undefined : Number(body.windowStartMillis);
    const windowEndMillis = body.windowEndMillis == null ? undefined : Number(body.windowEndMillis);
    const durationMinutes = body.durationMinutes == null ? undefined : Number(body.durationMinutes);

    if (mode === 'scheduled') {
      if (!Number.isFinite(windowStartMillis) || !Number.isFinite(windowEndMillis) || !Number.isFinite(durationMinutes)) {
        return res.status(400).json({ error: 'Scheduled tests require windowStartMillis, windowEndMillis, durationMinutes', requestId: ctx.requestId });
      }
      if ((windowEndMillis as number) <= (windowStartMillis as number)) {
        return res.status(400).json({ error: 'Invalid test window', requestId: ctx.requestId });
      }
      if ((durationMinutes as number) <= 0 || (durationMinutes as number) > 24 * 60) {
        return res.status(400).json({ error: 'Invalid durationMinutes', requestId: ctx.requestId });
      }
    }

    const attemptsAllowed = Number(body.attemptsAllowed ?? 1);
    if (!Number.isFinite(attemptsAllowed) || attemptsAllowed < 1 || attemptsAllowed > 10) {
      return res.status(400).json({ error: 'Invalid attemptsAllowed', requestId: ctx.requestId });
    }

    const shuffle = body.shuffle !== false;
    const isAssessed = mode === 'scheduled' ? true : body.isAssessed === true;

    const { questions, pointsPossible } = normalizeQuestions(body.questions);

    await requireInstructorOrPlatform({ courseId, actorUid: caller.uid, actorRole: caller.role });

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    const { courseRef } = await requireCourseExists(courseId);
    const testRef = courseRef.collection('tests').doc();
    const versionRef = testRef.collection('versions').doc('1');

    await db.runTransaction(async (tx) => {
      tx.create(testRef, {
        title,
        description: description || undefined,
        mode,
        status: 'draft',
        windowStartMillis: windowStartMillis ?? undefined,
        windowEndMillis: windowEndMillis ?? undefined,
        durationMinutes: durationMinutes ?? undefined,
        attemptsAllowed,
        shuffle,
        isAssessed,
        pointsPossible,
        activeVersion: 1,
        createdBy: caller.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.create(versionRef, {
        schemaVersion: 1,
        questions,
        createdBy: caller.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    await writeAuditLog({
      action: 'test.create',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { courseId, testId: testRef.id, mode, pointsPossible, questionCount: questions.length },
    });

    await emitDomainEvent({
      type: 'test.created',
      courseId,
      actorUid: caller.uid,
      actorRole: caller.role,
      aggregate: { kind: 'test', id: testRef.id, version: 1 },
      payload: { courseId, testId: testRef.id, mode, pointsPossible },
      idempotencyKey: `test.created:${courseId}:${testRef.id}:v1`,
      requestId: ctx.requestId,
    });

    return res.status(200).json({ ok: true, testId: testRef.id });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
