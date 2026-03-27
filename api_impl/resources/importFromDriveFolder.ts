import { FieldValue } from 'firebase-admin/firestore';
import { applyCors, isOriginAllowed } from '../_lib/cors';
import {
  assertBodySize,
  assertJson,
  requireCompleteProfile,
  requirePermission,
  requireUser,
} from '../_lib/authz';
import { writeAuditLog } from '../_lib/auditLog';
import { ensureFirebaseAdminApp } from '../_lib/firebaseAdmin';
import { getRequestContext, type VercelRequest, type VercelResponse } from '../_lib/request';
import { getDriveApiKey, listDriveFolderFiles } from '../_lib/googleDrive';

export const config = { runtime: 'nodejs' };

const MAX_BODY_SIZE = 40 * 1024;

type ImportBody = {
  folderId: string;
  branch: 'CSE' | 'IT' | 'DS' | 'AIML' | 'CYS' | 'ECE' | 'EEE' | 'MECH' | 'CIVIL';
  semester: string;
  subject: string;
  type: 'PPT' | 'MidPaper' | 'PYQ' | 'ImpQ';
  maxFiles?: number;
};

const ALLOWED_BRANCHES = new Set<ImportBody['branch']>([
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

function isFolderId(v: unknown): v is string {
  return typeof v === 'string' && /^[-\w]{10,}$/.test(v.trim());
}

function looksLikePdfOrPpt(name: string, mimeType: string): boolean {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return true;
  if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return true;
  if (mimeType === 'application/pdf') return true;
  if (mimeType === 'application/vnd.ms-powerpoint') return true;
  if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return true;
  return false;
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
    requirePermission(caller, 'resources.moderate');

    const body = (req.body || {}) as ImportBody;
    const folderId = (body.folderId || '').trim();
    const branch = body.branch;
    const semester = (body.semester || '').trim();
    const subject = (body.subject || '').trim();
    const type = body.type;
    const maxFiles = typeof body.maxFiles === 'number' ? body.maxFiles : 200;

    if (!isFolderId(folderId)) return res.status(400).json({ error: 'Invalid folderId', requestId: ctx.requestId });
    if (!ALLOWED_BRANCHES.has(branch)) return res.status(400).json({ error: 'Invalid branch', requestId: ctx.requestId });
    if (!semester || semester.length > 10) return res.status(400).json({ error: 'Invalid semester', requestId: ctx.requestId });
    if (!subject || subject.length > 200) return res.status(400).json({ error: 'Invalid subject', requestId: ctx.requestId });
    if (type !== 'PPT' && type !== 'MidPaper' && type !== 'PYQ' && type !== 'ImpQ') {
      return res.status(400).json({ error: 'Invalid type', requestId: ctx.requestId });
    }

    const apiKey = getDriveApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: 'Drive API is not configured (missing DRIVE_API_KEY)', requestId: ctx.requestId });
    }

    const files = await listDriveFolderFiles({ folderId, apiKey, maxFiles, includeGoogleDocs: true });

    const admin = ensureFirebaseAdminApp();
    const db = admin.firestore();

    let imported = 0;
    let skipped = 0;
    const results: Array<{ driveFileId: string; title: string; ok: boolean; reason?: string; resourceId?: string }> = [];

    // Avoid duplicates: check existing resources by driveFileId (best-effort)
    const seenDriveIds = new Set<string>();

    for (const f of files) {
      const driveFileId = f.id;
      const title = (f.name || '').trim().slice(0, 200) || `Drive File ${driveFileId.slice(0, 8)}`;
      if (!driveFileId) {
        skipped++;
        continue;
      }
      if (seenDriveIds.has(driveFileId)) {
        skipped++;
        results.push({ driveFileId, title, ok: false, reason: 'Duplicate in listing' });
        continue;
      }
      seenDriveIds.add(driveFileId);

      // Filter to likely useful doc types (keep this conservative)
      if (!looksLikePdfOrPpt(title, f.mimeType)) {
        skipped++;
        results.push({ driveFileId, title, ok: false, reason: 'Skipped (not PDF/PPT)' });
        continue;
      }

      try {
        const existing = await db
          .collection('resources')
          .where('driveFileId', '==', driveFileId)
          .limit(1)
          .get();

        if (!existing.empty) {
          skipped++;
          results.push({ driveFileId, title, ok: false, reason: 'Already exists' });
          continue;
        }

        const ref = db.collection('resources').doc();
        const downloadUrl = `https://drive.google.com/file/d/${driveFileId}/view`;
        await ref.create({
          title,
          subject,
          branch,
          semester,
          type,
          downloadUrl,
          driveFileId,
          mimeType: f.mimeType || undefined,
          originalFileName: title,
          fileSizeBytes: f.size ? Number(f.size) || undefined : undefined,
          status: 'pending',
          ownerId: caller.uid,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        imported++;
        results.push({ driveFileId, title, ok: true, resourceId: ref.id });
      } catch (e: any) {
        skipped++;
        results.push({ driveFileId, title, ok: false, reason: e?.message || 'Import failed' });
      }
    }

    await writeAuditLog({
      action: 'resource.import.driveFolder',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: caller.role,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: {
        folderId,
        branch,
        semester,
        subject,
        type,
        imported,
        skipped,
        totalListed: files.length,
      },
    });

    return res.status(200).json({ ok: true, imported, skipped, totalListed: files.length, results });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || 'Internal Server Error';
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
