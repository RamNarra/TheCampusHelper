import { Buffer } from 'buffer';
import type { VercelRequest } from './request';
import { ensureFirebaseAdminApp } from './firebaseAdmin';
import { hasPermission, normalizeRole, type Permission, type PlatformRole } from '../../lib/rbac';

export interface AuthenticatedCaller {
  uid: string;
  email?: string | null;
  role: PlatformRole;
  claims: Record<string, unknown>;
}

export function assertJson(req: VercelRequest) {
  const contentTypeHeader = req.headers['content-type'];
  const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader || '';
  if (contentType && !contentType.includes('application/json')) {
    const err = new Error('Unsupported Media Type. Use application/json.');
    (err as any).status = 415;
    throw err;
  }
}

export function assertBodySize(req: VercelRequest, maxBytes: number) {
  const bodySize = Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8');
  if (bodySize > maxBytes) {
    const err = new Error('Payload Too Large');
    (err as any).status = 413;
    throw err;
  }
}

export async function requireUser(req: VercelRequest): Promise<AuthenticatedCaller> {
  const authHeader = req.headers.authorization;
  const bearerToken = Array.isArray(authHeader) ? authHeader[0] : authHeader;

  if (!bearerToken || !bearerToken.startsWith('Bearer ')) {
    const err = new Error('Unauthorized');
    (err as any).status = 401;
    throw err;
  }

  const idToken = bearerToken.split('Bearer ')[1];
  const admin = ensureFirebaseAdminApp();

  let decoded: any;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch {
    const err = new Error('Forbidden: Invalid Token');
    (err as any).status = 403;
    throw err;
  }

  const roleFromClaim = (decoded?.role || decoded?.['https://example.com/role']) as string | undefined;
  const roleFromAdminClaim = decoded?.admin === true ? 'admin' : undefined;
  const role = normalizeRole(roleFromClaim || roleFromAdminClaim || 'student');

  return {
    uid: decoded.uid,
    email: decoded.email || null,
    role,
    claims: decoded,
  };
}

export function requirePermission(caller: AuthenticatedCaller, permission: Permission) {
  if (!hasPermission(caller.role, permission)) {
    const err = new Error('Forbidden');
    (err as any).status = 403;
    throw err;
  }
}
