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
  await page.addInitScript(() => {
    localStorage.setItem('maseer28_onboarding_complete_v1', '1');
    // Keep the first-run copyright gate deterministic in each isolated browser context.
    localStorage.removeItem('maseer28_copyright_v60');
    window.__archiveDrawnText = [];
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (value, ...args) {
      window.__archiveDrawnText.push(String(value));
      return originalFillText.call(this, value, ...args);
    };
    const answer = 'متن آزمایشی برای بررسی خروجی PDF در مرورگر واقعی. '.repeat(90);
    localStorage.setItem('maseer28_state', JSON.stringify({
      schema: 7, started: true, profile: true, assessment: true,
      completed: [1, 2], answers: { 1: answer, 2: 'پاسخ دوم' },
      daily: { 1: { score: 4, feedback: 'better', feedbackText: 'بهتر شدم' } },
      profileData: { problem: 'خشم', durationYears: 1, durationMonths: 0, goal: 'هدف آزمایشی', code: 'M28-EXPORT' },
      assessmentData: { score: 6 }, final: null,
      archive: [{
        pathId: 'browser-export-check',
        profileData: { problem: 'آزمون مرورگر', durationYears: 1, durationMonths: 0, goal: 'هدف آزمایشی' },
        completed: [1, 2, 17, 27], answers: { 1: answer, 2: 'پاسخ دوم' },
        daily: {
          1: { score: 4, feedbackText: 'بهتر شدم' },
          17: {
            status: 'skipped_safety_gate',
            feedbackText: 'این تمرین به دلیل ملاحظه ایمنی اجرا نشد؛ هیچ امتیازی ثبت نشده است.',
            exerciseId: 'T01-D17',
            updatedAt: '2026-01-17T12:00:00.000Z',
          },
          27: {
            status: 'skipped_human_review',
            feedbackText: 'این تمرین به دلیل نیاز به بازبینی انسانی اجرا نشد؛ هیچ امتیازی ثبت نشده است.',
            exerciseId: 'T01-D27',
            updatedAt: '2026-01-27T12:00:00.000Z',
          },
        },
        assessmentData: { score: 6 }, final: { score: 3 },
        startedAt: '2026-01-01T00:00:00.000Z', archivedAt: '2026-01-28T00:00:00.000Z',
      }],
      pathId: 'active-browser-export-check', startedAt: '2026-01-01T00:00:00.000Z', lastView: 'dashboard',
    }));
    localStorage.setItem('maseer28_user_profile_v2', JSON.stringify({
      version: 2, name: 'کاربر آزمایشی', age: 35, gender: 'زن', phone: '09123456789',
      medical: 'none', medicalNote: '', medication: 'no', medicationRisk: 'no',
    }));
  });
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0);
  await page.waitForFunction(() => {
    const copyright = document.querySelector('#copyrightModal');
    const startupError = document.querySelector('.validationModal');
    return Boolean(copyright || startupError);
  }, null, { timeout: 30000 });
  const startupErrorText = await page.locator('.validationModal').innerText().catch(() => '');
  assert.equal(
    await page.locator('#copyrightModal').isVisible().catch(() => false),
    true,
    `App did not reach the copyright acceptance gate. Startup screen: ${startupErrorText || 'no visible startup error'}; browser errors: ${errors.join(' | ')}`
  );
  await page.locator('#copyrightModal').getByRole('button', { name: /متوجه شدم و ورود به مسیر را ادامه می‌دهم/ }).click();
  await page.locator('#dashboard').waitFor({ state: 'visible' });
  await page.locator('#dashboard .quickAction').filter({ hasText: 'آرشیو' }).click();
  await page.locator('#archiveList').waitFor({ state: 'visible' });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'دریافت خروجی ZIP و PDF آرشیوها' }).click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^maseer۲۸-archives-[۰-۹]{4}-[۰-۹]{2}-[۰-۹]{2}\.zip$/);
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
  assert.equal(name, '۰۱-آزمون-مرورگر.pdf');
  const drawnText = await page.evaluate(() => window.__archiveDrawnText.join(' '));
  assert.doesNotMatch(drawnText, /[0-9]/, 'all text drawn into the archive PDF must use Persian digits');
  assert.match(drawnText, /۲۸/);
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
  // Empty archive state: use a fresh browser context so the assertion cannot
  // inherit React state or storage mutations from the preceding download scenario.
  const emptyPage = await browser.newPage();
  const emptyErrors = [];
  emptyPage.on('pageerror', (error) => emptyErrors.push(String(error)));
  await emptyPage.addInitScript(() => {
    localStorage.setItem('maseer28_onboarding_complete_v1', '1');
    // Keep the first-run copyright gate deterministic in each isolated browser context.
    localStorage.removeItem('maseer28_copyright_v60');
    localStorage.setItem('maseer28_user_profile_v2', JSON.stringify({
      version: 2, name: 'کاربر آزمایشی', age: 35, gender: 'زن', phone: '09123456789',
      medical: 'none', medicalNote: '', medication: 'no', medicationRisk: 'no',
    }));
    const answer = 'متن آزمایشی برای بررسی خروجی PDF در مرورگر واقعی. '.repeat(90);
    localStorage.setItem('maseer28_state', JSON.stringify({
      schema: 7, started: true, profile: true, assessment: true,
      completed: [1, 2], answers: { 1: answer, 2: 'پاسخ دوم' },
      daily: { 1: { score: 4, feedback: 'better', feedbackText: 'بهتر شدم' } },
      profileData: {
        problem: 'خشم', durationYears: 1, durationMonths: 0,
        goal: 'هدف آزمایشی', code: 'M28-EXPORT',
      },
      assessmentData: { score: 6 }, final: null, archive: [],
      pathId: 'active-empty-archive-check', startedAt: '2026-01-01T00:00:00.000Z', lastView: 'dashboard',
    }));
  });
  await emptyPage.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await emptyPage.locator('#copyrightModal').waitFor({ state: 'visible' });
  await emptyPage.locator('#copyrightModal').getByRole('button', { name: /متوجه شدم و ورود به مسیر را ادامه می‌دهم/ }).click();
  await emptyPage.locator('#dashboard').waitFor({ state: 'visible' });
  await emptyPage.locator('#dashboard .quickAction').filter({ hasText: 'آرشیو' }).click();
  await emptyPage.locator('#archiveList').waitFor({ state: 'visible' });
  const emptyExportButton = emptyPage.getByRole('button', { name: 'دریافت خروجی ZIP و PDF آرشیوها' });
  assert.equal(await emptyExportButton.isVisible(), true, 'export control remains visible for an empty archive');
  assert.equal(await emptyExportButton.isDisabled(), true, 'empty archive cannot produce an empty ZIP');
  assert.match(await emptyPage.locator('#archiveList').innerText(), /هنوز هیچ مسیر بایگانی‌شده‌ای وجود ندارد/);
  assert.deepEqual(emptyErrors, [], 'empty archive UI should not raise uncaught browser errors');
  await emptyPage.close();
  assert.deepEqual(errors, [], 'archive export UI should not raise uncaught browser errors');
  process.stdout.write('PASS: Chromium generated and downloaded a real archive ZIP/PDF, and verified the visible disabled empty-archive state (WV-BROWSER-EXPORT)\\n');
} finally {
  await browser.close();
}
