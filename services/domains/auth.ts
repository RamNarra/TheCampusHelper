import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { getAuthClient, getGoogleProvider } from '../platform/firebaseClient';

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

export const signIn = async () => {
  const auth = getAuthClient();
  const provider = getGoogleProvider();
  if (!auth || !provider) throw new Error('Auth not configured');
  return signInWithPopup(auth, provider);
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
