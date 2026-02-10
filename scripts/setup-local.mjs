import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const envLocalPath = path.join(root, '.env.local');
const envExamplePath = path.join(root, '.env.example');

const exists = (p) => {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

if (!exists(envLocalPath)) {
  if (!exists(envExamplePath)) {
    console.error('Missing .env.example. Cannot bootstrap .env.local.');
    process.exit(1);
  }

  fs.copyFileSync(envExamplePath, envLocalPath);
  console.log('Created .env.local from .env.example');
} else {
  console.log('.env.local already exists (leaving it unchanged)');
}

console.log('Next: ensure .env.local has correct values. If you use Vercel, `npm run local:init` will pull dev env vars after linking.');
