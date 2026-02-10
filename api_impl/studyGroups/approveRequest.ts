import { FieldValue } from 'firebase-admin/firestore';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requireCompleteProfile, requirePermission, requireUser } from '../_lib/authz';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 10 * 1024;

type ApproveBody = { requestId: string };

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
    // Reuse existing staff permission (moderators/admins/super_admin).
    requirePermission(caller, 'resources.moderate');

    const body = (req.body || {}) as ApproveBody;
    const requestId = (body.requestId || '').trim();
    if (!requestId) return res.status(400).json({ error: 'requestId is required', requestId: ctx.requestId });

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    const reqRef = db.collection('studyGroupRequests').doc(requestId);
    const groupRef = db.collection('studyGroups').doc();

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

      const requestedBy = String(reqData.requestedBy || '').trim();
      const requestedByName = String(reqData.requestedByName || '').trim();
      const name = String(reqData.name || '').trim();
      const subject = String(reqData.subject || '').trim();
      const purpose = String(reqData.purpose || '').trim();
      const visibleToYears = Array.isArray(reqData.visibleToYears) ? reqData.visibleToYears : [];

      if (!requestedBy || !name || !subject) {
        const err = new Error('Invalid request payload');
        (err as any).status = 400;
        throw err;
      }

      tx.create(groupRef, {
        name,
        subject,
        description: purpose || undefined,
        members: [requestedBy],
        admins: [requestedBy],
        createdBy: requestedBy,
        createdByName: requestedByName || undefined,
        isPrivate: false,
        visibleToYears,
        maxMembers: 200,
        createdAt: FieldValue.serverTimestamp(),
      });

      tx.update(reqRef, {
        status: 'approved',
        reviewedBy: caller.uid,
        reviewedAt: FieldValue.serverTimestamp(),
        approvedGroupId: groupRef.id,
      });
    });

    await writeAuditLog({
      action: 'studyGroup.request.approve',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { requestId },
    });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
