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
  return signOut(auth);
};

export const onAuthChanged = (cb: (user: User | null) => void) => {
  const auth = getAuthClient();
  if (!auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
};
