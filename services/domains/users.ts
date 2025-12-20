import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  limit,
  query,
  setDoc,
  type DocumentData,
} from 'firebase/firestore';
import type { UserProfile } from '../../types';
import { getDb } from '../platform/firebaseClient';
import { withTimeout } from '../platform/utils';

export const updateProfile = async (uid: string, data: Partial<UserProfile>) => {
  const db = getDb();
  if (!db) return;
  const ref = doc(db, 'users', uid);
  return withTimeout(setDoc(ref, data, { merge: true }), 5000);
};

export const onProfileChanged = (
  uid: string,
  cb: (data: DocumentData | undefined) => void
) => {
  const db = getDb();
  if (!db) {
    cb(undefined);
    return () => {};
  }
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    cb(snap.exists() ? snap.data() : undefined);
  });
};

export const getAllUsers = async (limitCount = 200): Promise<UserProfile[]> => {
  const db = getDb();
  if (!db) return [];
  const q = query(collection(db, 'users'), limit(Math.max(1, Math.min(limitCount, 500))));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) } as UserProfile));
};
