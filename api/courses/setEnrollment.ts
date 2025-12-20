import { FieldValue } from 'firebase-admin/firestore';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requireUser } from '../_lib/authz';
import { hasCoursePermission, hasPermission, type PlatformRole } from '../../lib/rbac';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';

type SetEnrollmentBody = {
  courseId: string;
  userId: string;
  role: 'student' | 'instructor';
  status: 'active' | 'removed';
};

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 20 * 1024; // 20KB
const MAX_INSTRUCTOR_CHECK = 10;

async function canManageCourse(courseId: string, actorUid: string, actorRole: PlatformRole) {
  // Platform-level override
  if (hasPermission(actorRole, 'courses.manage')) return true;

  // Course-scoped ABAC: active instructor enrollment
  const admin = ensureFirebaseAdminApp();
  const db = admin.firestore();
  const enrollRef = db.collection('courses').doc(courseId).collection('enrollments').doc(actorUid);
  const snap = await enrollRef.get();
  if (!snap.exists) return false;
  const data = snap.data() as any;
  return data?.status === 'active' && hasCoursePermission(data?.role, 'enrollments.manage');
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
    const body = (req.body || {}) as SetEnrollmentBody;

    const courseId = (body.courseId ?? '').trim();
    const userId = (body.userId ?? '').trim();
    const role = body.role;
    const status = body.status;

    if (!courseId || !userId || !role || !status) {
      return res.status(400).json({ error: 'courseId, userId, role, status are required', requestId: ctx.requestId });
    }

    const allowed = await canManageCourse(courseId, caller.uid, caller.role);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden', requestId: ctx.requestId });
    }

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    const courseRef = db.collection('courses').doc(courseId);
    const enrollRef = courseRef.collection('enrollments').doc(userId);

    await db.runTransaction(async (tx: FirebaseFirestore.Transaction) => {
      const courseSnap = await tx.get(courseRef);
      if (!courseSnap.exists) {
        const err = new Error('Course not found');
        (err as any).status = 404;
        throw err;
      }

      const existingSnap = await tx.get(enrollRef);
      const existing = (existingSnap.exists ? (existingSnap.data() as any) : null) as any;

      const currentlyActiveInstructor = existing?.status === 'active' && existing?.role === 'instructor';
      const willBeActiveInstructor = status === 'active' && role === 'instructor';

      if (currentlyActiveInstructor && !willBeActiveInstructor) {
        const q = courseRef
          .collection('enrollments')
          .where('status', '==', 'active')
          .where('role', '==', 'instructor')
          .limit(MAX_INSTRUCTOR_CHECK);

        const instrSnap = await tx.get(q);
        const hasOtherInstructor = instrSnap.docs.some((d) => d.id !== userId);
        if (!hasOtherInstructor) {
          const err = new Error('Cannot remove or demote the last active instructor');
          (err as any).status = 409;
          throw err;
        }
      }

      tx.set(
        enrollRef,
        {
          courseId,
          userId,
          role,
          status,
          updatedAt: FieldValue.serverTimestamp(),
          updatedAtBy: caller.uid,
          // Preserve create-time metadata once set
          createdAt: existing?.createdAt ?? FieldValue.serverTimestamp(),
          createdBy: existing?.createdBy ?? caller.uid,
        },
        { merge: true }
      );
    });

    await writeAuditLog({
      action: 'enrollment.set',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      targetUid: userId,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { courseId, role, status },
    });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    const statusCode = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(statusCode).json({ error: message });
  }
}
