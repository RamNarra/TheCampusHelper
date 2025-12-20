import type { VercelRequest, VercelResponse } from './request';

function parseAllowedOrigins(): Set<string> {
  const base = new Set<string>(['http://localhost:5173', 'http://localhost:3000']);

  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
  if (vercelUrl) base.add(vercelUrl);

  const raw = (process.env.APP_ORIGINS || '').trim();
  if (raw) {
    for (const part of raw.split(',')) {
      const o = part.trim();
      if (o) base.add(o);
    }
  }

  return base;
}

const ALLOWED_ORIGINS = parseAllowedOrigins();

export function applyCors(req: VercelRequest, res: VercelResponse, ctx: { origin: string | null }) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length');

  if (!ctx.origin) return;

  if (!ALLOWED_ORIGINS.has(ctx.origin)) {
    // Caller should typically return 403 when this happens.
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', ctx.origin);
  res.setHeader('Vary', 'Origin');
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true; // non-browser callers
  return ALLOWED_ORIGINS.has(origin);
}
