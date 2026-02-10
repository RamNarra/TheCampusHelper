import { FieldValue } from 'firebase-admin/firestore';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requireCompleteProfile, requireUser } from '../_lib/authz';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';
import { requireCourseExists, requireInstructorOrPlatform } from '../_lib/courseAccess';
import { emitDomainEvent } from '../_lib/domainEvents';
import { isHttpUrl } from '../_lib/sanitize';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 30 * 1024;

type Body = {
  courseId: string;
  type: 'announcement' | 'resource_link' | 'generic';
  title: string;
  body?: string;
  attachments?: string[];
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
    const type = body.type;
    const title = (body.title ?? '').trim();
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    const attachmentsRaw = Array.isArray(body.attachments) ? body.attachments : [];

    if (!courseId || !type || !title) {
      return res.status(400).json({ error: 'Invalid payload', requestId: ctx.requestId });
    }
    if (title.length > 200) {
      return res.status(400).json({ error: 'Invalid title', requestId: ctx.requestId });
    }
    if (text.length > 20000) {
      return res.status(400).json({ error: 'Invalid body', requestId: ctx.requestId });
    }

    const attachments = attachmentsRaw
      .map((a) => (typeof a === 'string' ? a.trim() : ''))
      .filter((a) => a && isHttpUrl(a))
      .slice(0, 10);

    await requireInstructorOrPlatform({ courseId, actorUid: caller.uid, actorRole: caller.role });

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    const { courseRef, course } = await requireCourseExists(courseId);

    const streamEnabled = course?.streamEnabled;
    if (streamEnabled === false) {
      return res.status(409).json({ error: 'Course stream is disabled', requestId: ctx.requestId });
    }

    const postRef = courseRef.collection('stream').doc();

    await postRef.create({
      type,
      title,
      body: text || undefined,
      attachments,
      visibility: 'enrolled',
      createdBy: caller.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await writeAuditLog({
      action: 'course.stream.post.create',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { courseId, postId: postRef.id, type, title },
    });

    await emitDomainEvent({
      type: 'course.stream.post.created',
      courseId,
      actorUid: caller.uid,
      actorRole: caller.role,
      aggregate: { kind: 'streamPost', id: postRef.id },
      payload: { courseId, postId: postRef.id, type, title },
      idempotencyKey: `course.stream.post.created:${courseId}:${postRef.id}`,
      requestId: ctx.requestId,
    });

    return res.status(200).json({ ok: true, postId: postRef.id });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
