import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requireUser } from '../_lib/authz';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 10 * 1024; // 10KB

type MyCoursesBody = {
  includeArchived?: boolean;
  limit?: number;
};

type MyCourseResult = {
  courseId: string;
  role: 'student' | 'instructor';
  status: 'active' | 'removed';
  course: {
    id: string;
    name: string;
    code: string;
    term: string;
    description?: string;
    archived?: boolean;
    createdBy?: string;
    createdAt?: unknown;
    updatedAt?: unknown;
  };
};

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
    const body = (req.body || {}) as MyCoursesBody;

    const includeArchived = body.includeArchived === true;
    const limit = Math.max(1, Math.min(200, Number(body.limit ?? 50)));

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    const enrollmentsSnap = await db
      .collectionGroup('enrollments')
      .where('userId', '==', caller.uid)
      .where('status', '==', 'active')
      .limit(limit)
      .get();

    const enrollments = enrollmentsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Array<{
      courseId: string;
      userId: string;
      role: 'student' | 'instructor';
      status: 'active' | 'removed';
    }>;

    const courseIds = Array.from(new Set(enrollments.map((e) => String(e.courseId || '').trim()).filter(Boolean)));
    if (!courseIds.length) return res.status(200).json({ courses: [] as MyCourseResult[] });

    const courseRefs = courseIds.map((id) => db.collection('courses').doc(id));
    const courseSnaps = await db.getAll(...courseRefs);

    const courseById = new Map<string, FirebaseFirestore.DocumentData>();
    for (const snap of courseSnaps) {
      if (snap.exists) courseById.set(snap.id, snap.data() as FirebaseFirestore.DocumentData);
    }

    const results: MyCourseResult[] = [];
    for (const e of enrollments) {
      const courseId = String(e.courseId || '').trim();
      const courseDoc = courseById.get(courseId);
      if (!courseDoc) continue;
      if (!includeArchived && courseDoc.archived === true) continue;

      results.push({
        courseId,
        role: e.role,
        status: e.status,
        course: {
          id: courseId,
          name: String(courseDoc.name ?? ''),
          code: String(courseDoc.code ?? ''),
          term: String(courseDoc.term ?? ''),
          description: courseDoc.description ? String(courseDoc.description) : undefined,
          archived: courseDoc.archived === true,
          createdBy: courseDoc.createdBy ? String(courseDoc.createdBy) : undefined,
          createdAt: courseDoc.createdAt,
          updatedAt: courseDoc.updatedAt,
        },
      });
    }

    // Stable ordering for UI: term desc-ish (string), then code, then name.
    results.sort((a, b) => {
      const t = String(b.course.term).localeCompare(String(a.course.term));
      if (t !== 0) return t;
      const c = String(a.course.code).localeCompare(String(b.course.code));
      if (c !== 0) return c;
      return String(a.course.name).localeCompare(String(b.course.name));
    });

    return res.status(200).json({ courses: results });
  } catch (e: any) {
    const statusCode = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(statusCode).json({ error: message, requestId: ctx.requestId });
  }
}
