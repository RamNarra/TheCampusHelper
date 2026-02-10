import { Buffer } from 'buffer';
import { rateLimitExceeded } from '../../lib/rateLimit';
import { isAtLeastRole } from '../../lib/rbac';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { writeAuditLog } from '../_lib/auditLog';
import { assertBodySize, assertJson, requireCompleteProfile, requireUser } from '../_lib/authz';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 4 * 1024; // 4KB

function coerceString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length ? s : null;
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
    await requireCompleteProfile(caller);
    if (!isAtLeastRole(caller.role, 'admin')) {
      return res.status(403).json({ error: 'Forbidden', requestId: ctx.requestId });
    }

    // Rate limit: avoid toggle thrash.
    const limiterKey = `admin:setPhase1Toggle:${caller.uid}`;
    if (await rateLimitExceeded(limiterKey)) {
      return res.status(429).json({ error: 'Too Many Requests', requestId: ctx.requestId });
    }

    const body = (req.body || {}) as any;
    const serverlessOnly = body?.serverlessOnly;
    const reason = coerceString(body?.reason);

    if (typeof serverlessOnly !== 'boolean') {
      return res.status(400).json({ error: 'Invalid serverlessOnly (expected boolean)', requestId: ctx.requestId });
    }

    // Keep request body small and audit-safe.
    if (reason && Buffer.byteLength(reason, 'utf8') > 500) {
      return res.status(400).json({ error: 'Invalid reason (too long)', requestId: ctx.requestId });
    }

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();
    const docRef = db.collection('config').doc('phase1');

    const { before, after } = await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      const prior = snap.exists ? (snap.data() as any)?.serverlessOnly : undefined;
      const beforeValue = prior === true;
      const afterValue = serverlessOnly === true;

      // Overwrite-safe: only set the single field; preserve any unknown fields.
      tx.set(docRef, { serverlessOnly: afterValue }, { merge: true });

      return { before: beforeValue, after: afterValue };
    });

    await writeAuditLog({
      action: 'config.phase1.toggle',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: {
        before: { serverlessOnly: before },
        after: { serverlessOnly: after },
        changed: before !== after,
        reason: reason ?? null,
      },
    });

    return res.status(200).json({ ok: true, before, after });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
