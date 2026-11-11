import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173';
const canonicalPathContent = JSON.parse(await readFile(new URL('../../public/content/path-content.json', import.meta.url), 'utf8'));
const dailyTextOverrides = JSON.parse(await readFile(new URL('../../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
const topicKey = 'غم و سوگ';
const dayNumber = 1;
const previewBaseURL = baseURL.endsWith('/') ? baseURL : `${baseURL}/`;
const servedOverrideResponse = await fetch(new URL('content/daily-text-overrides.v1.json', previewBaseURL));
assert.equal(servedOverrideResponse.status, 200);
assert.deepEqual(await servedOverrideResponse.json(), dailyTextOverrides);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(String(error)));

const journey = {
  schema: 7,
  started: true,
  profile: true,
  assessment: true,
  completed: [],
  answers: {},
  daily: {},
  profileData: {
    problem: topicKey,
    durationYears: 1,
    durationMonths: 0,
    goal: 'هدف مصنوعی برای آزمون رابط دستیار سوگ و فقدان',
    code: 'M28-T06-ASSISTANT-BROWSER',
  },
  assessmentData: { answers: [2, 2, 2, 2, 2], total: 8, score: 4, motivation: 2, scaleMax: 4, version: 2 },
  final: null,
  archive: [],
  pathId: 't06-grief-assistant-browser-check',
  startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  lastView: 'dashboard',
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
    await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(dailyTextOverrides) });
    return;
  }
  if (url.pathname.endsWith('/content/path-content.json')) {
    const payload = structuredClone(canonicalPathContent);
    const day = payload.categories?.[topicKey]?.days?.find(item => Number(item.day) === dayNumber);
    assert.ok(day, 'the canonical fixture must contain T06 day 1');
    assert.equal(Object.hasOwn(day, 'topic_id'), false);
    assert.equal(Object.hasOwn(day, 'review_status'), false);
    assert.equal(Object.hasOwn(day, 'risk_level'), false);
    await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(payload) });
    return;
  }
  if (url.searchParams.has('_m28_time')) {
    await route.fulfill({ status: 200, headers: { date: new Date().toUTCString() } });
    return;
  }
  await route.continue();
});

try {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('#copyrightModal').waitFor({ state: 'visible' });
  await page.locator('#copyrightModal').getByRole('button', { name: /متوجه شدم و ورود به مسیر را ادامه می‌دهم/ }).click();
  await page.locator('#dashboard').waitFor({ state: 'visible' });
  await page.locator('#dashboard .heroAction').click();
  await page.locator('#day').waitFor({ state: 'visible' });
  const dayText = await page.locator('#day').innerText();
  assert.match(dayText, /نام‌گذاری فقدان/);
  assert.match(dayText, /هدف: به‌رسمیت‌شناختن فقدان بدون اجبار به جزئیات/);
  assert.match(dayText, /معیار پایان:/);
  assert.match(dayText, /شرط توقف:/);
  await page.getByRole('button', { name: 'باز کردن دستیار مسیر۲۸' }).click();

  const panel = page.locator('.globalAssistantDialog');
  await panel.waitFor({ state: 'visible' });
  assert.equal(await panel.locator('#global-assistant-message').count(), 0,
    'T06 must remain prepared-only and must not expose free-form typing');
  assert.equal(await panel.getByRole('button', { name: 'نصب مدل هوش مصنوعی محلی' }).count(), 0,
    'T06 must not expose local model installation');

  const trigger = panel.getByTestId('grief-daily-prompt-trigger');
  await trigger.waitFor({ state: 'visible' });
  assert.match(await trigger.getAttribute('aria-label'), /غم و سوگ/);
  await trigger.click();

  const promptDialog = page.locator('#library-assistant-prompt-dialog');
  await promptDialog.waitFor({ state: 'visible' });
  assert.match(await promptDialog.innerText(), /سؤال‌های آماده روز ۱ غم و سوگ/);
  assert.equal(await promptDialog.locator('.libraryAssistantPromptGroup').count(), 5);
  assert.equal(await promptDialog.locator('[data-prompt-option]').count(), 14);

  await promptDialog.getByRole('button', { name: 'برای تمرین امروز یک مثال می‌زنی؟' }).click();
  await panel.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')]
    .some(node => node.innerText.includes('راهنمای روز ۱ غم و سوگ')));
  const answer = await panel.locator('.assistantMessage').last().innerText();
  assert.match(answer, /مثال فرضی و مستقل از زندگی واقعی تو/);
  assert.match(answer, /پس از از دست‌دادن شغل/);
  assert.match(answer, /نام فقدان/);
  assert.ok(await panel.locator('.assistantMessage').last().locator('strong').count() > 0);
  assert.equal(answer.includes('**'), false, 'T06 must not expose raw markdown markers');
  assert.equal(answer.includes(String.fromCharCode(92) + 'n'), false, 'T06 must not expose escaped newline tokens');
  assert.ok(answer.includes('\n'), 'T06 answer paragraphs must render on separate lines');

  await panel.getByTestId('grief-daily-prompt-trigger').click();
  await page.locator('#library-assistant-prompt-dialog')
    .getByRole('button', { name: 'اگر غم یا آشفتگی‌ام بیشتر شد چه کنم؟' }).click();
  await panel.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')]
    .some(node => node.innerText.includes('اگر غم یا آشفتگی بیشتر شد')));
  assert.ok(await panel.locator('[data-testid="daily-assistant-safety-reminder"]').count() >= 1,
    'T06 increased-distress FAQ must append the shared safety reminder');

  await panel.getByTestId('grief-daily-prompt-trigger').click();
  await page.locator('#library-assistant-prompt-dialog')
    .getByRole('button', { name: 'اگر انجام کاملش برایم سخت بود چه کنم؟' }).click();
  await panel.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')]
    .some(node => node.innerText.includes('نسخه سبک تمرین امروز')));
  const variantsAnswer = await panel.locator('.assistantMessage').last().innerText();
  const dayOneOverride = dailyTextOverrides.categories[topicKey].days[0];
  assert.ok(variantsAnswer.includes(dayOneOverride.lightExerciseText));
  assert.ok(variantsAnswer.includes(dayOneOverride.lightActionText));
  assert.ok(variantsAnswer.includes(dayOneOverride.progressActionText));
  assert.ok(variantsAnswer.includes(dayOneOverride.restExerciseText));
  assert.ok(variantsAnswer.includes(dayOneOverride.restActionText));

  assert.deepEqual(pageErrors, [], 'T06 prepared-only assistant browser flow must not raise page errors');
  process.stdout.write('PASS: T06 grief and loss prepared-only assistant UI, 14 prepared questions, teacher-style answer and safety reminder\n');
} finally {
  await browser.close();
}
