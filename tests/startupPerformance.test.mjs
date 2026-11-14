import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const libraryHook = await readFile(new URL('../src/features/library/useLibrary.js', import.meta.url), 'utf8');
const libraryPage = await readFile(new URL('../src/features/library/LibraryPage.jsx', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('startup does not wait through an artificial splash delay', () => {
  assert.doesNotMatch(app, /minimumSplashDuration|completionDuration/);
  assert.match(app, /setContent\(merged\)/);
});

test('path content and daily overrides are fetched concurrently', () => {
  assert.match(app, /Promise\.all\(\[pathRequest, overridesRequest\]\)/);
  assert.ok(app.indexOf('const pathRequest = fetch') < app.indexOf('const overridesRequest = fetch'));
});

test('library synchronization is deferred until a library-dependent screen is opened', () => {
  assert.match(app, /const libraryNeeded = screen === 'books' \|\| screen === 'bookReader' \|\| screen === 'dailyResult'/);
  assert.match(app, /useLibrary\(libraryNeeded\)/);
  assert.match(libraryHook, /if \(enabled && !hasLoadedOnce\.current\) refresh\(\)/);
  assert.match(libraryHook, /if \(refreshInFlight\.current\) return refreshInFlight\.current/);
});

test('recommended books can be loaded on demand without relying on startup preloading', () => {
  assert.match(app, /const availableBooks = books\.length \? books : await refreshLibrary\(\)/);
});

test('library covers use lazy loading and asynchronous decoding', () => {
  assert.match(libraryPage, /loading="lazy" decoding="async" fetchPriority="low"/);
});

test('initial splash uses the smaller existing logo asset', async () => {
  assert.match(html, /assets\/logo\.png/);
  const small = await stat(new URL('../public/assets/logo.png', import.meta.url));
  const large = await stat(new URL('../public/assets/Logo m24.png', import.meta.url));
  assert.ok(small.size < large.size, 'splash logo should be smaller than the legacy high-resolution logo');
});
