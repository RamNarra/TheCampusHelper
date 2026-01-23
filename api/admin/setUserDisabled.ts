import { FieldValue } from 'firebase-admin/firestore';
import { rateLimitExceeded } from '../../lib/rateLimit';
import { applyCors, isOriginAllowed } from '../../api_impl/_lib/cors';
import { ensureFirebaseAdminApp } from '../../api_impl/_lib/firebaseAdmin';
import { requireUser, requirePermission, assertBodySize, assertJson } from '../../api_impl/_lib/authz';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../../api_impl/_lib/request';
import { writeAuditLog } from '../../api_impl/_lib/auditLog';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 20 * 1024; // 20KB

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
    requirePermission(caller, 'users.manage_status');

    const limiterKey = `admin:setUserDisabled:${caller.uid}`;
    if (await rateLimitExceeded(limiterKey)) {
      return res.status(429).json({ error: 'Too Many Requests' });
    }

    const { targetUid, disabled } = req.body || {};
    if (!targetUid || typeof targetUid !== 'string' || targetUid.length < 4) {
      return res.status(400).json({ error: 'Invalid targetUid' });
    }
    if (typeof disabled !== 'boolean') {
      return res.status(400).json({ error: 'Invalid disabled flag' });
    }

    const admin = ensureFirebaseAdminApp();

    // Prevent self-lockout.
    if (caller.uid === targetUid && disabled) {
      return res.status(400).json({ error: 'Cannot disable self' });
    }

    const target = await admin.auth().getUser(targetUid);

    // Enforce disable at Firebase Auth layer.
    await admin.auth().updateUser(targetUid, { disabled });
    // When disabling, revoke refresh tokens so `verifyIdToken(..., true)` rejects existing sessions.
    if (disabled) {
      try {
        await admin.auth().revokeRefreshTokens(targetUid);
      } catch (e) {
        console.error(`[${ctx.requestId}] revokeRefreshTokens failed:`, e);
      }
    }

    const db = admin.firestore();
    await db
      .collection('users')
      .doc(targetUid)
      .set({ disabled, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    await writeAuditLog({
      action: 'user.disabled.set',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      targetUid,
      targetEmail: target.email?.toLowerCase() || null,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { disabled },
    });

    return res.status(200).json({ ok: true, disabled });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
