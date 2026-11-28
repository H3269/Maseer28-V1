import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173/Maseer28-V1/';
const browser = await chromium.launch({ headless: true });

try {
  // Warm the app and its public content cache, then prove a same-WebView
  // offline reload can restore the shell and runtime topic index.
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    // Match the startup-performance suite: hosted runners may default to reduced motion,
    // which can suppress the splash completion events required before the app mounts.
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  const swResponses = [];
  page.on('response', (response) => {
    if (/content\/runtime-v1\/index\.json/.test(response.url())) {
      swResponses.push({ url: response.url(), fromServiceWorker: response.fromServiceWorker(), status: response.status() });
    }
  });
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('#copyrightModal').waitFor({ state: 'visible', timeout: 45000 });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#copyrightModal').waitFor({ state: 'visible', timeout: 45000 });
  assert.equal(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), true,
    'The app should be controlled by its registered service worker after the warm reload');

  // Do not call the device offline-ready until every public topic shard,
  // exercise overlay, and published book text has been cached and verified.
  await page.waitForFunction(async () => {
    const scope = new URL('./', location.href).href;
    const cache = await caches.open('path28-public-content-v2');
    const markerUrl = new URL('path28-offline-prefetch-v2', scope).href;
    const markerResponse = await cache.match(markerUrl);
    if (!markerResponse) return false;
    const marker = await markerResponse.json();
    return marker.expectedTopicFiles === 68 && marker.requestedFiles >= 73;
  }, null, { timeout: 120000 });

  const offlineCacheAudit = await page.evaluate(async () => {
    const scope = new URL('./', location.href).href;
    const cache = await caches.open('path28-public-content-v2');
    const shell = await caches.open('path28-public-shell-v2');
    const getJson = async (relative) => {
      const response = await cache.match(new URL(relative, scope).href);
      return response ? response.json() : null;
    };
    const index = await getJson('content/runtime-v1/index.json');
    const manifest = await getJson('content/library.seed.json');
    const assetManifestResponse = await shell.match(new URL('offline-assets.json', scope).href);
    const assetManifest = assetManifestResponse ? await assetManifestResponse.json() : null;
    const assetManifestFiles = assetManifest?.files || [];
    const assetManifestCachedCount = (await Promise.all(assetManifestFiles.map(async (path) => {
      const target = /^(content|assistant)\//.test(path) ? cache : shell;
      return Boolean(await target.match(new URL(path, scope).href));
    }))).filter(Boolean).length;
    const topicFiles = (index?.topics || []).flatMap((topic) => [
      'content/runtime-v1/' + topic.basePath,
      'content/runtime-v1/' + topic.overridePath,
    ]);
    const topicCacheCount = (await Promise.all(topicFiles.map((path) =>
      cache.match(new URL(path, scope).href)))).filter(Boolean).length;
    const bookFiles = (manifest?.books || []).map((book) => book.file);
    const bookCacheCount = (await Promise.all(bookFiles.map((path) =>
      cache.match(new URL(path, scope).href)))).filter(Boolean).length;
    const coverFiles = (manifest?.books || []).flatMap((book) =>
      [book.cover, book.libraryCover].filter((path) => typeof path === 'string'));
    const coverCacheCount = (await Promise.all(coverFiles.map((path) =>
      shell.match(new URL(path, scope).href)))).filter(Boolean).length;
    const shellResponse = await shell.match(new URL('index.html', scope).href);
    return {
      topicCount: index?.topics?.length || 0,
      topicCacheCount,
      bookCount: bookFiles.length,
      bookCacheCount,
      coverCount: coverFiles.length,
      coverCacheCount,
      shellCached: Boolean(shellResponse),
      assetManifestCount: assetManifestFiles.length,
      assetManifestCachedCount,
      assetManifestCached: Boolean(assetManifestResponse),
    };
  });
  assert.equal(offlineCacheAudit.topicCount, 34, 'All 34 topic definitions must be present in the offline index');
  assert.equal(offlineCacheAudit.topicCacheCount, 68, 'All 34 topic files and 34 exercise overlays must be cached');
  assert.equal(offlineCacheAudit.bookCacheCount, offlineCacheAudit.bookCount, 'Every published book text must be cached');
  assert.equal(offlineCacheAudit.coverCacheCount, offlineCacheAudit.coverCount, 'Every published book cover must be cached');
  assert.equal(offlineCacheAudit.shellCached, true, 'The app shell must be cached before offline mode');
  assert.equal(offlineCacheAudit.assetManifestCached, true, 'The generated manifest for all eager and lazy build assets must be cached');
  assert.ok(offlineCacheAudit.assetManifestCount > 0, 'The generated asset manifest must enumerate production resources');
  assert.equal(offlineCacheAudit.assetManifestCachedCount, offlineCacheAudit.assetManifestCount,
    'Every generated eager/lazy JS, CSS, font, image and content asset must be present in Cache Storage');

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#copyrightModal').waitFor({ state: 'visible', timeout: 45000 });
  assert.equal(await page.locator('.loadingError').count(), 0, 'Warm offline launch must not remain on the startup error screen');
  const offlineState = await page.evaluate(() => ({
    controlled: Boolean(navigator.serviceWorker.controller),
    title: document.querySelector('h1')?.textContent || '',
    appVisible: Boolean(document.querySelector('#copyrightModal')),
  }));
  assert.equal(offlineState.controlled, true);
  assert.equal(offlineState.appVisible, true);
  const offlineAssetFailures = await page.evaluate(async () => {
    const cache = await caches.open('path28-public-content-v2');
    const shell = await caches.open('path28-public-shell-v2');
    const response = await shell.match(new URL('offline-assets.json', location.href).href);
    const manifest = response ? await response.json() : null;
    const files = manifest?.files || [];
    const failures = [];
    // Keep requests bounded while avoiding a slow one-by-one offline audit.
    for (let offset = 0; offset < files.length; offset += 8) {
      const batch = files.slice(offset, offset + 8);
      const results = await Promise.all(batch.map(async (relative) => {
        try {
          const response = await fetch(new URL(relative, location.href));
          return response.ok ? null : relative;
        } catch { return relative; }
      }));
      failures.push(...results.filter(Boolean));
    }
    return { total: files.length, failures };
  });
  assert.ok(offlineAssetFailures.total > 0, 'Offline manifest must enumerate resources');
  assert.deepEqual(offlineAssetFailures.failures, [], 'Every enumerated app resource must remain fetchable offline');
  await context.close();

  // Independently verify that the retry control repeats the startup fetch
  // pipeline in the same page after a simulated transient network failure.
  const retryContext = await browser.newContext({
    serviceWorkers: 'block',
    viewport: { width: 390, height: 844 },
    reducedMotion: 'no-preference',
  });
  const retryPage = await retryContext.newPage();
  let blockContent = true;
  await retryPage.route('**/content/**', async (route) => {
    if (blockContent) await route.abort('internetdisconnected');
    else await route.continue();
  });
  await retryPage.goto(baseURL, { waitUntil: 'domcontentloaded' });
  const retryButton = retryPage.getByRole('button', { name: 'بررسی اتصال و تلاش دوباره' });
  await retryButton.waitFor({ state: 'visible', timeout: 45000 });
  blockContent = false;
  await retryButton.click();
  await retryPage.locator('#copyrightModal').waitFor({ state: 'visible', timeout: 45000 });
  assert.equal(await retryPage.locator('.loadingError').count(), 0, 'A successful retry must clear the startup error');
  await retryContext.close();
  console.log('Offline warm launch and in-place reconnect retry passed.');
} finally {
  await browser.close();
}