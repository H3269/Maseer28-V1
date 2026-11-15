import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173/Maseer28/';
const outputPath = 'reports/generated/startup-performance.json';
const browser = await chromium.launch({ headless: true });

async function measure(viewport, run) {
  const isAndroid = viewport.profile === 'android';
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: isAndroid ? 2 : 1,
    isMobile: isAndroid,
    hasTouch: isAndroid,
    ...(isAndroid ? {
      userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    } : {}),
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/favicon|third.party/i.test(message.text())) errors.push(message.text());
  });

  await page.addInitScript(() => {
    window.__path28SplashObserved = null;
    const watchedImages = new WeakSet();
    window.__path28SplashAnimation = {
      firstAnimationName: null,
      firstAnimationDuration: null,
      firstClipPath: null,
      completedName: null,
      completedAt: null,
      appVisibleAt: null,
      finalClipPath: null,
      decodedAtAnimationStart: false,
    };
    document.addEventListener('animationstart', (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.closest('#root .initialSplash, #root .appLoading')) return;
      if (event.animationName !== 'initialLogoBloom' && event.animationName !== 'loadingLogoBloom') return;
      const style = getComputedStyle(image);
      if (window.__path28SplashAnimation.firstAnimationName === null) {
        window.__path28SplashAnimation.firstAnimationName = event.animationName;
        window.__path28SplashAnimation.firstAnimationDuration = style.animationDuration;
        window.__path28SplashAnimation.firstClipPath = style.clipPath;
        window.__path28SplashAnimation.decodedAtAnimationStart = image.complete && image.naturalWidth > 0;
      }
    }, true);
    document.addEventListener('animationend', (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.closest('#root .initialSplash, #root .appLoading')) return;
      if (event.animationName !== 'initialLogoBloom' && event.animationName !== 'loadingLogoBloom') return;
      window.__path28SplashAnimation.completedName = event.animationName;
      window.__path28SplashAnimation.completedAt = performance.now();
      window.__path28SplashAnimation.finalClipPath = getComputedStyle(image).clipPath;
      recordAppVisibility();
    }, true);
    const recordAppVisibility = () => {
      const modal = document.querySelector('#copyrightModal');
      if (!modal || window.__path28SplashAnimation.appVisibleAt !== null) return;
      const style = getComputedStyle(modal);
      const rect = modal.getBoundingClientRect();
      if (style.display !== 'none' && style.visibility !== 'hidden'
        && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0) {
        window.__path28SplashAnimation.appVisibleAt = performance.now();
      }
    };
    const inspectFrame = (image) => {
      if (!image.isConnected) return;
      const style = getComputedStyle(image);
      const rect = image.getBoundingClientRect();
      if (image.complete && image.naturalWidth > 0
        && style.display !== 'none' && style.visibility !== 'hidden'
        && rect.width > 0 && rect.height > 0) {
        window.__path28SplashObserved = {
          ready: true,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          width: rect.width,
          height: rect.height,
          opacity: Number(style.opacity),
          src: image.currentSrc || image.src,
        };
        return;
      }
      return;
    };
    const watchImage = (image) => {
      if (!(image instanceof HTMLImageElement) || watchedImages.has(image)) return;
      watchedImages.add(image);
      // Animation events are also captured at document level so a fast
      // static-to-React splash hand-off cannot lose the first animation frame.
      // Do not await image.decode(): the splash can be replaced while that
      // promise settles. Poll the live element from its first observed frame.
      if (image.complete && image.naturalWidth > 0) {
        inspectFrame(image);
      } else {
        image.addEventListener('load', () => inspectFrame(image), { once: true });
      }
    };
    const inspectNode = (node) => {
      if (!(node instanceof Element)) return;
      watchImage(node);
      node.querySelectorAll?.('#root .initialSplash img, #root .appLoading img').forEach(watchImage);
    };
    const observer = new MutationObserver((records) => {
      // Inspect added nodes from the mutation records as well as the live
      // document, so a quick splash hand-off is not lost between queries.
      for (const record of records) {
        for (const node of record.addedNodes) inspectNode(node);
      }
      document.querySelectorAll(
        '#root .initialSplash img, #root .appLoading img'
      ).forEach(watchImage);
      recordAppVisibility();
    });
    observer.observe(document, { childList: true, subtree: true });
    document.querySelectorAll(
      '#root .initialSplash img, #root .appLoading img'
    ).forEach(watchImage);
  });

  const parseCssTimeMs = (value) => {
  const match = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(value?.trim() || '');
  if (!match) return Number.NaN;
  return Number(match[1]) * (match[2] === 's' ? 1000 : 1);
};

const startedAt = Date.now();
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });

  // The static HTML splash can finish before DOMContentLoaded on a fast
  // device. Capture animation events from document start instead of waiting
  // for a transient splash node to remain mounted after navigation.
  await page.locator('#copyrightModal').waitFor({ state: 'visible', timeout: 45000 });
  const logoReadiness = await page.evaluate(() => {
    const observed = window.__path28SplashObserved;
    if (observed?.ready) return {
      logoDecoded: observed.naturalWidth > 0,
      logoNaturalWidth: observed.naturalWidth,
      logoVisible: observed.width > 0 && observed.height > 0,
    };
    const image = document.querySelector('#root .initialSplash img, #root .appLoading img');
    if (!image) return { logoDecoded: false, logoNaturalWidth: 0, logoVisible: false };
    const style = getComputedStyle(image);
    const rect = image.getBoundingClientRect();
    return {
      logoDecoded: image.complete && image.naturalWidth > 0,
      logoNaturalWidth: image.naturalWidth || 0,
      logoVisible: style.display !== 'none' && style.visibility !== 'hidden'
        && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0,
    };
  });

  // The first interactive surface is exposed only after required content and
  // splash-logo readiness gates have completed.
  const animationGate = await page.evaluate(() => window.__path28SplashAnimation);
  assert.ok(
    animationGate.firstAnimationName === 'initialLogoBloom' || animationGate.firstAnimationName === 'loadingLogoBloom',
    'The initial or React splash must start the radial logo-opening animation',
  );
  assert.ok(
    Math.abs(parseCssTimeMs(animationGate.firstAnimationDuration) - 950) < 1,
    'The logo-opening animation must run for its full 0.95-second duration',
  );
  assert.equal(animationGate.decodedAtAnimationStart, true, 'The splash logo image must be decoded when its reveal animation starts');
  assert.ok(
    animationGate.completedName === 'initialLogoBloom' || animationGate.completedName === 'loadingLogoBloom',
    'The splash logo radial animation must complete before the app is shown',
  );
  assert.ok(
    animationGate.finalClipPath?.includes('75%'),
    'The logo must reach its fully revealed circular clip-path at animation end',
  );
  assert.ok(
    animationGate.appVisibleAt !== null && animationGate.completedAt <= animationGate.appVisibleAt,
    'The app must not expose its first interactive surface before the logo animation completes',
  );
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource').map((entry) => ({
      url: entry.name,
      durationMs: Math.round(entry.duration),
      transferBytes: entry.transferSize || 0,
      decodedBytes: entry.decodedBodySize || 0,
      initiatorType: entry.initiatorType,
    }));
    return {
      domContentLoadedMs: Math.round(navigation?.domContentLoadedEventEnd || 0),
      loadEventMs: Math.round(navigation?.loadEventEnd || 0),
      responseStartMs: Math.round(navigation?.responseStart || 0),
      firstPaintMs: Math.round(performance.getEntriesByName('first-paint')[0]?.startTime || 0),
      firstContentfulPaintMs: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0),
      resourceCount: resources.length,
      totalTransferBytes: resources.reduce((sum, item) => sum + item.transferBytes, 0),
      totalDecodedBytes: resources.reduce((sum, item) => sum + item.decodedBytes, 0),
      largestResources: [...resources].sort((a, b) => b.transferBytes - a.transferBytes).slice(0, 12),
    };
  });
  const result = {
    viewport: { width: viewport.width, height: viewport.height },
    profile: viewport.profile || 'desktop',
    run,
    appReadyMs: Date.now() - startedAt,
    ...logoReadiness,
    ...metrics,
    consoleErrors: errors,
  };
  assert.equal(result.logoDecoded, true, 'Splash logo must decode before the app becomes interactive');
  assert.equal(result.logoVisible, true, 'Splash logo must be visible while the startup gate is active');
  await context.close();
  return result;
}

try {
  const results = [];
  const profiles = [
    { width: 360, height: 800, profile: 'android' },
    { width: 320, height: 640, profile: 'android' },
    { width: 390, height: 844, profile: 'desktop-mobile-viewport' },
    { width: 1365, height: 900, profile: 'desktop' },
  ];
  for (const viewport of profiles) {
    for (let run = 1; run <= 3; run += 1) {
      results.push(await measure(viewport, run));
    }
  }
  const report = {
    generatedAt: new Date().toISOString(),
    baseURL,
    note: 'CI-host measurements are diagnostic only; they are not a substitute for real-device measurements on the owner’s Android browser.',
    results,
  };
  await mkdir('reports/generated', { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({
    outputPath,
    runs: results.length,
    appReadyMs: results.map(({ viewport, profile, run, appReadyMs }) => ({ profile, viewport: viewport.width + 'x' + viewport.height, run, appReadyMs })),
    maxTransferBytes: Math.max(...results.map((item) => item.totalTransferBytes)),
    consoleErrorRuns: results.filter((item) => item.consoleErrors.length).length,
  }, null, 2));
} finally {
  await browser.close();
}
