import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173/Maseer28-V1/';
const canonicalPathContent = JSON.parse(await readFile(new URL('../../public/content/path-content.json', import.meta.url), 'utf8'));
const dailyTextOverrides = JSON.parse(await readFile(new URL('../../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));

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
    goal: 'هدف مصنوعی برای آزمون کادر ایمنی دستیار',
    code: 'M28-T01-SAFETY-CARD',
  },
  assessmentData: { answers: [2, 2, 2, 2, 2], total: 8, score: 4, motivation: 2, scaleMax: 4, version: 2 },
  final: null,
  archive: [],
  pathId: 'daily-assistant-safety-card-browser-check',
  startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  lastView: 'dashboard',
};

async function openAngerDay(page) {
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
    if (url.pathname.endsWith('/content/daily-text-overrides.v1.json')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(dailyTextOverrides),
      });
      return;
    }
    if (url.pathname.endsWith('/content/path-content.json')) {
      const payload = structuredClone(canonicalPathContent);
      const day = payload.categories?.['خشم']?.days?.find((item) => Number(item.day) === 1);
      assert.ok(day, 'the browser fixture must contain anger day one');
      Object.assign(day, { topic_id: 'T01', day: 1, review_status: 'approved', risk_level: 'routine' });
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
      });
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
  await page.locator('#copyrightModal').getByRole('button', { name: /متوجه شدم و ورود به مسیر را ادامه می‌دهم/ }).click();
  await page.locator('#dashboard').waitFor({ state: 'visible' });
  await page.locator('#dashboard .heroAction').click();
  await page.locator('#day').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'باز کردن دستیار مسیر۲۸' }).click();
  const panel = page.locator('.globalAssistantDialog');
  await panel.waitFor({ state: 'visible' });
  return panel;
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  const panel = await openAngerDay(page);
  const trigger = panel.getByTestId('anger-daily-prompt-trigger');

  const questions = [
    'اگر هنگام تمرین فشار یا ناراحتی‌ام بیشتر شد چه کنم؟',
    'آیا لازم است حتماً با فرد دیگری صحبت کنم؟',
    'از کجا بفهمم درست انجامش داده‌ام؟',
    'چه زمانی باید تمرین امروز را متوقف کنم؟',
  ];

  for (const question of questions) {
    await trigger.click();
    const prompt = page.locator('#library-assistant-prompt-dialog');
    await prompt.waitFor({ state: 'visible' });
    await prompt.getByRole('button', { name: question }).click();
    const previousCount = await panel.locator('.assistantMessage').count();
    await panel.getByRole('button', { name: 'ارسال' }).click();
    await page.waitForFunction((previous) => {
      const replies = [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')];
      return replies.length > previous && !replies.at(-1).innerText.includes('در حال بررسی پرسش');
    }, previousCount, { timeout: 15000 });

    const reply = panel.locator('.assistantMessage').last();
    const safetyCard = reply.getByTestId('daily-assistant-safety-reminder');
    assert.equal(await safetyCard.count(), 1, 'each of the four T01 safety/evaluation answers must show one outer safety card');
    assert.match(await safetyCard.innerText(), /یادآوری مهم درباره ایمنی شما/u);
    assert.doesNotMatch(await safetyCard.innerText(), /۰۹۱۹۰۸۸۹۰۶۲/u, 'the contact-number box must not appear inside the safety card');
    assert.equal(await safetyCard.locator('.dailyAssistantSafetyReminderShafa').count(), 0);

    const colors = await safetyCard.evaluate((node) => {
      const card = getComputedStyle(node);
      const heading = getComputedStyle(node.querySelector('h3'));
      const message = getComputedStyle(node.closest('.assistantMessage'));
      return {
        background: card.backgroundColor,
        border: card.borderTopColor,
        heading: heading.color,
        messageBackground: message.backgroundColor,
      };
    });
    assert.notEqual(colors.background, 'rgba(0, 0, 0, 0)', 'the main safety card must have a visible background');
    assert.notEqual(colors.background, colors.messageBackground, 'the safety card must be distinct from the assistant message but coordinated with its palette');
    assert.notEqual(colors.border, 'rgba(0, 0, 0, 0)', 'the main safety card must retain a visible border');
    assert.ok(colors.heading && colors.heading !== 'rgba(0, 0, 0, 0)', 'the safety heading must remain visible');
  }

  assert.deepEqual(pageErrors, [], 'T01 safety-card browser flow must not raise page errors');
  process.stdout.write('PASS: T01 four safety/evaluation answers retain one coordinated outer safety card, omit the nested contact-number box, and render distinct card colors.\\n');
  await page.close();
} finally {
  await browser.close();
}
