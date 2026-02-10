import { FieldValue } from 'firebase-admin/firestore';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requireCompleteProfile, requireUser } from '../_lib/authz';
import { hasCoursePermission, hasPermission, type PlatformRole } from '../../lib/rbac';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';

type CreateEventBody = {
  type: 'assignment_deadline' | 'test_window' | 'live_test' | 'class_event';
  title: string;
  description?: string;
  startMillis: number;
  endMillis: number;
  courseId?: string;
};

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 30 * 1024; // 30KB
const MAX_FANOUT_USERS = 1000; // hard cap to prevent unbounded fan-out writes

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && aEnd > bStart;
}

type FeedEventLike = {
  id: string;
  title?: unknown;
  startMillis?: unknown;
  endMillis?: unknown;
};

async function canManageCalendarForCourse(courseId: string, actorUid: string, actorPlatformRole: PlatformRole) {
  if (
    hasPermission(actorPlatformRole, 'calendar.manage') ||
    hasPermission(actorPlatformRole, 'courses.manage')
  ) {
    return true;
  }
  const admin = ensureFirebaseAdminApp();
  const db = admin.firestore();
  const enrollRef = db.collection('courses').doc(courseId).collection('enrollments').doc(actorUid);
  const snap = await enrollRef.get();
  if (!snap.exists) return false;
  const data = snap.data() as any;
  return data?.status === 'active' && hasCoursePermission(data?.role, 'events.manage');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = getRequestContext(req);

  res.setHeader('Cache-Control', 'no-store');
  applyCors(req, res, { origin: ctx.origin });
  if (ctx.origin && !isOriginAllowed(ctx.origin)) {
    return res.status(403).json({ error: 'Forbidden Origin', requestId: ctx.requestId });
  }

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    assertJson(req);
    assertBodySize(req, MAX_BODY_SIZE);

    const caller = await requireUser(req);
    await requireCompleteProfile(caller);
    const body = (req.body || {}) as CreateEventBody;

    const type = body.type;
    const title = (body.title ?? '').trim();
    const description = body.description?.trim();
    const startMillis = Number(body.startMillis);
    const endMillis = Number(body.endMillis);
    const courseId = body.courseId?.trim();

    if (!type || !title || !Number.isFinite(startMillis) || !Number.isFinite(endMillis) || endMillis <= startMillis) {
      return res.status(400).json({ error: 'Invalid payload', requestId: ctx.requestId });
    }

    const actorUid = caller.uid;
    const actorRole = caller.role;

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    let courseName: string | undefined;
    const feedWrites: Array<{ uid: string }> = [];

    if (courseId) {
      const allowed = await canManageCalendarForCourse(courseId, actorUid, actorRole);
      if (!allowed) {
        return res.status(403).json({ error: 'Forbidden', requestId: ctx.requestId });
      }

      const courseSnap = await db.collection('courses').doc(courseId).get();
      if (!courseSnap.exists) {
        return res.status(404).json({ error: 'Course not found', requestId: ctx.requestId });
      }
      courseName = String((courseSnap.data() as any)?.name ?? '');

      // Fan-out guard: refuse requests that would trigger unbounded writes.
      // Preflight with a hard cap to keep costs predictable.
      const enrollSnap = await db
        .collection('courses')
        .doc(courseId)
        .collection('enrollments')
        .where('status', '==', 'active')
        .limit(MAX_FANOUT_USERS + 1)
        .get();

      if (enrollSnap.size > MAX_FANOUT_USERS) {
        return res.status(413).json({
          error: `Course has too many active members to fan out calendar events (>${MAX_FANOUT_USERS}).`,
          requestId: ctx.requestId,
        });
      }

      for (const doc of enrollSnap.docs) {
        feedWrites.push({ uid: doc.id });
      }
    } else {
      feedWrites.push({ uid: actorUid });
    }

    // Canonical event
    const eventRef = db.collection('events').doc();
    await eventRef.create({
      type,
      title,
      description: description || undefined,
      startMillis,
      endMillis,
      courseId: courseId || undefined,
      courseName: courseName || undefined,
      source: courseId ? 'course' : 'personal',
      createdBy: actorUid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

  const payload = {
    eventId: eventRef.id,
    type,
    title,
    description: description || undefined,
    startMillis,
    endMillis,
    courseId: courseId || undefined,
    courseName: courseName || undefined,
    source: courseId ? 'course' : 'personal',
    createdBy: actorUid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Chunked batches (Firestore limit: 500 ops/batch)
  const chunkSize = 450;
  for (let i = 0; i < feedWrites.length; i += chunkSize) {
    const batch = db.batch();
    for (const { uid } of feedWrites.slice(i, i + chunkSize)) {
      const ref = db.collection('userCalendars').doc(uid).collection('events').doc(eventRef.id);
      batch.set(ref, payload, { merge: true });
    }
    await batch.commit();
  }

  // Conflict detection (for the caller only)
  const windowStart = startMillis - 7 * 24 * 60 * 60 * 1000;
  const conflictQuery = await db
    .collection('userCalendars')
    .doc(actorUid)
    .collection('events')
    .where('startMillis', '>=', windowStart)
    .where('startMillis', '<', endMillis)
    .get();

  const conflicts = conflictQuery.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as any) } as FeedEventLike))
    .filter((e) => overlaps(Number(e.startMillis), Number(e.endMillis), startMillis, endMillis))
    .map((e) => ({
      eventId: e.id,
      title: String(e.title ?? ''),
      startMillis: Number(e.startMillis),
      endMillis: Number(e.endMillis),
    }));

    await writeAuditLog({
      action: 'calendar.event.create',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { eventId: eventRef.id, courseId: courseId || null, type, title, startMillis, endMillis },
    });

    return res.status(200).json({ eventId: eventRef.id, conflicts });
  } catch (e: any) {
    const statusCode = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(statusCode).json({ error: message });
  }
}
