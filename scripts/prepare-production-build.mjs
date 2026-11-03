import fs from 'node:fs';
import path from 'node:path';
import { validateProductionContent } from '../src/features/content/productionContentGate.js';

const root = process.cwd();

const readJson = (relativePath) => JSON.parse(
  fs.readFileSync(path.join(root, relativePath), 'utf8')
);
const productionContentErrors = validateProductionContent({
  content: readJson('public/content/path-content.json'),
  topicsRegistry: readJson('public/assistant/knowledge/topics.v1.json'),
  subtopicsRegistry: readJson('public/assistant/knowledge/subtopics.v1.json'),
  evidenceRegistry: readJson('public/assistant/evidence/sources.v1.json'),
});
if (productionContentErrors.length) {
  const details = productionContentErrors.slice(0, 30).join('\\n');
  throw new Error(
    `Production publication blocked: ${productionContentErrors.length} daily content approval issue(s).\\n${details}`
  );
}
const basePath = process.env.PATH28_DEPLOY_BASE || '/Maseer28/';
if (!/^\/[A-Za-z0-9/_-]*\/$/.test(basePath)) {
  throw new Error('PATH28_DEPLOY_BASE must be a safe absolute path ending in /.');
}

function replaceExactlyOnce(filePath, pattern, replacer, label) {
  const absolute = path.join(root, filePath);
  let source = fs.readFileSync(absolute, 'utf8');
  const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  const matches = [...source.matchAll(globalPattern)];
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${label} setting in ${filePath}; found ${matches.length}.`);
  }
  source = source.replace(pattern, replacer);
  fs.writeFileSync(absolute, source, 'utf8');
}

replaceExactlyOnce(
  'src/features/journey/journeyStore.js',
  /(\bTEST_MODE\s*:\s*)(?:true|false)\b/,
  (_match, prefix) => `${prefix}false`,
  'TEST_MODE'
);
replaceExactlyOnce(
  'src/features/journey/journeyStore.js',
  /(\bTIME_LOCK_ENABLED\s*:\s*)(?:true|false)\b/,
  (_match, prefix) => `${prefix}true`,
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
