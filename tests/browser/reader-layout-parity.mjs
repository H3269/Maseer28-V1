import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173/Maseer28/';
const assetNames = await readdir('dist/assets');
const engineFile = assetNames.find((name) => name.startsWith('readerEngine-') && name.endsWith('.js'));
assert.ok(engineFile, 'the production reader-engine chunk must exist');
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  const comparisons = await page.evaluate(async ({ baseURL: appBase, engineFile: optimizedFile }) => {
    const optimized = await import(new URL(`assets/${optimizedFile}`, appBase).href);
    const baseline = await import(new URL('test-fixtures/readerEngine-baseline.js', appBase).href);
    const digest = async (value) => {
      const bytes = new TextEncoder().encode(JSON.stringify(value));
      const hash = await crypto.subtle.digest('SHA-256', bytes);
      return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    };
    const percentile = (values, p) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
    };
    const results = [];
    for (const viewport of [{ width: 340, fontPx: 18 }, { width: 850, fontPx: 20 }]) {
      for (let bookId = 1; bookId <= 5; bookId += 1) {
        const response = await fetch(new URL(`content/books/book${bookId}.json`, appBase));
        if (!response.ok) throw new Error(`book ${bookId} could not be loaded for parity check (${response.status})`);
        const book = await response.json();
        const input = { book, bookId, cover: '', width: viewport.width, fontPx: viewport.fontPx, fontFamily: 'Tahoma, Arial, sans-serif' };
        // One unmeasured warm-up per implementation reduces first-call/JIT noise.
        baseline.buildLegacyReaderLayout(input);
        optimized.buildLegacyReaderLayout(input);
        const baselineSamples = [];
        const optimizedSamples = [];
        let oldLayout;
        let newLayout;
        // Alternate execution order so one implementation is not consistently
        // measured first while the browser is warming its caches and JIT.
        for (let round = 0; round < 5; round += 1) {
          if (round % 2 === 0) {
            let started = performance.now();
            oldLayout = baseline.buildLegacyReaderLayout(input);
            baselineSamples.push(performance.now() - started);
            started = performance.now();
            newLayout = optimized.buildLegacyReaderLayout(input);
            optimizedSamples.push(performance.now() - started);
          } else {
            let started = performance.now();
            newLayout = optimized.buildLegacyReaderLayout(input);
            optimizedSamples.push(performance.now() - started);
            started = performance.now();
            oldLayout = baseline.buildLegacyReaderLayout(input);
            baselineSamples.push(performance.now() - started);
          }
        }
        const oldSignature = await digest(oldLayout);
        const newSignature = await digest(newLayout);
        results.push({
          bookId,
          width: viewport.width,
          oldPageCount: oldLayout.pageCount,
          newPageCount: newLayout.pageCount,
          baselineMs: { samples: baselineSamples.length, p50: Number(percentile(baselineSamples, 50).toFixed(2)), p95: Number(percentile(baselineSamples, 95).toFixed(2)), min: Number(Math.min(...baselineSamples).toFixed(2)), max: Number(Math.max(...baselineSamples).toFixed(2)) },
          optimizedMs: { samples: optimizedSamples.length, p50: Number(percentile(optimizedSamples, 50).toFixed(2)), p95: Number(percentile(optimizedSamples, 95).toFixed(2)), min: Number(Math.min(...optimizedSamples).toFixed(2)), max: Number(Math.max(...optimizedSamples).toFixed(2)) },
          oldSignature,
          newSignature,
        });
      }
    }
    return results;
  }, { baseURL, engineFile });

  for (const result of comparisons) {
    assert.equal(result.newPageCount, result.oldPageCount, `book ${result.bookId}, width ${result.width}: page count changed`);
    assert.equal(result.newSignature, result.oldSignature, `book ${result.bookId}, width ${result.width}: rendered page structure or text changed`);
  }
  console.log(`PASS: exact reader-layout parity for all five canonical books at mobile and desktop widths (${comparisons.length} comparisons).`);
  console.log('Reader layout timing diagnostics (5 measured runs per implementation after warm-up; headless Chromium only):');
  console.table(comparisons.map(({ bookId, width, oldPageCount, baselineMs, optimizedMs }) => ({
    bookId,
    width,
    pageCount: oldPageCount,
    baselineP50Ms: baselineMs.p50,
    optimizedP50Ms: optimizedMs.p50,
    baselineP95Ms: baselineMs.p95,
    optimizedP95Ms: optimizedMs.p95,
  })));
  console.log(JSON.stringify(comparisons, null, 2));
} finally {
  await browser.close();
}
