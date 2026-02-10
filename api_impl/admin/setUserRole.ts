import { Buffer } from 'buffer';
import { FieldValue } from 'firebase-admin/firestore';
import { rateLimitExceeded } from '../../lib/rateLimit';
import { canAssignRole, normalizeRole } from '../../lib/rbac';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { requireUser, requireCompleteProfile, requirePermission, assertBodySize, assertJson } from '../_lib/authz';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';

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
    await requireCompleteProfile(caller);
    requirePermission(caller, 'users.manage_roles');

    // Rate limit: prevent abuse of role flips.
    const limiterKey = `admin:setUserRole:${caller.uid}`;
    if (await rateLimitExceeded(limiterKey)) {
      return res.status(429).json({ error: 'Too Many Requests' });
    }

    const { targetUid, role } = req.body || {};
    if (!targetUid || typeof targetUid !== 'string' || targetUid.length < 4) {
      return res.status(400).json({ error: 'Invalid targetUid' });
    }
    if (!role || typeof role !== 'string') {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const admin = ensureFirebaseAdminApp();

    const target = await admin.auth().getUser(targetUid);
    const currentClaims = (target.customClaims || {}) as Record<string, any>;

    const currentRoleClaim = currentClaims.role || (currentClaims.admin === true ? 'admin' : 'student');
    const nextRole = normalizeRole(role);

    if (!canAssignRole(caller.role, currentRoleClaim, nextRole)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Custom claims (authoritative for security), plus admin boolean for back-compat.
    const nextClaims: Record<string, any> = { ...currentClaims, role: nextRole };
    if (nextRole === 'admin' || nextRole === 'super_admin') nextClaims.admin = true;
    if (nextRole === 'student' || nextRole === 'instructor' || nextRole === 'moderator') {
      // Keep admin claim only for true admin/super_admin.
      delete nextClaims.admin;
    }

    await admin.auth().setCustomUserClaims(targetUid, nextClaims);

    // Keep Firestore in sync for UI/back-compat.
    const db = admin.firestore();
    await db
      .collection('users')
      .doc(targetUid)
      .set({ role: nextRole, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    await writeAuditLog({
      action: 'user.role.set',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      targetUid,
      targetEmail: target.email?.toLowerCase() || null,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { nextRole },
    });

    return res.status(200).json({ ok: true, role: nextRole });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
