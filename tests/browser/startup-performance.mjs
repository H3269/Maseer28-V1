import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173/Maseer28/';
const outputPath = 'reports/generated/startup-performance.json';
const browser = await chromium.launch({ headless: true });

async function measure(viewport, run) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/favicon|third.party/i.test(message.text())) errors.push(message.text());
  });

  const startedAt = Date.now();
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  // The app exposes its first interactive surface only after its required
  // content and splash-logo readiness gates have completed.
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
    const logo = [...document.images].find((image) => /Logo%20m24|Logo m24/i.test(image.currentSrc || image.src));
    return {
      domContentLoadedMs: Math.round(navigation?.domContentLoadedEventEnd || 0),
      loadEventMs: Math.round(navigation?.loadEventEnd || 0),
      responseStartMs: Math.round(navigation?.responseStart || 0),
      firstPaintMs: Math.round(performance.getEntriesByName('first-paint')[0]?.startTime || 0),
      firstContentfulPaintMs: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0),
      logoDecoded: Boolean(logo?.complete && logo?.naturalWidth > 0),
      logoNaturalWidth: logo?.naturalWidth || 0,
      resourceCount: resources.length,
      totalTransferBytes: resources.reduce((sum, item) => sum + item.transferBytes, 0),
      totalDecodedBytes: resources.reduce((sum, item) => sum + item.decodedBytes, 0),
      largestResources: [...resources].sort((a, b) => b.transferBytes - a.transferBytes).slice(0, 12),
    };
  });
  const result = {
    viewport,
    run,
    appReadyMs: Date.now() - startedAt,
    ...metrics,
    consoleErrors: errors,
  };
  await context.close();
  return result;
}

try {
  const results = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 1365, height: 900 }]) {
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
    appReadyMs: results.map(({ viewport, run, appReadyMs }) => ({ viewport: viewport.width + 'x' + viewport.height, run, appReadyMs })),
    maxTransferBytes: Math.max(...results.map((item) => item.totalTransferBytes)),
    consoleErrorRuns: results.filter((item) => item.consoleErrors.length).length,
  }, null, 2));
} finally {
  await browser.close();
}
