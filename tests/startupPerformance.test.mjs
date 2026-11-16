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
  assert.match(app, /const LibraryPage = lazyassert.match(app, /navVisible && assistantLauncherLoaded/);(loadLibraryPageassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(app, /const Reader = lazyassert.match(app, /navVisible && assistantLauncherLoaded/);(loadReaderassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(app, /const loadGlobalAssistantLauncher = assert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);) => importassert.match(app, /navVisible && assistantLauncherLoaded/);('assert.match(app, /navVisible && assistantLauncherLoaded/);.assert.match(app, /navVisible && assistantLauncherLoaded/);/featuresassert.match(app, /navVisible && assistantLauncherLoaded/);/assistantassert.match(app, /navVisible && assistantLauncherLoaded/);/GlobalAssistantLauncherassert.match(app, /navVisible && assistantLauncherLoaded/);.jsx'assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(app, /const GlobalAssistantLauncher = lazyassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);) => importassert.match(app, /navVisible && assistantLauncherLoaded/);('assert.match(app, /navVisible && assistantLauncherLoaded/);.assert.match(app, /navVisible && assistantLauncherLoaded/);/featuresassert.match(app, /navVisible && assistantLauncherLoaded/);/assistantassert.match(app, /navVisible && assistantLauncherLoaded/);/GlobalAssistantLauncherassert.match(app, /navVisible && assistantLauncherLoaded/);.jsx'assert.match(app, /navVisible && assistantLauncherLoaded/);)assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(app, /void loadLibraryPageassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(app, /loadGlobalAssistantLauncherassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);)assert.match(app, /navVisible && assistantLauncherLoaded/);.thenassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);) => assert.match(app, /navVisible && assistantLauncherLoaded/);{/);
  assert.match(app, /if assert.match(app, /navVisible && assistantLauncherLoaded/);(!content assert.match(app, /navVisible && assistantLauncherLoaded/);|assert.match(app, /navVisible && assistantLauncherLoaded/);| !userProfile assert.match(app, /navVisible && assistantLauncherLoaded/);|assert.match(app, /navVisible && assistantLauncherLoaded/);| !hasCompletedOnboardingassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(app, /assistantLauncherLoaded && assert.match(app, /navVisible && assistantLauncherLoaded/);(!journeyassert.match(app, /navVisible && assistantLauncherLoaded/);.profileDataassert.match(app, /navVisible && assistantLauncherLoaded/);?assert.match(app, /navVisible && assistantLauncherLoaded/);.problem assert.match(app, /navVisible && assistantLauncherLoaded/);|assert.match(app, /navVisible && assistantLauncherLoaded/);|assert.match(app, /navVisible && assistantLauncherLoaded/);
  assert.match(app, /assert.match(app, /navVisible && assistantLauncherLoaded/);{navVisible && assistantLauncherLoaded && assert.match(app, /navVisible && assistantLauncherLoaded/);(!journeyassert.match(app, /navVisible && assistantLauncherLoaded/);.profileDataassert.match(app, /navVisible && assistantLauncherLoaded/);?assert.match(app, /navVisible && assistantLauncherLoaded/);.problem assert.match(app, /navVisible && assistantLauncherLoaded/);|assert.match(app, /navVisible && assistantLauncherLoaded/);| Booleanassert.match(app, /navVisible && assistantLauncherLoaded/);(contentassert.match(app, /navVisible && assistantLauncherLoaded/);?assert.match(app, /navVisible && assistantLauncherLoaded/);.categoriesassert.match(app, /navVisible && assistantLauncherLoaded/);?assert.match(app, /navVisible && assistantLauncherLoaded/);.assert.match(app, /navVisible && assistantLauncherLoaded/);[journeyassert.match(app, /navVisible && assistantLauncherLoaded/);.profileDataassert.match(app, /navVisible && assistantLauncherLoaded/);.problemassert.match(app, /navVisible && assistantLauncherLoaded/);]assert.match(app, /navVisible && assistantLauncherLoaded/);)assert.match(app, /navVisible && assistantLauncherLoaded/);) && <button/);
  assert.doesNotMatch(app, /requestIdleCallbackassert.match(app, /navVisible && assistantLauncherLoaded/);(warmAssistant/);
  assert.doesNotMatch(app, /import GlobalAssistantLauncher from/);
  assert.match(app, /navVisible && assistantLauncherLoaded && assert.match(app, /navVisible && assistantLauncherLoaded/);(!journeyassert.match(app, /navVisible && assistantLauncherLoaded/);.profileDataassert.match(app, /navVisible && assistantLauncherLoaded/);?assert.match(app, /navVisible && assistantLauncherLoaded/);.problem assert.match(app, /navVisible && assistantLauncherLoaded/);|assert.match(app, /navVisible && assistantLauncherLoaded/);| Booleanassert.match(app, /navVisible && assistantLauncherLoaded/);(contentassert.match(app, /navVisible && assistantLauncherLoaded/);?assert.match(app, /navVisible && assistantLauncherLoaded/);.categoriesassert.match(app, /navVisible && assistantLauncherLoaded/);?assert.match(app, /navVisible && assistantLauncherLoaded/);.assert.match(app, /navVisible && assistantLauncherLoaded/);[journeyassert.match(app, /navVisible && assistantLauncherLoaded/);.profileDataassert.match(app, /navVisible && assistantLauncherLoaded/);.problemassert.match(app, /navVisible && assistantLauncherLoaded/);]assert.match(app, /navVisible && assistantLauncherLoaded/);)assert.match(app, /navVisible && assistantLauncherLoaded/);) && <Suspense fallback=assert.match(app, /navVisible && assistantLauncherLoaded/);{nullassert.match(app, /navVisible && assistantLauncherLoaded/);}><GlobalAssistantLauncher/);
  assert.match(app, /setAssistantLauncherLoadedassert.match(app, /navVisible && assistantLauncherLoaded/);(trueassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(app, /setAssistantOpenRequestassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);(valueassert.match(app, /navVisible && assistantLauncherLoaded/);) => value assert.match(app, /navVisible && assistantLauncherLoaded/);+ 1assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(app, /openRequestId=assert.match(app, /navVisible && assistantLauncherLoaded/);{assistantOpenRequestassert.match(app, /navVisible && assistantLauncherLoaded/);}/);
  assert.match(app, /onOpenChange=assert.match(app, /navVisible && assistantLauncherLoaded/);{setAssistantOpenassert.match(app, /navVisible && assistantLauncherLoaded/);}/);
  assert.match(app, /hideLauncher/);
  assert.match(app, /initialOpen/);
});

test('startup uses the compact runtime topic index instead of downloading all daily content', () => {
  assert.match(app, /runtimeRepositoryassert.match(app, /navVisible && assistantLauncherLoaded/);.loadContentIndexassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(app, /setContentassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);{ assert.match(app, /navVisible && assistantLauncherLoaded/);.assert.match(app, /navVisible && assistantLauncherLoaded/);.assert.match(app, /navVisible && assistantLauncherLoaded/);.assert.match(app, /navVisible && assistantLauncherLoaded/);(indexassert.match(app, /navVisible && assistantLauncherLoaded/);.metadata assert.match(app, /navVisible && assistantLauncherLoaded/);|assert.match(app, /navVisible && assistantLauncherLoaded/);| assert.match(app, /navVisible && assistantLauncherLoaded/);{assert.match(app, /navVisible && assistantLauncherLoaded/);}assert.match(app, /navVisible && assistantLauncherLoaded/);), categories: assert.match(app, /navVisible && assistantLauncherLoaded/);{assert.match(app, /navVisible && assistantLauncherLoaded/);}, topics: indexassert.match(app, /navVisible && assistantLauncherLoaded/);.topics assert.match(app, /navVisible && assistantLauncherLoaded/);}assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(app, /const runtimeRepository = useMemoassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);) => createRuntimeContentRepositoryassert.match(app, /navVisible && assistantLauncherLoaded/);(/);
  assert.match(app, /const loadTopicForScreen = useCallbackassert.match(app, /navVisible && assistantLauncherLoaded/);(async assert.match(app, /navVisible && assistantLauncherLoaded/);(topicKeyassert.match(app, /navVisible && assistantLauncherLoaded/);) => assert.match(app, /navVisible && assistantLauncherLoaded/);{/);
  assert.match(app, /runtimeRepositoryassert.match(app, /navVisible && assistantLauncherLoaded/);.loadTopicContentassert.match(app, /navVisible && assistantLauncherLoaded/);(topicKeyassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.ok(app.indexOf('runtimeRepository.loadContentIndex()') < app.indexOf('const pathUrl ='), 'the compact index must be requested before the full-content fallback');
});

test('canonical full-content and daily-overlay loading remain available as a compatibility fallback', () => {
  assert.match(app, /contentassert.match(app, /navVisible && assistantLauncherLoaded/);/path-contentassert.match(app, /navVisible && assistantLauncherLoaded/);.jsonassert.match(app, /navVisible && assistantLauncherLoaded/);?v=20261023-fast-open/);
  assert.match(app, /fetchassert.match(app, /navVisible && assistantLauncherLoaded/);(pathUrl, assert.match(app, /navVisible && assistantLauncherLoaded/);{ cache: attempt === 0 assert.match(app, /navVisible && assistantLauncherLoaded/);? 'default' : 'reload', priority: 'high' assert.match(app, /navVisible && assistantLauncherLoaded/);}assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(app, /daily-text-overridesassert.match(app, /navVisible && assistantLauncherLoaded/);.v1assert.match(app, /navVisible && assistantLauncherLoaded/);.json[^assert.match(app, /navVisible && assistantLauncherLoaded/);n]*priority: 'low'/);
  assert.match(app, /mergeDailyTextOverridesassert.match(app, /navVisible && assistantLauncherLoaded/);(data, overridesassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
});

test('the selected topic loads independently and the day screen waits for its verified content', () => {
  assert.match(app, /if assert.match(app, /navVisible && assistantLauncherLoaded/);(!content assert.match(app, /navVisible && assistantLauncherLoaded/);|assert.match(app, /navVisible && assistantLauncherLoaded/);| !splashLogoRevealComplete || !splashProgressComplete assert.match(app, /navVisible && assistantLauncherLoaded/);|assert.match(app, /navVisible && assistantLauncherLoaded/);| loadErrorassert.match(app, /navVisible && assistantLauncherLoaded/);) return assert.match(app, /navVisible && assistantLauncherLoaded/);(/);
  assert.match(app, /setTopicLoadStateassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);{ key: problemKey, status: 'loading'/);
  assert.match(app, /activeDay assert.match(app, /navVisible && assistantLauncherLoaded/);? <>[assert.match(app, /navVisible && assistantLauncherLoaded/);sassert.match(app, /navVisible && assistantLauncherLoaded/);S]*?topicLoadStateassert.match(app, /navVisible && assistantLauncherLoaded/);.status === 'loading'/);
  assert.match(app, /screen === 'report' && assert.match(app, /navVisible && assistantLauncherLoaded/);(category assert.match(app, /navVisible && assistantLauncherLoaded/);?/);
  assert.match(app, /onLoadTopic=assert.match(app, /navVisible && assistantLauncherLoaded/);{loadTopicForScreenassert.match(app, /navVisible && assistantLauncherLoaded/);}/);
});

test('the static splash reveals the logo radially and fills its progress bar in sync', () => {
  assert.match(html, /assetsassert.match(app, /navVisible && assistantLauncherLoaded/);/splash-logoassert.match(app, /navVisible && assistantLauncherLoaded/);.webp/);
  assert.match(html, /animation:loadingLogoBloom varassert.match(app, /navVisible && assistantLauncherLoaded/);(--path28-splash-duration,950msassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.ok(html.includes('@keyframes loadingLogoBloom{from{opacity:1;clip-path:circle(0% at 50% 50%);transform:scale(.96)}to{opacity:1;clip-path:circle(75% at 50% 50%);transform:scale(1)}}'));
  assert.ok(html.includes('@keyframes loadingProgressFill{to{transform:scaleX(1)}}'));
  assert.match(html, /aria-label="پیشرفت نمایش لوگو"/);
  assert.match(html, /PATH28_SPLASH_DURATION_MS__/);
  assert.doesNotMatch(html, /@mediaassert.match(app, /navVisible && assistantLauncherLoaded/);s*assert.match(app, /navVisible && assistantLauncherLoaded/);(prefers-reduced-motion:assert.match(app, /navVisible && assistantLauncherLoaded/);s*reduceassert.match(app, /navVisible && assistantLauncherLoaded/);)/, 'The static splash must animate identically when reduced motion is enabled');
  assert.match(html, /fetchpriority="high"/);
  assert.match(html, /width="174" height="174"/);
});

test('startup waits for both actual content readiness and the completed radial reveal', () => {
  assert.match(app, /if assert.match(app, /navVisible && assistantLauncherLoaded/);(!content assert.match(app, /navVisible && assistantLauncherLoaded/);|assert.match(app, /navVisible && assistantLauncherLoaded/);| !splashLogoRevealComplete assert.match(app, /navVisible && assistantLauncherLoaded/);|assert.match(app, /navVisible && assistantLauncherLoaded/);| !splashProgressComplete assert.match(app, /navVisible && assistantLauncherLoaded/);|assert.match(app, /navVisible && assistantLauncherLoaded/);| loadErrorassert.match(app, /navVisible && assistantLauncherLoaded/);) return assert.match(app, /navVisible && assistantLauncherLoaded/);(/);
  assert.doesNotMatch(app, /splashLogoReady|splashMinimumVisible|imageassert.match(app, /navVisible && assistantLauncherLoaded/);.decodeassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);)|setTimeoutassert.match(app, /navVisible && assistantLauncherLoaded/);(.*splash/i);
  assert.match(app, /onAnimationEnd=assert.match(app, /navVisible && assistantLauncherLoaded/);{assert.match(app, /navVisible && assistantLauncherLoaded/);(eventassert.match(app, /navVisible && assistantLauncherLoaded/);) => assert.match(app, /navVisible && assistantLauncherLoaded/);{/);
  assert.match(app, /eventassert.match(app, /navVisible && assistantLauncherLoaded/);.animationName === 'loadingLogoBloom'assert.match(app, /navVisible && assistantLauncherLoaded/);) setSplashLogoRevealCompleteassert.match(app, /navVisible && assistantLauncherLoaded/);(trueassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(app, /eventassert.match(app, /navVisible && assistantLauncherLoaded/);.animationName === 'loadingProgressFill'/);
  assert.doesNotMatch(app, /prefers-reduced-motion: reduce/);
  assert.match(app, /assetsassert.match(app, /navVisible && assistantLauncherLoaded/);/splash-logoassert.match(app, /navVisible && assistantLauncherLoaded/);.webp/);
  assert.match(app, /eventassert.match(app, /navVisible && assistantLauncherLoaded/);.currentTargetassert.match(app, /navVisible && assistantLauncherLoaded/);.hidden = true;[assert.match(app, /navVisible && assistantLauncherLoaded/);sassert.match(app, /navVisible && assistantLauncherLoaded/);S]*?setSplashLogoRevealCompleteassert.match(app, /navVisible && assistantLauncherLoaded/);(trueassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.doesNotMatch(app, /assetsassert.match(app, /navVisible && assistantLauncherLoaded/);/logoassert.match(app, /navVisible && assistantLauncherLoaded/);.png|fallbackAttempted/);
  assert.doesNotMatch(app, /splashAnimationElapsedMs|splash-animation-delay/);
  assert.match(app, /Start the visual gate when React actually mounts the visible splash/);
  assert.match(css, /animation: loadingLogoBloom varassert.match(app, /navVisible && assistantLauncherLoaded/);(--path28-splash-duration, 950msassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(css, /animation: loadingProgressFill varassert.match(app, /navVisible && assistantLauncherLoaded/);(--path28-splash-duration, 950msassert.match(app, /navVisible && assistantLauncherLoaded/);) linear both/);
});

test('the splash thumbnail is generated from the original artwork with a strict byte budget', () => {
  assert.match(pkg.scripts.prebuild, /prepare-splash-logoassert.match(app, /navVisible && assistantLauncherLoaded/);.mjs/);
  assert.match(html, /assetsassert.match(app, /navVisible && assistantLauncherLoaded/);/splash-logoassert.match(app, /navVisible && assistantLauncherLoaded/);.webp/);
  const generator = readFile(new URL('../scripts/prepare-splash-logo.mjs', import.meta.url), 'utf8');
  return generator.then((source) => {
    assert.match(source, /scriptsassert.match(app, /navVisible && assistantLauncherLoaded/);/assetsassert.match(app, /navVisible && assistantLauncherLoaded/);/Logo m24assert.match(app, /navVisible && assistantLauncherLoaded/);.webp/);
    assert.match(source, /splash-logoassert.match(app, /navVisible && assistantLauncherLoaded/);.webp/);
    assert.match(source, /--quality[assert.match(app, /navVisible && assistantLauncherLoaded/);sassert.match(app, /navVisible && assistantLauncherLoaded/);S]*?58/);
    assert.match(source, /40 assert.match(app, /navVisible && assistantLauncherLoaded/);* 1024/);
  });
});

test('the library catalogue does not download every full book on entry', () => {
  const seedStart = libraryHook.indexOf('async function seedLibrary()');
  const ensureStart = libraryHook.indexOf('export function ensureSeedBookContent');
  const seedSource = libraryHook.slice(seedStart, ensureStart);
  const ensureSource = libraryHook.slice(ensureStart);
  assert.doesNotMatch(seedSource, /fetchJsonassert.match(app, /navVisible && assistantLauncherLoaded/);(metaassert.match(app, /navVisible && assistantLauncherLoaded/);.file/);
  assert.match(ensureSource, /fetchJsonassert.match(app, /navVisible && assistantLauncherLoaded/);(currentBookassert.match(app, /navVisible && assistantLauncherLoaded/);.seedFile/);
  assert.match(app, /ensureSeedBookContentassert.match(app, /navVisible && assistantLauncherLoaded/);(bookassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  const recommendationStart = app.indexOf('async function findRelevantBook');
  const completionStart = app.indexOf('async function completeDay', recommendationStart);
  const recommendationSource = app.slice(recommendationStart, completionStart);
  assert.match(recommendationSource, /await refreshLibraryassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(recommendationSource, /await ensureSeedBookContentassert.match(app, /navVisible && assistantLauncherLoaded/);(bookassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
});

test('library manifest revalidates with the browser cache instead of allowing stale catalogue metadata', () => {
  assert.match(libraryHook, /fetchJsonassert.match(app, /navVisible && assistantLauncherLoaded/);('contentassert.match(app, /navVisible && assistantLauncherLoaded/);/libraryassert.match(app, /navVisible && assistantLauncherLoaded/);.seedassert.match(app, /navVisible && assistantLauncherLoaded/);.json', 'manifest-check-v90', 'no-cache'assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(libraryHook, /cache === 'no-store'[assert.match(app, /navVisible && assistantLauncherLoaded/);sassert.match(app, /navVisible && assistantLauncherLoaded/);S]*?assert.match(app, /navVisible && assistantLauncherLoaded/);{ cache assert.match(app, /navVisible && assistantLauncherLoaded/);}/);
});

test('cached library catalogue is painted before the network manifest refresh', () => {
  assert.match(app, /const libraryNeeded = screen === 'books' assert.match(app, /navVisible && assistantLauncherLoaded/);|assert.match(app, /navVisible && assistantLauncherLoaded/);| screen === 'bookReader' assert.match(app, /navVisible && assistantLauncherLoaded/);|assert.match(app, /navVisible && assistantLauncherLoaded/);| screen === 'dailyResult'/);
  assert.match(app, /useLibraryassert.match(app, /navVisible && assistantLauncherLoaded/);(libraryNeededassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.ok(libraryHook.indexOf('cachedBooks = await libraryRepository.listBooks()') < libraryHook.indexOf('const seededBooks = await seedLibrary((catalogueBooks) =>'));
  assert.match(libraryHook, /setBooksassert.match(app, /navVisible && assistantLauncherLoaded/);(cachedBooksassert.match(app, /navVisible && assistantLauncherLoaded/););assert.match(app, /navVisible && assistantLauncherLoaded/);s*setLoadingassert.match(app, /navVisible && assistantLauncherLoaded/);(falseassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(libraryHook, /if assert.match(app, /navVisible && assistantLauncherLoaded/);(enabled && !hasLoadedOnceassert.match(app, /navVisible && assistantLauncherLoaded/);.currentassert.match(app, /navVisible && assistantLauncherLoaded/);) refreshassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(libraryHook, /if assert.match(app, /navVisible && assistantLauncherLoaded/);(refreshInFlightassert.match(app, /navVisible && assistantLauncherLoaded/);.currentassert.match(app, /navVisible && assistantLauncherLoaded/);) return refreshInFlightassert.match(app, /navVisible && assistantLauncherLoaded/);.current/);
});

test('recommended books can be loaded on demand without relying on startup preloading', () => {
  assert.match(app, /const availableBooks = booksassert.match(app, /navVisible && assistantLauncherLoaded/);.length assert.match(app, /navVisible && assistantLauncherLoaded/);? books : await refreshLibraryassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
});

test('library assistant acknowledges every send before asynchronous retrieval begins', () => {
  assert.match(assistantLauncher, /if assert.match(app, /navVisible && assistantLauncherLoaded/);(screen === 'books'assert.match(app, /navVisible && assistantLauncherLoaded/);) assert.match(app, /navVisible && assistantLauncherLoaded/);{[assert.match(app, /navVisible && assistantLauncherLoaded/);sassert.match(app, /navVisible && assistantLauncherLoaded/);S]*?setSendingassert.match(app, /navVisible && assistantLauncherLoaded/);(trueassert.match(app, /navVisible && assistantLauncherLoaded/););[assert.match(app, /navVisible && assistantLauncherLoaded/);sassert.match(app, /navVisible && assistantLauncherLoaded/);S]*?در حال بررسی پرسش[assert.match(app, /navVisible && assistantLauncherLoaded/);sassert.match(app, /navVisible && assistantLauncherLoaded/);S]*?ensureLibraryBooksLoadedassert.match(app, /navVisible && assistantLauncherLoaded/);(message, conversationStateRefassert.match(app, /navVisible && assistantLauncherLoaded/);.currentassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
});

test('library page/help questions avoid IndexedDB catalogue reads and book hydration', () => {
  assert.match(assistantLauncher, /initialLibraryPlanassert.match(app, /navVisible && assistantLauncherLoaded/);.kind === 'none'[assert.match(app, /navVisible && assistantLauncherLoaded/);sassert.match(app, /navVisible && assistantLauncherLoaded/);S]*?initialLibraryPlanassert.match(app, /navVisible && assistantLauncherLoaded/);.kind === 'clarify' && loadedLibraryBooksassert.match(app, /navVisible && assistantLauncherLoaded/);.length > 0/);
  assert.match(assistantLauncher, /with an empty cache, load metadata first[assert.match(app, /navVisible && assistantLauncherLoaded/);sassert.match(app, /navVisible && assistantLauncherLoaded/);S]*?ordinal book questions/);
  assert.match(assistantLauncher, /selectedPreparedQuestion = activePromptGroups/);
  assert.ok(assistantLauncher.indexOf('if (!selectedPreparedQuestion)') < assistantLauncher.indexOf('planLibraryBookLoad({ books: loadedLibraryBooks'));
  assert.doesNotMatch(assistantLauncher, /routeAssistantTurn/);
});

test('library passage tokenization and document-frequency indexes are reused between questions', () => {
  assert.match(libraryReasoning, /const RANKING_INDEX_CACHE = new WeakMapassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(libraryReasoning, /RANKING_INDEX_CACHEassert.match(app, /navVisible && assistantLauncherLoaded/);.getassert.match(app, /navVisible && assistantLauncherLoaded/);(rowsassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(libraryReasoning, /RANKING_INDEX_CACHEassert.match(app, /navVisible && assistantLauncherLoaded/);.setassert.match(app, /navVisible && assistantLauncherLoaded/);(rows, indexassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(libraryReasoning, /getPassageRankingIndexassert.match(app, /navVisible && assistantLauncherLoaded/);(rowsassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
});

test('library assistant hydrates only the requested book unless the question needs the catalogue', () => {
  assert.match(assistantLauncher, /import assert.match(app, /navVisible && assistantLauncherLoaded/);{ answerLibraryBookTurn, planLibraryBookLoad assert.match(app, /navVisible && assistantLauncherLoaded/);} from 'assert.match(app, /navVisible && assistantLauncherLoaded/);.assert.match(app, /navVisible && assistantLauncherLoaded/);/libraryBookAssistantassert.match(app, /navVisible && assistantLauncherLoaded/);.js'/);
  assert.match(assistantLauncher, /const libraryBooksLoadRef = useRefassert.match(app, /navVisible && assistantLauncherLoaded/);(nullassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.doesNotMatch(assistantLauncher, /else if assert.match(app, /navVisible && assistantLauncherLoaded/);(open && !loadedLibraryBooksassert.match(app, /navVisible && assistantLauncherLoaded/);.lengthassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.doesNotMatch(assistantLauncher, /function activateassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);)[assert.match(app, /navVisible && assistantLauncherLoaded/);sassert.match(app, /navVisible && assistantLauncherLoaded/);S]{0,180}ensureLibraryBooksLoadedassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(assistantLauncher, /planLibraryBookLoadassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);{ books: rows, message, conversationState assert.match(app, /navVisible && assistantLauncherLoaded/);}assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(assistantLauncher, /let rows = await libraryRepositoryassert.match(app, /navVisible && assistantLauncherLoaded/);.listBooksassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);)[assert.match(app, /navVisible && assistantLauncherLoaded/);sassert.match(app, /navVisible && assistantLauncherLoaded/);S]*?rowsassert.match(app, /navVisible && assistantLauncherLoaded/);.length === 0[assert.match(app, /navVisible && assistantLauncherLoaded/);sassert.match(app, /navVisible && assistantLauncherLoaded/);S]*?await libraryContextassert.match(app, /navVisible && assistantLauncherLoaded/);.loadBooksassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);)[assert.match(app, /navVisible && assistantLauncherLoaded/);sassert.match(app, /navVisible && assistantLauncherLoaded/);S]*?rows = await libraryRepositoryassert.match(app, /navVisible && assistantLauncherLoaded/);.listBooksassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(assistantLauncher, /const booksToHydrate = planassert.match(app, /navVisible && assistantLauncherLoaded/);.booksassert.match(app, /navVisible && assistantLauncherLoaded/);.filter/);
  assert.match(assistantLauncher, /ensureSeedBookContentassert.match(app, /navVisible && assistantLauncherLoaded/);(bookassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(assistantLauncher, /ensureLibraryBooksLoadedassert.match(app, /navVisible && assistantLauncherLoaded/);(message, conversationStateRefassert.match(app, /navVisible && assistantLauncherLoaded/);.currentassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.doesNotMatch(assistantLauncher, /setLibraryComparisonReply/);
});

test('prepared daily questions are not blocked by asynchronous local-model status checks', () => {
  assert.doesNotMatch(assistantLauncher, /localModelStatusChecked/);
  assert.match(assistantLauncher, /disabled=assert.match(app, /navVisible && assistantLauncherLoaded/);{sending assert.match(app, /navVisible && assistantLauncherLoaded/);|assert.match(app, /navVisible && assistantLauncherLoaded/);| jealousyRelationshipGatePending/);
  assert.match(assistantLauncher, /disabled=assert.match(app, /navVisible && assistantLauncherLoaded/);{!draftassert.match(app, /navVisible && assistantLauncherLoaded/);.trimassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);) assert.match(app, /navVisible && assistantLauncherLoaded/);|assert.match(app, /navVisible && assistantLauncherLoaded/);| sendingassert.match(app, /navVisible && assistantLauncherLoaded/);}/);
});

test('all assistant pages stay on deterministic prepared guidance with neural chat runtime disabled', () => {
  assert.doesNotMatch(assistantLauncher, /localNeuralModelClient|requestLocalNeuralModel|isLocalNeuralModelInstalled|shouldUseLocalNeuralModel|buildLocalAssistantMessages|isLocalModelInstallCommand/);
  assert.doesNotMatch(assistantLauncher, /مدل زبانی عصبی محلی|بارگیری مدل محلی/);
  assert.match(assistantLauncher, /screen === 'books'[assert.match(app, /navVisible && assistantLauncherLoaded/);sassert.match(app, /navVisible && assistantLauncherLoaded/);S]*?LIBRARY_ASSISTANT_PROMPT_GROUPS/);
  assert.match(assistantLauncher, /dailyContext[assert.match(app, /navVisible && assistantLauncherLoaded/);sassert.match(app, /navVisible && assistantLauncherLoaded/);S]*?PAGE_ASSISTANT_PROMPT_GROUPS/);
  assert.match(assistantLauncher, /activePromptGroupsassert.match(app, /navVisible && assistantLauncherLoaded/);s*assert.match(app, /navVisible && assistantLauncherLoaded/);.flatMapassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);(groupassert.match(app, /navVisible && assistantLauncherLoaded/);) => groupassert.match(app, /navVisible && assistantLauncherLoaded/);.questions assert.match(app, /navVisible && assistantLauncherLoaded/);|assert.match(app, /navVisible && assistantLauncherLoaded/);| assert.match(app, /navVisible && assistantLauncherLoaded/);[assert.match(app, /navVisible && assistantLauncherLoaded/);]assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.doesNotMatch(assistantLauncher, /<textarea/);
  assert.match(assistantLauncher, /if assert.match(app, /navVisible && assistantLauncherLoaded/);(!selectedPreparedQuestionassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(assistantLauncher, /makePageAssistantTurnassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);{ screen, text: message/);
  assert.match(assistantLauncher, /answerLibraryBookTurnassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);{ books: booksForTurn, message/);
  assert.doesNotMatch(pkg.scripts.build, /copy-local-llm-runtime-assets/);
});

test('first-entry cover requests start before IndexedDB catalogue synchronization finishes', () => {
  assert.match(libraryHook, /async function seedLibraryassert.match(app, /navVisible && assistantLauncherLoaded/);(onCatalogReady = nullassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(libraryHook, /onCatalogReadyassert.match(app, /navVisible && assistantLauncherLoaded/);?assert.match(app, /navVisible && assistantLauncherLoaded/);.assert.match(app, /navVisible && assistantLauncherLoaded/);(catalogueBooksassert.match(app, /navVisible && assistantLauncherLoaded/););[assert.match(app, /navVisible && assistantLauncherLoaded/);sassert.match(app, /navVisible && assistantLauncherLoaded/);S]*?await Promiseassert.match(app, /navVisible && assistantLauncherLoaded/);.allassert.match(app, /navVisible && assistantLauncherLoaded/);(catalogueBooksassert.match(app, /navVisible && assistantLauncherLoaded/);.map/);
  assert.match(libraryHook, /seedLibraryassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);(catalogueBooksassert.match(app, /navVisible && assistantLauncherLoaded/);) => assert.match(app, /navVisible && assistantLauncherLoaded/);{[assert.match(app, /navVisible && assistantLauncherLoaded/);sassert.match(app, /navVisible && assistantLauncherLoaded/);S]*?setBooksassert.match(app, /navVisible && assistantLauncherLoaded/);(catalogueBooksassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(libraryPage, /disabled=assert.match(app, /navVisible && assistantLauncherLoaded/);{loadingassert.match(app, /navVisible && assistantLauncherLoaded/);}/);
});

test('all five library covers load eagerly at high priority on library entry', () => {
  assert.match(libraryPage, /loading="eager" decoding="async" fetchPriority="high"/);
  assert.doesNotMatch(libraryPage, /loading="lazy"|fetchPriority="low"|priority=assert.match(app, /navVisible && assistantLauncherLoaded/);{index === 0assert.match(app, /navVisible && assistantLauncherLoaded/);}/);
  assert.match(libraryPage, /booksassert.match(app, /navVisible && assistantLauncherLoaded/);.mapassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);(bookassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
});

test('the static splash does not launch a large fallback during the React root handoff', () => {
  const staticLogo = html.match(/<img[^>]+splash-logoassert.match(app, /navVisible && assistantLauncherLoaded/);.webp[^>]*>/)?.[0] || '';
  assert.ok(staticLogo, 'The initial HTML must contain the optimized splash logo');
  assert.doesNotMatch(staticLogo, /onerror=/i, 'The static splash must not trigger a fallback when React replaces the initial root');
});

test('the initial splash preloads the generated lightweight WebP logo', async () => {
  assert.match(html, /assetsassert.match(app, /navVisible && assistantLauncherLoaded/);/splash-logoassert.match(app, /navVisible && assistantLauncherLoaded/);.webp/);
  assert.match(app, /assetsassert.match(app, /navVisible && assistantLauncherLoaded/);/splash-logoassert.match(app, /navVisible && assistantLauncherLoaded/);.webp/);
  const generator = await readFile(new URL('../scripts/prepare-splash-logo.mjs', import.meta.url), 'utf8');
  assert.match(generator, /scriptsassert.match(app, /navVisible && assistantLauncherLoaded/);/assetsassert.match(app, /navVisible && assistantLauncherLoaded/);/Logo m24assert.match(app, /navVisible && assistantLauncherLoaded/);.webp/);
  assert.match(generator, /splash-logoassert.match(app, /navVisible && assistantLauncherLoaded/);.webp/);
  assert.match(generator, /40 assert.match(app, /navVisible && assistantLauncherLoaded/);* 1024/);
});

test('logo failure never blocks startup, while content failure keeps its retry path', () => {
  assert.match(app, /if assert.match(app, /navVisible && assistantLauncherLoaded/);(!content assert.match(app, /navVisible && assistantLauncherLoaded/);|assert.match(app, /navVisible && assistantLauncherLoaded/);| !splashLogoRevealComplete || !splashProgressComplete assert.match(app, /navVisible && assistantLauncherLoaded/);|assert.match(app, /navVisible && assistantLauncherLoaded/);| loadErrorassert.match(app, /navVisible && assistantLauncherLoaded/);) return assert.match(app, /navVisible && assistantLauncherLoaded/);(/);
  assert.match(app, /eventassert.match(app, /navVisible && assistantLauncherLoaded/);.currentTargetassert.match(app, /navVisible && assistantLauncherLoaded/);.hidden = true;[assert.match(app, /navVisible && assistantLauncherLoaded/);sassert.match(app, /navVisible && assistantLauncherLoaded/);S]*?setSplashLogoRevealCompleteassert.match(app, /navVisible && assistantLauncherLoaded/);(trueassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.doesNotMatch(app, /assetsassert.match(app, /navVisible && assistantLauncherLoaded/);/logoassert.match(app, /navVisible && assistantLauncherLoaded/);.png|fallbackAttempted/);
  assert.match(app, /<div className="loadingError" role="alert">[assert.match(app, /navVisible && assistantLauncherLoaded/);sassert.match(app, /navVisible && assistantLauncherLoaded/);S]*?windowassert.match(app, /navVisible && assistantLauncherLoaded/);.locationassert.match(app, /navVisible && assistantLauncherLoaded/);.reloadassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.doesNotMatch(app, /splashLogoReady|splashMinimumVisible|imageassert.match(app, /navVisible && assistantLauncherLoaded/);.decodeassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);)|setTimeoutassert.match(app, /navVisible && assistantLauncherLoaded/);(.*splash/i);
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
  assert.match(layoutSource, /buildNeighbourTextIndexassert.match(app, /navVisible && assistantLauncherLoaded/);(blocksassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(helperSource, /const blockTexts = blocksassert.match(app, /navVisible && assistantLauncherLoaded/);.mapassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);(blockassert.match(app, /navVisible && assistantLauncherLoaded/);) => normassert.match(app, /navVisible && assistantLauncherLoaded/);(blockassert.match(app, /navVisible && assistantLauncherLoaded/);?assert.match(app, /navVisible && assistantLauncherLoaded/);.textassert.match(app, /navVisible && assistantLauncherLoaded/);)assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(helperSource, /const nextTexts = new Arrayassert.match(app, /navVisible && assistantLauncherLoaded/);(blocksassert.match(app, /navVisible && assistantLauncherLoaded/);.lengthassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(helperSource, /const previousTexts = new Arrayassert.match(app, /navVisible && assistantLauncherLoaded/);(blocksassert.match(app, /navVisible && assistantLauncherLoaded/);.lengthassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.doesNotMatch(helperSource, /blocksassert.match(app, /navVisible && assistantLauncherLoaded/);.sliceassert.match(app, /navVisible && assistantLauncherLoaded/);(i assert.match(app, /navVisible && assistantLauncherLoaded/);+ 1assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.doesNotMatch(helperSource, /blocksassert.match(app, /navVisible && assistantLauncherLoaded/);.sliceassert.match(app, /navVisible && assistantLauncherLoaded/);(0, iassert.match(app, /navVisible && assistantLauncherLoaded/);)assert.match(app, /navVisible && assistantLauncherLoaded/);.reverseassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
});

test('recent reader layouts are reused with a bounded three-layout mobile memory cap', () => {
  assert.match(reader, /const READER_LAYOUT_CACHE_LIMIT = 3/);
  assert.match(reader, /READER_LAYOUT_CACHEassert.match(app, /navVisible && assistantLauncherLoaded/);.getassert.match(app, /navVisible && assistantLauncherLoaded/);(cacheKeyassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(reader, /while assert.match(app, /navVisible && assistantLauncherLoaded/);(READER_LAYOUT_CACHEassert.match(app, /navVisible && assistantLauncherLoaded/);.size > READER_LAYOUT_CACHE_LIMITassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
});

test('hydrated book content is cached with a strict mobile memory cap', () => {
  assert.match(libraryHook, /SEED_BOOK_CONTENT_IN_FLIGHT = new Mapassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(libraryHook, /const SEED_BOOK_CONTENT_CACHE_LIMIT = 2/);
  assert.match(libraryHook, /while assert.match(app, /navVisible && assistantLauncherLoaded/);(SEED_BOOK_CONTENT_CACHEassert.match(app, /navVisible && assistantLauncherLoaded/);.size > SEED_BOOK_CONTENT_CACHE_LIMITassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
});

test('opening a book preloads the reader module and reuses the prepared IndexedDB version', () => {
  assert.match(app, /Promiseassert.match(app, /navVisible && assistantLauncherLoaded/);.allassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);[[assert.match(app, /navVisible && assistantLauncherLoaded/);sassert.match(app, /navVisible && assistantLauncherLoaded/);S]*?ensureSeedBookContentassert.match(app, /navVisible && assistantLauncherLoaded/);(bookassert.match(app, /navVisible && assistantLauncherLoaded/);),assert.match(app, /navVisible && assistantLauncherLoaded/);s*loadReaderassert.match(app, /navVisible && assistantLauncherLoaded/);(assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(app, /initialVersion=assert.match(app, /navVisible && assistantLauncherLoaded/);{readerStateassert.match(app, /navVisible && assistantLauncherLoaded/);.versionassert.match(app, /navVisible && assistantLauncherLoaded/);}/);
  assert.match(reader, /initialVersion = null/);
  assert.match(reader, /if assert.match(app, /navVisible && assistantLauncherLoaded/);(initialVersionassert.match(app, /navVisible && assistantLauncherLoaded/);?assert.match(app, /navVisible && assistantLauncherLoaded/);.contentassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
});

test('the React splash uses the same radial reveal and progress animation as static HTML', () => {
  assert.match(css, /clip-path: circleassert.match(app, /navVisible && assistantLauncherLoaded/);(0% at 50% 50%assert.match(app, /navVisible && assistantLauncherLoaded/););/);
  assert.doesNotMatch(css, /clip-path: circleassert.match(app, /navVisible && assistantLauncherLoaded/);(0% at 50% 50%assert.match(app, /navVisible && assistantLauncherLoaded/);) !important/);
  assert.doesNotMatch(css, /Fast splash|loadingLogoEnter|loadingTextReveal|loadingPulse|loadingProgressSegment|loadingBloomReveal/, 'Legacy splash rules must be removed');
  assert.equal((css.match(/@keyframes loadingLogoBloom/g) || []).length, 1, 'The React splash must have one canonical logo animation');
  assert.match(css, /@keyframes loadingLogoBloom[assert.match(app, /navVisible && assistantLauncherLoaded/);sassert.match(app, /navVisible && assistantLauncherLoaded/);S]*?circleassert.match(app, /navVisible && assistantLauncherLoaded/);(75% at 50% 50%assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(css, /@keyframes loadingProgressFill[assert.match(app, /navVisible && assistantLauncherLoaded/);sassert.match(app, /navVisible && assistantLauncherLoaded/);S]*?scaleXassert.match(app, /navVisible && assistantLauncherLoaded/);(1assert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.doesNotMatch(css.slice(css.lastIndexOf('/* Coordinated splash reveal')), /@mediaassert.match(app, /navVisible && assistantLauncherLoaded/);s*assert.match(app, /navVisible && assistantLauncherLoaded/);(prefers-reduced-motion:assert.match(app, /navVisible && assistantLauncherLoaded/);s*reduceassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(app, /!splashLogoRevealComplete assert.match(app, /navVisible && assistantLauncherLoaded/);|assert.match(app, /navVisible && assistantLauncherLoaded/);| !splashProgressComplete/);
  assert.match(app, /setSplashLogoRevealCompleteassert.match(app, /navVisible && assistantLauncherLoaded/);(trueassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
  assert.match(app, /setSplashProgressCompleteassert.match(app, /navVisible && assistantLauncherLoaded/);(trueassert.match(app, /navVisible && assistantLauncherLoaded/);)/);
});

test('Android WebViews without modern viewport units retain a 100vh fallback', () => {
  assert.ok(html.includes('#root{width:100%;min-height:100vh;min-height:100svh'));
  assert.ok(html.includes('height:100vh;height:100svh;min-height:100vh;min-height:100svh'));
  assert.ok(css.includes('height: 100vh;assert.match(app, /navVisible && assistantLauncherLoaded/);n  height: 100dvh;'));
  assert.ok(css.includes('.appLoading { min-height: 100vh; min-height: 100svh;'));
  assert.ok(css.includes('min-height: 100vh !important;assert.match(app, /navVisible && assistantLauncherLoaded/);n  min-height: 100svh !important;'));
  assert.ok(css.includes('min-height: min(420px, calc(100vh - 20px)); max-height: calc(100vh - 20px);assert.match(app, /navVisible && assistantLauncherLoaded/);n  min-height: min(420px, calc(100dvh - 20px))'));
  assert.ok(css.includes('height: 92vh; max-height: calc(100vh - 16px); height: 92dvh'));
});
