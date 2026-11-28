import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const serviceWorker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('offline cache is restricted to same-origin public app assets and content', () => {
  assert.match(serviceWorker, /url\.origin === APP_SCOPE\.origin/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\(APP_SCOPE\.pathname\)/);
  assert.match(serviceWorker, /content\|assistant/);
  assert.match(serviceWorker, /assets\\\//);
  assert.match(serviceWorker, /request\.method !== 'GET'/);
  assert.match(serviceWorker, /api\|auth\|account\|profile\|user-data/);
  assert.match(serviceWorker, /private\|no-store/);
  assert.doesNotMatch(serviceWorker, /skipWaiting\(/);
});

test('service worker does not access personal profile stores or credentials', () => {
  const executable = serviceWorker.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(executable, /localStorage|indexedDB|Authorization|credentials:/i);
  assert.match(serviceWorker, /User records[\s\S]*?deliberately outside this service worker's cache boundary/);
});

test('startup retry reruns content loading without forcing a WebView reload', () => {
  assert.match(app, /\[runtimeRepository, startupAttempt\]/);
  assert.match(app, /setStartupAttempt\(\(attempt\) => attempt \+ 1\)/);
  assert.match(app, /addEventListener\('online', retryAfterReconnect\)/);
  assert.doesNotMatch(app, /window\.location\.reload\(\)/);
});

test('service worker registration is scoped and non-blocking', () => {
  assert.match(app, /navigator\.serviceWorker\.register\(`\$\{import\.meta\.env\.BASE_URL\}sw\.js`/);
  assert.match(app, /must never prevent normal online startup/);
});