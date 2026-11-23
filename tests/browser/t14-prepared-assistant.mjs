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

  let previousAssistantCount = await dialog.locator('.assistantMessage').count();
  for (let questionIndex = 0; questionIndex < 14; questionIndex += 1) {
    if (questionIndex > 0) {
      await trigger.click();
      await picker.waitFor({ state: 'visible' });
    }
    await options.nth(questionIndex).click();
    await dialog.getByRole('button', { name: 'ارسال' }).click();

    const latestReply = dialog.locator('.assistantMessage').last();
    const latestIcon = latestReply.locator('.globalAssistantSpeakerIcon');
    try {
      await page.waitForFunction((previousCount) => {
        const replies = [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')];
        return replies.length > previousCount;
      }, previousAssistantCount, { timeout: 10000 });
      await page.waitForFunction(() => {
        const icon = document.querySelector('.globalAssistantDialog .assistantMessage:last-child .globalAssistantSpeakerIcon');
        return icon?.getAttribute('data-assistant-state') === 'typing';
      }, null, { timeout: 10000 });
      await page.waitForFunction(() => {
        const icon = document.querySelector('.globalAssistantDialog .assistantMessage:last-child .globalAssistantSpeakerIcon');
        return icon?.getAttribute('data-assistant-state') === 'idle';
      }, null, { timeout: 20000 });
    } catch (error) {
      console.error('T14_QUESTION_INDEX', questionIndex);
      console.error('T14_MESSAGES', JSON.stringify(await dialog.locator('.assistantMessage').allInnerTexts()));
      console.error('T14_ERRORS', JSON.stringify(errors));
      throw error;
    }

    const replyText = await latestReply.innerText();
    assert.ok(replyText.trim().length > 20,
      `T14 prepared question ${questionIndex + 1} must receive a complete, nonempty answer`);
    assert.doesNotMatch(replyText, /در حال بررسی پرسش/u,
      `T14 prepared question ${questionIndex + 1} must not leave the pending placeholder visible`);
    const iconColor = await latestIcon.evaluate((element) => getComputedStyle(element).color);
    assert.equal(iconColor, 'rgb(196, 154, 66)',
      'the assistant icon must use the soft gold accent');
    const iconAnimation = await latestIcon.evaluate((element) => getComputedStyle(element).animationName);
    assert.equal(iconAnimation, 'none',
      'the assistant icon must stop breathing after the complete answer is revealed');
    previousAssistantCount = await dialog.locator('.assistantMessage').count();
    assert.equal(await dialog.getByTestId('t14-daily-prompt-trigger').count(), 1,
      'the T14 prepared-question trigger must remain available after answering');
  }
  assert.deepEqual(errors, [], 'the T14 browser flow must not emit page or console errors');
  console.log('PASS: Chromium displayed all 14 T14 prepared questions, revealed each answer word by word, and stopped the gold icon after each answer.');
} finally {
  await browser.close();
}
