import {
  collection,
  doc,
  documentId,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
  where,
} from 'firebase/firestore';

import type { PresenceState } from '../../types';
import { getDb } from '../platform/firebaseClient';
import { withTimeout } from '../platform/utils';

export type PresenceRecord = {
  state: PresenceState;
  lastSeen: any;
  updatedAt: any;
  displayName?: string | null;
  photoURL?: string | null;
};

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export const setPresence = async (
  uid: string,
  data: Partial<PresenceRecord> & { state: PresenceState }
) => {
  const db = getDb();
  if (!db) return;
  const ref = doc(db, 'presence', uid);
  const payload: Partial<PresenceRecord> = {
    ...data,
    lastSeen: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  return withTimeout(setDoc(ref, payload, { merge: true }), 4000);
};

export const setOnline = async (
  uid: string,
  profile?: { displayName?: string | null; photoURL?: string | null }
) => {
  return setPresence(uid, {
    state: 'online',
    displayName: profile?.displayName ?? undefined,
    photoURL: profile?.photoURL ?? undefined,
  });
};

export const setIdle = async (
  uid: string,
  profile?: { displayName?: string | null; photoURL?: string | null }
) => {
  return setPresence(uid, {
    state: 'idle',
    displayName: profile?.displayName ?? undefined,
    photoURL: profile?.photoURL ?? undefined,
  });
};

export const setOffline = async (uid: string) => {
  return setPresence(uid, { state: 'offline' });
};

export const onPresenceByUserIds = (
  userIds: string[],
  cb: (records: Record<string, DocumentData>) => void
) => {
  const db = getDb();
  if (!db) {
    cb({});
    return () => {};
  }

  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) {
    cb({});
    return () => {};
  }

  const unsubs: Array<() => void> = [];
  const accum: Record<string, DocumentData> = {};

  const emit = () => {
    cb({ ...accum });
  };

  // Firestore `in` supports up to 10 values.
  const chunks = chunk(ids, 10);
  for (const part of chunks) {
    const q = query(collection(db, 'presence'), where(documentId(), 'in', part));
    const unsub = onSnapshot(q, (snap) => {
      for (const change of snap.docChanges()) {
        const id = change.doc.id;
        if (change.type === 'removed') {
          delete accum[id];
        } else {
          accum[id] = change.doc.data();
        }
      }
      emit();
    });
    unsubs.push(unsub);
  }

  return () => {
    for (const u of unsubs) u();
  };
};
