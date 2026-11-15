import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173/Maseer28/';
const browser = await chromium.launch({ headless: true });

const makeState = () => {
  const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  return {
    schema: 7, started: true, profile: true, assessment: true,
    completed: [], answers: {}, daily: {},
    profileData: { problem: 'خشم', durationYears: 1, durationMonths: 0, goal: 'هدف آزمایشی', code: 'M28-READER-PERF' },
    assessmentData: { answers: [2, 2, 2, 2, 2], total: 8, score: 4, motivation: 2, scaleMax: 4, version: 2 },
    final: null, archive: [], pathId: 'reader-performance-direct', startedAt: old, lastView: 'dashboard',
  };
};

async function waitForReadablePage(page) {
  await page.waitForFunction(() => {
    const article = document.querySelector('#bookReaderText');
    if (!article || article.getClientRects().length === 0) return false;
    const loadedImage = [...article.querySelectorAll('img')].some((image) => image.complete && image.naturalWidth > 0);
    const text = String(article.innerText || '').replace(/\s+/g, ' ').trim();
    const readableText = text.length > 0 && !text.includes('در حال بارگذاری کتاب');
    return loadedImage || readableText;
  }, null, { timeout: 120000 });
  return page.evaluate(() => ({
    elapsedMs: Number((performance.now() - window.__readerPerfStartedAt).toFixed(2)),
    contentType: document.querySelector('#bookReaderText img') ? 'image-or-cover' : 'text',
    pageTextLength: String(document.querySelector('#bookReaderText')?.innerText || '').trim().length,
    pageCounter: document.querySelector('#readerPageCounter')?.innerText || '',
    pageRangeMax: Number(document.querySelector('#readerPageRange')?.max || 0),
  }));
}

async function waitForFirstBodyParagraph(page) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const paragraph = await page.evaluate(() => {
      const article = document.querySelector('#bookReaderText');
      const line = [...(article?.querySelectorAll('.readerFixedLine.body.paraStart') || [])]
        .find((item) => String(item.innerText || '').replace(/\\s+/g, ' ').trim().length >= 20);
      return line ? String(line.innerText || '').replace(/\\s+/g, ' ').trim() : '';
    });
    if (paragraph) {
      return page.evaluate((text) => ({
        elapsedMs: Number((performance.now() - window.__readerPerfStartedAt).toFixed(2)),
        paragraphLength: text.length,
        pageCounter: document.querySelector('#readerPageCounter')?.innerText || '',
      }), paragraph);
    }
    const counter = await page.locator('#readerPageCounter').innerText();
    const next = page.locator('.readerNextArrow');
    if (await next.isDisabled()) break;
    await next.click();
    await page.waitForFunction((previous) => (
      String(document.querySelector('#readerPageCounter')?.innerText || '') !== previous
    ), counter, { timeout: 15000 });
  }
  throw new Error('Reader opened, but the first readable body paragraph was not found within 12 pages.');
}

try {
  const results = [];
  const entryPoints = [
    { id: 'dashboard-library-button', open: async (page) => page.locator('#dashboard .quickAction').filter({ hasText: 'کتابخانه' }).click() },
    { id: 'bottom-navigation-study-button', open: async (page) => page.locator('#bottomNav button[data-view="books"]').click() },
  ];

  for (const entryPoint of entryPoints) {
    for (let bookId = 1; bookId <= 5; bookId += 1) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await page.addInitScript((state) => {
        localStorage.setItem('maseer28_onboarding_complete_v1', '1');
        localStorage.setItem('maseer28_state', JSON.stringify(state));
        localStorage.setItem('maseer28_user_profile_v2', JSON.stringify({
          version: 2, name: 'کاربر آزمایشی', age: 35, gender: 'زن', phone: '09123456789',
          medical: 'none', medicalNote: '', medication: 'no', medicationRisk: 'no',
        }));
      }, makeState());
      await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
      await page.locator('#copyrightModal').waitFor({ state: 'visible' });
      await page.locator('#copyrightModal').getByRole('button', { name: /متوجه شدم و ورود به مسیر را ادامه می‌دهم/ }).click();
      await page.locator('#dashboard').waitFor({ state: 'visible' });

      await entryPoint.open(page);
      await page.locator('#books').waitFor({ state: 'visible' });
      const book = page.locator('#books .libraryBook').nth(bookId - 1);
      await book.waitFor({ state: 'visible' });

      await page.evaluate(() => { window.__readerPerfStartedAt = performance.now(); });
      await book.locator('button').click();
      const cold = await waitForReadablePage(page);
      const coldFirstBodyParagraph = await waitForFirstBodyParagraph(page);

      await page.locator('#bookReader').getByRole('button', { name: 'خروج از مطالعه' }).click();
      await page.locator('#books').waitFor({ state: 'visible' });
      const reopenedBook = page.locator('#books .libraryBook').nth(bookId - 1);
      await page.evaluate(() => { window.__readerPerfStartedAt = performance.now(); });
      await reopenedBook.locator('button').click();
      const warm = await waitForReadablePage(page);
      const warmFirstBodyParagraph = await waitForFirstBodyParagraph(page);

      assert.equal(await page.locator('#bookReaderText').count(), 1, `${entryPoint.id}, book ${bookId}: reader text article must exist`);
      assert.ok(coldFirstBodyParagraph.paragraphLength >= 20, `${entryPoint.id}, book ${bookId}: cold open must reach a real body paragraph`);
      assert.ok(warmFirstBodyParagraph.paragraphLength >= 20, `${entryPoint.id}, book ${bookId}: warm open must reach a real body paragraph`);
      assert.deepEqual(errors, [], `${entryPoint.id}, book ${bookId}: no browser errors during cold/warm open`);
      results.push({ entryPoint: entryPoint.id, bookId, cold, coldFirstBodyParagraph, warm, warmFirstBodyParagraph });
      await page.close();
    }
  }

  console.log('PASS: dashboard-library and bottom-navigation study entry points each completed cold/warm reader opens for all five canonical books.');
  console.log('Both entry points are clicked independently. Timing includes click-to-first-readable-content and click-to-first-real-body-paragraph; measurements are headless Chromium, not physical Android results.');
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
