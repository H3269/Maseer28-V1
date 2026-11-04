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
  assert.match(await dialog.innerText(), /پردازش این نسخه در مرورگر انجام می‌شود/);
  assert.equal(await dialog.getByRole('textbox').count(), 1, 'the limited local page assistant must expose its message composer');
  assert.equal((await dialog.innerText()).includes('09123456789'), false, 'private profile data must not be exposed to the page assistant');
  await dialog.getByRole('textbox').fill('اینجا چه کارهایی می‌توانم انجام بدهم؟');
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForTimeout(250);
  process.stdout.write(`DEBUG GLOBAL ASSISTANT AFTER PAGE QUESTION: ${(await dialog.innerText()).slice(-1800)}\\n`);
  await page.waitForFunction(() => document.querySelector('.globalAssistantDialog')?.innerText.includes('ادامه مسیر امروز'));
  const firstAssistantReply = dialog.locator('.assistantMessage').last();
  assert.match(await firstAssistantReply.innerText(), /در صفحه «خانه» می‌توانی/);
  await dialog.getByRole('textbox').fill('من اضطراب دارم؛ این صفحه برای چیست؟');
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some((node) => node.innerText.includes('موضوع فعلاً فقط')));
  const personalReply = dialog.locator('.assistantMessage').last();
  assert.match(await personalReply.innerText(), /موضوع فعلاً فقط یک فرضیه اولیه است/);
  assert.doesNotMatch(await personalReply.innerText(), /در صفحه «خانه» می‌توانی/);
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
  await dialog.getByRole('textbox').fill('این صفحه برای چیست؟');
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some((node) => node.innerText.includes('برای مرور کتاب‌های موجود')));
  await dialog.getByRole('button', { name: 'متوجه شدم' }).click();
  await dialog.waitFor({ state: 'detached' });

  await page.getByRole('button', { name: 'ارتباط' }).click();
  await page.locator('.bottomNav button[data-view="support"].active').waitFor({ state: 'visible' });
  await launcher.click();
  dialog = page.getByRole('dialog', { name: 'دستیار مسیر۲۸' });
  await dialog.waitFor({ state: 'visible' });
  assert.match(await dialog.innerText(), /صفحه فعلی: پشتیبانی/);
  await dialog.getByRole('textbox').fill('این صفحه برای چیست؟');
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some((node) => node.innerText.includes('راه‌های ارتباط با مرکز')));
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });

  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    const launcherBox = await launcher.boundingBox();
    const navigationBox = await page.locator('.bottomNav').boundingBox();
    assert.ok(launcherBox && navigationBox, 'launcher and bottom navigation must remain measurable on mobile');
    assert.ok(
      launcherBox.y + launcherBox.height <= navigationBox.y,
      `launcher must not overlap bottom navigation at ${viewport.width}x${viewport.height}`,
    );

    await launcher.click();
    dialog = page.getByRole('dialog', { name: 'دستیار مسیر۲۸' });
    await dialog.waitFor({ state: 'visible' });
    const dialogBox = await dialog.boundingBox();
    assert.ok(dialogBox, 'mobile dialog must have a visible layout box');
    assert.ok(dialogBox.x >= 0 && dialogBox.x + dialogBox.width <= viewport.width, 'mobile dialog must fit horizontally');
    assert.ok(dialogBox.y >= 0 && dialogBox.y + dialogBox.height <= viewport.height, 'mobile dialog must fit vertically');
    await dialog.getByRole('button', { name: 'متوجه شدم' }).click();
    await dialog.waitFor({ state: 'detached' });
  }

  assert.deepEqual(errors, [], 'global assistant navigation must not raise uncaught page errors');
  await page.close();
  process.stdout.write('PASS: Chromium global assistant placement, daily-page shortcut, page-context disclosure, unsupported-page guard, dialog close, Escape, focus management and mobile layout (WV-BROWSER-GLOBAL-ASSISTANT)\\n');
} finally {
  await browser.close();
}
