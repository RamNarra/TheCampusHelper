import {
  collectionGroup,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import type { Enrollment } from '../../types';
import { getDb } from '../platform/firebaseClient';
import { getAuthToken } from './auth';
import { withTimeout } from '../platform/utils';

export const onMyEnrollmentsChanged = (
  userId: string,
  cb: (items: Enrollment[]) => void,
  onError?: (e: unknown) => void
) => {
  const db = getDb();
  if (!db) {
    cb([]);
    return () => {};
  }

  const q = query(
    collectionGroup(db, 'enrollments'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(200)
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Enrollment));
      cb(list);
    },
    (err) => onError?.(err)
  );
};

export const setEnrollment = async (input: {
  courseId: string;
  userId?: string;
  targetUid?: string;
  role: 'student' | 'instructor';
  status: 'active' | 'removed';
}): Promise<void> => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');

  const userId = (input.userId ?? input.targetUid ?? '').trim();
  if (!userId) throw new Error('userId is required');

  const res = await withTimeout(
    fetch('/api/courses/setEnrollment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        courseId: input.courseId,
        userId,
        role: input.role,
        status: input.status,
      }),
    }),
    15000
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Set enrollment failed (${res.status})`);
  }
};
