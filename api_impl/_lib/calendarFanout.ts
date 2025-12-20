import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { ensureFirebaseAdminApp } from './firebaseAdmin';

const MAX_FANOUT_USERS = 1000;

export function makeDeterministicEventId(key: string): string {
  // 64 hex chars; safe Firestore doc id.
  return crypto.createHash('sha256').update(key).digest('hex');
}

export async function emitCourseCalendarEvent(params: {
  eventId: string;
  courseId: string;
  type: 'assignment_deadline' | 'test_window' | 'live_test' | 'class_event';
  title: string;
  description?: string;
  startMillis: number;
  endMillis: number;
  createdBy: string;
  courseName?: string;
}) {
  const admin = ensureFirebaseAdminApp();
  const db = admin.firestore();

  // Preflight fanout size (hard cap) to keep costs predictable.
  const enrollSnap = await db
    .collection('courses')
    .doc(params.courseId)
    .collection('enrollments')
    .where('status', '==', 'active')
    .limit(MAX_FANOUT_USERS + 1)
    .get();

  if (enrollSnap.size > MAX_FANOUT_USERS) {
    const err = new Error(`Course has too many active members to fan out calendar events (>${MAX_FANOUT_USERS}).`);
    (err as any).status = 413;
    throw err;
  }

  const payload = {
    type: params.type,
    title: params.title,
    description: params.description || undefined,
    startMillis: params.startMillis,
    endMillis: params.endMillis,
    courseId: params.courseId,
    courseName: params.courseName || undefined,
    source: 'course',
    createdBy: params.createdBy,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Canonical event doc is deterministic for idempotency.
  const canonicalRef = db.collection('events').doc(params.eventId);
  await canonicalRef.set(payload, { merge: true });

  // Fan out to user calendars (idempotent set).
  const uids = enrollSnap.docs.map((d) => d.id);
  const chunkSize = 450;
  for (let i = 0; i < uids.length; i += chunkSize) {
    const batch = db.batch();
    for (const uid of uids.slice(i, i + chunkSize)) {
      const ref = db.collection('userCalendars').doc(uid).collection('events').doc(params.eventId);
      batch.set(ref, payload, { merge: true });
    }
    await batch.commit();
  }

  return { eventId: params.eventId, fanoutCount: uids.length };
}
