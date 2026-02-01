import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { getAuthClient, getGoogleProvider } from '../platform/firebaseClient';

const getAuthErrorCode = (err: unknown): string | null => {
  if (!err || typeof err !== 'object') return null;
  const code = (err as any).code;
  return typeof code === 'string' ? code : null;
};

export const consumeRedirectResult = async (): Promise<void> => {
  const auth = getAuthClient();
  if (!auth) return;
  // Ensures any pending redirect flow is finalized and errors surface.
  await getRedirectResult(auth);
};

export const getAuthToken = async (): Promise<string | null> => {
  const auth = getAuthClient();
  if (!auth || !auth.currentUser) return null;
  return auth.currentUser.getIdToken(false);
};

export const forceRefreshAuthToken = async (): Promise<string | null> => {
  const auth = getAuthClient();
  if (!auth || !auth.currentUser) return null;
  return auth.currentUser.getIdToken(true);
};

export const signIn = async (): Promise<void> => {
  const auth = getAuthClient();
  const provider = getGoogleProvider();
  if (!auth || !provider) throw new Error('Auth not configured');

  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    const code = getAuthErrorCode(err);
    // Prefer popup (best UX). If it fails due to environment/browser constraints,
    // fall back to redirect so the user still sees the Google account chooser.
    // NOTE: Redirect won't fix configuration errors (unauthorized-domain, etc.), so we rethrow those.
    const nonRecoverable = new Set([
      'auth/unauthorized-domain',
      'auth/invalid-api-key',
      'auth/operation-not-allowed',
    ]);

    const shouldFallbackToRedirect =
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment' ||
      code === 'auth/internal-error' ||
      code === 'auth/network-request-failed' ||
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/popup-closed-by-user';

    if (code && nonRecoverable.has(code)) throw err;

    if (shouldFallbackToRedirect) {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw err;
  }
};

export const signOutUser = async () => {
  const auth = getAuthClient();
  if (!auth) return;
  await signOut(auth);

  // Best-effort: clear any cached app shell/content after logout.
  // This helps avoid serving previously cached pages/assets to a signed-out user.
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const keys = await caches.keys();
      await Promise.allSettled(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // Ignore cache clear failures.
  }
};

export const onAuthChanged = (cb: (user: User | null) => void) => {
  const auth = getAuthClient();
  if (!auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
};
