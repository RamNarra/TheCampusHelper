import { FieldValue } from 'firebase-admin/firestore';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requireUser } from '../_lib/authz';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';
import { requireCourseExists, requireInstructorOrPlatform } from '../_lib/courseAccess';
import { emitDomainEvent } from '../_lib/domainEvents';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 40 * 1024;

type Body = {
  courseId: string;
  title: string;
  description?: string;
  pointsPossible: number;
  dueMillis?: number;
  allowLate?: boolean;
  latePolicy?: { type: 'none' | 'accept_with_penalty'; penaltyPercent?: number };
  submissionSpec?: { type: 'text' | 'link' | 'file_link'; maxBytes?: number };
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
    const title = (body.title ?? '').trim();
    const description = typeof body.description === 'string' ? body.description.trim() : undefined;
    const pointsPossible = Number(body.pointsPossible);
    const dueMillis = body.dueMillis == null ? undefined : Number(body.dueMillis);

    if (!courseId || !title || !Number.isFinite(pointsPossible) || pointsPossible < 0 || pointsPossible > 1_000_000) {
      return res.status(400).json({ error: 'Invalid payload', requestId: ctx.requestId });
    }
    if (title.length > 200) return res.status(400).json({ error: 'Invalid title', requestId: ctx.requestId });
    if (description && description.length > 20000) {
      return res.status(400).json({ error: 'Invalid description', requestId: ctx.requestId });
    }
    if (dueMillis !== undefined && !Number.isFinite(dueMillis)) {
      return res.status(400).json({ error: 'Invalid dueMillis', requestId: ctx.requestId });
    }

    const allowLate = body.allowLate === true;
    const latePolicy = body.latePolicy?.type ? body.latePolicy : { type: 'none' as const };
    if (latePolicy.type !== 'none' && latePolicy.type !== 'accept_with_penalty') {
      return res.status(400).json({ error: 'Invalid latePolicy', requestId: ctx.requestId });
    }
    const penaltyPercent = latePolicy.type === 'accept_with_penalty' ? Number(latePolicy.penaltyPercent ?? 0) : 0;
    if (latePolicy.type === 'accept_with_penalty' && (!Number.isFinite(penaltyPercent) || penaltyPercent < 0 || penaltyPercent > 100)) {
      return res.status(400).json({ error: 'Invalid penaltyPercent', requestId: ctx.requestId });
    }

    const submissionSpec = body.submissionSpec?.type ? body.submissionSpec : { type: 'text' as const };
    if (submissionSpec.type !== 'text' && submissionSpec.type !== 'link' && submissionSpec.type !== 'file_link') {
      return res.status(400).json({ error: 'Invalid submissionSpec', requestId: ctx.requestId });
    }

    await requireInstructorOrPlatform({ courseId, actorUid: caller.uid, actorRole: caller.role });

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    const { courseRef } = await requireCourseExists(courseId);
    const assignmentRef = courseRef.collection('assignments').doc();

    await assignmentRef.create({
      title,
      description: description || undefined,
      status: 'draft',
      dueMillis: dueMillis ?? undefined,
      pointsPossible,
      allowLate,
      latePolicy: latePolicy.type === 'accept_with_penalty' ? { type: 'accept_with_penalty', penaltyPercent } : { type: 'none' },
      submissionSpec: {
        type: submissionSpec.type,
        maxBytes: submissionSpec.maxBytes ?? undefined,
      },
      version: 1,
      createdBy: caller.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await writeAuditLog({
      action: 'assignment.create',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { courseId, assignmentId: assignmentRef.id, title, pointsPossible },
    });

    await emitDomainEvent({
      type: 'assignment.created',
      courseId,
      actorUid: caller.uid,
      actorRole: caller.role,
      aggregate: { kind: 'assignment', id: assignmentRef.id, version: 1 },
      payload: { courseId, assignmentId: assignmentRef.id, title, pointsPossible },
      idempotencyKey: `assignment.created:${courseId}:${assignmentRef.id}:v1`,
      requestId: ctx.requestId,
    });

    return res.status(200).json({ ok: true, assignmentId: assignmentRef.id });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
