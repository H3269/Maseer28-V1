import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const basePath = process.env.PATH28_DEPLOY_BASE || '/Maseer28/';
if (!/^\/[A-Za-z0-9/_-]*\/$/.test(basePath)) {
  throw new Error('PATH28_DEPLOY_BASE must be a safe absolute path ending in /.');
}

function replaceExactlyOnce(filePath, pattern, replacement, label) {
  const absolute = path.join(root, filePath);
  let source = fs.readFileSync(absolute, 'utf8');
  let count = 0;
  source = source.replace(pattern, (...args) => {
    count += 1;
    return typeof replacement === 'function' ? replacement(...args) : replacement;
  });
  if (count !== 1) {
    throw new Error(`Expected exactly one ${label} setting in ${filePath}; found ${count}.`);
  }
  fs.writeFileSync(absolute, source, 'utf8');
}

replaceExactlyOnce(
  'src/features/journey/journeyStore.js',
  /(\bTEST_MODE\s*:\s*)(?:true|false)\b/,
  '$1false',
  'TEST_MODE'
);
replaceExactlyOnce(
  'src/features/journey/journeyStore.js',
  /(\bTIME_LOCK_ENABLED\s*:\s*)(?:true|false)\b/,
  '$1true',
  'TIME_LOCK_ENABLED'
);
replaceExactlyOnce(
  'vite.config.js',
  /(\bbase\s*:\s*)['"][^'"]*['"]/,
  (_match, prefix) => `${prefix}'${basePath}'`,
  'Vite base path'
);

const journey = fs.readFileSync(path.join(root, 'src/features/journey/journeyStore.js'), 'utf8');
const vite = fs.readFileSync(path.join(root, 'vite.config.js'), 'utf8');
if (!/\bTEST_MODE\s*:\s*false\b/.test(journey)) throw new Error('Production TEST_MODE validation failed.');
if (!/\bTIME_LOCK_ENABLED\s*:\s*true\b/.test(journey)) throw new Error('Production time-lock validation failed.');
if (!vite.includes(`base: '${basePath}'`)) throw new Error('Production Vite base-path validation failed.');
console.log(`Prepared production build: TEST_MODE=false, TIME_LOCK_ENABLED=true, base=${basePath}`);
