import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('the app revalidates the current canonical daily content and example overlay assets', () => {
  assert.ok(appSource.includes("PATH_CONTENT_CACHE_VERSION = '20261119-path-content-v2'"));
  assert.ok(appSource.includes("DAILY_TEXT_OVERRIDES_CACHE_VERSION = '20261121-daily-assistant-examples'"));
  assert.ok(appSource.includes('content/path-content.json?v=${PATH_CONTENT_CACHE_VERSION}'));
  assert.ok(appSource.includes('content/daily-text-overrides.v1.json?v=${DAILY_TEXT_OVERRIDES_CACHE_VERSION}'));
  assert.ok(appSource.includes("cache: attempt === 0 ? 'no-cache' : 'reload'"));
  assert.ok(appSource.includes("cache: 'no-cache', priority: 'low'"));
  assert.ok(!appSource.includes('v=20261023-fast-open'));
  assert.ok(!appSource.includes('v=20261118-t14'));
});
