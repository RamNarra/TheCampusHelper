import { FieldValue } from 'firebase-admin/firestore';
import { applyCors, isOriginAllowed } from './_lib/cors';
import { ensureFirebaseAdminApp } from './_lib/firebaseAdmin';
import { assertBodySize, assertJson, requireUser } from './_lib/authz';
import { getRequestContext, type VercelRequest, type VercelResponse } from './_lib/request';
import { writeAuditLog } from './_lib/auditLog';

export const config = {
  runtime: 'nodejs',
};

// --- SECURITY CONFIGURATION ---

const MAX_BODY_SIZE = 20 * 1024; // 20KB

// Hard fallback allowlist so the project owner can always recover admin.
// Prefer using ADMIN_EMAILS on Vercel for additional admins.
const DEFAULT_ADMIN_EMAILS: string[] = [];

function parseAdminAllowlist(): string[] {
  const raw = (process.env.ADMIN_EMAILS || '').trim();
  const fromEnv = raw
    ? raw
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    : [];

  return Array.from(
    new Set([...DEFAULT_ADMIN_EMAILS.map((e) => e.toLowerCase()), ...fromEnv])
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = getRequestContext(req);

  res.setHeader('Cache-Control', 'no-store');

  applyCors(req, res, { origin: ctx.origin });
  if (ctx.origin && !isOriginAllowed(ctx.origin)) {
    return res.status(403).json({ error: 'Forbidden Origin', requestId: ctx.requestId });
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    assertJson(req);
    assertBodySize(req, MAX_BODY_SIZE);

    const caller = await requireUser(req);
    const email = (caller.email || '').toLowerCase();
    const uid = caller.uid;

    const allowlist = parseAdminAllowlist();
    if (!allowlist.length) {
      return res.status(503).json({ error: 'Admin bootstrap not configured', requestId: ctx.requestId });
    }
    if (!email || !allowlist.includes(email)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const admin = ensureFirebaseAdminApp();
    const userRecord = await admin.auth().getUser(uid);
    const existingClaims = (userRecord.customClaims || {}) as Record<string, any>;

    // Bootstrap means: make this caller a platform super_admin.
    const nextClaims = { ...existingClaims, admin: true, role: 'super_admin' };
    await admin.auth().setCustomUserClaims(uid, nextClaims);

    // Keep Firestore role in sync for UI and back-compat.
    let firestoreSyncOk = false;
    try {
      const db = admin.firestore();
      await db
        .collection('users')
        .doc(uid)
        .set(
          {
            role: 'super_admin',
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      firestoreSyncOk = true;
    } catch (e) {
      console.error(`[${ctx.requestId}] Firestore role sync failed:`, e);
      // Claim is the important part for rules; don't fail the whole request.
    }

    await writeAuditLog({
      action: 'auth.bootstrap_admin',
      actorUid: uid,
      actorEmail: email,
      actorRole: 'super_admin',
      targetUid: uid,
      targetEmail: email,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return res.status(200).json({ ok: true, role: 'super_admin', firestoreSyncOk });
  } catch (e) {
    console.error(`[${ctx.requestId}] bootstrapAdmin failed:`, e);
    return res.status(500).json({ error: 'internal_error', requestId: ctx.requestId });
  }
}
