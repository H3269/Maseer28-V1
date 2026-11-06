import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import { mergeDailyTextOverrides } from '../../src/features/content/dailyTextOverrides.js';
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });

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
    const { page, errors } = await openDay(topic, 1);
    const card = page.locator('#day');
    assert.equal(await card.locator('#dayExercise').count(), 1, topic + ' day 1 must display its exercise');
    assert.equal(await card.locator('#dayAction').count(), 1, topic + ' day 1 must display its dedicated action');
    assert.equal(await card.locator('#openDailyEntryBtn').count(), 1, topic + ' day 1 must expose the original daily interaction');
    const text = await card.innerText();
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
    assert.ok((await card.innerText()).includes(expected.exercise.slice(0, 35)));
    await card.locator('#openDailyEntryBtn').click();
    await card.locator('#dailyEntryPanel').waitFor({ state: 'visible' });
    assert.deepEqual(errors, []);
    await page.close();
  }

  process.stdout.write('PASS: all 34 topics render their daily exercise and action directly; anger days 10 and 11 remain interactive.\\n');
} finally {
  await browser.close();
}
