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
    // This suite verifies the approved non-blocking splash motion, so make the motion preference deterministic
    // instead of inheriting a hosted runner's OS-level accessibility setting.
    reducedMotion: 'no-preference',
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
    window.__path28ImageEvents = [];
    document.addEventListener('load', (event) => {
      if (event.target instanceof HTMLImageElement) window.__path28ImageEvents.push({ type: 'load', src: event.target.currentSrc || event.target.src, naturalWidth: event.target.naturalWidth });
    }, true);
    document.addEventListener('error', (event) => {
      if (event.target instanceof HTMLImageElement) window.__path28ImageEvents.push({ type: 'error', src: event.target.currentSrc || event.target.src, fallbackAttempted: event.target.dataset.fallbackAttempted || null });
    }, true);
    const watchedImages = new WeakSet();
    window.__path28SplashAnimation = {
      firstAnimationName: null,
      firstAnimationDuration: null,
      firstAnimationOpacity: null,
      firstClipPath: null,
      completedName: null,
      completedAt: null,
      appVisibleAt: null,
      finalClipPath: null,
      finalLogoConnectedAtAnimationEnd: null,
      decodedAtAnimationStart: false,
      progressCompletedAt: null,
    };
    document.addEventListener('animationstart', (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.closest('#root .initialSplash, #root .appLoading')) return;
      if (event.animationName !== 'loadingLogoBloom') return;
      const style = getComputedStyle(image);
      if (window.__path28SplashAnimation.firstAnimationName === null) {
        window.__path28SplashAnimation.firstAnimationName = event.animationName;
        window.__path28SplashAnimation.firstAnimationDuration = style.animationDuration;
        window.__path28SplashAnimation.firstAnimationOpacity = Number(style.opacity);
        window.__path28SplashAnimation.firstClipPath = style.clipPath;
        window.__path28SplashAnimation.decodedAtAnimationStart = image.complete && image.naturalWidth > 0;
      }
    }, true);
    document.addEventListener('animationend', (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.closest('#root .initialSplash, #root .appLoading')) return;
      if (event.animationName !== 'loadingLogoBloom') return;
      window.__path28SplashAnimation.completedName = event.animationName;
      window.__path28SplashAnimation.completedAt = performance.now();
      window.__path28SplashAnimation.finalLogoConnectedAtAnimationEnd = image.isConnected;
      const finalStyle = getComputedStyle(image);
      const logoAnimation = image.getAnimations().find((animation) => animation.animationName === 'loadingLogoBloom');
      window.__path28SplashAnimation.finalClipPath = finalStyle.clipPath;
      window.__path28SplashAnimation.finalAnimationName = finalStyle.animationName;
      window.__path28SplashAnimation.finalAnimationPlayState = logoAnimation?.playState || 'not-present';
      window.__path28SplashAnimation.finalAnimationCurrentTime = logoAnimation?.currentTime ?? null;
      window.__path28SplashAnimation.finalAnimationEffect = logoAnimation?.effect?.getKeyframes?.() || null;
      window.__path28SplashAnimation.finalElementClass = image.className;
      window.__path28SplashAnimation.finalParentClass = image.parentElement?.className || null;
      window.__path28SplashAnimation.finalParentConnected = image.parentElement?.isConnected || false;
      const finalRect = image.getBoundingClientRect();
      window.__path28SplashAnimation.finalLogoRect = {
        width: finalRect.width,
        height: finalRect.height,
      };
      recordAppVisibility();
    }, true);
    document.addEventListener('animationend', (event) => {
      if (event.target instanceof HTMLElement && event.target.classList.contains('loadingProgressFill')) {
        window.__path28SplashAnimation.progressCompletedAt = performance.now();
      }
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
        const logoAnimation = image.getAnimations()
          .find((animation) => animation.animationName === 'loadingLogoBloom');
        if (logoAnimation && window.__path28SplashAnimation.firstAnimationName === null) {
          window.__path28SplashAnimation.firstAnimationName = logoAnimation.animationName;
          window.__path28SplashAnimation.firstAnimationDuration = style.animationDuration;
          window.__path28SplashAnimation.firstAnimationOpacity = Number(style.opacity);
          window.__path28SplashAnimation.firstClipPath = style.clipPath;
          window.__path28SplashAnimation.decodedAtAnimationStart = image.complete && image.naturalWidth > 0;
          window.__path28SplashAnimation.animationPlayState = logoAnimation.playState;
        }
        window.__path28SplashObserved = {
          ready: true,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          width: rect.width,
          height: rect.height,
          opacity: Number(style.opacity),
          animationName: style.animationName,
          clipPath: style.clipPath,
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

  // The app is exposed only after both actual content readiness and the radial reveal.
  const splashVisual = await page.evaluate(() => window.__path28SplashObserved);
  assert.ok(splashVisual, 'A splash logo element must exist while startup is loading');
  const animationEvidence = await page.evaluate(() => window.__path28SplashAnimation);
  assert.equal(animationEvidence.firstAnimationName, 'loadingLogoBloom', 'The splash must run the centered radial reveal');
  assert.ok(['running', 'finished'].includes(animationEvidence.animationPlayState), 'The radial reveal must run to completion');
  assert.equal(parseCssTimeMs(animationEvidence.firstAnimationDuration), 950, 'The radial reveal must retain its natural 950ms duration');
  assert.equal(animationEvidence.firstAnimationOpacity, 1, 'The logo must remain opaque while its radial mask opens');
  assert.equal(splashVisual.opacity, 1, 'The splash logo must remain visible during the reveal');
  assert.ok(splashVisual.width >= 160 && splashVisual.height >= 160, 'The logo must retain its intended display size');
  assert.equal(animationEvidence.completedName, 'loadingLogoBloom', 'The app must wait for the radial reveal animation end event');
  assert.match(animationEvidence.finalClipPath, /circle\(75% at 50% 50%\)/, `The reveal must finish with the full centered logo visible; evidence: ${JSON.stringify(animationEvidence)}`);
  assert.ok(animationEvidence.completedAt !== null && animationEvidence.appVisibleAt !== null
    && animationEvidence.completedAt <= animationEvidence.appVisibleAt,
  'The first app surface must not appear before the radial reveal completes');
  assert.ok(animationEvidence.progressCompletedAt !== null
    && animationEvidence.progressCompletedAt <= animationEvidence.appVisibleAt,
  'The app must not appear before the progress bar reaches 100%');
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
      imageEvents: window.__path28ImageEvents,
      splashLogoResources: resources.filter((item) => /splash-logo\.webp|logo\.png/i.test(item.url)),
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
  if (result.splashLogoResources.some((item) => /logo\.png/i.test(item.url))) console.error('SPLASH LOGO DIAGNOSTICS', JSON.stringify({ imageEvents: result.imageEvents, splashLogoResources: result.splashLogoResources }, null, 2));
  assert.ok(!result.splashLogoResources.some((item) => /logo\.png/i.test(item.url)), 'The oversized PNG fallback must never be requested during successful startup');
  const optimizedLogo = result.splashLogoResources.find((item) => /splash-logo\.webp/i.test(item.url));
  assert.ok(optimizedLogo && optimizedLogo.transferBytes > 0 && optimizedLogo.transferBytes <= 40 * 1024, 'The startup logo must use the generated lightweight WebP asset');
  await context.close();
  return result;
}

async function verifySplashReadinessOrders() {
  const viewport = { width: 390, height: 844 };

  // Simulate a slow application bundle: the static HTML animation may finish
  // before React mounts, but the visible React splash must start a fresh reveal.
  const delayedBundleContext = await browser.newContext({ viewport, reducedMotion: 'no-preference' });
  const delayedBundlePage = await delayedBundleContext.newPage();
  await delayedBundlePage.route('**/*.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await delayedBundlePage.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await delayedBundlePage.locator('#root .appLoading').waitFor({ state: 'visible', timeout: 20000 });
  const delayedMountAnimation = await delayedBundlePage.locator('#root .appLoading .loadingBrand img').evaluate((image) => {
    const animation = image.getAnimations().find((item) => item.animationName === 'loadingLogoBloom');
    return { playState: animation?.playState || 'missing', currentTime: Number(animation?.currentTime ?? -1) };
  });
  assert.equal(delayedMountAnimation.playState, 'running',
    'The React splash must start its logo reveal when it becomes visible, even after a delayed bundle');
  assert.ok(delayedMountAnimation.currentTime >= 0 && delayedMountAnimation.currentTime < 500,
    'The React splash animation must not be consumed before it is visible; observed ' + JSON.stringify(delayedMountAnimation));
  await delayedBundleContext.close();
  const animationFirstContext = await browser.newContext({ viewport, reducedMotion: 'no-preference' });
  const animationFirstPage = await animationFirstContext.newPage();
  let releaseIndex;
  let signalIndexRequest;
  const indexRequested = new Promise((resolve) => { signalIndexRequest = resolve; });
  const indexGate = new Promise((resolve) => { releaseIndex = resolve; });
  await animationFirstPage.route('**/content/runtime-v1/index.json*', async (route) => {
    signalIndexRequest();
    await indexGate;
    await route.continue();
  });
  await animationFirstPage.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await indexRequested;
  await animationFirstPage.waitForFunction(() => {
    const splash = document.querySelector('#root .appLoading');
    return splash?.dataset.revealComplete === 'true';
  }, { timeout: 10000 });
  const animationFirstState = await animationFirstPage.locator('#root .appLoading').evaluate((node) => ({
    contentReady: node.dataset.contentReady,
    revealComplete: node.dataset.revealComplete,
    modalVisible: Boolean(document.querySelector('#copyrightModal')),
  }));
  assert.deepEqual(animationFirstState, { contentReady: 'false', revealComplete: 'true', modalVisible: false },
    'When content is slow, the completed animation must not dismiss the splash');
  releaseIndex();
  await animationFirstPage.locator('#copyrightModal').waitFor({ state: 'visible', timeout: 45000 });
  await animationFirstContext.close();

  const readinessFirstContext = await browser.newContext({ viewport, reducedMotion: 'no-preference' });
  await readinessFirstContext.addInitScript(() => {
    window.__PATH28_SPLASH_DURATION_MS__ = 3000;
  });
  await readinessFirstContext.addInitScript(() => {
    window.__path28GateProbe = { completedAt: null, appVisibleAt: null };
    document.addEventListener('animationend', (event) => {
      if (event.animationName === 'loadingLogoBloom') window.__path28GateProbe.completedAt = performance.now();
    }, true);
    const observer = new MutationObserver(() => {
      const modal = document.querySelector('#copyrightModal');
      if (!modal || window.__path28GateProbe.appVisibleAt !== null) return;
      const style = getComputedStyle(modal);
      const rect = modal.getBoundingClientRect();
      if (style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0) {
        window.__path28GateProbe.appVisibleAt = performance.now();
      }
    });
    observer.observe(document, { childList: true, subtree: true, attributes: true });
  });
  const readinessFirstPage = await readinessFirstContext.newPage();
  await readinessFirstPage.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await readinessFirstPage.waitForFunction(() => {
    const splash = document.querySelector('#root .appLoading');
    return splash?.dataset.contentReady === 'true';
  }, { timeout: 45000 });
  const readinessFirstState = await readinessFirstPage.locator('#root .appLoading').evaluate((node) => ({
    contentReady: node.dataset.contentReady,
    revealComplete: node.dataset.revealComplete,
    modalVisible: Boolean(document.querySelector('#copyrightModal')),
  }));
  assert.deepEqual(readinessFirstState, { contentReady: 'true', revealComplete: 'false', modalVisible: false },
    'When content is ready first, the app must remain covered until the reveal completes');
  await readinessFirstPage.locator('#copyrightModal').waitFor({ state: 'visible', timeout: 45000 });
  const readinessFirstEvidence = await readinessFirstPage.evaluate(() => window.__path28GateProbe);
  assert.ok(readinessFirstEvidence.completedAt <= readinessFirstEvidence.appVisibleAt,
    'The app must become visible only after the deliberately extended reveal finishes');
  await readinessFirstContext.close();

  // The owner explicitly requires the same splash animation in both device
  // motion settings. Reduced-motion must not skip either animation or the gate.
  const reducedMotionContext = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const reducedMotionPage = await reducedMotionContext.newPage();
  await reducedMotionPage.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await reducedMotionPage.locator('#root .appLoading').waitFor({ state: 'visible', timeout: 20000 });
  const reducedMotionAnimations = await reducedMotionPage.locator('#root .appLoading').evaluate((splash) => {
    const logo = splash.querySelector('.loadingBrand img');
    const progress = splash.querySelector('.loadingProgressFill');
    const logoAnimation = logo.getAnimations().find((item) => item.animationName === 'loadingLogoBloom');
    const progressAnimation = progress.getAnimations().find((item) => item.animationName === 'loadingProgressFill');
    return {
      logoState: logoAnimation?.playState || 'missing',
      progressState: progressAnimation?.playState || 'missing',
      logoDuration: Number(logoAnimation?.effect?.getTiming().duration ?? -1),
      progressDuration: Number(progressAnimation?.effect?.getTiming().duration ?? -1),
    };
  });
  assert.deepEqual(reducedMotionAnimations, {
    logoState: 'running',
    progressState: 'running',
    logoDuration: 950,
    progressDuration: 950,
  }, 'Reduced-motion preference must not disable or shorten the splash reveal or its synchronized progress');
  await reducedMotionPage.waitForTimeout(250);
  const reducedMotionProgress = await reducedMotionPage.locator('#root .appLoading .loadingProgressFill').evaluate((node) => {
    const transform = getComputedStyle(node).transform;
    return transform === 'none' ? 1 : Number(new DOMMatrixReadOnly(transform).m11);
  });
  assert.ok(reducedMotionProgress > 0 && reducedMotionProgress < 1,
    'The progress bar must visibly fill over time, not jump instantly to 100%; observed ' + reducedMotionProgress);
  await reducedMotionPage.locator('#copyrightModal').waitFor({ state: 'visible', timeout: 45000 });
  assert.equal(await reducedMotionPage.locator('#root .appLoading').count(), 0,
    'The first app screen must appear after the logo and progress animations complete, even with reduced-motion enabled');
  await reducedMotionContext.close();
}

try {
  await verifySplashReadinessOrders();
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
