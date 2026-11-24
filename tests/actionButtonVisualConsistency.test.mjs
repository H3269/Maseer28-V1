import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const screens = await readFile(new URL('../src/features/journey/JourneyScreens.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/styles/original-v72.css', import.meta.url), 'utf8');

test('support actions use the shared icon-divider-label structure', () => {
  for (const label of ['باز کردن پیامک', 'کپی شماره', 'ورود به پشتیبانی تلگرام', 'ورود به کانال مرکز']) {
    assert.ok(screens.includes(`m28ActionText">${label}`), `missing action label: ${label}`);
  }
  assert.ok((screens.match(/m28IconAction/g) || []).length >= 4);
});

test('daily completion action uses the same shared structure', () => {
  assert.match(screens, /id="openDailyEntryBtn"[^>]*className="primary heroAction m28IconAction"/);
  assert.match(screens, /m28ActionText">انجام دادم؛ ثبت نتیجه امروز/);
});

test('shared action styles render a visible icon/text divider', () => {
  assert.match(styles, /\.m28ActionIcon[\s\S]*border-inline-end: 1px solid currentColor/);
  assert.match(styles, /\.m28ActionText/);
});
