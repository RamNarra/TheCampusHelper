import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requireUser } from '../_lib/authz';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 25 * 1024;

type CreateSessionBody = {
  groupId: string;
  title: string;
  description?: string;
  scheduledAtMillis: number;
  duration: number;
  videoUrl?: string;
  status?: 'scheduled' | 'active' | 'completed' | 'cancelled';
};

function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
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
    const body = (req.body || {}) as CreateSessionBody;

    const groupId = (body.groupId || '').trim();
    const title = (body.title || '').trim();
    const description = body.description?.trim();
    const scheduledAtMillis = Number(body.scheduledAtMillis);
    const duration = Number(body.duration);
    const status = body.status || 'scheduled';
    const videoUrlRaw = (body.videoUrl || '').trim();
    const videoUrl = videoUrlRaw ? (isHttpUrl(videoUrlRaw) ? videoUrlRaw : '') : '';

    if (!groupId) return res.status(400).json({ error: 'groupId is required', requestId: ctx.requestId });
    if (!title || title.length > 200) return res.status(400).json({ error: 'Invalid title', requestId: ctx.requestId });
    if (!Number.isFinite(scheduledAtMillis) || scheduledAtMillis <= 0) {
      return res.status(400).json({ error: 'Invalid scheduledAtMillis', requestId: ctx.requestId });
    }
    if (!Number.isFinite(duration) || duration <= 0 || duration > 60 * 24) {
      return res.status(400).json({ error: 'Invalid duration', requestId: ctx.requestId });
    }
    if (!['scheduled', 'active', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status', requestId: ctx.requestId });
    }

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    const groupRef = db.collection('studyGroups').doc(groupId);
    const sessionRef = groupRef.collection('sessions').doc();

    await db.runTransaction(async (tx) => {
      const groupSnap = await tx.get(groupRef);
      if (!groupSnap.exists) {
        const err = new Error('Group not found');
        (err as any).status = 404;
        throw err;
      }

      const group = groupSnap.data() as any;
      const admins: string[] = Array.isArray(group?.admins) ? group.admins : [];
      if (!admins.includes(caller.uid)) {
        const err = new Error('Forbidden');
        (err as any).status = 403;
        throw err;
      }

      tx.create(sessionRef, {
        studyGroupId: groupId,
        title,
        description: description || undefined,
        scheduledAt: Timestamp.fromMillis(scheduledAtMillis),
        duration,
        videoUrl: videoUrl || undefined,
        createdBy: caller.uid,
        createdByName: String((group?.createdByName as any) || caller.email || '').slice(0, 80) || 'Admin',
        status,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      } as any);
    });

    await writeAuditLog({
      action: 'studyGroup.session.create',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { groupId, sessionId: sessionRef.id, title, scheduledAtMillis, duration, status },
    });

    return res.status(200).json({ sessionId: sessionRef.id });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
