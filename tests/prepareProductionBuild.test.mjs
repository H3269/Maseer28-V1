import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const script = fileURLToPath(new URL('../scripts/prepare-production-build.mjs', import.meta.url));

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maseer28-production-'));
  fs.mkdirSync(path.join(root, 'src/features/journey'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/features/journey/journeyStore.js'),
    'export const APP_CONFIG = { TEST_MODE: true, TIME_LOCK_ENABLED: false };\n');
  fs.writeFileSync(path.join(root, 'vite.config.js'),
    "export default { base: '/Maseer28-V1/' };\n");
  return root;
}

test('production preparation disables test mode, enables daily lock and sets deployment base', () => {
  const root = fixture();
  try {
    const output = execFileSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
    const journey = fs.readFileSync(path.join(root, 'src/features/journey/journeyStore.js'), 'utf8');
    const vite = fs.readFileSync(path.join(root, 'vite.config.js'), 'utf8');
    assert.match(journey, /TEST_MODE: false/);
    assert.match(journey, /TIME_LOCK_ENABLED: true/);
    assert.match(vite, /base: '\/Maseer28\/'/);
    assert.match(output, /Prepared production build/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('production preparation refuses ambiguous duplicate configuration', () => {
  const root = fixture();
  try {
    fs.appendFileSync(path.join(root, 'src/features/journey/journeyStore.js'),
      '\nexport const TEST_OVERRIDE = { TEST_MODE: true };\n');
    assert.throws(
      () => execFileSync(process.execPath, [script], { cwd: root, encoding: 'utf8', stdio: 'pipe' }),
      /Expected exactly one TEST_MODE setting/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
