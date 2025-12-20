import { FieldValue } from 'firebase-admin/firestore';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requirePermission, requireUser } from '../_lib/authz';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 10 * 1024;

type RejectBody = { requestId: string; reason?: string };

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
    requirePermission(caller, 'resources.moderate');

    const body = (req.body || {}) as RejectBody;
    const requestId = (body.requestId || '').trim();
    const reason = (body.reason || '').toString().slice(0, 500);

    if (!requestId) return res.status(400).json({ error: 'requestId is required', requestId: ctx.requestId });

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    const reqRef = db.collection('studyGroupRequests').doc(requestId);
    await db.runTransaction(async (tx) => {
      const reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists) {
        const err = new Error('Request not found');
        (err as any).status = 404;
        throw err;
      }

      const reqData = reqSnap.data() as any;
      if ((reqData?.status || 'pending') !== 'pending') {
        const err = new Error('Request is not pending');
        (err as any).status = 409;
        throw err;
      }

      tx.update(reqRef, {
        status: 'rejected',
        rejectionReason: reason,
        reviewedBy: caller.uid,
        reviewedAt: FieldValue.serverTimestamp(),
      });
    });

    await writeAuditLog({
      action: 'studyGroup.request.reject',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { requestId, reason: reason || null },
    });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
