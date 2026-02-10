import { spawn } from 'node:child_process';
import process from 'node:process';

const args = process.argv.slice(2);

// When `vercel dev` runs, it executes the project's configured "Development Command".
// If that command itself runs `vercel dev`, Vercel detects recursion and aborts.
//
// To avoid that, we make `npm run dev` behave like:
// - normal shell: start `vercel dev`
// - inside Vercel's dev-command invocation: start `vite`
const inVercelContext = Boolean(
  process.env.VERCEL ||
  process.env.VERCEL_DEV ||
  process.env.VERCEL_ENV ||
  process.env.NOW_REGION
);

const command = inVercelContext ? 'vite' : 'vercel';
const commandArgs = inVercelContext ? args : ['dev', '--yes', ...args];

const child = spawn(command, commandArgs, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

child.on('error', (err) => {
  console.error(err);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
