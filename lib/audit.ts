export type AuditAction =
  | 'user.role.set'
  | 'user.disabled.set'
  | 'auth.bootstrap_admin'
  | 'course.create'
  | 'enrollment.set'
  | 'calendar.event.create';

export interface AuditLogEntry {
  id?: string;
  action: AuditAction;
  actorUid: string;
  actorEmail?: string | null;
  actorRole?: string | null;
  targetUid?: string | null;
  targetEmail?: string | null;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  createdAt: any;
  metadata?: Record<string, unknown>;
}
