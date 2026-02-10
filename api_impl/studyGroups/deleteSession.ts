import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requireCompleteProfile, requireUser } from '../_lib/authz';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 10 * 1024;

type DeleteSessionBody = {
  groupId: string;
  sessionId: string;
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
    const body = (req.body || {}) as DeleteSessionBody;

    const groupId = (body.groupId || '').trim();
    const sessionId = (body.sessionId || '').trim();
    if (!groupId) return res.status(400).json({ error: 'groupId is required', requestId: ctx.requestId });
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required', requestId: ctx.requestId });

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

      tx.delete(sessionRef);
    });

    await writeAuditLog({
      action: 'studyGroup.session.delete',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { groupId, sessionId },
    });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
