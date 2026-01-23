import { applyCors, isOriginAllowed } from '../_lib/cors';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { requirePermission, requireUser } from '../_lib/authz';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';

export const config = { runtime: 'nodejs' };

function isNonEmpty(s: unknown): boolean {
  return typeof s === 'string' && s.trim().length > 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = getRequestContext(req);

  res.setHeader('Cache-Control', 'no-store');
  applyCors(req, res, { origin: ctx.origin });

  if (ctx.origin && !isOriginAllowed(ctx.origin)) {
    return res.status(403).json({ error: 'Forbidden Origin', requestId: ctx.requestId });
  }

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed', requestId: ctx.requestId });

  try {
    const caller = await requireUser(req);
    requirePermission(caller, 'system.health.read');

    const geminiConfigured = isNonEmpty(process.env.GEMINI_API_KEY);
    const aiGatewayConfigured = isNonEmpty(process.env.AI_GATEWAY_API_KEY);
    const aiGatewayModel = isNonEmpty(process.env.AI_GATEWAY_MODEL) ? String(process.env.AI_GATEWAY_MODEL).trim() : null;
    const upstashConfigured = isNonEmpty(process.env.UPSTASH_REDIS_REST_URL) && isNonEmpty(process.env.UPSTASH_REDIS_REST_TOKEN);

    const firebaseAdminConfigured =
      isNonEmpty(process.env.FIREBASE_PROJECT_ID) &&
      isNonEmpty(process.env.FIREBASE_CLIENT_EMAIL) &&
      isNonEmpty(process.env.FIREBASE_PRIVATE_KEY);

    // Best-effort verify admin SDK init doesn't throw when configured.
    let firebaseAdminInitOk: boolean | null = null;
    if (firebaseAdminConfigured) {
      try {
        ensureFirebaseAdminApp();
        firebaseAdminInitOk = true;
      } catch {
        firebaseAdminInitOk = false;
      }
    }

    return res.status(200).json({
      ok: true,
      requestId: ctx.requestId,
      now: new Date().toISOString(),
      deps: {
        aiGatewayConfigured,
        aiGatewayModel,
        geminiConfigured,
        upstashConfigured,
        firebaseAdminConfigured,
        firebaseAdminInitOk,
      },
    });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = typeof e?.message === 'string' ? e.message : 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
