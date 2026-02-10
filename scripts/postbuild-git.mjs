import { execSync } from 'node:child_process';

function run(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim();
}

function tryRun(cmd) {
  try {
    return { ok: true, out: run(cmd) };
  } catch (e) {
    const stderr = (e?.stderr ? String(e.stderr) : '') || (e?.message ? String(e.message) : '');
    return { ok: false, out: stderr.trim() };
  }
}

// Don’t auto-push in CI environments.
if (process.env.CI || process.env.GITHUB_ACTIONS || process.env.VERCEL) {
  process.exit(0);
}

// Allow opting out locally if needed.
if (process.env.AUTO_GIT_PUSH === '0') {
  process.exit(0);
}

// Ensure we’re in a git repo.
const isRepo = tryRun('git rev-parse --is-inside-work-tree');
if (!isRepo.ok || isRepo.out !== 'true') {
  process.exit(0);
}

// If no changes, nothing to do.
const status = tryRun('git status --porcelain=v1');
if (!status.ok) {
  process.exit(0);
}
if (!status.out) {
  process.exit(0);
}

// Stage, commit, push.
tryRun('git add -A');

const branch = (tryRun('git branch --show-current').out || 'main').trim();
const now = new Date();
const stamp = now.toISOString().replace(/[:.]/g, '-');
const msg = `chore: auto-push after build (${stamp})`;

const commit = tryRun(`git commit -m "${msg}"`);
if (!commit.ok) {
  // Common benign case: nothing staged, or hooks blocked.
  process.exit(0);
}

// Push may fail if no credentials; don’t fail build.
tryRun(`git push origin ${branch}`);
