import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const libraryHook = await readFile(new URL('../src/features/library/useLibrary.js', import.meta.url), 'utf8');
const libraryPage = await readFile(new URL('../src/features/library/LibraryPage.jsx', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const assistantLauncher = await readFile(new URL('../src/features/assistant/GlobalAssistantLauncher.jsx', import.meta.url), 'utf8');

test('heavy library, reader, and assistant modules are split from the startup bundle', () => {
  assert.match(app, /const LibraryPage = lazy\(\(\) => import\('\.\/features\/library\/LibraryPage\.jsx'\)\)/);
  assert.match(app, /const Reader = lazy\(\(\) => import\('\.\/features\/library\/Reader\.jsx'\)\)/);
  assert.match(app, /const GlobalAssistantLauncher = lazy\(\(\) => import\('\.\/features\/assistant\/GlobalAssistantLauncher\.jsx'\)\)/);
  assert.match(app, /navVisible && <Suspense fallback=\{null\}>/);
});

test('startup does not wait through an artificial splash delay', () => {
  assert.doesNotMatch(app, /minimumSplashDuration|completionDuration/);
  assert.match(app, /setContent\(merged\)/);
});

test('path content and daily overrides are fetched concurrently', () => {
  assert.match(app, /Promise\.all\(\[pathRequest, overridesRequest\]\)/);
  assert.ok(app.indexOf('const pathRequest = fetch') < app.indexOf('const overridesRequest = fetch'));
});

test('the library catalogue does not download every full book on entry', () => {
  const seedStart = libraryHook.indexOf('async function seedLibrary()');
  const ensureStart = libraryHook.indexOf('export async function ensureSeedBookContent');
  const seedSource = libraryHook.slice(seedStart, ensureStart);
  const ensureSource = libraryHook.slice(ensureStart);
  assert.doesNotMatch(seedSource, /fetchJson\(meta\.file/);
  assert.match(ensureSource, /fetchJson\(currentBook\.seedFile/);
  assert.match(app, /ensureSeedBookContent\(book\)/);
  const recommendationStart = app.indexOf('async function findRelevantBook');
  const completionStart = app.indexOf('async function completeDay', recommendationStart);
  const recommendationSource = app.slice(recommendationStart, completionStart);
  assert.match(recommendationSource, /await refreshLibrary\(\)/);
  assert.match(recommendationSource, /await ensureSeedBookContent\(book\)/);
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

test('library assistant hydrates full book content only when the assistant is opened', () => {
  assert.match(assistantLauncher, /const libraryBooksLoadRef = useRef\(null\)/);
  assert.match(assistantLauncher, /else if \(open && !loadedLibraryBooks\.length\)/);
  assert.match(assistantLauncher, /function activate\(\)[\s\S]{0,180}ensureLibraryBooksLoaded\(\)/);
  assert.match(assistantLauncher, /ensureSeedBookContent\(book\)/);
  assert.match(assistantLauncher, /await libraryBooksLoadRef\.current/);
  assert.match(assistantLauncher, /screen === 'books' && !booksForTurn\.length/);
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
