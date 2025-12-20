import { applyCors, isOriginAllowed } from '../api_impl/_lib/cors';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../api_impl/_lib/request';

export function getAction(req: VercelRequest): string {
  const q = (req.query as any) || {};
  const fromQuery = typeof q.action === 'string' ? q.action : Array.isArray(q.action) ? q.action[0] : undefined;

  const b = (req.body as any) || {};
  const fromBody = typeof b.action === 'string' ? b.action : undefined;

  return String(fromQuery ?? fromBody ?? '').trim();
}

export function rejectUnknownAction(req: VercelRequest, res: VercelResponse, allowed: readonly string[]) {
  const ctx = getRequestContext(req);

  res.setHeader('Cache-Control', 'no-store');
  applyCors(req, res, { origin: ctx.origin });
  if (ctx.origin && !isOriginAllowed(ctx.origin)) {
    return res.status(403).json({ error: 'Forbidden Origin', requestId: ctx.requestId });
  }

  if (req.method === 'OPTIONS') return res.status(204).end();

  return res.status(400).json({
    error: 'Invalid action',
    requestId: ctx.requestId,
    allowedActions: allowed,
  });
}
