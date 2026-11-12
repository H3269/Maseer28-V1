import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173';
const pathContent = JSON.parse(await readFile(new URL('../../public/content/path-content.json', import.meta.url), 'utf8'));
const overrides = JSON.parse(await readFile(new URL('../../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ headless: true });

function journey(day) {
  return {
    schema: 7,
    started: true,
    profile: true,
    assessment: true,
    completed: Array.from({ length: day - 1 }, (_, i) => i + 1),
    answers: {},
    daily: {},
    profileData: {
      problem: 'وابستگی عاطفی',
      durationYears: 1,
      durationMonths: 0,
      goal: 'آزمون مرورگر T08',
      code: 'M28-T08-BROWSER',
    },
    assessmentData: { answers: [2, 2, 2, 2, 2], total: 8, score: 4, motivation: 2, scaleMax: 4, version: 2 },
    final: null,
    archive: [],
    pathId: 't08-assistant-browser-check-' + day,
    startedAt: new Date(Date.now() - Math.max(12, day + 1) * 24 * 60 * 60 * 1000).toISOString(),
    lastView: 'dashboard',
  };
}

async function openT08Day(page, day) {
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
  }, journey(day));
  await page.addInitScript(async ({ basePath, marker }) => {
    const cache = await caches.open('maseer28-local-model-state-v1');
    const markerUrl = new URL(`${basePath}local-model/qwen3-0.6b-ready.json`, location.origin);
    await cache.put(markerUrl.href, new Response(JSON.stringify(marker), {
      headers: { 'content-type': 'application/json' },
    }));
  }, {
    basePath: new URL(baseURL).pathname,
    marker: {
      modelId: 'onnx-community/Qwen3-0.6B-Instruct-ONNX',
      revision: '54250909aca286a05b9d013c8af7a21859ee6ead',
    },
  });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/content/daily-text-overrides.v1.json')) {
      await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(overrides) });
      return;
    }
    if (url.pathname.endsWith('/content/path-content.json')) {
      const payload = structuredClone(pathContent);
      const record = payload.categories?.['وابستگی عاطفی']?.days?.find((item) => Number(item.day) === day);
      assert.ok(record, 'T08 canonical fixture must contain day ' + day);
      Object.assign(record, { topic_id: 'T08', day, review_status: 'approved', risk_level: 'routine' });
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
  await page.getByRole('button', { name: 'باز کردن دستیار مسیر۲۸' }).click();
  const panel = page.locator('.globalAssistantDialog');
  await panel.waitFor({ state: 'visible' });
  return panel;
}

try {
  const dayOnePage = await browser.newPage();
  const errors = [];
  dayOnePage.on('pageerror', (error) => errors.push(String(error)));
  const dayOnePanel = await openT08Day(dayOnePage, 1);
  const trigger = dayOnePanel.getByTestId('emotional-dependency-daily-prompt-trigger');
  await trigger.waitFor({ state: 'visible' });
  await trigger.click();
  const prompt = dayOnePage.locator('#library-assistant-prompt-dialog');
  await prompt.waitFor({ state: 'visible' });
  await prompt.getByRole('button', { name: 'منظور از تمرین امروز چیست؟' }).click();
  await dayOnePanel.getByRole('button', { name: 'ارسال' }).click();
  await dayOnePage.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')]
    .some((node) => node.innerText.includes('راهنمای روز ۱ وابستگی عاطفی')));
  const dayOneReply = await dayOnePanel.locator('.assistantMessage').last().innerText();
  assert.match(dayOneReply, /نقشه اتکای عاطفی/);
  const normalizedReply = dayOneReply.normalize('NFKC').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ');
  const normalizedExercise = overrides.categories['وابستگی عاطفی'].days[0].exercise.normalize('NFKC').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ');
  assert.ok(normalizedReply.includes(normalizedExercise),
    'T08 assistant must use the same exercise text shown by the daily content source');
  assert.deepEqual(errors, [], 'T08 day 1 must not raise browser errors');
  await dayOnePage.close();

  const gatedPage = await browser.newPage();
  const gatedPanel = await openT08Day(gatedPage, 6);
  const gate = gatedPanel.getByTestId('emotional-dependency-relationship-safety-gate');
  await gate.waitFor({ state: 'visible' });
  const gatedTrigger = gatedPanel.getByTestId('emotional-dependency-daily-prompt-trigger');
  await gatedTrigger.waitFor({ state: 'visible' });
  assert.equal(await gatedTrigger.isDisabled(), true, 'prepared prompts must remain unavailable until the relationship safety check is answered');
  await gate.getByTestId('emotional-dependency-relationship-safety-safe').click();
  await gatedPage.waitForFunction(() => {
    const button = document.querySelector('[data-testid="emotional-dependency-daily-prompt-trigger"]');
    return button && !button.disabled;
  });
  await gatedTrigger.click();
  const gatedPrompt = gatedPage.locator('#library-assistant-prompt-dialog');
  await gatedPrompt.waitFor({ state: 'visible' });
  await gatedPrompt.getByRole('button', { name: 'منظور از تمرین امروز چیست؟' }).click();
  await gatedPanel.getByRole('button', { name: 'ارسال' }).click();
  await gatedPage.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')]
    .some((node) => node.innerText.includes('راهنمای روز ۶ وابستگی عاطفی')));
  await gatedPage.close();

  // Every other T08 relationship-communication day must fail closed and remain blocked
  // when either person is unsure or feels pressured.
  for (const day of [11, 15, 24]) {
    const safetyPage = await browser.newPage();
    const safetyPanel = await openT08Day(safetyPage, day);
    const safetyGate = safetyPanel.getByTestId('emotional-dependency-relationship-safety-gate');
    await safetyGate.waitFor({ state: 'visible' });
    const safetyTrigger = safetyPanel.getByTestId('emotional-dependency-daily-prompt-trigger');
    await safetyTrigger.waitFor({ state: 'visible' });
    assert.equal(await safetyTrigger.isDisabled(), true,
      'T08 day ' + day + ' prepared prompts must wait for explicit safety confirmation');
    await safetyGate.getByTestId('emotional-dependency-relationship-safety-unsafe').click();
    await safetyPage.waitForFunction(() =>
      document.querySelector('[data-testid="emotional-dependency-relationship-safety-unsafe"]') === null);
    assert.equal(await safetyTrigger.isDisabled(), true,
      'T08 day ' + day + ' must remain blocked when safety is uncertain or pressured');
    await safetyPage.close();
  }

  const privacyPage = await browser.newPage();
  const privacyPanel = await openT08Day(privacyPage, 12);
  await privacyPanel.getByTestId('emotional-dependency-privacy-notice').waitFor({ state: 'visible' });
  assert.match(await privacyPanel.getByTestId('emotional-dependency-privacy-notice').innerText(), /رمزگذاری نمی‌کند/);
  await privacyPage.close();

  const privacyDay18Page = await browser.newPage();
  const privacyDay18Panel = await openT08Day(privacyDay18Page, 18);
  await privacyDay18Panel.getByTestId('emotional-dependency-privacy-notice').waitFor({ state: 'visible' });
  assert.match(await privacyDay18Panel.getByTestId('emotional-dependency-privacy-notice').innerText(), /نظارت|حریم خصوصی/);
  await privacyDay18Page.close();

  process.stdout.write('PASS: Chromium T08 prepared assistant, canonical day routing, exact visible source use, all relationship safety gates and both privacy notices\n');
} finally {
  await browser.close();
}
