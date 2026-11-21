import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import { mergeDailyTextOverrides } from '../../src/features/content/dailyTextOverrides.js';
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });

function toPersianDigits(value) {
  return String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
}

function normalizeVisibleDailyText(value) {
  return String(value || '').normalize('NFKC')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

async function readExpandedDailyText(page, selector) {
  const section = page.locator(selector);
  const disclosure = section.locator('details.dailyTextDisclosure');
  if (await disclosure.count()) await disclosure.locator('summary').click();
  const preview = await section.locator('.dailyTextPreview').innerText();
  const remaining = await section.locator('.dailyTextFull p').allInnerTexts();
  return [preview, ...remaining].join(' ');
}

function makeState(problem, completedDays = []) {
  const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const daily = Object.fromEntries(completedDays.map((day) => [day, {
    score: 4, feedback: 'same', feedbackText: 'ثبت آزمایشی قبلی', updatedAt: old,
  }]));
  return {
    schema: 7, started: true, profile: true, assessment: true,
    completed: completedDays, answers: {}, daily,
    profileData: { problem, durationYears: 1, durationMonths: 0, goal: 'هدف آزمایشی', code: 'M28-DIRECT' },
    assessmentData: { answers: [2, 2, 2, 2, 2], total: 8, score: 4, motivation: 2, scaleMax: 4, version: 2 },
    final: null, archive: [], pathId: 'direct-' + problem, startedAt: old, lastView: 'dashboard',
  };
}

async function openDay(problem, day) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const failedRequests = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', (request) => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText || 'failed'}`));
  const completed = Array.from({ length: day - 1 }, (_, index) => index + 1);
  await page.addInitScript((state) => {
    localStorage.setItem('maseer28_onboarding_complete_v1', '1');
    localStorage.setItem('maseer28_state', JSON.stringify(state));
    localStorage.setItem('maseer28_user_profile_v2', JSON.stringify({
      version: 2, name: 'کاربر آزمایشی', age: 35, gender: 'زن', phone: '09123456789',
      medical: 'none', medicalNote: '', medication: 'no', medicationRisk: 'no',
    }));
  }, makeState(problem, completed));
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  try {
    await page.locator('#copyrightModal').waitFor({ state: 'visible' });
  } catch (error) {
    console.error('STARTUP_PAGE_ERRORS', JSON.stringify(errors));
    console.error('STARTUP_FAILED_REQUESTS', JSON.stringify(failedRequests));
    console.error('STARTUP_BODY_TEXT', await page.locator('body').innerText().catch(() => 'unavailable'));
    throw error;
  }
  await page.locator('#copyrightModal').getByRole('button', { name: /متوجه شدم و ورود به مسیر را ادامه می‌دهم/ }).click();
  await page.locator('#dashboard').waitFor({ state: 'visible' });
  await page.locator('#dashboard .heroAction').click();
  await page.locator('#day').waitFor({ state: 'visible' });
  return { page, errors };
}

try {
  const [baseContent, overrides] = await Promise.all([
    readFile(new URL('../../public/content/path-content.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  const content = mergeDailyTextOverrides(baseContent, overrides);
  const topics = Object.keys(content.categories);
  assert.equal(topics.length, 34);

  async function assertDailyContentVisible(topic, day) {
    const { page, errors } = await openDay(topic, day);
    const card = page.locator('#day');
    assert.equal(await card.locator('#ownerApprovalPending').count(), 0,
      topic + ' day ' + day + ' must not show an internal approval status');
    assert.equal(await card.locator('#dayExercise').count(), 1,
      topic + ' day ' + day + ' must display its exercise');
    assert.equal(await card.locator('#dayAction').count(), 1,
      topic + ' day ' + day + ' must display its dedicated action');
    assert.equal(await card.locator('#openDailyEntryBtn').count(), 1,
      topic + ' day ' + day + ' must expose daily interaction');
    const launcher = page.getByRole('button', { name: 'باز کردن دستیار مسیر۲۸' });
    await launcher.click();
    const dialog = page.locator('.globalAssistantDialog');
    await dialog.waitFor({ state: 'visible' });
    assert.ok(await dialog.locator('[data-prompt-option]').count() > 0,
      topic + ' day ' + day + ' must expose its prepared assistant questions');
    assert.doesNotMatch(await dialog.innerText(), /تأیید مستقیم دکتر عابدی|هنوز سؤال آماده‌ای برای این بخش ثبت نشده است/u);
    assert.deepEqual(errors, [], topic + ' day ' + day + ' must not raise browser errors');
    await page.close();
  }

  for (const topic of topics) {
    await assertDailyContentVisible(topic, 1);
    const { page, errors } = await openDay(topic, 1);
    const card = page.locator('#day');
    assert.equal(await card.locator('#dayExercise').count(), 1, topic + ' day 1 must display its exercise');
    assert.equal(await card.locator('#dayAction').count(), 1, topic + ' day 1 must display its dedicated action');
    assert.equal(await card.locator('#openDailyEntryBtn').count(), 1, topic + ' day 1 must expose the original daily interaction');
    const expected = content.categories[topic].days.find((item) => item.day === 1);
    const visibleExercise = normalizeVisibleDailyText(await readExpandedDailyText(page, '#dayExercise'));
    const visibleAction = normalizeVisibleDailyText(await readExpandedDailyText(page, '#dayAction'));
    assert.equal(visibleExercise, normalizeVisibleDailyText(expected.exercise), topic + ' day 1 must render its exact overlay exercise');
    assert.ok(visibleAction.endsWith(normalizeVisibleDailyText(expected.actionText)), topic + ' day 1 must render its exact overlay action after the topic context prefix');
    assert.doesNotMatch(await card.innerText(), /این تمرین در نسخه فعلی قابل اجرا نیست|نیازمند بازبینی انسانی|آیا در این رابطه یا تعامل، هر دو نفر می‌توانند آزادانه/);
    await card.locator('#openDailyEntryBtn').click();
    await card.locator('#dailyEntryPanel').waitFor({ state: 'visible' });
    assert.deepEqual(errors, [], topic + ' must not raise browser errors');
    await page.close();
  }

  // Verify all 28 days of a representative topic and additional T01 days.
  for (let day = 1; day <= 28; day += 1) {
    await assertDailyContentVisible('عادت‌های تکراری', day);
  }
  for (const day of [10, 11]) {
    await assertDailyContentVisible('خشم', day);
  }

  process.stdout.write('PASS: daily content and prepared assistant are visible without an internal approval gate; daily interactions remain available.\\n');
} finally {
  await browser.close();
}
