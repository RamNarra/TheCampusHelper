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
import { authedJsonPost } from '../platform/apiClient';

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
  const userId = (input.userId ?? input.targetUid ?? '').trim();
  if (!userId) throw new Error('userId is required');

  await authedJsonPost<void>(
    '/api/courses/setEnrollment',
    {
      courseId: input.courseId,
      userId,
      role: input.role,
      status: input.status,
    },
    { timeoutMs: 15000 }
  );
};
