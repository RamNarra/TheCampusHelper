export type AuditAction =
  | 'user.role.set'
  | 'user.disabled.set'
  | 'auth.bootstrap_admin'
  | 'config.phase1.toggle'
  | 'course.visibility.set'
  | 'course.stream.post.create'
  | 'assignment.create'
  | 'assignment.publish'
  | 'submission.submit'
  | 'submission.grade.set'
  | 'test.create'
  | 'test.publish'
  | 'test.attempt.start'
  | 'test.attempt.submit'
  | 'gradebook.read'
  | 'gradebook.recompute'
  | 'studyGroup.request.approve'
  | 'studyGroup.request.reject'
  | 'studyGroup.join'
  | 'studyGroup.leave'
  | 'studyGroup.session.create'
  | 'studyGroup.session.update'
  | 'studyGroup.session.delete'
  | 'course.create'
  | 'enrollment.set'
  | 'calendar.event.create'
  | 'calendar.event.update'
  | 'resource.submit'
  | 'resource.delete'
  | 'resource.status.set';

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
