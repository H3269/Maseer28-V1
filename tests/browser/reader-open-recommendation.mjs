// End-to-end route coverage: daily result -> computed recommendation -> preview -> Reader.
// Keep the app state seeded, but perform every navigation and action through the visible UI.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173/Maseer28/';
const browser = await chromium.launch({ headless: true });

const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
const journey = {
  schema: 7, started: true, profile: true, assessment: true,
  completed: [], answers: {}, daily: {},
  profileData: {
    problem: 'خشم', durationYears: 1, durationMonths: 0,
    goal: 'شناخت محرک‌های خشم و انتخاب واکنش سنجیده‌تر در موقعیت تنش',
    code: 'M28-READER-RECOMMENDATION',
  },
  assessmentData: { answers: [2, 2, 2, 2, 2], total: 8, score: 4, motivation: 2, scaleMax: 4, version: 2 },
  final: null, archive: [], pathId: 'reader-performance-recommendation',
  startedAt: old, lastView: 'dashboard',
};

async function waitForReadableReader(page) {
  await page.waitForFunction(() => {
    const article = document.querySelector('#bookReaderText');
    if (!article || article.getClientRects().length === 0) return false;
    const imageReady = [...article.querySelectorAll('img')].some((image) => image.complete && image.naturalWidth > 0);
    const textReady = String(article.innerText || '').replace(/\s+/g, ' ').trim().length > 0;
    return imageReady || textReady;
  }, null, { timeout: 120000 });
  return page.evaluate(() => ({
    elapsedMs: Number((performance.now() - window.__readerPerfStartedAt).toFixed(2)),
    contentType: document.querySelector('#bookReaderText img') ? 'image-or-cover' : 'text',
    textLength: String(document.querySelector('#bookReaderText')?.innerText || '').trim().length,
    pageCounter: document.querySelector('#readerPageCounter')?.innerText || '',
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

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errors = [];
  const failedRequests = [];
  const abortedNavigationRequests = [];
  const abortedRequestDiagnostics = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText || 'failed';
    if (failure === 'net::ERR_ABORTED') {
      const diagnostic = {
        url: request.url(), method: request.method(), resourceType: request.resourceType(),
        isNavigationRequest: request.isNavigationRequest(),
        frameUrl: (() => { try { return request.frame()?.url() || ''; } catch { return 'frame-unavailable'; } })(),
      };
      abortedRequestDiagnostics.push(diagnostic);
      if (request.isNavigationRequest() && request.resourceType() === 'document') {
        abortedNavigationRequests.push({ ...diagnostic, error: failure });
        return;
      }
    }
    failedRequests.push(request.url() + ' :: ' + failure);
  });

  // Stub only the trusted-clock probe inside this test page. Intercepting the
  // HEAD request at the browser routing layer still produced ERR_ABORTED in Chromium,
  // so handle this deterministic fixture before the app issues a network request.
  await page.addInitScript((state) => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      const rawUrl = typeof input === 'string' ? input : input?.url;
      if (rawUrl) {
        const url = new URL(rawUrl, window.location.href);
        if (url.origin === window.location.origin && url.searchParams.has('_m28_time')) {
          return Promise.resolve(new Response(null, {
            status: 200,
            headers: { date: new Date().toUTCString() },
          }));
        }
      }
      return nativeFetch(input, init);
    };
    localStorage.setItem('maseer28_onboarding_complete_v1', '1');
    localStorage.setItem('maseer28_state', JSON.stringify(state));
    localStorage.setItem('maseer28_user_profile_v2', JSON.stringify({
      version: 2, name: 'کاربر آزمایشی', age: 35, gender: 'زن', phone: '09123456789',
      medical: 'none', medicalNote: '', medication: 'no', medicationRisk: 'no',
    }));
  }, journey);

  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('#copyrightModal').waitFor({ state: 'visible' });
  await page.locator('#copyrightModal').getByRole('button', { name: /متوجه شدم و ورود به مسیر را ادامه می‌دهم/ }).click();
  await page.locator('#dashboard').waitFor({ state: 'visible' });
  await page.locator('#dashboard .heroAction').click();
  const day = page.locator('#day');
  await day.waitFor({ state: 'visible' });
  await day.locator('#openDailyEntryBtn').click();
  await day.locator('#dailyEntryPanel').waitFor({ state: 'visible' });

  const score = day.locator('#dayScore');
  await score.evaluate((el) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, '4');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelector('#dayScore')?.getAttribute('data-touched') === '1');
  await day.locator('.smartSelectButton').click();
  await day.locator('.smartSelectOption').filter({ hasText: 'بهتر شدم' }).click();
  await day.locator('#answer').fill('امروز محرک خشم و تنش را شناسایی کردم. پیش از واکنش، مکث کردم و یک پاسخ سنجیده‌تر برای کنترل خشم انتخاب کردم.');
  await page.evaluate(() => { window.__readerPerfStartedAt = performance.now(); });
  await day.getByRole('button', { name: /ثبت امروز و دریافت نتیجه/ }).click();

  await page.locator('#dailyResult').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const pending = document.querySelector('#bookRecommendationPending');
    const button = [...document.querySelectorAll('#resultNextWrap button')].find((item) => item.innerText.includes('مطالعه پیشنهاد کتاب امروز'));
    return !pending && Boolean(button);
  }, null, { timeout: 120000 });
  const previewButton = page.locator('#resultNextWrap').getByRole('button', { name: /مطالعه پیشنهاد کتاب امروز/ });
  const recommendationReady = await page.evaluate(() => Number((performance.now() - window.__readerPerfStartedAt).toFixed(2)));
  await page.evaluate(() => { window.__previewPerfStartedAt = performance.now(); });
  await previewButton.click();
  await page.locator('#bookPreviewModal').waitFor({ state: 'visible', timeout: 120000 });
  await page.locator('#bookPreviewText').waitFor({ state: 'visible' });
  await page.waitForFunction(() => String(document.querySelector('#bookPreviewText')?.innerText || '').trim().length > 0);
  const previewReady = await page.evaluate(() => ({
    elapsedMs: Number((performance.now() - window.__previewPerfStartedAt).toFixed(2)),
    textLength: String(document.querySelector('#bookPreviewText')?.innerText || '').trim().length,
    meta: document.querySelector('#bookPreviewMeta')?.innerText || '',
  }));

  await page.evaluate(() => { window.__readerPerfStartedAt = performance.now(); });
  await page.locator('#bookPreviewModal').getByRole('button', { name: /رفتن به کتابخانه اختصاصی/ }).click();
  const readerReady = await waitForReadableReader(page);
  const firstBodyParagraph = await waitForFirstBodyParagraph(page);

  console.log('Recommendation-to-reader diagnostics:', JSON.stringify({ readerReady, firstBodyParagraph, abortedNavigationRequests, abortedRequestDiagnostics, failedRequests, errors }, null, 2));
  assert.deepEqual(errors, [], 'recommendation-to-reader route must not raise browser errors');
  assert.deepEqual(failedRequests, [], 'recommendation-to-reader route must not fail network requests; aborted request diagnostics are included above');
  console.log('PASS: real daily-result recommendation → preview → reader flow completed through UI.');
  console.log(JSON.stringify({
    recommendationReadyMs: recommendationReady,
    previewReady,
    readerReady,
    firstBodyParagraph,
    errors,
    failedRequests,
    abortedNavigationRequests,
    abortedRequestDiagnostics,
  }, null, 2));
  await page.close();
} finally {
  await browser.close();
}
