import { ensureFirebaseAdminApp } from './firebaseAdmin';
import { hasPermission, type PlatformRole } from '../../lib/rbac';

export async function requireCourseExists(courseId: string) {
  const admin = ensureFirebaseAdminApp();
  const db = admin.firestore();

  const courseRef = db.collection('courses').doc(courseId);
  const snap = await courseRef.get();
  if (!snap.exists) {
    const err = new Error('Course not found');
    (err as any).status = 404;
    throw err;
  }

  return { courseRef, course: snap.data() as any };
}

export async function isActiveEnrollment(courseId: string, uid: string): Promise<boolean> {
  const admin = ensureFirebaseAdminApp();
  const db = admin.firestore();
  const enrollRef = db.collection('courses').doc(courseId).collection('enrollments').doc(uid);
  const snap = await enrollRef.get();
  if (!snap.exists) return false;
  const data = snap.data() as any;
  return data?.status === 'active';
}

export async function isActiveInstructor(courseId: string, uid: string): Promise<boolean> {
  const admin = ensureFirebaseAdminApp();
  const db = admin.firestore();
  const enrollRef = db.collection('courses').doc(courseId).collection('enrollments').doc(uid);
  const snap = await enrollRef.get();
  if (!snap.exists) return false;
  const data = snap.data() as any;
  return data?.status === 'active' && data?.role === 'instructor';
}

export async function requireInstructorOrPlatform(params: {
  courseId: string;
  actorUid: string;
  actorRole: PlatformRole;
}) {
  if (hasPermission(params.actorRole, 'courses.manage')) return;
  const ok = await isActiveInstructor(params.courseId, params.actorUid);
  if (!ok) {
    const err = new Error('Forbidden');
    (err as any).status = 403;
    throw err;
  }
}

export async function requireActiveEnrollmentOrPlatform(params: {
  courseId: string;
  actorUid: string;
  actorRole: PlatformRole;
}) {
  if (hasPermission(params.actorRole, 'courses.manage')) return;
  const ok = await isActiveEnrollment(params.courseId, params.actorUid);
  if (!ok) {
    const err = new Error('Forbidden');
    (err as any).status = 403;
    throw err;
  }
}
