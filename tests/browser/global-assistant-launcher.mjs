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
    goal: 'هدف مصنوعی برای آزمون دسترسی سراسری',
    code: 'M28-GLOBAL-ASSISTANT-BROWSER',
  },
  assessmentData: { answers: [2, 2, 2, 2, 2], total: 8, score: 4, motivation: 2, scaleMax: 4, version: 2 },
  final: null,
  archive: [],
  pathId: 'global-assistant-browser-check',
  startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  lastView: 'dashboard',
};

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.addInitScript((state) => {
    localStorage.setItem('maseer28_onboarding_complete_v1', '1');
    localStorage.setItem('maseer28_state', JSON.stringify(state));
    localStorage.setItem('maseer28_user_profile_v2', JSON.stringify({
      version: 2,
      name: 'کاربر مصنوعی آزمون',
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

  const launcher = page.getByRole('button', { name: 'باز کردن دستیار مسیر۲۸' });
  await launcher.waitFor({ state: 'visible' });
  assert.equal(await launcher.isVisible(), true, 'global assistant launcher must appear on the dashboard');
  await launcher.click();
  let dialog = page.getByRole('dialog', { name: 'دستیار مسیر۲۸' });
  await dialog.waitFor({ state: 'visible' });
  const closeButton = dialog.getByRole('button', { name: 'بستن پنجره دستیار' });
  const acknowledgeButton = dialog.getByRole('button', { name: 'متوجه شدم' });
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'بستن پنجره دستیار');
  assert.equal(await launcher.getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await acknowledgeButton.evaluate((element) => element === document.activeElement), true, 'Shift+Tab from the first control must wrap to the last');
  await page.keyboard.press('Tab');
  assert.equal(await closeButton.evaluate((element) => element === document.activeElement), true, 'Tab from the last control must wrap to the first');
  assert.match(await dialog.innerText(), /صفحه فعلی: خانه/);
  assert.match(await dialog.innerText(), /هنوز محتوای این بخش به موتور پاسخ‌گویی متصل نیست/);
  assert.equal(await dialog.getByRole('textbox').count(), 0, 'unsupported pages must not display a misleading chat composer');
  await closeButton.click();
  await dialog.waitFor({ state: 'detached' });
  assert.equal(await launcher.getAttribute('aria-expanded'), 'false');
  assert.equal(await launcher.evaluate((element) => element === document.activeElement), true, 'closing the dialog must restore focus to the launcher');

  await page.locator('#dashboard .heroAction').click();
  await page.locator('#day').waitFor({ state: 'visible' });
  await launcher.waitFor({ state: 'visible' });
  await launcher.click();
  await page.waitForFunction(() => {
    const target = document.querySelector('.dailyExerciseAssistant');
    if (!target) return false;
    const rect = target.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  });
  assert.equal(await page.getByRole('dialog').count(), 0, 'daily shortcut should jump to the existing day-scoped assistant instead of opening an empty chat');

  await page.getByRole('button', { name: 'خانه' }).click();
  await page.locator('#dashboard').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'مطالعه', exact: true }).click();
  await page.locator('.bottomNav button[data-view="books"].active').waitFor({ state: 'visible' });
  await launcher.click();
  dialog = page.getByRole('dialog', { name: 'دستیار مسیر۲۸' });
  await dialog.waitFor({ state: 'visible' });
  assert.match(await dialog.innerText(), /صفحه فعلی: کتابخانه/);
  await dialog.getByRole('button', { name: 'متوجه شدم' }).click();
  await dialog.waitFor({ state: 'detached' });

  await page.getByRole('button', { name: 'ارتباط' }).click();
  await page.locator('.bottomNav button[data-view="support"].active').waitFor({ state: 'visible' });
  await launcher.click();
  dialog = page.getByRole('dialog', { name: 'دستیار مسیر۲۸' });
  await dialog.waitFor({ state: 'visible' });
  assert.match(await dialog.innerText(), /صفحه فعلی: پشتیبانی/);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });

  assert.deepEqual(errors, [], 'global assistant navigation must not raise uncaught page errors');
  await page.close();
  process.stdout.write('PASS: Chromium global assistant placement, daily-page shortcut, page-context disclosure, unsupported-page guard, dialog close and Escape handling (WV-BROWSER-GLOBAL-ASSISTANT)\\n');
} finally {
  await browser.close();
}
