import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const screens = readFileSync(new URL('../src/features/journey/JourneyScreens.jsx', import.meta.url), 'utf8');

test('completion screen receives journey state and guards missing journey data', () => {
  assert.match(app, /screen === 'done' && <Done journey=\{journey\}/);
  assert.match(screens, /export function Done\(\{ journey = \{\}/);
  assert.match(screens, /journey\.archiveRecoveryRequired/);
});
