import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });

const archived = {
  schema: 7, started: true, profile: true, assessment: true,
  completed: [1], answers: { 1: 'پاسخ آرشیوشده که نباید حذف شود' },
  daily: { 1: { score: 4, feedbackText: 'ثبت آرشیوشده' } },
  profileData: { problem: 'خشم', durationYears: 1, durationMonths: 0, goal: 'هدف آرشیو', code: 'ARCHIVE-KEEP' },
  assessmentData: { answers: [2, 2, 2, 2, 2], total: 8, score: 4, motivation: 2, scaleMax: 4, version: 2 },
  final: null, archive: [], pathId: 'preserved-archive-entry',
  startedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
  archivedAt: new Date().toISOString(),
};
const journey = {
  ...archived, completed: [], answers: {}, daily: {},
  profileData: { problem: 'موضوع حذف‌شده یا نامعتبر', durationYears: 1, durationMonths: 0, goal: 'هدف مسیر فعال', code: 'ACTIVE-INVALID' },
  archive: [archived], pathId: 'invalid-active-path', lastView: 'dashboard',
};

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.addInitScript(state => {
    localStorage.setItem('maseer28_onboarding_complete_v1', '1');
    localStorage.setItem('maseer28_state', JSON.stringify(state));
    localStorage.setItem('maseer28_user_profile_v2', JSON.stringify({
      version: 2, name: 'کاربر آزمون', age: 35, gender: 'ترجیح می‌دهم نگویم',
      phone: '', medical: 'none', medicalNote: '', medication: 'no', medicationRisk: 'no',
    }));
  }, journey);
  await page.route('**/*', async route => {
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
  await page.locator('#pathSetup').waitFor({ state: 'visible', timeout: 15000 });
  assert.equal(await page.locator('#dashboard').count(), 0, 'invalid restored path must not remain on the dashboard');
  assert.equal(await page.locator('#pProblem').count(), 1, 'the user must be returned to topic selection');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('maseer28_state')));
  assert.equal(stored.profileData.problem, 'موضوع حذف‌شده یا نامعتبر', 'recovery must not silently rewrite the current path topic');
  assert.equal(stored.archive.length, 1, 'archive entries must remain intact');
  assert.equal(stored.archive[0].answers[1], 'پاسخ آرشیوشده که نباید حذف شود', 'archived answers must be preserved');
  assert.equal(stored.archive[0].daily[1].feedbackText, 'ثبت آرشیوشده', 'archived daily records must be preserved');
  assert.deepEqual(errors, [], 'invalid-path recovery must not raise browser errors');
  await page.close();
  process.stdout.write('PASS: invalid restored active path returns to topic setup while preserving archived answers and records (WV-BROWSER-INVALID-PATH-RECOVERY)\\n');
} finally {
  await browser.close();
}
