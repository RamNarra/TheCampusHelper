import type { UserProfile } from '../types';
import {
  isValidCollegeEmailForBranch,
  isValidCollegeEmailSyntax,
  normalizeCollegeEmail,
} from './collegeEmail';

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

// Canonical completeness check used across client + server.
// Keep this conservative: if in doubt, treat as incomplete.
export const missingProfileFields = (profile: Partial<UserProfile> | null | undefined): ProfileFieldKey[] => {
  const p = profile || {};
  const missing: ProfileFieldKey[] = [];

  if (!isNonEmptyString(p.displayName, 80)) missing.push('displayName');

  const collegeEmailRaw = typeof p.collegeEmail === 'string' ? p.collegeEmail : '';
  const collegeEmail = normalizeCollegeEmail(collegeEmailRaw);
  if (!collegeEmail || collegeEmail.length > 120 || !isValidCollegeEmailSyntax(collegeEmail)) {
    missing.push('collegeEmail');
  } else if (typeof p.branch !== 'string' || !isValidCollegeEmailForBranch(p.branch, collegeEmail)) {
    // If branch is missing, that will be surfaced by the 'branch' field too.
    // But we still treat collegeEmail as invalid if it doesn't match the expected branch domain.
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
