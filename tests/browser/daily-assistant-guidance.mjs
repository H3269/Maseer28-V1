import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });

const journey = {
  schema: 7,
  started: true,
  profile: true,
  assessment: true,
  completed: [],
  answers: {},
  daily: {},
  profileData: {
    problem: 'خشم',
    durationYears: 1,
    durationMonths: 0,
    goal: 'هدف مصنوعی برای آزمون رابط دستیار',
    code: 'M28-ASSISTANT-BROWSER',
  },
  assessmentData: { answers: [2, 2, 2, 2, 2], total: 8, score: 4, motivation: 2, scaleMax: 4, version: 2 },
  final: null,
  archive: [],
  pathId: 'daily-assistant-browser-check',
  startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  lastView: 'dashboard',
};

async function openDay(page) {
  await page.addInitScript((state) => {
    localStorage.setItem('maseer28_onboarding_complete_v1', '1');
    localStorage.setItem('maseer28_state', JSON.stringify(state));
    localStorage.setItem('maseer28_user_profile_v2', JSON.stringify({
      version: 2,
      name: 'کاربر مصنوعی آزمون',
      age: 35,
      gender: 'ترجیح می‌دهم نگویم',
      phone: '00000000000',
      medical: 'none',
      medicalNote: '',
      medication: 'no',
      medicationRisk: 'no',
    }));
  }, journey);

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has('_m28_time')) {
      await route.fulfill({ status: 200, headers: { date: new Date().toUTCString() } });
      return;
    }
    await route.continue();
  });

  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('#copyrightModal').waitFor({ state: 'visible' });
  await page.locator('#copyrightModal').getByRole('button', { name: /متوجه شدم و ورود به مسیر را ادامه می‌دهم/ }).click();
  await page.locator('#dashboard').waitFor({ state: 'visible' });
  await page.locator('#dashboard .heroAction').click();
  await page.locator('#day').waitFor({ state: 'visible' });
}

try {
  const page = await browser.newPage();
  const errors = [];
  const workerRequests = [];
  const privateMarker = 'private-assistant-browser-marker-7f31c2';
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('request', (request) => {
    if (/\/v1\/assistant\/turn|assistant-api|workers\.dev/u.test(request.url())) {
      workerRequests.push(request.url());
    }
  });

  await openDay(page);
  const panel = page.locator('.dailyExerciseAssistant');
  await panel.waitFor({ state: 'visible' });
  const composer = panel.locator('#daily-exercise-assistant-message');
  const send = panel.getByRole('button', { name: 'ارسال' });

  assert.equal(await composer.getAttribute('maxlength'), '2000');
  assert.equal(await send.isDisabled(), true, 'empty assistant messages must not be sent');

  await composer.fill(`چطور انجامش بدم؟ ${privateMarker}`);
  assert.equal(await send.isDisabled(), false);
  await send.click();
  await page.waitForFunction(() => document.querySelectorAll('.dailyExerciseAssistant .assistantMessage').length >= 2);

  let assistantReply = await panel.locator('.assistantMessage').last().innerText();
  assert.match(assistantReply, /خشم/);
  assert.match(assistantReply, /روز 1/);
  assert.match(assistantReply, /متن تمرین همین روز/);
  assert.match(assistantReply, /راهکار اختصاصی همین روز/);

  await composer.fill('تمرین را بیشتر توضیح بده');
  await send.click();
  await page.waitForFunction(() => document.querySelectorAll('.dailyExerciseAssistant .assistantMessage').length >= 3);
  assistantReply = await panel.locator('.assistantMessage').last().innerText();
  assert.match(assistantReply, /متن تمرین همین روز/);
  assert.match(assistantReply, /جمله یا واژه‌اش را بیشتر باز کنم/);

  const boundedInput = 'آ'.repeat(2400);
  await composer.fill(boundedInput);
  assert.equal(await composer.inputValue().then((value) => value.length), 2000, 'composer must enforce its 2000-character limit');
  await composer.fill('دیگه نمی‌کشم. همه‌چی تمومه.');
  await send.click();
  await page.waitForFunction(() => /آیا همین الآن خطر فوری/.test(document.querySelector('.dailyExerciseAssistant .assistantMessage:last-of-type')?.innerText || ''));
  assistantReply = await panel.locator('.assistantMessage').last().innerText();
  assert.match(assistantReply, /آیا همین الآن خطر فوری/);
  assert.doesNotMatch(assistantReply, /متن تمرین همین روز/);

  await composer.fill('شاید، مطمئن نیستم');
  await send.click();
  await page.waitForFunction(() => /کمک فوری انسانی/.test(document.querySelector('.dailyExerciseAssistant .assistantMessage:last-of-type')?.innerText || ''));
  assistantReply = await panel.locator('.assistantMessage').last().innerText();
  assert.match(assistantReply, /کمک فوری انسانی/);
  assert.doesNotMatch(assistantReply, /متن تمرین همین روز/);

  await composer.fill('حالا تمرین امروز را توضیح بده');
  await send.click();
  await page.waitForFunction(() => document.querySelectorAll('.dailyExerciseAssistant .assistantMessage').length >= 6);
  assistantReply = await panel.locator('.assistantMessage').last().innerText();
  assert.match(assistantReply, /کمک فوری انسانی/);
  assert.doesNotMatch(assistantReply, /متن تمرین همین روز/);

  const storedValues = await page.evaluate(() => Object.keys(localStorage).map((key) => localStorage.getItem(key) || '').join('\n'));
  assert.equal(storedValues.includes(privateMarker), false, 'assistant transcript must not be persisted to localStorage');
  assert.deepEqual(workerRequests, [], 'day-scoped assistant must not call a Worker or external assistant provider');
  assert.deepEqual(errors, [], 'assistant browser flow should not raise uncaught page errors');

  await page.close();
  process.stdout.write('PASS: Chromium daily assistant guidance, follow-up context, input bounds, persistent safety handoff, local-only privacy, and no Worker requests (WV-BROWSER-ASSISTANT)\\n');
} finally {
  await browser.close();
}
