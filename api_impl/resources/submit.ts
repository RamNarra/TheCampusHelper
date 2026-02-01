import { FieldValue } from 'firebase-admin/firestore';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import { assertBodySize, assertJson, requireUser } from '../_lib/authz';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { writeAuditLog } from '../_lib/auditLog';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 25 * 1024; // 25KB

type SubmitBody = {
  title: string;
  subject: string;
  branch: 'CS_IT_DS' | 'AIML_ECE_CYS' | 'ECE' | 'EEE' | 'MECH' | 'CIVIL';
  semester: string;
  unit?: string;
  type: string;
  downloadUrl: string;
  driveFileId?: string;
};

const ALLOWED_BRANCHES = new Set<SubmitBody['branch']>([
  'CS_IT_DS',
  'AIML_ECE_CYS',
  'ECE',
  'EEE',
  'MECH',
  'CIVIL',
]);

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
    const body = (req.body || {}) as SubmitBody;

    const title = (body.title ?? '').trim();
    const subject = (body.subject ?? '').trim();
    const branch = body.branch;
    const semester = (body.semester ?? '').trim();
    const unit = body.unit?.trim();
    const type = (body.type ?? '').trim();
    const downloadUrl = (body.downloadUrl ?? '').trim();
    const driveFileId = body.driveFileId?.trim();

    if (!title || title.length > 200) return res.status(400).json({ error: 'Invalid title', requestId: ctx.requestId });
    if (!subject || subject.length > 200) return res.status(400).json({ error: 'Invalid subject', requestId: ctx.requestId });
    if (!ALLOWED_BRANCHES.has(branch)) {
      return res.status(400).json({ error: 'Invalid branch', requestId: ctx.requestId });
    }
    if (!semester || semester.length > 10) return res.status(400).json({ error: 'Invalid semester', requestId: ctx.requestId });
    if (unit && unit.length > 20) return res.status(400).json({ error: 'Invalid unit', requestId: ctx.requestId });
    if (!type || type.length > 50) return res.status(400).json({ error: 'Invalid type', requestId: ctx.requestId });
    if (!downloadUrl || downloadUrl.length > 2000 || !isHttpUrl(downloadUrl)) {
      return res.status(400).json({ error: 'Invalid downloadUrl', requestId: ctx.requestId });
    }
    if (driveFileId && driveFileId.length > 300) {
      return res.status(400).json({ error: 'Invalid driveFileId', requestId: ctx.requestId });
    }

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    const ref = db.collection('resources').doc();
    await ref.create({
      title,
      subject,
      branch,
      semester,
      unit: unit || undefined,
      type,
      downloadUrl,
      driveFileId: driveFileId || undefined,
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
      metadata: { resourceId: ref.id, title, subject, branch, semester, unit: unit || null, type },
    });

    return res.status(200).json({ resourceId: ref.id });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
