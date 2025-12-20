import { FieldValue } from 'firebase-admin/firestore';
import { ensureFirebaseAdminApp } from './firebaseAdmin';
import type { AuditAction } from '../../lib/audit';

export async function writeAuditLog(params: {
  action: AuditAction;
  actorUid: string;
  actorEmail?: string | null;
  actorRole?: string | null;
  targetUid?: string | null;
  targetEmail?: string | null;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = ensureFirebaseAdminApp();
  const db = admin.firestore();

  await db.collection('auditLogs').add({
    action: params.action,
    actorUid: params.actorUid,
    actorEmail: params.actorEmail ?? null,
    actorRole: params.actorRole ?? null,
    targetUid: params.targetUid ?? null,
    targetEmail: params.targetEmail ?? null,
    requestId: params.requestId ?? null,
    ip: params.ip ?? null,
    userAgent: params.userAgent ?? null,
    metadata: params.metadata ?? {},
    createdAt: FieldValue.serverTimestamp(),
  });
}
