import { FieldValue } from 'firebase-admin/firestore';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requireCompleteProfile, requirePermission, requireUser } from '../_lib/authz';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 15 * 1024;

type SetStatusBody = {
  resourceId: string;
  status: 'approved' | 'rejected' | 'pending';
  rejectionReason?: string;
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
    requirePermission(caller, 'resources.moderate');

    const body = (req.body || {}) as SetStatusBody;
    const resourceId = (body.resourceId || '').trim();
    const status = body.status;
    const rejectionReason = (body.rejectionReason || '').trim();

    if (!resourceId) return res.status(400).json({ error: 'resourceId is required', requestId: ctx.requestId });
    if (status !== 'approved' && status !== 'rejected' && status !== 'pending') {
      return res.status(400).json({ error: 'Invalid status', requestId: ctx.requestId });
    }

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    const ref = db.collection('resources').doc(resourceId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Resource not found', requestId: ctx.requestId });

    await ref.update({
      status,
      reviewedBy: status === 'approved' || status === 'rejected' ? caller.uid : null,
      reviewedAt: status === 'approved' || status === 'rejected' ? FieldValue.serverTimestamp() : null,
      rejectionReason: status === 'rejected' ? rejectionReason : null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await writeAuditLog({
      action: 'resource.status.set',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { resourceId, status, rejectionReason: status === 'rejected' ? rejectionReason : null },
    });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
