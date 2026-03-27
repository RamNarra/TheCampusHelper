// Shared platform utilities. Keep dependency-free.

export const withTimeout = <T>(promise: Promise<T>, ms: number = 10000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out. Check your connection.')), ms)
    ),
  ]);
};

export const stripUndefined = <T extends Record<string, any>>(obj: T): T => {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
  return Object.fromEntries(entries) as T;
};

export const addDevAllFeaturesHeader = (headers?: Record<string, string>): Record<string, string> => {
  const out: Record<string, string> = { ...(headers || {}) };
  try {
    const env = (import.meta as any)?.env || {};
    const flag = String(env?.VITE_DEV_ALL_FEATURES ?? '').trim().toLowerCase();
    const enabled = Boolean(env?.DEV) && (flag === '1' || flag === 'true' || flag === 'yes' || flag === 'on');
    if (enabled) out['x-dev-all-features'] = '1';
  } catch {
    // ignore
  }
  return out;
};
