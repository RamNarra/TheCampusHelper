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

  const xff = req.headers['x-forwarded-for'];
  const rawIp = Array.isArray(xff) ? xff[0] : xff || '';
  const ip = rawIp.split(',')[0].trim() || 'unknown-ip';

  const ua = req.headers['user-agent'];
  const userAgent = Array.isArray(ua) ? ua[0] : ua || '';

  return { requestId, origin, ip, userAgent };
}
