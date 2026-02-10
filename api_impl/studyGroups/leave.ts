import { FieldValue } from 'firebase-admin/firestore';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requireCompleteProfile, requireUser } from '../_lib/authz';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 10 * 1024;

type LeaveBody = { groupId: string };

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
    const body = (req.body || {}) as LeaveBody;
    const groupId = (body.groupId || '').trim();
    if (!groupId) return res.status(400).json({ error: 'groupId is required', requestId: ctx.requestId });

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    const groupRef = db.collection('studyGroups').doc(groupId);

    await db.runTransaction(async (tx) => {
      const groupSnap = await tx.get(groupRef);
      if (!groupSnap.exists) {
        const err = new Error('Group not found');
        (err as any).status = 404;
        throw err;
      }

      const group = groupSnap.data() as any;
      const members: string[] = Array.isArray(group?.members) ? group.members : [];
      if (!members.includes(caller.uid)) return;

      tx.update(groupRef, {
        members: members.filter((m) => m !== caller.uid),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await writeAuditLog({
      action: 'studyGroup.leave',
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
