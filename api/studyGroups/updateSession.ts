import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requireUser } from '../_lib/authz';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 25 * 1024;

type UpdateSessionBody = {
  groupId: string;
  sessionId: string;
  title?: string;
  description?: string;
  scheduledAtMillis?: number;
  duration?: number;
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
    const body = (req.body || {}) as UpdateSessionBody;

    const groupId = (body.groupId || '').trim();
    const sessionId = (body.sessionId || '').trim();
    if (!groupId) return res.status(400).json({ error: 'groupId is required', requestId: ctx.requestId });
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required', requestId: ctx.requestId });

    const patch: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() };

    if (body.title !== undefined) {
      const t = (body.title || '').trim();
      if (!t || t.length > 200) return res.status(400).json({ error: 'Invalid title', requestId: ctx.requestId });
      patch.title = t;
    }

    if (body.description !== undefined) {
      const d = (body.description || '').trim();
      if (d.length > 2000) return res.status(400).json({ error: 'Invalid description', requestId: ctx.requestId });
      patch.description = d || undefined;
    }

    if (body.scheduledAtMillis !== undefined) {
      const ms = Number(body.scheduledAtMillis);
      if (!Number.isFinite(ms) || ms <= 0) return res.status(400).json({ error: 'Invalid scheduledAtMillis', requestId: ctx.requestId });
      patch.scheduledAt = Timestamp.fromMillis(ms);
    }

    if (body.duration !== undefined) {
      const duration = Number(body.duration);
      if (!Number.isFinite(duration) || duration <= 0 || duration > 60 * 24) {
        return res.status(400).json({ error: 'Invalid duration', requestId: ctx.requestId });
      }
      patch.duration = duration;
    }

    if (body.status !== undefined) {
      if (!['scheduled', 'active', 'completed', 'cancelled'].includes(body.status)) {
        return res.status(400).json({ error: 'Invalid status', requestId: ctx.requestId });
      }
      patch.status = body.status;
    }

    if (body.videoUrl !== undefined) {
      const raw = (body.videoUrl || '').trim();
      patch.videoUrl = raw ? (isHttpUrl(raw) ? raw : undefined) : undefined;
    }

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    const groupRef = db.collection('studyGroups').doc(groupId);
    const sessionRef = groupRef.collection('sessions').doc(sessionId);

    await db.runTransaction(async (tx) => {
      const [groupSnap, sessionSnap] = await Promise.all([tx.get(groupRef), tx.get(sessionRef)]);
      if (!groupSnap.exists) {
        const err = new Error('Group not found');
        (err as any).status = 404;
        throw err;
      }
      if (!sessionSnap.exists) {
        const err = new Error('Session not found');
        (err as any).status = 404;
        throw err;
      }

      const group = groupSnap.data() as any;
      const admins: string[] = Array.isArray(group?.admins) ? group.admins : [];
      const session = sessionSnap.data() as any;
      const createdBy = String(session?.createdBy || '').trim();

      if (!admins.includes(caller.uid) && createdBy !== caller.uid) {
        const err = new Error('Forbidden');
        (err as any).status = 403;
        throw err;
      }

      // Immutable linkage
      if (String(session?.studyGroupId || '').trim() !== groupId) {
        const err = new Error('Invalid session payload');
        (err as any).status = 409;
        throw err;
      }

      tx.update(sessionRef, patch);
    });

    await writeAuditLog({
      action: 'studyGroup.session.update',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { groupId, sessionId, fields: Object.keys(patch).filter((k) => k !== 'updatedAt') },
    });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
