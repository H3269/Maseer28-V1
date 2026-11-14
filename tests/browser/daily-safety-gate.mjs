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
  page.on('pageerror', (error) => errors.push(String(error)));
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
  await page.locator('#copyrightModal').waitFor({ state: 'visible' });
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

  for (const topic of topics) {
    let { page, errors } = await openDay(topic, 1);
    const card = page.locator('#day');
    assert.equal(await card.locator('#dayExercise').count(), 1, topic + ' day 1 must display its exercise');
    assert.equal(await card.locator('#dayAction').count(), 1, topic + ' day 1 must display its dedicated action');
    if (topic === 'عادت‌های تکراری') {
      for (let day = 1; day <= 28; day += 1) {
        const dayCard = page.locator('#day');
        const badgeText = await page.locator('#dayBadge').innerText();
        assert.match(badgeText, new RegExp('روز ' + toPersianDigits(day) + ' از ۲۸', 'u'));
        const expected = content.categories[topic].days.find((item) => item.day === day);
        assert.ok(expected, 'T11 canonical day ' + day + ' exists');
        const visibleExercise = normalizeVisibleDailyText(await readExpandedDailyText(page, '#dayExercise'));
        const visibleAction = normalizeVisibleDailyText(await readExpandedDailyText(page, '#dayAction'));
        assert.equal(visibleExercise, normalizeVisibleDailyText(expected.exercise), 'T11 day ' + day + ' exact exercise renders');
        assert.ok(visibleAction.endsWith(normalizeVisibleDailyText(expected.actionText)), 'T11 day ' + day + ' exact action renders');
        assert.equal(await dayCard.locator('#dailySafetyStatus').count(), 0,
          'T11 must not show an owner-review or approval-block notice');
        assert.equal(await dayCard.locator('#skipDailyReviewBtn').count(), 0,
          'T11 must not use the non-scoring preview skip flow');
        assert.equal(await dayCard.locator('#openDailyEntryBtn').count(), 1,
          'T11 must expose the same daily result-entry action as T01-T10');
        assert.doesNotMatch(await dayCard.innerText(), /پیش‌نمایش برای بازبینی مالک|مشاهده مشخصات کامل این روز برای بازبینی/u);

        await dayCard.locator('#openDailyEntryBtn').click();
        await dayCard.locator('#dailyEntryPanel').waitFor({ state: 'visible' });
        assert.equal(await dayCard.locator('#dayScore').count(), 1, 'T11 day ' + day + ' exposes score input');
        assert.equal(await dayCard.locator('#dayFeedbackChoice').count(), 1, 'T11 day ' + day + ' exposes feedback input');
        assert.equal(await dayCard.locator('#answer').count(), 1, 'T11 day ' + day + ' exposes response input');

        const scoreInput = dayCard.locator('#dayScore');
        await scoreInput.focus();
        for (let step = 0; step < 4; step += 1) await scoreInput.press('ArrowRight');
        assert.equal(await scoreInput.getAttribute('data-touched'), '1',
          'T11 score slider must register a real user change');
        assert.equal(await scoreInput.inputValue(), '4');
        await dayCard.locator('.smartSelectButton').click();
        await dayCard.locator('.smartSelectOption').filter({ hasText: 'تقریباً مثل قبل' }).click();
        assert.equal(await dayCard.locator('#dayFeedbackChoice').inputValue(), 'same');
        await dayCard.locator('#answer').fill('امروز تمرین روز ' + toPersianDigits(day) + ' را انجام دادم و نتیجه را ثبت کردم.');
        await dayCard.getByRole('button', { name: /ثبت امروز و دریافت نتیجه/u }).click();
        await page.locator('#dailyResult').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#resultScore').count(), 1,
          'T11 day ' + day + ' must complete and render the normal result screen');

        if (day < 28) {
          const nextLabel = new RegExp('رفتن به روز ' + toPersianDigits(day + 1), 'u');
          assert.equal(await page.getByRole('button', { name: nextLabel }).count(), 1,
            'T11 day ' + day + ' must expose the normal next-day action');
          await page.getByRole('button', { name: nextLabel }).click();
          await page.locator('#dayBadge').waitFor({ state: 'visible' });
        } else {
          assert.equal(await page.getByRole('button', { name: /رفتن به ارزیابی نهایی/u }).count(), 1,
            'T11 day 28 must expose the normal final-assessment action');
        }
        assert.deepEqual(errors, [], 'T11 day ' + day + ' must not raise browser errors');
      }
      await page.close();
      continue;
    }
    assert.equal(await card.locator('#openDailyEntryBtn').count(), 1, topic + ' day 1 must expose the original daily interaction');
    const text = await card.innerText();
    const expected = content.categories[topic].days.find((item) => item.day === 1);
    const visibleExercise = normalizeVisibleDailyText(await readExpandedDailyText(page, '#dayExercise'));
    const visibleAction = normalizeVisibleDailyText(await readExpandedDailyText(page, '#dayAction'));
    assert.equal(visibleExercise, normalizeVisibleDailyText(expected.exercise), topic + ' day 1 must render its exact overlay exercise');
    assert.ok(visibleAction.endsWith(normalizeVisibleDailyText(expected.actionText)), topic + ' day 1 must render its exact overlay action after the topic context prefix');
    assert.doesNotMatch(text, /این تمرین در نسخه فعلی قابل اجرا نیست|نیازمند بازبینی انسانی|آیا در این رابطه یا تعامل، هر دو نفر می‌توانند آزادانه/);
    await card.locator('#openDailyEntryBtn').click();
    await card.locator('#dailyEntryPanel').waitFor({ state: 'visible' });
    assert.deepEqual(errors, [], topic + ' must not raise browser errors');
    await page.close();
  }

  for (const day of [10, 11]) {
    const { page, errors } = await openDay('خشم', day);
    const card = page.locator('#day');
    assert.equal(await card.locator('#dayExercise').count(), 1);
    assert.equal(await card.locator('#dayAction').count(), 1);
    assert.equal(await card.locator('#openDailyEntryBtn').count(), 1);
    const expected = content.categories['خشم'].days.find((item) => item.day === day);
    const visibleExercise = normalizeVisibleDailyText(await readExpandedDailyText(page, '#dayExercise'));
    const visibleAction = normalizeVisibleDailyText(await readExpandedDailyText(page, '#dayAction'));
    assert.equal(visibleExercise, normalizeVisibleDailyText(expected.exercise), 'anger day ' + day + ' must render its exact overlay exercise');
    assert.ok(visibleAction.endsWith(normalizeVisibleDailyText(expected.actionText)), 'anger day ' + day + ' must render its exact overlay action after the topic context prefix');
    await card.locator('#openDailyEntryBtn').click();
    await card.locator('#dailyEntryPanel').waitFor({ state: 'visible' });
    assert.deepEqual(errors, []);
    await page.close();
  }

  process.stdout.write('PASS: all 34 topics render their daily exercise and action directly; anger days 10 and 11 remain interactive.\\n');
} finally {
  await browser.close();
}
