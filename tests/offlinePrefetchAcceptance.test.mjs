import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const serviceWorker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const repository = await readFile(new URL('../src/features/content/runtimeContentRepository.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('offline hydration is limited to the complete 34-topic public content index', () => {
  assert.match(serviceWorker, /index\\?\.topics\\.length === 34/);
  assert.match(serviceWorker, /topics\\/T\\\\d\\{2\\}\\\\.json/);
  assert.match(serviceWorker, /overrides\\/T\\\\d\\{2\\}\\\\.json/);
  assert.match(serviceWorker, /expectedTopicFiles: 68/);
});

test('offline hydration includes the published book texts and public covers', () => {
  assert.match(serviceWorker, /content\\/library\\.seed\\.json/);
  assert.match(serviceWorker, /content\\/books\\//);
  assert.match(serviceWorker, /book\\?\.cover/);
  assert.match(serviceWorker, /libraryCover/);
});

test('offline cache never stores private user records or cross-origin resources', () => {
  assert.match(serviceWorker, /url\\.origin === APP_SCOPE\\.origin/);
  assert.match(serviceWorker, /api\\|auth\\|account\\|profile\\|user-data/);
  assert.match(serviceWorker, /private\\|no-store/);
  assert.match(serviceWorker, /credentials: 'same-origin'/);
  assert.doesNotMatch(serviceWorker, /localStorage|indexedDB|Authorization|credentials: 'include'/i);
});

test('runtime content requests have a bounded timeout and retry path', () => {
  assert.match(repository, /AbortController/);
  assert.match(repository, /setTimeout\\(\\(\\) => controller\\.abort\\(\\), 8000\\)/);
  assert.match(repository, /attempt <= retries/);
  assert.match(app, /بررسی اتصال و تلاش دوباره/);
  assert.match(app, /setStartupAttempt\\(\\(attempt\\) => attempt \\+ 1\\)/);
});

test('offline content prefetch is best-effort and does not block online startup', () => {
  assert.match(serviceWorker, /prefetchOfflineContent\\(\\)\\.catch\\(\\(\\) => \\{\\}\\)/);
  assert.match(serviceWorker, /Optional preload failure does not invalidate a valid app shell/);
  assert.doesNotMatch(serviceWorker, /skipWaiting\\(/);
});
