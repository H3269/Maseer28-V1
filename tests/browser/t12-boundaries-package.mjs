import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173';
const overrides = JSON.parse(await readFile(new URL('../../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
const t12Days = overrides.categories?.['مرزبندی و نه گفتن']?.days || [];
assert.equal(t12Days.length, 28, 'T12 browser fixture must contain 28 daily overrides');
const previewBaseURL = baseURL.endsWith('/') ? baseURL : baseURL + '/';
const servedOverrides = await fetch(new URL('content/daily-text-overrides.v1.json', previewBaseURL));
assert.equal(servedOverrides.status, 200);
assert.deepEqual(await servedOverrides.json(), overrides);

const browser = await chromium.launch({ headless: true });
const startState = (day) => ({
  schema: 7,
  started: true,
  profile: true,
  assessment: true,
  completed: Array.from({ length: day - 1 }, (_, i) => i + 1),
  answers: {},
  daily: {},
  profileData: {
    problem: 'مرزبندی و نه گفتن',
    durationYears: 1,
    durationMonths: 0,
    goal: 'آزمون زنده محتوای T12',
    code: 'M28-T12-LIVE',
  },
  assessmentData: { answers: [2, 2, 2, 2, 2], total: 8, score: 4, motivation: 2, scaleMax: 4, version: 2 },
  final: null,
  archive: [],
  pathId: 't12-live-browser-check',
  startedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  lastView: 'dashboard',
});

async function openDay(page, day) {
  await page.addInitScript((state) => {
    localStorage.setItem('maseer28_onboarding_complete_v1', '1');
    // T12 content tests do not cover the separate copyright notice; start with it acknowledged.
    localStorage.setItem('maseer28_copyright_v60', '1');
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
  }, startState(day));
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  const copyright = page.locator('#copyrightModal');
  if (await copyright.count()) {
    await copyright.waitFor({ state: 'visible' });
    await copyright.getByRole('button', { name: /متوجه شدم و ورود به مسیر را ادامه می‌دهم/ }).click();
  }
  await page.locator('#dashboard').waitFor({ state: 'visible' });
  await page.locator('#dashboard .heroAction').click();
  await page.locator('#day').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'باز کردن دستیار مسیر۲۸' }).click();
  const panel = page.locator('.globalAssistantDialog');
  await panel.waitFor({ state: 'visible' });
  return panel;
}

try {
  const firstPage = await browser.newPage();
  const pageErrors = [];
  firstPage.on('pageerror', error => pageErrors.push(String(error)));
  const firstPanel = await openDay(firstPage, 1);
  const firstDay = t12Days.find(item => item.day === 1);
  assert.equal(await firstPage.locator('#dayTitle').innerText(), firstDay.title);
  assert.ok((await firstPage.locator('#dayExercise').innerText()).includes(firstDay.exercise.slice(0, 28)));
  const trigger = firstPanel.getByTestId('t12-daily-prompt-trigger');
  await trigger.waitFor({ state: 'visible' });
  await trigger.click();
  const promptDialog = firstPage.locator('#library-assistant-prompt-dialog');
  await promptDialog.waitFor({ state: 'visible' });
  assert.match(await promptDialog.innerText(), /سؤال‌های آماده روز .*مرزبندی و نه گفتن/);
  assert.equal(await promptDialog.locator('.libraryAssistantPromptGroup').count(), 5);
  assert.equal(await promptDialog.locator('[data-prompt-option]').count(), 14);
  await promptDialog.getByRole('button', { name: 'منظور از تمرین امروز چیست؟' }).click();
  await firstPanel.getByRole('button', { name: 'ارسال' }).click();
  await firstPage.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')]
    .some(node => node.innerText.includes('تشخیص یک حد شخصی')));
  const answer = await firstPanel.locator('.assistantMessage').last().innerText();
  assert.ok(answer.includes(firstDay.exercise));
  assert.equal(answer.includes('**'), false);
  assert.deepEqual(pageErrors, []);
  await firstPage.close();

  const unsafePage = await browser.newPage();
  const unsafePanel = await openDay(unsafePage, 20);
  await unsafePanel.getByTestId('t12-privacy-notice').waitFor({ state: 'visible' });
  const safetyGate = unsafePanel.getByTestId('t12-relationship-safety-gate');
  await safetyGate.waitFor({ state: 'visible' });
  assert.match(await safetyGate.innerText(), /هر دو نفر می‌توانند آزادانه گفت‌وگو را رد یا متوقف کنند/);
  assert.equal(await unsafePanel.getByTestId('t12-daily-prompt-trigger').isDisabled(), true);
  await safetyGate.getByTestId('t12-relationship-safety-unsafe').click();
  await unsafePage.waitForFunction(() => document.querySelector('[data-testid="t12-relationship-safety-gate"]')?.innerText.includes('گفت‌وگوی مستقیم، مواجهه یا مذاکره'));
  assert.equal(await safetyGate.getByTestId('t12-relationship-safety-safe').count(), 0);
  assert.equal(await unsafePanel.getByTestId('t12-daily-prompt-trigger').isDisabled(), true);
  await unsafePage.close();

  const safePage = await browser.newPage();
  const safePanel = await openDay(safePage, 20);
  const safeGate = safePanel.getByTestId('t12-relationship-safety-gate');
  await safeGate.waitFor({ state: 'visible' });
  await safeGate.getByTestId('t12-relationship-safety-safe').click();
  await safePage.waitForFunction(() => !document.querySelector('[data-testid="t12-relationship-safety-gate"]'));
  const enabledTrigger = safePanel.getByTestId('t12-daily-prompt-trigger');
  await safePage.waitForFunction(() => {
    const button = document.querySelector('[data-testid="t12-daily-prompt-trigger"]');
    return button && !button.disabled;
  });
  await enabledTrigger.click();
  await safePage.locator('#library-assistant-prompt-dialog').waitFor({ state: 'visible' });
  await safePage.locator('#library-assistant-prompt-dialog')
    .getByRole('button', { name: 'منظور از تمرین امروز چیست؟' }).click();
  await safePanel.getByRole('button', { name: 'ارسال' }).click();
  await safePage.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')]
    .some(node => node.innerText.includes('روز 20')));
  await safePage.close();

  process.stdout.write('PASS: T12 28-day visible content, 14 prepared assistant questions, and relationship-safety confirmation flow\n');
} finally {
  await browser.close();
}
