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
    coverImageReady: (() => {
      const image = document.querySelector('#bookReaderText .readerCoverPage img, #bookReaderText .readerFrontispiecePage img');
      return image ? image.complete && image.naturalWidth > 0 : null;
    })(),
    coverImageElapsedMs: (() => {
      const image = document.querySelector('#bookReaderText .readerCoverPage img, #bookReaderText .readerFrontispiecePage img');
      return image && image.complete && image.naturalWidth > 0
        ? Number((performance.now() - window.__readerPerfStartedAt).toFixed(2))
        : null;
    })(),
    coverImageUrl: (() => {
      const image = document.querySelector('#bookReaderText .readerCoverPage img, #bookReaderText .readerFrontispiecePage img');
      return image ? (image.currentSrc || image.src) : null;
    })(),
    coverImageResourceTiming: (() => {
      const image = document.querySelector('#bookReaderText .readerCoverPage img, #bookReaderText .readerFrontispiecePage img');
      const url = image ? (image.currentSrc || image.src) : '';
      const entry = url ? performance.getEntriesByName(url).at(-1) : null;
      return entry ? {
        preloadedBeforeOpen: entry.startTime < window.__readerPerfStartedAt,
        requestStartMs: Number((entry.requestStart - window.__readerPerfStartedAt).toFixed(2)),
        responseEndMs: Number((entry.responseEnd - window.__readerPerfStartedAt).toFixed(2)),
        durationMs: Number(entry.duration.toFixed(2)),
        transferBytes: entry.transferSize || 0,
      } : null;
    })(),
    bookContentResources: performance.getEntriesByType('resource')
      .filter((entry) => entry.startTime >= window.__readerPerfStartedAt && /\/content\/books\/book\d+\.json(?:$|\?)/.test(entry.name))
      .map((entry) => ({
        url: entry.name,
        requestStartMs: Number((entry.requestStart - window.__readerPerfStartedAt).toFixed(2)),
        responseEndMs: Number((entry.responseEnd - window.__readerPerfStartedAt).toFixed(2)),
        durationMs: Number(entry.duration.toFixed(2)),
        transferBytes: entry.transferSize || 0,
      })),
  }));
}

async function waitForFirstBodyParagraph(page) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const paragraph = await page.evaluate(() => {
      const article = document.querySelector('#bookReaderText');
      const line = [...(article?.querySelectorAll('.readerFixedLine.body.paraStart') || [])]
        .find((item) => String(item.innerText || '').replace(/\s+/g, ' ').trim().length >= 20);
      return line ? String(line.innerText || '').replace(/\s+/g, ' ').trim() : '';
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

async function collectReaderDiagnostics(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#bookReader');
    const article = document.querySelector('#bookReaderText');
    const rect = (element) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        x: Number(box.x.toFixed(1)), y: Number(box.y.toFixed(1)),
        width: Number(box.width.toFixed(1)), height: Number(box.height.toFixed(1)),
      };
    };
    const text = String(article?.innerText || '').replace(/\\s+/g, ' ').trim();
    return {
      url: location.href,
      documentVisibility: document.visibilityState,
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
      readerVisible: Boolean(root?.getClientRects().length),
      readerRoot: rect(root),
      articleExists: Boolean(article),
      articleVisible: Boolean(article?.getClientRects().length),
      articleRect: rect(article),
      articleChildCount: article?.children.length ?? null,
      articleTextLength: text.length,
      articleTextPreview: text.slice(0, 240),
      loadingMessageVisible: [...(article?.querySelectorAll('.readerFixedLine') || [])]
        .some((node) => /در حال بارگذاری کتاب/.test(node.innerText || '')),
      bodyLineCount: article?.querySelectorAll('.readerFixedLine.body').length ?? null,
      paragraphStartCount: article?.querySelectorAll('.readerFixedLine.body.paraStart').length ?? null,
      imageStates: [...(article?.querySelectorAll('img') || [])].map((image) => ({
        src: image.currentSrc || image.src,
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      })),
      pageCounter: document.querySelector('#readerPageCounter')?.innerText || '',
      pageRangeMax: Number(document.querySelector('#readerPageRange')?.max || 0),
      resources: performance.getEntriesByType('resource').slice(-20).map((entry) => ({
        name: entry.name,
        durationMs: Number(entry.duration.toFixed(1)),
        transferBytes: entry.transferSize || 0,
      })),
    };
  }).catch((error) => ({ diagnosticsError: String(error) }));
}

try {
  const results = [];
  const entryPoints = [
    { id: 'dashboard-library-button', open: async (page) => page.locator('#dashboard .quickAction').filter({ hasText: 'کتابخانه' }).click() },
    { id: 'bottom-navigation-study-button', open: async (page) => page.locator('#bottomNav button[data-view="books"]').click() },
  ];

  const viewports = [
    { id: 'mobile', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    { id: 'desktop', width: 1365, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  ];

  // Three independent contexts per viewport, entry point and book provide repeated
  // cold samples; each context is reopened once to capture its paired warm sample.
  for (const viewport of viewports) {
  for (let repetition = 1; repetition <= 3; repetition += 1) {
    for (const entryPoint of entryPoints) {
    for (let bookId = 1; bookId <= 5; bookId += 1) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.deviceScaleFactor,
        isMobile: viewport.isMobile,
        hasTouch: viewport.hasTouch,
      });
      const errors = [];
      const failedRequests = [];
      const requestedBookContent = [];
      const requestedImages = [];
      const expectedBookPath = `/content/books/book${bookId}.json`;
      page.on('request', (request) => {
        try {
          const pathname = new URL(request.url()).pathname;
          if (/\/content\/books\/book\d+\.json$/.test(pathname)) requestedBookContent.push(pathname);
          if (request.resourceType() === 'image') requestedImages.push({ url: request.url(), pathname });
        } catch { /* ignore non-URL requests */ }
      });
      page.on('requestfailed', (request) => {
        const url = request.url();
        if (request.resourceType() === 'image' || /\/content\/books\/book\d+\.json(?:$|\?)/.test(url)) {
          failedRequests.push({
            url,
            error: request.failure()?.errorText || 'request failed',
          });
        }
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
      await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
      await page.locator('#copyrightModal').waitFor({ state: 'visible' });
      await page.locator('#copyrightModal').getByRole('button', { name: /متوجه شدم و ورود به مسیر را ادامه می‌دهم/ }).click();
      await page.locator('#dashboard').waitFor({ state: 'visible' });

      await entryPoint.open(page);
      await page.locator('#books').waitFor({ state: 'visible' });
      const book = page.locator('#books .libraryBook').nth(bookId - 1);
      await book.waitFor({ state: 'visible' });

      console.log(`START reader scenario: viewport=${viewport.id}, repetition=${repetition}, entryPoint=${entryPoint.id}, book=${bookId}, phase=cold`);
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
        })).catch(() => ({}));
        throw new Error(`Cold reader open failed (${entryPoint.id}, book ${bookId}, repetition ${repetition}): ${error.message}; diagnostics=${JSON.stringify(diagnostics)}; browserErrors=${JSON.stringify(errors)}`);
      }
      const coldFirstBodyParagraph = await waitForFirstBodyParagraph(page);

      await page.locator('#bookReader').getByRole('button', { name: 'خروج از مطالعه' }).click();
      await page.locator('#books').waitFor({ state: 'visible' });
      const reopenedBook = page.locator('#books .libraryBook').nth(bookId - 1);
      console.log(`START reader scenario: viewport=${viewport.id}, repetition=${repetition}, entryPoint=${entryPoint.id}, book=${bookId}, phase=warm`);
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
        })).catch(() => ({}));
        throw new Error(`Warm reader open failed (${entryPoint.id}, book ${bookId}, repetition ${repetition}): ${error.message}; diagnostics=${JSON.stringify(diagnostics)}; browserErrors=${JSON.stringify(errors)}`);
      }
      const warmFirstBodyParagraph = await waitForFirstBodyParagraph(page);

      assert.equal(await page.locator('#bookReaderText').count(), 1, `${entryPoint.id}, book ${bookId}: reader text article must exist`);
      assert.ok(coldFirstBodyParagraph.paragraphLength >= 20, `${entryPoint.id}, book ${bookId}: cold open must reach a real body paragraph`);
      assert.ok(warmFirstBodyParagraph.paragraphLength >= 20, `${entryPoint.id}, book ${bookId}: warm open must reach a real body paragraph`);
      assert.equal(requestedBookContent.length, 1, `${entryPoint.id}, book ${bookId}: exactly one book-content request is allowed across cold and warm opens; got ${JSON.stringify(requestedBookContent)}`);
      assert.ok(requestedBookContent[0].endsWith(expectedBookPath), `${entryPoint.id}, book ${bookId}: only the selected book may be fetched; got ${requestedBookContent[0]}`);
      // Freeze the cold/warm measurement before the later book-switch and repeated-reopen
      // stress scenarios add their own intentional requests to the shared event listener.
      const coldWarmBookContentRequests = [...requestedBookContent];
      assert.deepEqual(errors, [], `${viewport.id}, ${entryPoint.id}, book ${bookId}: no browser errors during cold/warm open`);
      assert.deepEqual(failedRequests, [], `${viewport.id}, ${entryPoint.id}, book ${bookId}: no failed network requests during cold/warm open`);

      if (repetition === 1 && bookId === 1) {
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
      if (repetition === 1 && bookId === 1) {
        repeatedReopen = [];
        // The user reports the same no-refresh reopen failure across all five books.
        // Exercise every book in the same live app session, three close/reopen cycles each.
        for (let repeatedBookIndex = 0; repeatedBookIndex < 5; repeatedBookIndex += 1) {
          const repeatedSamples = [];
          const repeatedParagraphSamples = [];
          for (let cycle = 1; cycle <= 3; cycle += 1) {
            await page.evaluate(() => { window.__readerPerfStartedAt = performance.now(); });
            const selectedBook = page.locator('#books .libraryBook').nth(repeatedBookIndex);
            try {
              await selectedBook.locator('button').click();
              await page.locator('#bookReader').waitFor({ state: 'visible', timeout: 30000 });
              const sample = await waitForReadablePage(page);
              assert.equal(await page.locator('#bookReaderText').count(), 1, `${entryPoint.id}: book ${repeatedBookIndex + 1} cycle ${cycle} must mount exactly one Reader text surface`);
              assert.ok(sample.pageTextLength > 0, `${entryPoint.id}: book ${repeatedBookIndex + 1} cycle ${cycle} must render readable content`);
              const paragraph = await waitForFirstBodyParagraph(page);
              assert.ok(paragraph.paragraphLength >= 20, `${entryPoint.id}: book ${repeatedBookIndex + 1} cycle ${cycle} must reach a real body paragraph, not remain in the loading state`);
              repeatedSamples.push(sample.elapsedMs);
              repeatedParagraphSamples.push(paragraph.elapsedMs);
              await page.locator('#bookReader').getByRole('button', { name: 'خروج از مطالعه' }).click();
              await page.locator('#books').waitFor({ state: 'visible' });
              assert.equal(await page.locator('#bookReader').count(), 0, `${entryPoint.id}: book ${repeatedBookIndex + 1} cycle ${cycle} must fully unmount Reader`);
            } catch (error) {
              const diagnostics = await collectReaderDiagnostics(page);
              throw new Error(`Repeated reopen failed (viewport=${viewport.id}, entryPoint=${entryPoint.id}, book=${repeatedBookIndex + 1}, cycle=${cycle}): ${error.message}; diagnostics=${JSON.stringify(diagnostics)}; browserErrors=${JSON.stringify(errors)}; failedRequests=${JSON.stringify(failedRequests)}`);
            }
          }
          const sorted = [...repeatedParagraphSamples].sort((a, b) => a - b);
          const bookResult = {
            bookId: repeatedBookIndex + 1,
            cycles: repeatedSamples.length,
            firstReadableSamplesMs: repeatedSamples,
            firstBodyParagraphSamplesMs: repeatedParagraphSamples,
            firstBodyParagraphP50Ms: sorted[Math.floor(sorted.length / 2)],
          };
          repeatedReopen.push(bookResult);
          console.log(`Repeated reopen stress (${entryPoint.id}, book ${bookResult.bookId}, no app refresh): ${JSON.stringify(bookResult)}`);
        }
        assert.equal(errors.length, 0, `${entryPoint.id}: repeated open/close across all five books must not create browser errors: ${JSON.stringify(errors)}`);
      }

      results.push({
        viewport: viewport.id,
        viewportSize: `${viewport.width}x${viewport.height}`,
        repetition,
        entryPoint: entryPoint.id,
        bookId,
        cold,
        coldFirstBodyParagraph,
        warm,
        warmFirstBodyParagraph,
        repeatedReopen,
        requestedBookContent: coldWarmBookContentRequests,
        postColdWarmBookContentRequests: requestedBookContent.slice(coldWarmBookContentRequests.length),
        requestedImages,
        failedRequests,
        browserErrors: errors,
      });
      await page.close();
    }
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
    independentRepetitionsPerViewportEntryPointAndBook: 3,
    viewportProfiles: viewports.map(({ id, width, height }) => ({ id, width, height })),
    totalColdSamples: coldSamples.length,
    totalWarmSamples: warmSamples.length,
    perBookAndViewport: viewports.flatMap((viewport) => Array.from({ length: 5 }, (_, index) => {
      const samples = results.filter((item) => item.viewport === viewport.id && item.bookId === index + 1);
      const coldValues = samples.map((item) => item.coldFirstBodyParagraph.elapsedMs);
      const warmValues = samples.map((item) => item.warmFirstBodyParagraph.elapsedMs);
      return {
        viewport: viewport.id,
        bookId: index + 1,
        coldFirstReadableP50Ms: percentile(samples.map((item) => item.cold.elapsedMs), 50),
        coldFirstParagraphP50Ms: percentile(coldValues, 50),
        warmFirstReadableP50Ms: percentile(samples.map((item) => item.warm.elapsedMs), 50),
        warmFirstParagraphP50Ms: percentile(warmValues, 50),
        coldCoverImageReadyP50Ms: percentile(samples.map((item) => item.cold.coverImageElapsedMs).filter(Number.isFinite), 50),
        coldBookJsonRequest: samples[0]?.cold.bookContentResources || [],
      };
    })),
    coldBodyParagraphMs: { samples: coldSamples.length, p50: percentile(coldSamples, 50), p95: percentile(coldSamples, 95), min: Math.min(...coldSamples), max: Math.max(...coldSamples) },
    warmBodyParagraphMs: { samples: warmSamples.length, p50: percentile(warmSamples, 50), p95: percentile(warmSamples, 95), min: Math.min(...warmSamples), max: Math.max(...warmSamples) },
  };
  console.log('PASS: dashboard-library and bottom-navigation study entry points each completed 3 independent cold/warm reader opens for all five canonical books on mobile and desktop.');
  console.log('Both entry points are clicked independently. Timing includes click-to-first-readable-content and click-to-first-real-body-paragraph; measurements are headless Chromium, not physical Android results.');
  console.log('Repeated first-body-paragraph timing summary (headless Chromium):');
  console.log(JSON.stringify(summary, null, 2));
  await (await import('node:fs/promises')).mkdir('reports/generated', { recursive: true });
  await (await import('node:fs/promises')).writeFile(
    'reports/generated/reader-open-performance.json',
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      baseURL,
      note: 'Headless Chromium diagnostics; mobile/desktop emulation is not a substitute for physical-device measurements.',
      summary,
      results,
    }, null, 2) + '\n',
    'utf8',
  );
  console.log('Saved reports/generated/reader-open-performance.json');
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await browser.close();
}
