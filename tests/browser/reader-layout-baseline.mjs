import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readdir, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173/Maseer28/';
const outputPath = 'reports/generated/reader-layout-baseline.json';
const assetNames = await readdir('dist/assets');
const engineFile = assetNames.find((name) => /^readerEngine-[^/]+\.js$/.test(name));
assert.ok(engineFile, 'the production reader-engine chunk must exist');
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(120000);
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });

  const report = await page.evaluate(async ({ baseURL: appBase, engineFile: optimizedFile }) => {
    const { buildLegacyReaderLayout } = await import(new URL(`assets/${optimizedFile}`, appBase).href);
    const profiles = [
      { name: 'android-360', width: 340, fontPx: 18 },
      { name: 'desktop-850', width: 850, fontPx: 20 },
    ];
    const results = [];

    for (const profile of profiles) {
      for (let bookId = 1; bookId <= 5; bookId += 1) {
        const fetchStart = performance.now();
        const response = await fetch(new URL(`content/books/book${bookId}.json`, appBase), { cache: 'no-store' });
        if (!response.ok) throw new Error(`Book ${bookId} fetch failed: ${response.status}`);
        const rawText = await response.text();
        const fetchMs = performance.now() - fetchStart;
        const parseStart = performance.now();
        const book = JSON.parse(rawText);
        const parseMs = performance.now() - parseStart;
        const layoutRuns = [];

        for (let run = 1; run <= 5; run += 1) {
          const started = performance.now();
          const layout = buildLegacyReaderLayout({
            book,
            bookId,
            cover: '',
            width: profile.width,
            fontPx: profile.fontPx,
            fontFamily: 'Tahoma, Arial, sans-serif',
          });
          const durationMs = performance.now() - started;
          assert.ok(layout?.pages?.length > 0, `Book ${bookId} produced no layout pages.`);
          assert.ok(layout.pages.some((item) => (item.lines || []).some((line) => String(line.text || '').trim())), `Book ${bookId} has no readable text in the layout.`);
          layoutRuns.push({ run, durationMs: Number(durationMs.toFixed(2)), pageCount: layout.pageCount });
        }

        const warm = layoutRuns.slice(1).map((item) => item.durationMs).sort((a, b) => a - b);
        const sorted = layoutRuns.map((item) => item.durationMs).sort((a, b) => a - b);
        results.push({
          bookId,
          profile: profile.name,
          width: profile.width,
          contentBytes: new TextEncoder().encode(rawText).length,
          fetchNoStoreMs: Number(fetchMs.toFixed(2)),
          jsonParseMs: Number(parseMs.toFixed(2)),
          layoutRuns,
          firstLayoutMs: layoutRuns[0].durationMs,
          warmMedianLayoutMs: Number(warm[Math.floor(warm.length / 2)].toFixed(2)),
          layoutP95Ms: Number(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)].toFixed(2)),
        });
      }
    }
    return {
      generatedAt: new Date().toISOString(),
      baseURL: appBase,
      note: 'Measures browser-side book JSON fetch/parse and synchronous full-layout generation. This is a diagnostic baseline, not end-to-end time-to-first-text for the three user entry routes; real-device route timing remains required.',
      results,
    };
  }, { baseURL, engineFile });

  await mkdir('reports/generated', { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({
    outputPath,
    comparisons: report.results.length,
    results: report.results.map(({ bookId, profile, contentBytes, fetchNoStoreMs, jsonParseMs, firstLayoutMs, warmMedianLayoutMs, layoutP95Ms, layoutRuns }) => ({
      bookId, profile, contentBytes, fetchNoStoreMs, jsonParseMs, firstLayoutMs, warmMedianLayoutMs, layoutP95Ms,
      pageCount: layoutRuns[0].pageCount,
    })),
  }, null, 2));
} finally {
  await browser.close();
}
