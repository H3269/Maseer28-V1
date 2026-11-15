import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173';
const topic = 'مرزبندی و نه گفتن';
const canonical = JSON.parse(await readFile(new URL('../../public/content/path-content.json', import.meta.url), 'utf8'));
const overrides = JSON.parse(await readFile(new URL('../../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
const dayNumber = 25;
const dayId = topic + '-25';

// Test-only fixture: this synthetic approval record exists only to reach the
// day-25 UI and exercise its safety gate. It is NOT a real owner/expert review
// and is never written to the repository's runtime content.
const testOverrides = structuredClone(overrides);
const overrideDay = testOverrides.categories?.[topic]?.days?.find(item => Number(item.day) === dayNumber);
assert.ok(overrideDay, 'T12 day 25 override must exist');
Object.assign(overrideDay, {
  review_status: 'approved',
  reviewStatus: 'approved',
  review_record_id: 'TEST-ONLY-NOT-A-REAL-REVIEW',
});

const journey = {
  schema: 7,
  started: true,
  profile: true,
  assessment: true,
  completed: Array.from({ length: dayNumber - 1 }, (_, index) => index + 1),
  answers: {},
  daily: {},
  final: null,
  archive: [],
  pathId: 't12-boundaries-safety-browser-check',
  startedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
  lastView: 'dashboard',
  profileData: {
    problem: topic,
    durationYears: 1,
    durationMonths: 0,
    goal: 'آزمون مصنوعی گیت ایمنی T12',
    code: 'T12-BOUNDARIES-BROWSER',
  },
  assessmentData: { answers: [2, 2, 2, 2, 2], total: 8, score: 4, motivation: 2, scaleMax: 4, version: 2 },
};

async function openT12Day(page) {
  await page.addInitScript((state) => {
    localStorage.setItem('maseer28_onboarding_complete_v1', '1');
    localStorage.setItem('maseer28_state', JSON.stringify(state));
    localStorage.setItem('maseer28_user_profile_v2', JSON.stringify({
      version: 2,
      name: 'کاربر مصنوعی آزمون',
      age: 35,
      gender: 'ترجیح می‌دهم نگویم',
      phone: '',
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
        body: JSON.stringify(testOverrides),
      });
      return;
    }
    if (url.pathname.endsWith('/content/path-content.json')) {
      const payload = structuredClone(canonical);
      const day = payload.categories?.[topic]?.days?.find(item => Number(item.day) === dayNumber);
      assert.ok(day, 'T12 day 25 must exist in the canonical fixture');
      Object.assign(day, {
        id: dayId,
        topic_id: 'T12',
        day: dayNumber,
        review_status: 'approved',
        risk_level: 'caution',
        subtopic_ids: ['T12-S03'],
        review_record_id: 'TEST-ONLY-NOT-A-REAL-REVIEW',
        stop_conditions: [
          'در صورت وجود تهدید یا تلافی، اقدام مستقیم برای اعلام مرز انجام نشود.',
        ],
        when_to_seek_human_support: 'در صورت تهدید یا خطر فوری، از مسیر حمایت امن و خدمات اضطراری محل زندگی کمک بگیر.',
      });
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
  assert.match(await page.locator('#dayBadge').innerText(), /مرزبندی و نه گفتن/);
  assert.match(await page.locator('#dayBadge').innerText(), /روز ۲۵|روز 25/);
  await page.locator('.globalAssistantLauncher').click();
  const panel = page.locator('.globalAssistantDialog');
  await panel.waitFor({ state: 'visible' });
  return panel;
}

const browser = await chromium.launch({ headless: true });
try {
  const unsafePage = await browser.newPage();
  const unsafeErrors = [];
  unsafePage.on('pageerror', error => unsafeErrors.push(String(error)));
  const unsafePanel = await openT12Day(unsafePage);
  await unsafePanel.getByTestId('t12-privacy-notice').waitFor({ state: 'visible' });
  const gate = unsafePanel.getByTestId('t12-relationship-safety-gate');
  await gate.waitFor({ state: 'visible' });
  assert.match(await gate.innerText(), /هر دو نفر می‌توانند آزادانه گفت‌وگو را رد یا متوقف کنند/);
  const unsafeTrigger = unsafePanel.getByTestId('t12-daily-prompt-trigger');
  assert.equal(await unsafeTrigger.isDisabled(), true);
  await gate.getByTestId('t12-relationship-safety-unsafe').click();
  await unsafePage.waitForFunction(() => document.querySelector('[data-testid="t12-relationship-safety-gate"]')?.innerText.includes('گفت‌وگوی مستقیم، مواجهه یا مذاکره'));
  assert.equal(await gate.getByTestId('t12-relationship-safety-safe').count(), 0);
  assert.equal(await unsafeTrigger.isDisabled(), true);
  assert.deepEqual(unsafeErrors, [], 'T12 unsafe branch must not raise browser errors');
  await unsafePage.close();

  const safePage = await browser.newPage();
  const safeErrors = [];
  safePage.on('pageerror', error => safeErrors.push(String(error)));
  const safePanel = await openT12Day(safePage);
  const safeGate = safePanel.getByTestId('t12-relationship-safety-gate');
  await safeGate.getByTestId('t12-relationship-safety-safe').click();
  await safePage.waitForFunction(() => !document.querySelector('[data-testid="t12-relationship-safety-gate"]'));
  const trigger = safePanel.getByTestId('t12-daily-prompt-trigger');
  await safePage.waitForFunction(() => {
    const button = document.querySelector('[data-testid="t12-daily-prompt-trigger"]');
    return Boolean(button && !button.disabled);
  });
  assert.equal(await safePanel.locator('#global-assistant-message').count(), 0,
    'T12 must remain prepared-only and must not expose free-form typing');
  await trigger.click();
  const promptDialog = safePage.locator('#library-assistant-prompt-dialog');
  await promptDialog.waitFor({ state: 'visible' });
  assert.match(await promptDialog.innerText(), /سؤال‌های آماده روز ۲۵ مرزبندی و نه گفتن/);
  assert.equal(await promptDialog.locator('.libraryAssistantPromptGroup').count(), 5);
  assert.equal(await promptDialog.locator('[data-prompt-option]').count(), 14);
  await promptDialog.getByRole('button', { name: 'اگر هنگام تمرین فشار یا ناراحتی‌ام بیشتر شد چه کنم؟' }).click();
  await safePanel.getByRole('button', { name: 'ارسال' }).click();
  await safePage.waitForFunction(() => Array.from(document.querySelectorAll('.globalAssistantDialog .assistantMessage'))
    .some(node => /راهنمای روز (?:25|۲۵) مرزبندی و نه گفتن/.test(node.innerText)));
  const reply = await safePanel.locator('.assistantMessage').last().innerText();
  assert.match(reply, /یادآوری اختصاصی ایمنی و حریم خصوصی T12/);
  assert.match(reply, /دستگاه، مرورگر یا حساب پیام‌رسان/);
  assert.doesNotMatch(reply, /مرکز هیپنوتراپی شفا/);
  assert.equal(reply.includes('**'), false, 'T12 reply must render markdown rather than raw markers');
  assert.deepEqual(safeErrors, [], 'T12 safe branch must not raise browser errors');
  await safePage.close();

  process.stdout.write('PASS: T12 day-25 privacy notice, relationship safety gate, unsafe fail-closed behavior, prepared-only 14-question UI and topic-specific safety answer (T12 browser regression)\n');
} finally {
  await browser.close();
}
