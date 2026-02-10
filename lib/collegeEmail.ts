import type { BranchKey } from '../types';

const BRANCH_TO_DOMAIN: Record<BranchKey, string> = {
  CSE: 'cse.sreenidhi.edu.in',
  IT: 'it.sreenidhi.edu.in',
  DS: 'ds.sreenidhi.edu.in',
  AIML: 'aiml.sreenidhi.edu.in',
  CYS: 'cs.sreenidhi.edu.in',
  ECE: 'ece.sreenidhi.edu.in',
  EEE: 'eee.sreenidhi.edu.in',
  MECH: 'me.sreenidhi.edu.in',
  CIVIL: 'ce.sreenidhi.edu.in',
};

const ALLOWED_DOMAINS = new Set(Object.values(BRANCH_TO_DOMAIN));

export function normalizeCollegeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

export function inferBranchFromCollegeEmail(email: string): BranchKey | null {
  const e = normalizeCollegeEmail(email);
  const at = e.lastIndexOf('@');
  if (at <= 0) return null;
  const domain = e.slice(at + 1);

  const entry = (Object.entries(BRANCH_TO_DOMAIN) as Array<[BranchKey, string]>).find(([, d]) => d === domain);
  return entry ? entry[0] : null;
}

export function inferRollNumberFromCollegeEmail(email: string): string | null {
  const e = normalizeCollegeEmail(email);
  const at = e.indexOf('@');
  if (at <= 0) return null;
  const local = e.slice(0, at).trim();
  if (!local) return null;
  if (!/^[a-z0-9]{6,16}$/.test(local)) return null;
  return local.toUpperCase();
}

export function isValidCollegeEmailSyntax(email: string): boolean {
  const e = normalizeCollegeEmail(email);
  const at = e.lastIndexOf('@');
  if (at <= 0) return false;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);

  if (!/^[a-z0-9]{6,16}$/.test(local)) return false;
  if (!ALLOWED_DOMAINS.has(domain)) return false;
  return true;
}

export function isValidCollegeEmailForBranch(branch: BranchKey | string | null | undefined, email: string): boolean {
  if (typeof branch !== 'string') return false;
  const b = branch.trim() as BranchKey;
  const expected = (BRANCH_TO_DOMAIN as Record<string, string>)[b];
  if (!expected) return false;

  const e = normalizeCollegeEmail(email);
  const at = e.lastIndexOf('@');
  if (at <= 0) return false;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);

  return /^[a-z0-9]{6,16}$/.test(local) && domain === expected;
}

export function expectedDomainForBranch(branch: BranchKey): string {
  return BRANCH_TO_DOMAIN[branch];
}
