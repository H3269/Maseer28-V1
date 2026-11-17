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
  console.log('PHASE: waiting for first visible reader content');
  await page.waitForFunction(() => {
    const article = document.querySelector('#bookReaderText');
    if (!article || article.getClientRects().length === 0) return false;
    const loadedImage = [...article.querySelectorAll('img')].some((image) => image.complete && image.naturalWidth > 0);
    const text = String(article.innerText || '').replace(/\s+/g, ' ').trim();
    const readableText = text.length > 0 && !text.includes('در حال بارگذاری کتاب');
    return loadedImage || readableText;
  }, null, { timeout: 45000 });
  return page.evaluate(() => ({
    elapsedMs: Number((performance.now() - window.__readerPerfStartedAt).toFixed(2)),
    contentType: document.querySelector('#bookReaderText img') ? 'image-or-cover' : 'text',
    pageTextLength: String(document.querySelector('#bookReaderText')?.innerText || '').trim().length,
    pageCounter: document.querySelector('#readerPageCounter')?.innerText || '',
    pageRangeMax: Number(document.querySelector('#readerPageRange')?.max || 0),
  }));
}

async function waitForFirstBodyParagraph(page) {
  let lastObserved = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await page.waitForFunction(() => {
        const article = document.querySelector('#bookReaderText');
        return [...(article?.querySelectorAll('.readerFixedLine.body.paraStart') || [])]
          .some((item) => String(item.innerText || '').replace(/\\s+/g, ' ').trim().length >= 20);
      }, null, { timeout: 2000 });
      return page.evaluate(() => {
        const article = document.querySelector('#bookReaderText');
        const line = [...(article?.querySelectorAll('.readerFixedLine.body.paraStart') || [])]
          .find((item) => String(item.innerText || '').replace(/\\s+/g, ' ').trim().length >= 20);
        return {
          elapsedMs: Number((performance.now() - window.__readerPerfStartedAt).toFixed(2)),
          paragraphLength: String(line?.innerText || '').replace(/\\s+/g, ' ').trim().length,
          pageCounter: document.querySelector('#readerPageCounter')?.innerText || '',
        };
      });
    } catch {
      lastObserved = await page.evaluate(() => {
        const article = document.querySelector('#bookReaderText');
        return {
          pageCounter: document.querySelector('#readerPageCounter')?.innerText || '',
          articleText: String(article?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 180),
          lineSamples: [...(article?.querySelectorAll('.readerFixedLine') || [])].slice(0, 8).map((item) => ({ className: item.className, text: String(item.innerText || '').trim().slice(0, 70) })),
          readerDiagnosticEvents: (window.__M28_READER_DIAGNOSTICS__?.events || []).map((event) => ({ stage: event.stage, elapsedMs: event.elapsedMs, details: event.details })),
        };
      });
    }

    const next = page.locator('.readerNextArrow');
    if (await next.isDisabled()) {
      throw new Error(`Reader did not render a readable body paragraph; lastObserved=${JSON.stringify(lastObserved)}`);
    }
    const counter = await page.locator('#readerPageCounter').innerText();
    await next.click();
    await page.waitForFunction((previous) => (
      String(document.querySelector('#readerPageCounter')?.innerText || '') !== previous
    ), counter, { timeout: 15000 });
  }
  throw new Error(`Reader opened, but the first readable body paragraph was not found within 12 pages; lastObserved=${JSON.stringify(lastObserved)}`);
}

try {
  const results = [];
  const entryPoints = [
    { id: 'dashboard-library-button', open: async (page) => page.locator('#dashboard .quickAction').filter({ hasText: 'کتابخانه' }).click() },
    { id: 'bottom-navigation-study-button', open: async (page) => page.locator('#bottomNav button[data-view="books"]').click() },
  ];

  // Three independent browser contexts per entry point/book provide repeated cold samples;
  // each context is reopened once to capture its paired warm sample.
  for (let repetition = 1; repetition <= 3; repetition += 1) {
    for (const entryPoint of entryPoints) {
    for (let bookId = 1; bookId <= 5; bookId += 1) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
      const errors = [];
      const requestedBookContent = [];
      const expectedBookPath = `/content/books/book${bookId}.json`;
      page.on('request', (request) => {
        try {
          const pathname = new URL(request.url()).pathname;
          if (/\/content\/books\/book\d+\.json$/.test(pathname)) requestedBookContent.push(pathname);
        } catch { /* ignore non-URL requests */ }
      });
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
      await page.goto(`${baseURL}${baseURL.includes('?') ? '&' : '?'}readerDiagnostics=1`, { waitUntil: 'domcontentloaded' });
      await page.locator('#copyrightModal').waitFor({ state: 'visible' });
      await page.locator('#copyrightModal').getByRole('button', { name: /متوجه شدم و ورود به مسیر را ادامه می‌دهم/ }).click();
      await page.locator('#dashboard').waitFor({ state: 'visible' });

      await entryPoint.open(page);
      await page.locator('#books').waitFor({ state: 'visible' });
      const book = page.locator('#books .libraryBook').nth(bookId - 1);
      await book.waitFor({ state: 'visible' });

      console.log(`START reader scenario: repetition=${repetition}, entryPoint=${entryPoint.id}, book=${bookId}, phase=cold`);
      await page.evaluate(() => { window.__readerPerfStartedAt = performance.now(); });
      await book.locator('button').click();
      let cold;
      try {
        await page.locator('#bookReader').waitFor({ state: 'visible', timeout: 30000 });
        cold = await waitForReadablePage(page);
      } catch (error) {
        const diagnostics = await page.evaluate(() => ({
          url: location.href,
          readerVisible: Boolean(document.querySelector('#bookReader')?.getClientRects().length),
          readerTextExists: Boolean(document.querySelector('#bookReaderText')),
          readerText: String(document.querySelector('#bookReaderText')?.innerText || '').slice(0, 300),
          pageCounter: document.querySelector('#readerPageCounter')?.innerText || '',
          readerDiagnosticEvents: (window.__M28_READER_DIAGNOSTICS__?.events || []).map((event) => ({ stage: event.stage, elapsedMs: event.elapsedMs, details: event.details })),
        })).catch(() => ({}));
        throw new Error(`Cold reader open failed (${entryPoint.id}, book ${bookId}, repetition ${repetition}): ${error.message}; diagnostics=${JSON.stringify(diagnostics)}; browserErrors=${JSON.stringify(errors)}`);
      }
      const coldFirstBodyParagraph = await waitForFirstBodyParagraph(page);

      await page.locator('#bookReader').getByRole('button', { name: 'خروج از مطالعه' }).click();
      await page.locator('#books').waitFor({ state: 'visible' });
      const reopenedBook = page.locator('#books .libraryBook').nth(bookId - 1);
      console.log(`START reader scenario: repetition=${repetition}, entryPoint=${entryPoint.id}, book=${bookId}, phase=warm`);
      await page.evaluate(() => { window.__readerPerfStartedAt = performance.now(); });
      await reopenedBook.locator('button').click();
      let warm;
      try {
        await page.locator('#bookReader').waitFor({ state: 'visible', timeout: 30000 });
        warm = await waitForReadablePage(page);
      } catch (error) {
        const diagnostics = await page.evaluate(() => ({
          url: location.href,
          readerVisible: Boolean(document.querySelector('#bookReader')?.getClientRects().length),
          readerTextExists: Boolean(document.querySelector('#bookReaderText')),
          readerText: String(document.querySelector('#bookReaderText')?.innerText || '').slice(0, 300),
          pageCounter: document.querySelector('#readerPageCounter')?.innerText || '',
          readerDiagnosticEvents: (window.__M28_READER_DIAGNOSTICS__?.events || []).map((event) => ({ stage: event.stage, elapsedMs: event.elapsedMs, details: event.details })),
        })).catch(() => ({}));
        throw new Error(`Warm reader open failed (${entryPoint.id}, book ${bookId}, repetition ${repetition}): ${error.message}; diagnostics=${JSON.stringify(diagnostics)}; browserErrors=${JSON.stringify(errors)}`);
      }
      const warmFirstBodyParagraph = await waitForFirstBodyParagraph(page);

      assert.equal(await page.locator('#bookReaderText').count(), 1, `${entryPoint.id}, book ${bookId}: reader text article must exist`);
      assert.ok(coldFirstBodyParagraph.paragraphLength >= 20, `${entryPoint.id}, book ${bookId}: cold open must reach a real body paragraph`);
      assert.ok(warmFirstBodyParagraph.paragraphLength >= 20, `${entryPoint.id}, book ${bookId}: warm open must reach a real body paragraph`);
      assert.equal(requestedBookContent.length, 1, `${entryPoint.id}, book ${bookId}: exactly one book-content request is allowed across cold and warm opens; got ${JSON.stringify(requestedBookContent)}`);
      assert.ok(requestedBookContent[0].endsWith(expectedBookPath), `${entryPoint.id}, book ${bookId}: only the selected book may be fetched; got ${requestedBookContent[0]}`);
      assert.deepEqual(errors, [], `${entryPoint.id}, book ${bookId}: no browser errors during cold/warm open`);

      if (repetition === 1) {
        await page.locator('#bookReader').getByRole('button', { name: 'خروج از مطالعه' }).click();
        await page.locator('#books').waitFor({ state: 'visible' });
        const nextBook = page.locator('#books .libraryBook').nth(1);
        await nextBook.locator('button').click();
        await page.locator('#bookReader').waitFor({ state: 'visible', timeout: 30000 });
        const switchedBookParagraph = await waitForFirstBodyParagraph(page);
        assert.ok(switchedBookParagraph.paragraphLength >= 20, `${entryPoint.id}: switching from the first book to the second after closing Reader must show real body content`);
        assert.deepEqual(errors, [], `${entryPoint.id}: close-and-switch book flow must not raise browser errors`);
        await page.locator('#bookReader').getByRole('button', { name: 'خروج از مطالعه' }).click();
        await page.locator('#books').waitFor({ state: 'visible' });
      }

      let repeatedReopen = null;
      if (repetition === 1) {
        const repeatedSamples = [];
        // Exercise the exact user-reported pattern in one live page/context:
        // close and reopen the same book repeatedly without refreshing the app.
        for (let cycle = 1; cycle <= 8; cycle += 1) {
          await page.evaluate(() => { window.__readerPerfStartedAt = performance.now(); });
          const sameBook = page.locator('#books .libraryBook').nth(bookId - 1);
          await sameBook.locator('button').click();
          await page.locator('#bookReader').waitFor({ state: 'visible', timeout: 30000 });
          const sample = await waitForReadablePage(page);
          assert.equal(await page.locator('#bookReaderText').count(), 1, `${entryPoint.id}: cycle ${cycle} must mount exactly one Reader text surface`);
          assert.ok(sample.pageTextLength > 0, `${entryPoint.id}: cycle ${cycle} must render readable content`);
          repeatedSamples.push(sample.elapsedMs);
          await page.locator('#bookReader').getByRole('button', { name: 'خروج از مطالعه' }).click();
          await page.locator('#books').waitFor({ state: 'visible' });
          assert.equal(await page.locator('#bookReader').count(), 0, `${entryPoint.id}: cycle ${cycle} must fully unmount Reader`);
        }
        const sorted = [...repeatedSamples].sort((a, b) => a - b);
        repeatedReopen = {
          cycles: repeatedSamples.length,
          samplesMs: repeatedSamples,
          p50Ms: sorted[Math.floor(sorted.length / 2)],
          firstMs: repeatedSamples[0],
          lastMs: repeatedSamples[repeatedSamples.length - 1],
        };
        console.log(`Repeated same-book reopen stress (${entryPoint.id}, no app refresh): ${JSON.stringify(repeatedReopen)}`);
        assert.equal(errors.length, 0, `${entryPoint.id}: repeated same-book open/close must not create browser errors: ${JSON.stringify(errors)}`);
      }

      results.push({ repetition, entryPoint: entryPoint.id, bookId, cold, coldFirstBodyParagraph, warm, warmFirstBodyParagraph, repeatedReopen });
      await page.close();
    }
    }
  }

  const percentile = (values, p) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
  };
  const coldSamples = results.map((item) => item.coldFirstBodyParagraph.elapsedMs);
  const warmSamples = results.map((item) => item.warmFirstBodyParagraph.elapsedMs);
  const summary = {
    independentRepetitionsPerEntryPointAndBook: 3,
    coldBodyParagraphMs: { samples: coldSamples.length, p50: percentile(coldSamples, 50), p95: percentile(coldSamples, 95), min: Math.min(...coldSamples), max: Math.max(...coldSamples) },
    warmBodyParagraphMs: { samples: warmSamples.length, p50: percentile(warmSamples, 50), p95: percentile(warmSamples, 95), min: Math.min(...warmSamples), max: Math.max(...warmSamples) },
  };
  console.log('PASS: dashboard-library and bottom-navigation study entry points each completed 3 independent cold/warm reader opens for all five canonical books.');
  console.log('Both entry points are clicked independently. Timing includes click-to-first-readable-content and click-to-first-real-body-paragraph; measurements are headless Chromium, not physical Android results.');
  console.log('Repeated first-body-paragraph timing summary (headless Chromium):');
  console.log(JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
