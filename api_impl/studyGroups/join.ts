import { FieldValue } from 'firebase-admin/firestore';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requireCompleteProfile, requireUser } from '../_lib/authz';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 10 * 1024;

type JoinBody = { groupId: string };

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
    const body = (req.body || {}) as JoinBody;
    const groupId = (body.groupId || '').trim();
    if (!groupId) return res.status(400).json({ error: 'groupId is required', requestId: ctx.requestId });

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    const groupRef = db.collection('studyGroups').doc(groupId);
    const userRef = db.collection('users').doc(caller.uid);

    await db.runTransaction(async (tx) => {
      const [groupSnap, userSnap] = await Promise.all([tx.get(groupRef), tx.get(userRef)]);
      if (!groupSnap.exists) {
        const err = new Error('Group not found');
        (err as any).status = 404;
        throw err;
      }

      const group = groupSnap.data() as any;
      if (group?.isPrivate === true) {
        const err = new Error('Cannot join a private group directly');
        (err as any).status = 403;
        throw err;
      }

      const members: string[] = Array.isArray(group?.members) ? group.members : [];
      if (members.includes(caller.uid)) return;

      const maxMembers = typeof group?.maxMembers === 'number' ? group.maxMembers : 200;
      if (members.length + 1 > maxMembers) {
        const err = new Error('Group is full');
        (err as any).status = 409;
        throw err;
      }

      const visibleToYears: string[] = Array.isArray(group?.visibleToYears) ? group.visibleToYears : [];
      if (visibleToYears.length > 0) {
        const userYear = userSnap.exists ? String((userSnap.data() as any)?.year || '').trim() : '';
        if (!userYear || !visibleToYears.includes(userYear)) {
          const err = new Error('Forbidden');
          (err as any).status = 403;
          throw err;
        }
      }

      tx.update(groupRef, {
        members: [...members, caller.uid],
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await writeAuditLog({
      action: 'studyGroup.join',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { groupId },
    });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
