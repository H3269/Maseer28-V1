import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/styles/original-v72.css', import.meta.url), 'utf8');
const libraryHook = await readFile(new URL('../src/features/library/useLibrary.js', import.meta.url), 'utf8');
const libraryPage = await readFile(new URL('../src/features/library/LibraryPage.jsx', import.meta.url), 'utf8');
const libraryManifest = JSON.parse(await readFile(new URL('../public/content/library.seed.json', import.meta.url), 'utf8'));
const coverThumbnailBuild = await readFile(new URL('../scripts/prepare-library-cover-thumbnails.mjs', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const assistantLauncher = await readFile(new URL('../src/features/assistant/GlobalAssistantLauncher.jsx', import.meta.url), 'utf8');
const libraryReasoning = await readFile(new URL('../src/features/assistant/libraryLocalReasoning.js', import.meta.url), 'utf8');

test('library, reader, and assistant modules stay out of the initial application bundle', () => {
  assert.match(app, /const LibraryPage = lazy\(loadLibraryPage\)/);
  assert.match(app, /const Reader = lazy\(loadReader\)/);
  assert.match(app, /const loadGlobalAssistantLauncher = \(\) => import\('\.\/features\/assistant\/GlobalAssistantLauncher\.jsx'\)/);
  assert.match(app, /const GlobalAssistantLauncher = lazy\(\(\) => import\('\.\/features\/assistant\/GlobalAssistantLauncher\.jsx'\)\)/);
  assert.match(app, /void loadLibraryPage\(\)/);
  assert.match(app, /loadGlobalAssistantLauncher\(\)\.then\(\(\) => \{/);
  assert.match(app, /if \(!content \|\| !userProfile \|\| !hasCompletedOnboarding\)/);
  assert.match(app, /navVisible && assistantLauncherLoaded/);
  assert.match(app, /\{navVisible && assistantLauncherLoaded && \(!journey\.profileData\?\.problem \|\| Boolean\(content\?\.categories\?\.\[journey\.profileData\.problem\]\)\) && <button/);
  assert.doesNotMatch(app, /requestIdleCallback\(warmAssistant/);
  assert.doesNotMatch(app, /import GlobalAssistantLauncher from/);
  assert.match(app, /navVisible && assistantLauncherLoaded && <Suspense fallback=\\{null\\}><GlobalAssistantLauncher/);
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
  assert.match(app, /if \(!content \|\| !splashLogoRevealComplete || !splashProgressComplete \|\| loadError\) return \(/);
  assert.match(app, /setTopicLoadState\(\{ key: problemKey, status: 'loading'/);
  assert.match(app, /activeDay \? <>[\s\S]*?topicLoadState\.status === 'loading'/);
  assert.match(app, /screen === 'report' && \(category \?/);
  assert.match(app, /onLoadTopic=\{loadTopicForScreen\}/);
});

test('the static splash reveals the logo radially and fills its progress bar in sync', () => {
  assert.match(html, /assets\/splash-logo\.webp/);
  assert.match(html, /animation:loadingLogoBloom var\(--path28-splash-duration,950ms\)/);
  assert.ok(html.includes('@keyframes loadingLogoBloom{from{opacity:1;clip-path:circle(0% at 50% 50%);transform:scale(.96)}to{opacity:1;clip-path:circle(75% at 50% 50%);transform:scale(1)}}'));
  assert.ok(html.includes('@keyframes loadingProgressFill{to{transform:scaleX(1)}}'));
  assert.match(html, /aria-label="پیشرفت نمایش لوگو"/);
  assert.match(html, /PATH28_SPLASH_DURATION_MS__/);
  assert.doesNotMatch(html, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'The static splash must animate identically when reduced motion is enabled');
  assert.match(html, /fetchpriority="high"/);
  assert.match(html, /width="174" height="174"/);
});

test('startup waits for both actual content readiness and the completed radial reveal', () => {
  assert.match(app, /if \(!content \|\| !splashLogoRevealComplete \|\| !splashProgressComplete \|\| loadError\) return \(/);
  assert.doesNotMatch(app, /splashLogoReady|splashMinimumVisible|image\.decode\(\)|setTimeout\(.*splash/i);
  assert.match(app, /onAnimationEnd=\{\(event\) => \{/);
  assert.match(app, /event\.animationName === 'loadingLogoBloom'\) setSplashLogoRevealComplete\(true\)/);
  assert.match(app, /event\.animationName === 'loadingProgressFill'/);
  assert.doesNotMatch(app, /prefers-reduced-motion: reduce/);
  assert.match(app, /assets\/splash-logo\.webp/);
  assert.match(app, /event\.currentTarget\.hidden = true;[\s\S]*?setSplashLogoRevealComplete\(true\)/);
  assert.doesNotMatch(app, /assets\/logo\.png|fallbackAttempted/);
  assert.doesNotMatch(app, /splashAnimationElapsedMs|splash-animation-delay/);
  assert.match(app, /Start the visual gate when React actually mounts the visible splash/);
  assert.match(css, /animation: loadingLogoBloom var\(--path28-splash-duration, 950ms\)/);
  assert.match(css, /animation: loadingProgressFill var\(--path28-splash-duration, 950ms\) linear both/);
});

test('the splash thumbnail is generated from the original artwork with a strict byte budget', () => {
  assert.match(pkg.scripts.prebuild, /prepare-splash-logo\.mjs/);
  assert.match(html, /assets\/splash-logo\.webp/);
  const generator = readFile(new URL('../scripts/prepare-splash-logo.mjs', import.meta.url), 'utf8');
  return generator.then((source) => {
    assert.match(source, /scripts\/assets\/Logo m24\.webp/);
    assert.match(source, /splash-logo\.webp/);
    assert.match(source, /--quality[\s\S]*?58/);
    assert.match(source, /40 \* 1024/);
  });
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
  assert.ok(libraryHook.indexOf('cachedBooks = await libraryRepository.listBooks()') < libraryHook.indexOf('const seededBooks = await seedLibrary((catalogueBooks) =>'));
  assert.match(libraryHook, /setBooks\(cachedBooks\);\s*setLoading\(false\)/);
  assert.match(libraryHook, /if \(enabled && !hasLoadedOnce\.current\) refresh\(\)/);
  assert.match(libraryHook, /if \(refreshInFlight\.current\) return refreshInFlight\.current/);
});

test('recommended books can be loaded on demand without relying on startup preloading', () => {
  assert.match(app, /const availableBooks = books\.length \? books : await refreshLibrary\(\)/);
});

test('library assistant acknowledges every send before asynchronous retrieval begins', () => {
  assert.match(assistantLauncher, /if \(screen === 'books'\) \{[\s\S]*?setSending\(true\);[\s\S]*?در حال بررسی پرسش[\s\S]*?ensureLibraryBooksLoaded\(message, conversationStateRef\.current\)/);
});

test('library page/help questions avoid IndexedDB catalogue reads and book hydration', () => {
  assert.match(assistantLauncher, /initialLibraryPlan\.kind === 'none'[\s\S]*?initialLibraryPlan\.kind === 'clarify' && loadedLibraryBooks\.length > 0/);
  assert.match(assistantLauncher, /with an empty cache, load metadata first[\s\S]*?ordinal book questions/);
  assert.match(assistantLauncher, /selectedPreparedQuestion = activePromptGroups/);
  assert.ok(assistantLauncher.indexOf('if (!selectedPreparedQuestion)') < assistantLauncher.indexOf('planLibraryBookLoad({ books: loadedLibraryBooks'));
  assert.doesNotMatch(assistantLauncher, /routeAssistantTurn/);
});

test('library passage tokenization and document-frequency indexes are reused between questions', () => {
  assert.match(libraryReasoning, /const RANKING_INDEX_CACHE = new WeakMap\(\)/);
  assert.match(libraryReasoning, /RANKING_INDEX_CACHE\.get\(rows\)/);
  assert.match(libraryReasoning, /RANKING_INDEX_CACHE\.set\(rows, index\)/);
  assert.match(libraryReasoning, /getPassageRankingIndex\(rows\)/);
});

test('library assistant hydrates only the requested book unless the question needs the catalogue', () => {
  assert.match(assistantLauncher, /import \{ answerLibraryBookTurn, planLibraryBookLoad \} from '\.\/libraryBookAssistant\.js'/);
  assert.match(assistantLauncher, /const libraryBooksLoadRef = useRef\(null\)/);
  assert.doesNotMatch(assistantLauncher, /else if \(open && !loadedLibraryBooks\.length\)/);
  assert.doesNotMatch(assistantLauncher, /function activate\(\)[\s\S]{0,180}ensureLibraryBooksLoaded\(\)/);
  assert.match(assistantLauncher, /planLibraryBookLoad\(\{ books: rows, message, conversationState \}\)/);
  assert.match(assistantLauncher, /let rows = await libraryRepository\.listBooks\(\)[\s\S]*?rows\.length === 0[\s\S]*?await libraryContext\.loadBooks\(\)[\s\S]*?rows = await libraryRepository\.listBooks\(\)/);
  assert.match(assistantLauncher, /const booksToHydrate = plan\.books\.filter/);
  assert.match(assistantLauncher, /ensureSeedBookContent\(book\)/);
  assert.match(assistantLauncher, /ensureLibraryBooksLoaded\(message, conversationStateRef\.current\)/);
  assert.doesNotMatch(assistantLauncher, /setLibraryComparisonReply/);
});

test('prepared daily questions are not blocked by asynchronous local-model status checks', () => {
  assert.doesNotMatch(assistantLauncher, /localModelStatusChecked/);
  assert.match(assistantLauncher, /disabled=\{sending \|\| jealousyRelationshipGatePending/);
  assert.match(assistantLauncher, /disabled=\{!draft\.trim\(\) \|\| sending\}/);
});

test('all assistant pages stay on deterministic prepared guidance with neural chat runtime disabled', () => {
  assert.doesNotMatch(assistantLauncher, /localNeuralModelClient|requestLocalNeuralModel|isLocalNeuralModelInstalled|shouldUseLocalNeuralModel|buildLocalAssistantMessages|isLocalModelInstallCommand/);
  assert.doesNotMatch(assistantLauncher, /مدل زبانی عصبی محلی|بارگیری مدل محلی/);
  assert.match(assistantLauncher, /screen === 'books'[\s\S]*?LIBRARY_ASSISTANT_PROMPT_GROUPS/);
  assert.match(assistantLauncher, /dailyContext[\s\S]*?PAGE_ASSISTANT_PROMPT_GROUPS/);
  assert.match(assistantLauncher, /activePromptGroups\s*\.flatMap\(\(group\) => group\.questions \|\| \[\]\)/);
  assert.doesNotMatch(assistantLauncher, /<textarea/);
  assert.match(assistantLauncher, /if \(!selectedPreparedQuestion\)/);
  assert.match(assistantLauncher, /makePageAssistantTurn\(\{ screen, text: message/);
  assert.match(assistantLauncher, /answerLibraryBookTurn\(\{ books: booksForTurn, message/);
  assert.doesNotMatch(pkg.scripts.build, /copy-local-llm-runtime-assets/);
});

test('first-entry cover requests start before IndexedDB catalogue synchronization finishes', () => {
  assert.match(libraryHook, /async function seedLibrary\(onCatalogReady = null\)/);
  assert.match(libraryHook, /onCatalogReady\?\.\(catalogueBooks\);[\s\S]*?await Promise\.all\(catalogueBooks\.map/);
  assert.match(libraryHook, /seedLibrary\(\(catalogueBooks\) => \{[\s\S]*?setBooks\(catalogueBooks\)/);
  assert.match(libraryPage, /disabled=\{loading\}/);
});

test('all five library covers load eagerly at high priority on library entry', () => {
  assert.match(libraryPage, /loading="eager" decoding="async" fetchPriority="high"/);
  assert.doesNotMatch(libraryPage, /loading="lazy"|fetchPriority="low"|priority=\{index === 0\}/);
  assert.match(libraryPage, /books\.map\(\(book\)/);
});

test('the static splash does not launch a large fallback during the React root handoff', () => {
  const staticLogo = html.match(/<img[^>]+splash-logo\.webp[^>]*>/)?.[0] || '';
  assert.ok(staticLogo, 'The initial HTML must contain the optimized splash logo');
  assert.doesNotMatch(staticLogo, /onerror=/i, 'The static splash must not trigger a fallback when React replaces the initial root');
});

test('the initial splash preloads the generated lightweight WebP logo', async () => {
  assert.match(html, /assets\/splash-logo\.webp/);
  assert.match(app, /assets\/splash-logo\.webp/);
  const generator = await readFile(new URL('../scripts/prepare-splash-logo.mjs', import.meta.url), 'utf8');
  assert.match(generator, /scripts\/assets\/Logo m24\.webp/);
  assert.match(generator, /splash-logo\.webp/);
  assert.match(generator, /40 \* 1024/);
});

test('logo failure never blocks startup, while content failure keeps its retry path', () => {
  assert.match(app, /if \(!content \|\| !splashLogoRevealComplete || !splashProgressComplete \|\| loadError\) return \(/);
  assert.match(app, /event\.currentTarget\.hidden = true;[\s\S]*?setSplashLogoRevealComplete\(true\)/);
  assert.doesNotMatch(app, /assets\/logo\.png|fallbackAttempted/);
  assert.match(app, /<div className="loadingError" role="alert">[\s\S]*?window\.location\.reload\(\)/);
  assert.doesNotMatch(app, /splashLogoReady|splashMinimumVisible|image\.decode\(\)|setTimeout\(.*splash/i);
});

test('library cards use generated lightweight WebP thumbnails without weakening eager display', () => {
  assert.equal(libraryManifest.books.length, 5);
  for (const book of libraryManifest.books) {
    assert.equal(book.libraryCover, `assets/covers/library/book${book.legacyId}.webp`);
  }
  assert.ok(libraryHook.includes('libraryCoverUrl: meta.libraryCover'));
  assert.ok(libraryPage.includes('book.libraryCoverUrl'));
  assert.match(libraryPage, /loading="eager" decoding="async" fetchPriority="high"/);
  assert.ok(coverThumbnailBuild.includes('sharp-cli@6.1.0'));
  assert.ok(coverThumbnailBuild.includes("'360'") && coverThumbnailBuild.includes("'522'"));
  assert.ok(coverThumbnailBuild.includes("'72'"));
  assert.ok(coverThumbnailBuild.includes('600 * 1024'));
});

test('all library book covers are requested immediately at high priority', () => {
  assert.match(libraryPage, /loading="eager" decoding="async" fetchPriority="high"/);
  assert.doesNotMatch(libraryPage, /loading="lazy"|fetchPriority="low"/);
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

test('recent reader layouts are reused with a bounded three-layout mobile memory cap', () => {
  assert.match(reader, /const READER_LAYOUT_CACHE_LIMIT = 3/);
  assert.match(reader, /READER_LAYOUT_CACHE\.get\(cacheKey\)/);
  assert.match(reader, /while \(READER_LAYOUT_CACHE\.size > READER_LAYOUT_CACHE_LIMIT\)/);
});

test('hydrated book content is cached with a strict mobile memory cap', () => {
  assert.match(libraryHook, /SEED_BOOK_CONTENT_IN_FLIGHT = new Map\(\)/);
  assert.match(libraryHook, /const SEED_BOOK_CONTENT_CACHE_LIMIT = 2/);
  assert.match(libraryHook, /while \(SEED_BOOK_CONTENT_CACHE\.size > SEED_BOOK_CONTENT_CACHE_LIMIT\)/);
});

test('opening a book preloads the reader module and reuses the prepared IndexedDB version', () => {
  assert.match(app, /Promise\.all\(\[[\s\S]*?ensureSeedBookContent\(book\),\s*loadReader\(\)/);
  assert.match(app, /initialVersion=\{readerState\.version\}/);
  assert.match(reader, /initialVersion = null/);
  assert.match(reader, /if \(initialVersion\?\.content\)/);
});

test('the React splash uses the same radial reveal and progress animation as static HTML', () => {
  assert.match(css, /clip-path: circle\(0% at 50% 50%\);/);
  assert.doesNotMatch(css, /clip-path: circle\(0% at 50% 50%\) !important/);
  assert.doesNotMatch(css, /Fast splash|loadingLogoEnter|loadingTextReveal|loadingPulse|loadingProgressSegment|loadingBloomReveal/, 'Legacy splash rules must be removed');
  assert.equal((css.match(/@keyframes loadingLogoBloom/g) || []).length, 1, 'The React splash must have one canonical logo animation');
  assert.match(css, /@keyframes loadingLogoBloom[\s\S]*?circle\(75% at 50% 50%\)/);
  assert.match(css, /@keyframes loadingProgressFill[\s\S]*?scaleX\(1\)/);
  assert.doesNotMatch(css.slice(css.lastIndexOf('/* Coordinated splash reveal')), /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(app, /!splashLogoRevealComplete \|\| !splashProgressComplete/);
  assert.match(app, /setSplashLogoRevealComplete\(true\)/);
  assert.match(app, /setSplashProgressComplete\(true\)/);
});

test('Android WebViews without modern viewport units retain a 100vh fallback', () => {
  assert.ok(html.includes('#root{width:100%;min-height:100vh;min-height:100svh'));
  assert.ok(html.includes('height:100vh;height:100svh;min-height:100vh;min-height:100svh'));
  assert.ok(css.includes('height: 100vh;\n  height: 100dvh;'));
  assert.ok(css.includes('.appLoading { min-height: 100vh; min-height: 100svh;'));
  assert.ok(css.includes('min-height: 100vh !important;\n  min-height: 100svh !important;'));
  assert.ok(css.includes('min-height: min(420px, calc(100vh - 20px)); max-height: calc(100vh - 20px);\n  min-height: min(420px, calc(100dvh - 20px))'));
  assert.ok(css.includes('height: 92vh; max-height: calc(100vh - 16px); height: 92dvh'));
});
