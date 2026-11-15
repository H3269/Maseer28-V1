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

  const startedAt = Date.now();
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });

  // Capture the splash logo while the loading screen is still mounted. The
  // logo is intentionally removed after the app passes its startup gate.
  const logoReadiness = await page.evaluate(async () => {
    const selector = '#root img[alt="لوگوی برنامه مسیر"]';
    const image = document.querySelector(selector);
    if (!image) return { logoDecoded: false, logoNaturalWidth: 0, logoVisible: false };
    try {
      await image.decode();
    } catch {
      // A failed decode is reflected in the explicit readiness fields below.
    }
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
  await page.locator('#copyrightModal').waitFor({ state: 'visible', timeout: 45000 });
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
