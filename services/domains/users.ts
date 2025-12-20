import {
  collection,
  doc,
  getDocs,
  onSnapshot,
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

export const getAllUsers = async (): Promise<UserProfile[]> => {
  const db = getDb();
  if (!db) return [];
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) } as UserProfile));
};
