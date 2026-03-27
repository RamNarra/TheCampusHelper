// Centralized dev-only override for local testing.
// IMPORTANT: Keep this file free of any server secrets.

export const isDevAllFeaturesEnabled = (): boolean => {
  try {
    const env = (import.meta as any)?.env || {};
    const flag = String(env?.VITE_DEV_ALL_FEATURES ?? '').trim().toLowerCase();
    const enabledByFlag = flag === '1' || flag === 'true' || flag === 'yes' || flag === 'on';
    return Boolean(env?.DEV) && enabledByFlag;
  } catch {
    return false;
  }
};
