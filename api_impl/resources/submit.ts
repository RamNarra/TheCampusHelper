import { FieldValue } from 'firebase-admin/firestore';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requireCompleteProfile, requireUser } from '../_lib/authz';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 25 * 1024; // 25KB

type SubmitBody = {
  title: string;
  subject: string;
  branch: 'CSE' | 'IT' | 'DS' | 'AIML' | 'CYS' | 'ECE' | 'EEE' | 'MECH' | 'CIVIL';
  semester: string;
  type: string;
  downloadUrl: string;
  driveFileId?: string;

  // Modern file metadata (preferred)
  mimeType?: string;
  originalFileName?: string;
  fileSizeBytes?: number;
  storagePath?: string;
};

const ALLOWED_BRANCHES = new Set<SubmitBody['branch']>([
  'CSE',
  'IT',
  'DS',
  'AIML',
  'CYS',
  'ECE',
  'EEE',
  'MECH',
  'CIVIL',
]);

const SYSTEM_RESOURCE_TYPES = new Set(['PPT', 'MidPaper', 'PYQ', 'ImpQ']);

function normalizeResourceType(raw: string): { type: string; legacyType?: string } | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  if (SYSTEM_RESOURCE_TYPES.has(t)) return { type: t };

  // Legacy mappings (best-effort). We keep the original in legacyType.
  if (t === 'Note' || t === 'Lab Record') return { type: 'ImpQ', legacyType: t };

  const lower = t.toLowerCase();
  if (lower === 'mid papers' || lower === 'midpaper') return { type: 'MidPaper', legacyType: t };
  if (lower === 'pyqs' || lower === 'pyq') return { type: 'PYQ', legacyType: t };
  if (lower === 'ppts' || lower === 'ppt') return { type: 'PPT', legacyType: t };
  if (lower === 'important qs' || lower === 'important questions') return { type: 'ImpQ', legacyType: t };

  return null;
}

function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
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
    const body = (req.body || {}) as SubmitBody;

    const title = (body.title ?? '').trim();
    const subject = (body.subject ?? '').trim();
    const branch = body.branch;
    const semester = (body.semester ?? '').trim();
    const typeRaw = (body.type ?? '').trim();
    const downloadUrl = (body.downloadUrl ?? '').trim();
    const driveFileId = body.driveFileId?.trim();

    const mimeType = (body.mimeType ?? '').trim();
    const originalFileName = (body.originalFileName ?? '').trim();
    const fileSizeBytes = typeof body.fileSizeBytes === 'number' ? body.fileSizeBytes : undefined;
    const storagePath = (body.storagePath ?? '').trim();

    if (!title || title.length > 200) return res.status(400).json({ error: 'Invalid title', requestId: ctx.requestId });
    if (!subject || subject.length > 200) return res.status(400).json({ error: 'Invalid subject', requestId: ctx.requestId });
    if (!ALLOWED_BRANCHES.has(branch)) {
      return res.status(400).json({ error: 'Invalid branch', requestId: ctx.requestId });
    }
    if (!semester || semester.length > 10) return res.status(400).json({ error: 'Invalid semester', requestId: ctx.requestId });
    const normalizedType = normalizeResourceType(typeRaw);
    if (!normalizedType) {
      return res.status(400).json({ error: 'Invalid type', requestId: ctx.requestId });
    }
    if (!downloadUrl || downloadUrl.length > 2000 || !isHttpUrl(downloadUrl)) {
      return res.status(400).json({ error: 'Invalid downloadUrl', requestId: ctx.requestId });
    }
    if (driveFileId && driveFileId.length > 300) {
      return res.status(400).json({ error: 'Invalid driveFileId', requestId: ctx.requestId });
    }

    if (mimeType && mimeType.length > 200) {
      return res.status(400).json({ error: 'Invalid mimeType', requestId: ctx.requestId });
    }
    if (originalFileName && originalFileName.length > 260) {
      return res.status(400).json({ error: 'Invalid originalFileName', requestId: ctx.requestId });
    }
    if (typeof fileSizeBytes === 'number') {
      if (!Number.isFinite(fileSizeBytes) || fileSizeBytes < 0 || fileSizeBytes > 50 * 1024 * 1024) {
        return res.status(400).json({ error: 'Invalid fileSizeBytes', requestId: ctx.requestId });
      }
    }
    if (storagePath && storagePath.length > 600) {
      return res.status(400).json({ error: 'Invalid storagePath', requestId: ctx.requestId });
    }

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    const ref = db.collection('resources').doc();
    await ref.create({
      title,
      subject,
      branch,
      semester,
      type: normalizedType.type,
      legacyType: normalizedType.legacyType || undefined,
      downloadUrl,
      driveFileId: driveFileId || undefined,
      mimeType: mimeType || undefined,
      originalFileName: originalFileName || undefined,
      fileSizeBytes: typeof fileSizeBytes === 'number' ? fileSizeBytes : undefined,
      storagePath: storagePath || undefined,
      status: 'pending',
      ownerId: caller.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await writeAuditLog({
      action: 'resource.submit',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { resourceId: ref.id, title, subject, branch, semester, type: normalizedType.type },
    });

    return res.status(200).json({ resourceId: ref.id });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
