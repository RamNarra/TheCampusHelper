import crypto from 'crypto';

export interface VercelRequest {
  headers: { [key: string]: string | string[] | undefined };
  method: string;
  body: any;
}

export interface VercelResponse {
  setHeader: (key: string, value: string) => void;
  status: (code: number) => VercelResponse;
  json: (data: any) => void;
  end: () => void;
}

export interface RequestContext {
  requestId: string;
  origin: string | null;
  ip: string;
  userAgent: string;
}

export function getRequestContext(req: VercelRequest): RequestContext {
  const requestId = crypto.randomUUID();

  const originHeader = req.headers.origin;
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader || null;

  // IP: prefer explicit edge headers, then fall back to the right-most forwarded IP.
  const xRealIp = req.headers['x-real-ip'];
  const vercelFwd = req.headers['x-vercel-forwarded-for'];
  const xff = req.headers['x-forwarded-for'];

  const first = (h: string | string[] | undefined): string => (Array.isArray(h) ? h[0] : h || '');
  const realIp = first(xRealIp).trim();
  const vercelIp = first(vercelFwd).trim();
  const rawXff = first(xff);
  const xffParts = rawXff
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const forwardedIp = xffParts.length ? xffParts[xffParts.length - 1] : '';

  const ip = realIp || vercelIp || forwardedIp || 'unknown-ip';

  const ua = req.headers['user-agent'];
  const userAgent = Array.isArray(ua) ? ua[0] : ua || '';

  return { requestId, origin, ip, userAgent };
}
