import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const libraryHook = await readFile(new URL('../src/features/library/useLibrary.js', import.meta.url), 'utf8');
const libraryPage = await readFile(new URL('../src/features/library/LibraryPage.jsx', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const assistantLauncher = await readFile(new URL('../src/features/assistant/GlobalAssistantLauncher.jsx', import.meta.url), 'utf8');

test('library and reader modules remain split while the guide assistant is restored to eager loading', () => {
  assert.match(app, /const LibraryPage = lazy\(\(\) => import\('\.\/features\/library\/LibraryPage\.jsx'\)\)/);
  assert.match(app, /const Reader = lazy\(\(\) => import\('\.\/features\/library\/Reader\.jsx'\)\)/);
  assert.match(app, /import GlobalAssistantLauncher from '\.\/features\/assistant\/GlobalAssistantLauncher\.jsx'/);
  assert.doesNotMatch(app, /const GlobalAssistantLauncher = lazy/);
  assert.match(app, /navVisible && <GlobalAssistantLauncher/);
});

test('startup does not wait through an artificial splash delay', () => {
  assert.doesNotMatch(app, /minimumSplashDuration|completionDuration/);
  // Primary content is rendered first; optional overlays are merged afterward.
  assert.match(app, /setContent\(data\)/);
  assert.match(app, /mergeDailyTextOverrides\(data, overrides\)/);
  assert.doesNotMatch(app, /setContent\(merged\)/);
});

test('the home screen renders as soon as primary path content is ready', () => {
  assert.match(app, /pathRequest[\s\S]*?\.then\(\(data\) => \{[\s\S]*?setContent\(data\)/);
  assert.match(app, /overridesRequest\.then\(\(overrides\) => \{[\s\S]*?mergeDailyTextOverrides\(data, overrides\)/);
  assert.doesNotMatch(app, /Promise\.all\(\[pathRequest, overridesRequest\]\)/);
  assert.ok(app.indexOf('setContent(data)') < app.indexOf('overridesRequest.then'));
});

test('the static splash logo and title remain visible before React mounts', () => {
  assert.match(html, /\.initialSplash img\{[^}]*opacity:1;visibility:visible/);
  assert.match(html, /\.initialSplash h1\{[^}]*opacity:1/);
  assert.doesNotMatch(html, /\.initialSplash h1\{opacity:0!important/);
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

test('cached library catalogue is painted before the network manifest refresh', () => {
  assert.match(app, /const libraryNeeded = screen === 'books' \|\| screen === 'bookReader' \|\| screen === 'dailyResult'/);
  assert.match(app, /useLibrary\(libraryNeeded\)/);
  assert.ok(libraryHook.indexOf('cachedBooks = await libraryRepository.listBooks()') < libraryHook.indexOf('const seededBooks = await seedLibrary()'));
  assert.match(libraryHook, /setBooks\(cachedBooks\);\s*setLoading\(false\)/);
  assert.match(libraryHook, /if \(enabled && !hasLoadedOnce\.current\) refresh\(\)/);
  assert.match(libraryHook, /if \(refreshInFlight\.current\) return refreshInFlight\.current/);
});

test('recommended books can be loaded on demand without relying on startup preloading', () => {
  assert.match(app, /const availableBooks = books\.length \? books : await refreshLibrary\(\)/);
});

test('library assistant hydrates full book content only when the assistant is opened', () => {
  assert.match(assistantLauncher, /import \{ ensureSeedBookContent \} from '\.\.\/library\/useLibrary\.js'/);
  assert.match(assistantLauncher, /const libraryBooksLoadRef = useRef\(null\)/);
  assert.match(assistantLauncher, /else if \(open && !loadedLibraryBooks\.length\)/);
  assert.match(assistantLauncher, /function activate\(\)[\s\S]{0,180}loadedLibraryBooks\.length\) ensureLibraryBooksLoaded\(\)/);
  assert.match(assistantLauncher, /screen === 'books' && !booksForTurn\.length/);
  assert.match(assistantLauncher, /ensureSeedBookContent\(book\)/);
  assert.match(assistantLauncher, /await \(libraryBooksLoadRef\.current \|\| ensureLibraryBooksLoaded\(\)\)/);
  assert.match(assistantLauncher, /screen === 'books' && !booksForTurn\.length/);
});

test('all five library covers are requested eagerly at high priority', () => {
  assert.match(libraryPage, /loading="eager" decoding="async" fetchPriority="high"/);
});

test('initial splash restores the original approved logo asset', async () => {
  assert.match(html, /assets\/Logo m24\.png/);
  assert.match(html, /rel="preload" as="image"[^>]*fetchpriority="high"/);
  assert.match(app, /assets\/Logo m24\.png/);
  const original = await stat(new URL('../public/assets/Logo m24.png', import.meta.url));
  assert.ok(original.size > 0, 'the original splash logo asset must exist');
});


test('the app waits until the complete splash logo image is decoded', () => {
  assert.match(app, /const \[splashLogoReady, setSplashLogoReady\] = useState\(false\)/);
  assert.match(app, /await image\.decode\(\)/);
  assert.match(app, /if \(!content \|\| !splashLogoReady\)/);
  assert.match(app, /ref=\{splashLogoRef\}/);
  assert.match(app, /image\.complete\) void confirmReady\(\)/);
  assert.match(app, /fetchPriority="high"/);
  assert.match(app, /onLoad=\{\(event\) => markSplashLogoReady\(event\.currentTarget\)\}/);
});

test('all five library book covers are requested eagerly at high priority', () => {
  assert.match(libraryPage, /loading="eager" decoding="async" fetchPriority="high"/);
  assert.doesNotMatch(libraryPage, /fetchPriority="low"/);
});

const reader = await readFile(new URL('../src/features/library/Reader.jsx', import.meta.url), 'utf8');

test('opening a book preloads the reader module and reuses the prepared IndexedDB version', () => {
  assert.match(app, /Promise\.all\(\[[\s\S]*?ensureSeedBookContent\(book\),\s*import\('\.\/features\/library\/Reader\.jsx'\)/);
  assert.match(app, /initialVersion=\{readerState\.version\}/);
  assert.match(reader, /initialVersion = null/);
  assert.match(reader, /if \(initialVersion\?\.content\)/);
});
