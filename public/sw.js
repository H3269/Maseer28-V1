/* Path28 public-resource offline cache.
 * Only same-origin, app-owned static resources are cached. User records,
 * localStorage, IndexedDB, API/auth endpoints and cross-origin requests are
 * deliberately outside this service worker's cache boundary.
 */
const SHELL_CACHE = 'path28-public-shell-v1';
const CONTENT_CACHE = 'path28-public-content-v1';
const APP_SCOPE = new URL(self.registration.scope);

function isInsideApp(url) {
  return url.origin === APP_SCOPE.origin && url.pathname.startsWith(APP_SCOPE.pathname);
}

function cacheKind(url, request) {
  if (!isInsideApp(url)) return null;
  const relative = url.pathname.slice(APP_SCOPE.pathname.length);
  if (/^(api|auth|account|profile|user-data)(\/|$)/i.test(relative)) return null;
  if (/^assets\//i.test(relative)) return 'shell';
  if (/^(content|assistant)\//i.test(relative)) return 'content';
  if (/^(index\.html|manifest\.webmanifest|version\.json|Label\.png)$/.test(relative)
    || request.mode === 'navigate') return 'shell';
  return null;
}

async function storePublicResponse(cache, request, response) {
  if (!response || !response.ok || response.type !== 'basic') return;
  const control = response.headers.get('cache-control') || '';
  if (/private|no-store/i.test(control) || response.headers.has('set-cookie')) return;
  try { await cache.put(request, response.clone()); } catch { /* Quota failures must not break online use. */ }
}

async function fetchWithTimeout(request, timeoutMs = 4500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(request, { signal: controller.signal }); }
  finally { clearTimeout(timeout); }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetchWithTimeout(request);
    await storePublicResponse(cache, request, response);
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
  event.waitUntil(self.clients.claim());
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