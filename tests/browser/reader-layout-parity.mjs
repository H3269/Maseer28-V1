import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173/Maseer28/';
const assetNames = await readdir('dist/assets');
const engineFile = assetNames.find((name) => /^readerEngine-[^/]+\.js$/.test(name));
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
    const results = [];
    for (const viewport of [{ width: 340, fontPx: 18 }, { width: 850, fontPx: 20 }]) {
      for (let bookId = 1; bookId <= 5; bookId += 1) {
        const response = await fetch(new URL(`content/books/book${bookId}.json`, appBase));
        if (!response.ok) throw new Error(`book ${bookId} could not be loaded for parity check (${response.status})`);
        const book = await response.json();
        const input = { book, bookId, cover: '', width: viewport.width, fontPx: viewport.fontPx, fontFamily: 'Tahoma, Arial, sans-serif' };
        const oldStarted = performance.now();
        const oldLayout = baseline.buildLegacyReaderLayout(input);
        const baselineDurationMs = performance.now() - oldStarted;
        const newStarted = performance.now();
        const newLayout = optimized.buildLegacyReaderLayout(input);
        const optimizedDurationMs = performance.now() - newStarted;
        const oldSignature = await digest(oldLayout);
        const newSignature = await digest(newLayout);
        results.push({ bookId, width: viewport.width, oldPageCount: oldLayout.pageCount, newPageCount: newLayout.pageCount, baselineDurationMs: Number(baselineDurationMs.toFixed(2)), optimizedDurationMs: Number(optimizedDurationMs.toFixed(2)), oldSignature, newSignature });
      }
    }
    return results;
  }, { baseURL, engineFile });

  for (const result of comparisons) {
    assert.equal(result.newPageCount, result.oldPageCount, `book ${result.bookId}, width ${result.width}: page count changed`);
    assert.equal(result.newSignature, result.oldSignature, `book ${result.bookId}, width ${result.width}: rendered page structure or text changed`);
  }
  console.log(`PASS: exact reader-layout parity for all five canonical books at mobile and desktop widths (${comparisons.length} comparisons).`);
  console.log('Reader layout timing diagnostics (ms; single-run CI measurements, not real-device guarantees):');
  console.table(comparisons.map(({ bookId, width, baselineDurationMs, optimizedDurationMs, oldPageCount }) => ({ bookId, width, pageCount: oldPageCount, baselineDurationMs, optimizedDurationMs })));
} finally {
  await browser.close();
}
