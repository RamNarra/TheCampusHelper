export function isHttpUrl(url: string): boolean {
  const u = (url || '').trim();
  if (!u) return false;
  if (u.length > 2000) return false;
  return /^https?:\/\//i.test(u);
}

export function sanitizeOptionalReason(reason: unknown): string | null {
  if (typeof reason !== 'string') return null;
  const trimmed = reason.trim();
  if (!trimmed) return null;
  if (trimmed.length > 500) return null;
  return trimmed;
}
