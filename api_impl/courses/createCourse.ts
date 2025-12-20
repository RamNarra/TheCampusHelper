import { FieldValue } from 'firebase-admin/firestore';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requirePermission, requireUser } from '../_lib/authz';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';

type CreateCourseBody = {
  name: string;
  code: string;
  term: string;
  description?: string;
};

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 20 * 1024; // 20KB

function normalizeKeyPart(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function toIndexId(codeNorm: string, termNorm: string): string {
  // Firestore doc IDs cannot contain '/', so we use encodeURIComponent.
  // Also keep it short (limit is 1500 bytes).
  const id = `${encodeURIComponent(codeNorm)}__${encodeURIComponent(termNorm)}`;
  return id.length <= 1200 ? id : id.slice(0, 1200);
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
    requirePermission(caller, 'courses.create');

    const body = (req.body || {}) as CreateCourseBody;

    const name = (body.name ?? '').trim();
    const code = (body.code ?? '').trim();
    const term = (body.term ?? '').trim();
    const description = body.description?.trim();

    if (!name || !code || !term) {
      return res.status(400).json({ error: 'name, code, and term are required', requestId: ctx.requestId });
    }

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    const courseRef = db.collection('courses').doc();
    const enrollmentRef = courseRef.collection('enrollments').doc(caller.uid);

    const codeNorm = normalizeKeyPart(code);
    const termNorm = normalizeKeyPart(term);
    const indexRef = db.collection('courseCodeTermIndex').doc(toIndexId(codeNorm, termNorm));

    await db.runTransaction(async (tx: FirebaseFirestore.Transaction) => {
      const existing = await tx.get(indexRef);
      if (existing.exists) {
        const err = new Error('Course already exists for this code and term');
        (err as any).status = 409;
        throw err;
      }

      tx.create(indexRef, {
        courseId: courseRef.id,
        code: code,
        term: term,
        codeNorm,
        termNorm,
        createdBy: caller.uid,
        createdAt: FieldValue.serverTimestamp(),
      });

      tx.create(courseRef, {
        name,
        code,
        term,
        codeNorm,
        termNorm,
        description: description || undefined,
        archived: false,
        createdBy: caller.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.set(enrollmentRef, {
        courseId: courseRef.id,
        userId: caller.uid,
        role: 'instructor',
        status: 'active',
        createdBy: caller.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await writeAuditLog({
      action: 'course.create',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { courseId: courseRef.id, name, code, term },
    });

    return res.status(200).json({ courseId: courseRef.id });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message });
  }
}
