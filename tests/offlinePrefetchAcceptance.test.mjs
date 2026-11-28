import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const serviceWorker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const repository = await readFile(new URL('../src/features/content/runtimeContentRepository.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('offline hydration targets all 34 topic base files and overlays', () => {
  assert.ok(serviceWorker.includes('!Array.isArray(index?.topics) || index.topics.length !== 34'));
  assert.ok(serviceWorker.includes("topic?.basePath || ''"));
  assert.ok(serviceWorker.includes("topic?.overridePath || ''"));
  assert.ok(serviceWorker.includes('expectedTopicFiles: 68'));
  assert.ok(serviceWorker.includes('if (paths.length !== 68) return;'));
  assert.ok(serviceWorker.includes('if (books.length !== 5) return;'));
  assert.ok(serviceWorker.includes("paths.push('content/runtime-v1/' + topic.basePath)"));
  assert.ok(serviceWorker.includes("paths.push('content/runtime-v1/' + topic.overridePath)"));
});

test('offline hydration includes published book texts and public covers', () => {
  assert.ok(serviceWorker.includes("new URL('content/library.seed.json', APP_SCOPE)"));
  assert.ok(serviceWorker.includes("paths.push(book.file)"));
  assert.ok(serviceWorker.includes('book?.cover'));
  assert.ok(serviceWorker.includes('book?.libraryCover'));
});

test('offline cache excludes private user data and cross-origin resources', () => {
  assert.ok(serviceWorker.includes('url.origin === APP_SCOPE.origin'));
  assert.ok(serviceWorker.includes('api|auth|account|profile|user-data'));
  assert.ok(serviceWorker.includes('/private|no-store/i'));
  assert.doesNotMatch(serviceWorker, /localStorage|indexedDB|Authorization|credentials: 'include'/i);
});

test('incomplete prefetch is not marked ready and can be retried', () => {
  assert.ok(serviceWorker.includes('if (failedFiles === 0 && paths.length >= 73)'));
  assert.ok(serviceWorker.includes('A later online visit can retry the incomplete prefetch.'));
  assert.ok(serviceWorker.includes('prefetchOfflineContent().catch(() => {})'));
});

test('runtime content requests have bounded timeouts and retry handling', () => {
  assert.ok(repository.includes('new AbortController()'));
  assert.ok(repository.includes('setTimeout(() => controller.abort(), 8000)'));
  assert.ok(repository.includes('attempt <= retries'));
  assert.ok(app.includes('بررسی اتصال و تلاش دوباره'));
  assert.ok(app.includes('setStartupAttempt((attempt) => attempt + 1)'));
});

test('lazy first-party screens are warmed without blocking online startup indefinitely', () => {
  assert.ok(app.includes('loadGlobalAssistantLauncher()'));
  assert.ok(app.includes('loadLibraryPage()'));
  assert.ok(app.includes('loadReader()'));
  assert.ok(app.includes('Promise.race'));
  assert.ok(app.includes('setTimeout(resolve, 3000)'));
});

test('service worker source parses as valid JavaScript', () => {
  execFileSync(process.execPath, ['--check', fileURLToPath(new URL('../public/sw.js', import.meta.url))]);
});
