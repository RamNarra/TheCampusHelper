export const isDev = Boolean(import.meta.env.DEV);

const truthy = (v: string | undefined): boolean => {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
};

/**
 * Local-dev convenience: bypass auth gating so pages can be reviewed without signing in.
 *
 * Enabled by default in dev. You can disable it by setting:
 * - VITE_DEV_BYPASS_AUTH=0 (or false)
 *
 * You can also toggle at runtime via DevTools:
 * - localStorage.setItem('thc_dev_bypass_auth', '1' | '0')
 */
export const isAuthBypassed = (): boolean => {
  // Defense-in-depth: never bypass in production builds.
  if (import.meta.env.PROD) return false;
  if (!isDev) return false;

  const env = import.meta.env.VITE_DEV_BYPASS_AUTH as string | undefined;
  if (env !== undefined) return truthy(env);

  try {
    const raw = localStorage.getItem('thc_dev_bypass_auth');
    if (raw === '0') return false;
    if (raw === '1') return true;
  } catch {
    // ignore
  }

  // Default ON in local dev.
  return true;
};

export const getPreviewUserId = (): string => {
  try {
    const existing = sessionStorage.getItem('thc_dev_preview_uid');
    if (existing) return existing;
    const id = `dev-preview-${(globalThis.crypto as any)?.randomUUID?.() || Math.random().toString(16).slice(2)}`;
    sessionStorage.setItem('thc_dev_preview_uid', id);
    return id;
  } catch {
    return `dev-preview-${Math.random().toString(16).slice(2)}`;
  }
};
