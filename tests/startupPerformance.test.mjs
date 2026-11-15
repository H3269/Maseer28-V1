import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/styles/original-v72.css', import.meta.url), 'utf8');
const libraryHook = await readFile(new URL('../src/features/library/useLibrary.js', import.meta.url), 'utf8');
const libraryPage = await readFile(new URL('../src/features/library/LibraryPage.jsx', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const assistantLauncher = await readFile(new URL('../src/features/assistant/GlobalAssistantLauncher.jsx', import.meta.url), 'utf8');

test('library, reader, and assistant modules stay out of the initial application bundle', () => {
  assert.match(app, /const LibraryPage = lazy\(\(\) => import\('\.\/features\/library\/LibraryPage\.jsx'\)\)/);
  assert.match(app, /const Reader = lazy\(\(\) => import\('\.\/features\/library\/Reader\.jsx'\)\)/);
  assert.match(app, /const GlobalAssistantLauncher = lazy\(\(\) => import\('\.\/features\/assistant\/GlobalAssistantLauncher\.jsx'\)\)/);
  assert.doesNotMatch(app, /import GlobalAssistantLauncher from/);
  assert.match(app, /navVisible && assistantLauncherLoaded && <Suspense fallback=\{null\}><GlobalAssistantLauncher/);
  assert.match(app, /setAssistantLauncherLoaded\(true\)/);
  assert.match(app, /setAssistantOpenRequest\(\(value\) => value \+ 1\)/);
  assert.match(app, /openRequestId=\{assistantOpenRequest\}/);
  assert.match(app, /onOpenChange=\{setAssistantOpen\}/);
  assert.match(app, /hideLauncher/);
  assert.match(app, /initialOpen/);
});

test('startup uses the compact runtime topic index instead of downloading all daily content', () => {
  assert.match(app, /runtimeRepository\.loadContentIndex\(\)/);
  assert.match(app, /setContent\(\{ \.\.\.\(index\.metadata \|\| \{\}\), categories: \{\}, topics: index\.topics \}\)/);
  assert.match(app, /const runtimeRepository = useMemo\(\(\) => createRuntimeContentRepository\(/);
  assert.match(app, /const loadTopicForScreen = useCallback\(async \(topicKey\) => \{/);
  assert.match(app, /runtimeRepository\.loadTopicContent\(topicKey\)/);
  assert.ok(app.indexOf('runtimeRepository.loadContentIndex()') < app.indexOf('const pathUrl ='), 'the compact index must be requested before the full-content fallback');
});

test('canonical full-content and daily-overlay loading remain available as a compatibility fallback', () => {
  assert.match(app, /content\/path-content\.json\?v=20261023-fast-open/);
  assert.match(app, /fetch\(pathUrl, \{ cache: attempt === 0 \? 'default' : 'reload', priority: 'high' \}\)/);
  assert.match(app, /daily-text-overrides\.v1\.json[^\n]*priority: 'low'/);
  assert.match(app, /mergeDailyTextOverrides\(data, overrides\)/);
});

test('the selected topic loads independently and the day screen waits for its verified content', () => {
  assert.match(app, /if \(!content \|\| !problemKey \|\| content\.categories\?\.\[problemKey\]\) return undefined/);
  assert.match(app, /setTopicLoadState\(\{ key: problemKey, status: 'loading'/);
  assert.match(app, /activeDay \? <>[\s\S]*?topicLoadState\.status === 'loading'/);
  assert.match(app, /screen === 'report' && \(category \?/);
  assert.match(app, /onLoadTopic=\{loadTopicForScreen\}/);
});

test('the static splash logo and title remain visible before React mounts', () => {
  assert.match(html, /\.initialSplash img\{[^}]*opacity:1;visibility:visible/);
  assert.match(html, /\.initialSplash h1\{[^}]*opacity:1/);
  assert.doesNotMatch(html, /\.initialSplash h1\{opacity:0!important/);
});

test('the library catalogue does not download every full book on entry', () => {
  const seedStart = libraryHook.indexOf('async function seedLibrary()');
  const ensureStart = libraryHook.indexOf('export function ensureSeedBookContent');
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

test('library manifest revalidates with the browser cache instead of allowing stale catalogue metadata', () => {
  assert.match(libraryHook, /fetchJson\('content\/library\.seed\.json', 'manifest-check-v90', 'no-cache'\)/);
  assert.match(libraryHook, /cache === 'no-store'[\s\S]*?\{ cache \}/);
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

test('only the first two visible library covers receive eager high-priority loading', () => {
  assert.match(libraryPage, /priority=\{index < 2\}/);
  assert.match(libraryPage, /loading=\{priority \? 'eager' : 'lazy'\} decoding="async" fetchPriority=\{priority \? 'high' : 'low'\}/);
  assert.match(libraryPage, /books\.map\(\(book, index\)/);
});

test('initial splash uses the optimized WebP logo asset', async () => {
  assert.match(html, /assets\/Logo m24\.webp/);
  assert.match(html, /rel="preload" as="image"[^>]*fetchpriority="high"/);
  assert.match(app, /assets\/Logo m24\.webp/);
  const original = await stat(new URL('../public/assets/Logo m24.webp', import.meta.url));
  assert.ok(original.size > 0, 'the original splash logo asset must exist');
});


test('the app waits until the complete splash logo image is decoded', () => {
  assert.match(app, /const \[splashLogoReady, setSplashLogoReady\] = useState\(false\)/);
  assert.match(app, /await image\.decode\(\)/);
  assert.match(app, /if \(!content \|\| !splashLogoReady \|\| !splashMinimumVisible \|\| loadError\)/);
  assert.match(app, /ref=\{splashLogoRef\}/);
  assert.match(app, /image\.complete\) void confirmReady\(\)/);
  assert.match(app, /fetchPriority="high"/);
  assert.match(app, /onLoad=\{\(event\) => markSplashLogoReady\(event\.currentTarget\)\}/);
});

test('offscreen library book covers remain lazy and low priority', () => {
  assert.match(libraryPage, /loading=\{priority \? 'eager' : 'lazy'\} decoding="async" fetchPriority=\{priority \? 'high' : 'low'\}/);
});

const reader = await readFile(new URL('../src/features/library/Reader.jsx', import.meta.url), 'utf8');
const readerEngine = await readFile(new URL('../src/features/library/readerEngine.js', import.meta.url), 'utf8');

test('reader pagination uses the linear neighbour index instead of rescanning each block array', () => {
  const layoutSource = readerEngine.slice(readerEngine.indexOf('export function buildLegacyReaderLayout'));
  const helperStart = readerEngine.indexOf('export function buildNeighbourTextIndex');
  const helperEnd = readerEngine.indexOf('function bookRows', helperStart);
  const helperSource = readerEngine.slice(helperStart, helperEnd);
  assert.match(layoutSource, /buildNeighbourTextIndex\(blocks\)/);
  assert.match(helperSource, /const blockTexts = blocks\.map\(\(block\) => norm\(block\?\.text\)\)/);
  assert.match(helperSource, /const nextTexts = new Array\(blocks\.length\)/);
  assert.match(helperSource, /const previousTexts = new Array\(blocks\.length\)/);
  assert.doesNotMatch(helperSource, /blocks\.slice\(i \+ 1\)/);
  assert.doesNotMatch(helperSource, /blocks\.slice\(0, i\)\.reverse\(\)/);
});

test('recent reader layouts are reused with a strict two-layout memory cap', () => {
  assert.match(reader, /const READER_LAYOUT_CACHE_LIMIT = 2/);
  assert.match(reader, /READER_LAYOUT_CACHE\.get\(cacheKey\)/);
  assert.match(reader, /while \(READER_LAYOUT_CACHE\.size > READER_LAYOUT_CACHE_LIMIT\)/);
});

test('hydrated book content is cached with a strict mobile memory cap', () => {
  assert.match(libraryHook, /SEED_BOOK_CONTENT_IN_FLIGHT = new Map\(\)/);
  assert.match(libraryHook, /const SEED_BOOK_CONTENT_CACHE_LIMIT = 2/);
  assert.match(libraryHook, /while \(SEED_BOOK_CONTENT_CACHE\.size > SEED_BOOK_CONTENT_CACHE_LIMIT\)/);
});

test('opening a book preloads the reader module and reuses the prepared IndexedDB version', () => {
  assert.match(app, /Promise\.all\(\[[\s\S]*?ensureSeedBookContent\(book\),\s*import\('\.\/features\/library\/Reader\.jsx'\)/);
  assert.match(app, /initialVersion=\{readerState\.version\}/);
  assert.match(reader, /initialVersion = null/);
  assert.match(reader, /if \(initialVersion\?\.content\)/);
});

test('the splash logo is visible independently of the content-download progress', () => {
  assert.match(css, /\.appLoading \.loadingBrand img \{[\s\S]*?clip-path: none !important/);
  assert.match(css, /\.appLoading \.loadingBrand h1 \{[\s\S]*?clip-path: none !important/);
});

test('no later stylesheet rule can re-hide the splash logo or title behind loading progress', () => {
  assert.doesNotMatch(css, /clip-path:\s*circle\(var\(--logo-reveal/);
  assert.match(css, /\.appLoading \.loadingBrand img \{[\s\S]*?clip-path: none !important[\s\S]*?visibility: visible !important/);
  assert.match(css, /\.appLoading \.loadingBrand h1 \{[\s\S]*?clip-path: none !important[\s\S]*?visibility: visible !important/);
});


test('the splash remains visible briefly for its first paint without imposing a long artificial startup delay', () => {
  assert.match(app, /const \[splashMinimumVisible, setSplashMinimumVisible\] = useState\(false\)/);
  assert.match(app, /if \(!splashLogoReady\) return undefined[\s\S]*?setTimeout\(\(\) => \{[\s\S]*?setSplashMinimumVisible\(true\)[\s\S]*?\}, 120\)/);
  assert.match(app, /!splashMinimumVisible/);
});

test('content and logo failures keep the splash visible and expose retry without replacing it', () => {
  assert.doesNotMatch(app, /if \(loadError\) return <div className="validationModal"/);
  assert.match(app, /if \(!content \|\| !splashLogoReady \|\| !splashMinimumVisible \|\| loadError\)/);
  assert.match(app, /<div className="loadingError" role="alert">[\s\S]*?\{loadError\}[\s\S]*?window\.location\.reload\(\)/);
});

test('runtime index failure falls back to canonical content and keeps the manual startup retry', () => {
  assert.match(app, /runtimeRepository\.loadContentIndex\(\)[\s\S]*?\.catch\(async \(\) => \{/);
  assert.match(app, /for \(let attempt = 0; attempt <= 2; attempt \+= 1\)/);
  assert.match(app, /response\.status === 404/);
  assert.match(app, /window\.location\.reload\(\)/);
});
