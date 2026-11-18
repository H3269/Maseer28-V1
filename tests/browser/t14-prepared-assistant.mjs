import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173/Maseer28/';
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
    problem: 'کمبود انگیزه',
    durationYears: 1,
    durationMonths: 0,
    goal: 'شناخت زمینه‌های دشواری شروع فعالیت',
    code: 'M28-T14-PREPARED-QUESTIONS-BROWSER',
  },
  assessmentData: { answers: [2, 2, 2, 2, 2], total: 10, score: 5, motivation: 2, scaleMax: 4, version: 2 },
  final: null,
  archive: [],
  pathId: 't14-prepared-assistant-browser-check',
  startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  lastView: 'dashboard',
};

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.addInitScript((state) => {
    localStorage.setItem('maseer28_onboarding_complete_v1', '1');
    localStorage.setItem('maseer28_state', JSON.stringify(state));
    localStorage.setItem('maseer28_user_profile_v2', JSON.stringify({
      version: 2,
      name: 'کاربر مصنوعی آزمون T14',
      age: 35,
      gender: 'ترجیح می‌دهم نگویم',
      phone: '09123456789',
      medical: 'none',
      medicalNote: '',
      medication: 'no',
      medicationRisk: 'no',
    }));
  }, journey);

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/content/path-content.json')) {
      const response = await route.fetch();
      const payload = await response.json();
      const motivationCategory = payload.categories?.['کمبود انگیزه']
        || Object.values(payload.categories || {}).find((category) =>
          category.days?.some((item) => String(item.id || '').startsWith('کمبود انگیزه-')));
      const motivationDay = motivationCategory?.days?.find((item) => Number(item.day) === 1);
      assert.ok(motivationDay, 'the browser fixture must contain canonical T14 day 1');
      assert.equal(motivationDay.id, 'کمبود انگیزه-01');
      Object.assign(motivationDay, {
        topic_id: 'T14',
        day: 1,
        review_status: 'approved',
        risk_level: 'routine',
      });
      await route.fulfill({ response, json: payload });
      return;
    }
    if (url.searchParams.has('_m28_time')) {
      await route.fulfill({ status: 200, headers: { date: new Date().toUTCString() } });
      return;
    }
    await route.continue();
  });

  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('#copyrightModal').waitFor({ state: 'visible' });
  await page.locator('#copyrightModal')
    .getByRole('button', { name: /متوجه شدم و ورود به مسیر را ادامه می‌دهم/ }).click();
  await page.locator('#dashboard').waitFor({ state: 'visible' });
  await page.locator('#dashboard .heroAction').click();
  await page.locator('#day').waitFor({ state: 'visible' });

  const launcher = page.getByRole('button', { name: 'باز کردن دستیار مسیر۲۸' });
  await launcher.waitFor({ state: 'visible' });
  await launcher.click();
  const dialog = page.getByRole('dialog', { name: 'دستیار راهنمای مسیر ۲۸' });
  await dialog.waitFor({ state: 'visible' });

  const trigger = dialog.getByTestId('t14-daily-prompt-trigger');
  await trigger.waitFor({ state: 'visible' });
  assert.equal(await dialog.getByRole('textbox').count(), 0,
    'T14 must remain prepared-only and must not expose free-text input');
  await trigger.click();

  const picker = page.locator('#library-assistant-prompt-dialog');
  await picker.waitFor({ state: 'visible' });
  const options = picker.locator('[data-prompt-option]');
  assert.equal(await options.count(), 14,
    'the visible T14 picker must render all fourteen prepared questions');
  await picker.getByRole('button', { name: 'منظور از تمرین امروز چیست؟' }).click();

  const before = await dialog.locator('.assistantMessage').count();
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction((previous) => {
    const replies = [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')];
    return replies.length > previous
      && /راهنمای روز 1 کمبود انگیزه/.test(replies.at(-1)?.innerText || '');
  }, before);

  const reply = dialog.locator('.assistantMessage').last();
  const replyText = await reply.innerText();
  assert.match(replyText, /نقشه افت انگیزه/);
  assert.match(replyText, /پایش زمینه/);
  assert.equal(await dialog.getByTestId('t14-daily-prompt-trigger').count(), 1,
    'the T14 prepared-question trigger must remain available after answering');
  assert.deepEqual(errors, [], 'the T14 browser flow must not emit page or console errors');

  console.log('PASS: Chromium displayed all 14 T14 prepared questions and returned the selected day-1 answer.');
} finally {
  await browser.close();
}
