import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173';
const topic = 'بی‌خوابی و مشکلات خواب';
const canonical = JSON.parse(await readFile(new URL('../../public/content/path-content.json', import.meta.url), 'utf8'));
const overrides = JSON.parse(await readFile(new URL('../../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
const t10Draft = JSON.parse(await readFile(new URL('../../docs/T06-T34-PACKAGES/T10/T10_CANONICAL_CONTENT_DRAFT_V2_20261113.json', import.meta.url), 'utf8'));
const canonicalDays = canonical.categories?.[topic]?.days || [];
const overrideDays = overrides.categories?.[topic]?.days || [];
assert.equal(canonicalDays.length, 28, 'T10 canonical path fixture must contain 28 days');
assert.equal(overrideDays.length, 28, 'T10 override fixture must contain 28 days');
assert.equal(t10Draft.records.length, 28, 'T10 draft must contain 28 days');

// Feed the browser smoke test from the newly audited draft, not stale runtime copy.
// This remains a fixture-level rendering test; it does not claim production integration.
for (const draftDay of t10Draft.records) {
  const target = overrideDays.find(item => Number(item.day) === Number(draftDay.day));
  assert.ok(target, `T10 day ${draftDay.day} must exist in the override fixture`);
  target.exercise = draftDay.instructions;
  target.actionText = draftDay.action;
}

function normalize(value) {
  return String(value || '').normalize('NFKC')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

async function readDailyText(page, selector) {
  const section = page.locator(selector);
  const disclosure = section.locator('details.dailyTextDisclosure');
  if (await disclosure.count()) {
    const open = await disclosure.evaluate((element) => element.open);
    if (!open) await disclosure.locator('summary').click();
  }
  const preview = await section.locator('.dailyTextPreview').innerText();
  const full = await section.locator('.dailyTextFull p').allInnerTexts();
  return [preview, ...full].join(' ');
}

async function verifyDay(browser, dayNumber) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  const journey = {
    schema: 7, started: true, profile: true, assessment: true,
    completed: Array.from({ length: dayNumber - 1 }, (_, i) => i + 1),
    answers: {}, daily: {}, final: null, archive: [],
    pathId: 't10-sleep-package-browser-check',
    startedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
    lastView: 'dashboard',
    profileData: {
      problem: topic, durationYears: 1, durationMonths: 0,
      goal: 'آزمون مصنوعی نمایش محتوای خواب', code: 'T10-SLEEP-BROWSER',
    },
    assessmentData: { answers: [2, 2, 2, 2, 2], total: 8, score: 4, motivation: 2, scaleMax: 4, version: 2 },
  };
  await page.addInitScript((state) => {
    localStorage.setItem('maseer28_onboarding_complete_v1', '1');
    localStorage.setItem('maseer28_state', JSON.stringify(state));
    localStorage.setItem('maseer28_user_profile_v2', JSON.stringify({
      version: 2, name: 'کاربر مصنوعی آزمون', age: 35,
      gender: 'ترجیح می‌دهم نگویم', phone: '09123456789',
      medical: 'none', medicalNote: '', medication: 'no', medicationRisk: 'no',
    }));
  }, journey);

  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/content/daily-text-overrides.v1.json')) {
      await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(overrides) });
      return;
    }
    if (url.pathname.endsWith('/content/path-content.json')) {
      const payload = structuredClone(canonical);
      const day = payload.categories?.[topic]?.days?.find(item => Number(item.day) === dayNumber);
      assert.ok(day, `T10 day ${dayNumber} must exist in the canonical fixture`);
      const auditedDay = t10Draft.records.find(item => Number(item.day) === dayNumber);
      assert.ok(auditedDay, `T10 draft day ${dayNumber} must exist`);
      Object.assign(day, {
        topic_id: 'T10', day: dayNumber,
        review_status: auditedDay.review_status,
        risk_level: auditedDay.risk_level,
      });
      await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(payload) });
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

  const badge = normalize(await page.locator('#dayBadge').innerText());
  assert.ok(badge.includes(normalize(topic)), 'daily screen must identify T10');
  assert.ok(badge.includes('روز ' + dayNumber), 'daily screen must identify the selected T10 day');

  const source = overrideDays.find(item => Number(item.day) === dayNumber);
  const exercise = normalize(await readDailyText(page, '#dayExercise'));
  const action = normalize(await readDailyText(page, '#dayAction'));
  assert.ok(exercise.includes(normalize(source.exercise)), `T10 day ${dayNumber} exercise must match its daily override`);
  assert.ok(action.includes(normalize(source.actionText)), `T10 day ${dayNumber} action must match its daily override`);
  assert.deepEqual(errors, [], `T10 day ${dayNumber} must render without browser errors`);
  await page.close();
}

const browser = await chromium.launch({ headless: true });
try {
  for (let dayNumber = 1; dayNumber <= 28; dayNumber += 1) {
    await verifyDay(browser, dayNumber);
  }
} finally {
  await browser.close();
}
