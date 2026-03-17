import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.join(import.meta.dirname, '..');
const srcRoot = path.join(repoRoot, 'src');

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
      out.push(full);
    }
  }
  return out;
};

const files = [
  path.join(repoRoot, 'vite.config.js'),
  ...walk(srcRoot),
];

let ok = true;
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'ignore' });
  } catch {
    ok = false;
    // eslint-disable-next-line no-console
    console.error(`Syntax check failed: ${path.relative(process.cwd(), file)}`);
  }
}

if (!ok) process.exit(1);

