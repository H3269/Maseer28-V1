import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });

  const downloadPromise = page.waitForEvent('download');
  const generated = await page.evaluate(async () => {
    const { exportArchivesZip, triggerBlobDownload } = await import('/src/features/journey/archiveExport.js');
    const answer = 'متن آزمایشی برای بررسی خروجی PDF در مرورگر واقعی. '.repeat(90);
    const blob = await exportArchivesZip([{
      pathId: 'browser-export-check',
      profileData: { problem: 'آزمون مرورگر' },
      completed: [1, 2],
      answers: { 1: answer, 2: 'پاسخ دوم' },
      daily: { 1: { score: 4, feedbackText: 'بهتر شدم' } },
      assessmentData: { score: 6 },
      final: { score: 3 },
      startedAt: '2026-01-01T00:00:00.000Z',
      archivedAt: '2026-01-28T00:00:00.000Z',
    }]);
    triggerBlobDownload(blob, 'maseer28-archive-browser-test.zip');
    return { size: blob.size, type: blob.type };
  });
  const download = await downloadPromise;
  assert.equal(generated.type, 'application/zip');
  assert.ok(generated.size > 1000, 'real Canvas output should produce a non-empty ZIP');
  assert.equal(download.suggestedFilename(), 'maseer28-archive-browser-test.zip');
  const filePath = await download.path();
  assert.ok(filePath, 'Chromium should expose the downloaded file');
  const bytes = new Uint8Array(await readFile(filePath));
  const u16 = (offset) => bytes[offset] | (bytes[offset + 1] << 8);
  const u32 = (offset) => (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
  const eocd = bytes.length - 22;
  assert.equal(u32(eocd), 0x06054b50, 'ZIP end record');
  assert.equal(u16(eocd + 10), 1, 'one PDF entry');
  const centralOffset = u32(eocd + 16);
  assert.equal(u32(centralOffset), 0x02014b50, 'central directory');
  const nameLength = u16(centralOffset + 28);
  const name = new TextDecoder().decode(bytes.slice(centralOffset + 46, centralOffset + 46 + nameLength));
  assert.equal(name, '01-آزمون-مرورگر.pdf');
  const localOffset = u32(centralOffset + 42);
  assert.equal(u32(localOffset), 0x04034b50, 'local file header');
  const localNameLength = u16(localOffset + 26);
  const localExtraLength = u16(localOffset + 28);
  const size = u32(centralOffset + 24);
  const dataStart = localOffset + 30 + localNameLength + localExtraLength;
  const pdf = new TextDecoder().decode(bytes.slice(dataStart, dataStart + size));
  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(pdf, /\/Count [2-9][0-9]*/);
  assert.match(pdf, /startxref\n\d+\n%%EOF$/);
  assert.deepEqual(errors, [], 'archive export should not raise uncaught browser errors');
  process.stdout.write('PASS: Chromium generated a real Canvas PDF, packaged it in ZIP, and downloaded the file (WV-BROWSER-EXPORT)\\n');
} finally {
  await browser.close();
}
