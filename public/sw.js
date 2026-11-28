/* Path28 public-resource offline cache.
 * User records are deliberately outside this service worker's cache boundary.
 * Only same-origin, app-owned public resources are cached.
 */
const SHELL_CACHE = 'path28-public-shell-v2';
const CONTENT_CACHE = 'path28-public-content-v2';
const APP_SCOPE = new URL(self.registration.scope);
const PREFETCH_KEY = 'path28-offline-prefetch-v2';
const OFFLINE_ASSET_MANIFEST = 'offline-assets.json';

function isInsideApp(url) {
  return url.origin === APP_SCOPE.origin && url.pathname.startsWith(APP_SCOPE.pathname);
}

function cacheKind(url, request) {
  if (!isInsideApp(url)) return null;
  const relative = url.pathname.slice(APP_SCOPE.pathname.length);
  if (/^(api|auth|account|profile|user-data)(\/|$)/i.test(relative)) return null;
  if (/^assets\//i.test(relative)) return 'shell';
  if (/^(content|assistant)\//i.test(relative)) return 'content';
  if (/^(index\.html|manifest\.webmanifest|version\.json|Label\\.png|offline-assets\\.json)$/.test(relative)
    || request.mode === 'navigate') return 'shell';
  return null;
}

function isExpectedPublicResponse(request, response) {
  let url;
  try { url = new URL(request instanceof Request ? request.url : String(request)); }
  catch { return false; }
  const pathname = url.pathname;
  const contentType = response.headers.get('content-type') || '';
  if (/\.json$/i.test(pathname)) return /(?:application|text)\/[^;]*json/i.test(contentType);
  if (/\.webmanifest$/i.test(pathname)) return /manifest\+json|application\/json/i.test(contentType);
  if (/\.html?$/i.test(pathname) || pathname === APP_SCOPE.pathname
    || (request instanceof Request && request.mode === 'navigate')) return /text\/html/i.test(contentType);
  if (/\.m?js$/i.test(pathname)) return /(?:java|ecma)script/i.test(contentType);
  if (/\.css$/i.test(pathname)) return /text\/css/i.test(contentType);
  if (/\.(png|webp|jpe?g|svg|gif|ico)$/i.test(pathname)) return /image\//i.test(contentType);
  return true;
}

async function storePublicResponse(cache, request, response) {
  if (!response || !response.ok || response.type !== 'basic' || !isExpectedPublicResponse(request, response)) return false;
  const control = response.headers.get('cache-control') || '';
  if (/private|no-store/i.test(control) || response.headers.has('set-cookie')) return false;
  try { await cache.put(request, response.clone()); return true; }
  catch { return false; }
}

async function fetchWithTimeout(request, timeoutMs = 6500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(request, { signal: controller.signal }); }
  finally { clearTimeout(timeout); }
}

async function cachePublicUrl(relativePath, cacheName = CONTENT_CACHE) {
  if (typeof relativePath !== 'string' || relativePath.startsWith('/')
    || relativePath.includes('..') || /^(api|auth|account|profile|user-data)(\/|$)/i.test(relativePath)) return false;
  const url = new URL(relativePath, APP_SCOPE);
  if (!isInsideApp(url)) return false;
  const cache = await caches.open(cacheName);
  const request = new Request(url.href, { cache: 'reload' });
  try {
    const response = await fetchWithTimeout(request, 25000);
    return storePublicResponse(cache, request, response);
  } catch { return false; }
}

async function performOfflinePrefetch() {
  const cache = await caches.open(CONTENT_CACHE);
  try {
    const indexUrl = new URL('content/runtime-v1/index.json', APP_SCOPE);
    const indexResponse = await fetchWithTimeout(new Request(indexUrl.href, { cache: 'reload' }));
    if (!indexResponse.ok) return;
    const index = await indexResponse.clone().json();
    if (!Array.isArray(index?.topics) || index.topics.length !== 34) return;

    const manifestUrl = new URL('content/library.seed.json', APP_SCOPE);
    const manifestResponse = await fetchWithTimeout(new Request(manifestUrl.href, { cache: 'reload' }));
    if (!manifestResponse.ok) return;
    const manifest = await manifestResponse.clone().json();

    const assetManifestUrl = new URL(OFFLINE_ASSET_MANIFEST, APP_SCOPE);
    const assetManifestResponse = await fetchWithTimeout(new Request(assetManifestUrl.href, { cache: 'reload' }));
    if (!assetManifestResponse.ok) return;
    const assetManifest = await assetManifestResponse.clone().json();
    if (assetManifest?.schema !== 1 || !Array.isArray(assetManifest?.files)
      || assetManifest.files.length < 1
      || assetManifest.files.some((path) => typeof path !== 'string' || !path
        || path.startsWith('/') || path.includes('..'))) return;

    await storePublicResponse(cache, indexUrl.href, indexResponse);
    await storePublicResponse(cache, manifestUrl.href, manifestResponse);
    await storePublicResponse(await caches.open(SHELL_CACHE), assetManifestUrl.href, assetManifestResponse);

    const topicPaths = [];
    for (const topic of index.topics) {
      if (/^topics\/T\d{2}\.json$/.test(topic?.basePath || '')) topicPaths.push('content/runtime-v1/' + topic.basePath);
      if (/^overrides\/T\d{2}\.json$/.test(topic?.overridePath || '')) topicPaths.push('content/runtime-v1/' + topic.overridePath);
    }
    // Every topic must contribute exactly one canonical file and one overlay.
    if (topicPaths.length !== 68) return;
    const paths = [...new Set([...assetManifest.files, ...topicPaths])];
    const books = Array.isArray(manifest?.books) ? manifest.books : [];
    if (books.length !== 5) return;
    for (const book of books) {
      if (/^content\/books\/[a-zA-Z0-9_-]+\.json$/.test(book?.file || '')) paths.push(book.file);
      for (const cover of [book?.cover, book?.libraryCover]) {
        if (typeof cover === 'string' && /^assets\/[a-zA-Z0-9_./-]+\.(webp|png|jpg|jpeg)$/i.test(cover)) paths.push(cover);
      }
    }

    // Include every generated runtime shard, book and public cover in addition
    // to every emitted JS/CSS/chunk/asset from the production build.
    const requiredPaths = [...new Set(paths)];
    const previousMarker = await cache.match(new URL(PREFETCH_KEY, APP_SCOPE).href);
    const previousState = previousMarker ? await previousMarker.json().catch(() => null) : null;
    if (previousState?.schema === 2
      && previousState?.contentVersion === index.content_version
      && previousState?.libraryRevision === manifest.revision
      && previousState?.assetManifestVersion === assetManifest.version) {
      let allPresent = true;
      for (const path of requiredPaths) {
        const targetCache = path.startsWith('assets/') ? await caches.open(SHELL_CACHE) : cache;
        if (!await targetCache.match(new URL(path, APP_SCOPE).href)) { allPresent = false; break; }
      }
      if (allPresent) return;
    }
    // A bounded worker pool avoids flooding constrained mobile connections.
    let cursor = 0;
    let failedFiles = 0;
    const workers = Array.from({ length: 3 }, async () => {
      while (cursor < paths.length) {
        const current = paths[cursor++];
        const stored = await cachePublicUrl(current, current.startsWith('assets/') ? SHELL_CACHE : CONTENT_CACHE);
        if (!stored) failedFiles += 1;
      }
    });
    await Promise.all(workers);
    // Do not mark the device offline-ready if even one required public file failed.
    // A later online visit can retry the incomplete prefetch.
    // Verify the cache read-back, not just successful network responses. The
    // browser may evict entries or reject writes under storage pressure.
    const missingAfterWrite = [];
    for (const path of requiredPaths) {
      const targetCache = path.startsWith('assets/') ? await caches.open(SHELL_CACHE) : cache;
      if (!await targetCache.match(new URL(path, APP_SCOPE).href)) missingAfterWrite.push(path);
    }
    if (failedFiles === 0 && missingAfterWrite.length === 0
      && requiredPaths.length >= 73) {
      await cache.put(new URL(PREFETCH_KEY, APP_SCOPE).href, new Response(JSON.stringify({
        schema: 2,
        completedAt: new Date().toISOString(),
        contentVersion: index.content_version,
        libraryRevision: manifest.revision,
        assetManifestVersion: assetManifest.version,
        expectedTopicFiles: 68,
        requestedFiles: requiredPaths.length,
      }), { headers: { 'Content-Type': 'application/json' } }));
    }
  } catch {
    // Prefetch is best-effort; a failed optional download must not break online use.
  }
}

let offlinePrefetchInFlight = null;

function prefetchOfflineContent() {
  if (!offlinePrefetchInFlight) {
    offlinePrefetchInFlight = performOfflinePrefetch().finally(() => {
      offlinePrefetchInFlight = null;
    });
  }
  return offlinePrefetchInFlight;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetchWithTimeout(request);
    if (!response.ok || !isExpectedPublicResponse(request, response)) {
      // Filtering gateways may return 403/451/5xx or a synthetic HTML block page instead of the expected asset.
      // Prefer the last verified app-owned copy in those cases as well.
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      return response;
    }
    await storePublicResponse(cache, request, response);
    const url = new URL(request.url);
    const relative = url.pathname.slice(APP_SCOPE.pathname.length);
    if (relative === 'content/runtime-v1/index.json') {
      // Start full public-content hydration after the first successful index fetch.
      prefetchOfflineContent().catch(() => {});
    }
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw new Error('در حال حاضر اتصال در دسترس نیست و این فایل قبلاً روی دستگاه ذخیره نشده است.');
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetchWithTimeout(request);
  await storePublicResponse(cache, request, response);
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const shellUrl = new URL('index.html', APP_SCOPE).href;
    const response = await fetchWithTimeout(new Request(shellUrl, { cache: 'reload' }), 8000);
    if (!response.ok) throw new Error('App shell could not be cached.');
    await storePublicResponse(cache, shellUrl, response);
    await storePublicResponse(cache, APP_SCOPE.href, response);
    const html = await response.clone().text();
    const assetPaths = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)]
      .map((match) => match[1]);
    await Promise.all(assetPaths.map(async (assetPath) => {
      try {
        const assetUrl = new URL(assetPath, shellUrl);
        if (!isInsideApp(assetUrl)) return;
        const asset = await fetchWithTimeout(new Request(assetUrl.href), 8000);
        await storePublicResponse(cache, assetUrl.href, asset);
      } catch { /* Optional preload failure does not invalidate a valid app shell. */ }
    }));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => /^path28-public-(shell|content)-v1$/.test(name))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'PATH28_PREFETCH_OFFLINE') {
    event.waitUntil(prefetchOfflineContent());
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const kind = cacheKind(url, request);
  if (!kind) return;
  if (kind === 'shell' && /^assets\//i.test(url.pathname.slice(APP_SCOPE.pathname.length))) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }
  event.respondWith(networkFirst(request, kind === 'content' ? CONTENT_CACHE : SHELL_CACHE));
});
