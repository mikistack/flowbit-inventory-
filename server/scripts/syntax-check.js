const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'src');

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
};

const files = walk(root);
let ok = true;

for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'ignore' });
  } catch (error) {
    ok = false;
    // eslint-disable-next-line no-console
    console.error(`Syntax check failed: ${path.relative(process.cwd(), file)}`);
  }
}

if (!ok) {
  process.exit(1);
}

