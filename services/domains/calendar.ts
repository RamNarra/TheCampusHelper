import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import type { CalendarEvent } from '../../types';
import { getDb } from '../platform/firebaseClient';
import { getAuthToken } from './auth';
import { withTimeout } from '../platform/utils';

export const onMyCalendarEventsChanged = (
  uid: string,
  startMillis: number,
  endMillis: number,
  cb: (events: CalendarEvent[]) => void,
  onError?: (e: unknown) => void
) => {
  const db = getDb();
  if (!db) {
    cb([]);
    return () => {};
  }

  const q = query(
    collection(db, 'userCalendars', uid, 'events'),
    where('startMillis', '>=', startMillis),
    where('startMillis', '<=', endMillis),
    orderBy('startMillis', 'asc'),
    limit(2000)
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as CalendarEvent));
      cb(list);
    },
    (err) => onError?.(err)
  );
};

export const createCourseEvent = async (input: {
  courseId: string;
  type: CalendarEvent['type'];
  title: string;
  description?: string;
  startMillis: number;
  endMillis: number;
}): Promise<{ eventId: string; conflicts: Array<{ eventId: string; title: string; startMillis: number; endMillis: number }> }> => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');

  const res = await withTimeout(
    fetch('/api/calendar/createEvent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    }),
    20000
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Create event failed (${res.status})`);
  }

  return (await res.json()) as any;
};
