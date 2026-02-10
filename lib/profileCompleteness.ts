import type { UserProfile } from '../types';

export type ProfileFieldKey =
  | 'displayName'
  | 'collegeEmail'
  | 'dateOfBirth'
  | 'branch'
  | 'section';

const isNonEmptyString = (v: unknown, maxLen = 200): v is string => {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  return s.length > 0 && s.length <= maxLen;
};

const isValidCollegeEmail = (value: string): boolean => {
  const v = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._%+-]{1,63}@[a-z0-9-]+\.sreenidh(i)?\.edu\.in$/.test(v);
};

// Canonical completeness check used across client + server.
// Keep this conservative: if in doubt, treat as incomplete.
export const missingProfileFields = (profile: Partial<UserProfile> | null | undefined): ProfileFieldKey[] => {
  const p = profile || {};
  const missing: ProfileFieldKey[] = [];

  if (!isNonEmptyString(p.displayName, 80)) missing.push('displayName');

  const collegeEmail = typeof p.collegeEmail === 'string' ? p.collegeEmail.trim() : '';
  if (!collegeEmail || collegeEmail.length > 120 || !isValidCollegeEmail(collegeEmail)) {
    missing.push('collegeEmail');
  }

  // DOB format is currently stored as DD-MM-YYYY in the UI; keep validation minimal here.
  if (!isNonEmptyString(p.dateOfBirth, 16)) missing.push('dateOfBirth');

  if (!isNonEmptyString(p.branch, 20)) missing.push('branch');
  if (!isNonEmptyString(p.section, 10)) missing.push('section');

  return missing;
};

export const isProfileComplete = (profile: Partial<UserProfile> | null | undefined): boolean => {
  return missingProfileFields(profile).length === 0;
};
