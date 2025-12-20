export const PLATFORM_ROLES = [
  'super_admin',
  'admin',
  'moderator',
  'instructor',
  'student',
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];

// Back-compat for legacy roles already stored in Firestore.
export type LegacyRole = 'user' | 'mod' | 'admin';

export type AnyRole = PlatformRole | LegacyRole | (string & {});

export const normalizeRole = (role: AnyRole | null | undefined): PlatformRole => {
  const r = (role || '').toString().trim().toLowerCase();
  if (r === 'super_admin' || r === 'superadmin' || r === 'super-admin') return 'super_admin';
  if (r === 'admin') return 'admin';
  if (r === 'moderator' || r === 'mod') return 'moderator';
  if (r === 'instructor' || r === 'teacher') return 'instructor';
  if (r === 'student' || r === 'user') return 'student';
  return 'student';
};

// Simple inheritance order.
const ROLE_RANK: Record<PlatformRole, number> = {
  super_admin: 5,
  admin: 4,
  moderator: 3,
  instructor: 2,
  student: 1,
};

export const isAtLeastRole = (role: AnyRole | null | undefined, minimum: PlatformRole): boolean => {
  const r = normalizeRole(role);
  return ROLE_RANK[r] >= ROLE_RANK[minimum];
};

export type Permission =
  | 'users.read'
  | 'users.manage_roles'
  | 'users.manage_status'
  | 'courses.create'
  | 'courses.manage'
  | 'calendar.manage'
  | 'resources.moderate'
  | 'audit.read'
  | 'system.health.read';

export type CourseScopedRole = 'student' | 'instructor';

export type CoursePermission = 'enrollments.manage' | 'events.manage';

export function hasCoursePermission(role: CourseScopedRole, permission: CoursePermission): boolean {
  const COURSE_PERMISSIONS: Record<CourseScopedRole, ReadonlySet<CoursePermission>> = {
    instructor: new Set(['enrollments.manage', 'events.manage']),
    student: new Set([]),
  };
  return COURSE_PERMISSIONS[role].has(permission);
}

const ROLE_PERMISSIONS: Record<PlatformRole, ReadonlySet<Permission>> = {
  super_admin: new Set([
    'users.read',
    'users.manage_roles',
    'users.manage_status',
    'resources.moderate',
    'audit.read',
    'system.health.read',
  ]),
  admin: new Set([
    'users.read',
    'users.manage_roles',
    'users.manage_status',
    'resources.moderate',
    'audit.read',
    'system.health.read',
  ]),
  moderator: new Set(['users.read', 'resources.moderate', 'audit.read']),
  instructor: new Set(['courses.create', 'courses.manage', 'calendar.manage']),
  student: new Set([]),
};

export const hasPermission = (role: AnyRole | null | undefined, permission: Permission): boolean => {
  const r = normalizeRole(role);
  return ROLE_PERMISSIONS[r].has(permission);
};

export const canAssignRole = (actorRole: AnyRole | null | undefined, targetRole: AnyRole | null | undefined, nextRole: AnyRole): boolean => {
  const actor = normalizeRole(actorRole);
  const target = normalizeRole(targetRole);
  const next = normalizeRole(nextRole);

  // Only admins+ may manage roles.
  if (!hasPermission(actor, 'users.manage_roles')) return false;

  // Only super_admin can create/modify super_admin.
  if ((target === 'super_admin' || next === 'super_admin') && actor !== 'super_admin') return false;

  // Cannot assign a role higher than yourself.
  if (!isAtLeastRole(actor, next)) return false;

  // Prevent same-rank admin sabotage: only super_admin can edit peers.
  if (actor !== 'super_admin' && ROLE_RANK[target] >= ROLE_RANK[actor]) return false;

  return true;
};
