import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173';
const canonicalPathContent = JSON.parse(await readFile(new URL('../../public/content/path-content.json', import.meta.url), 'utf8'));
const dailyTextOverrides = JSON.parse(await readFile(new URL('../../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
const previewBaseURL = baseURL.endsWith('/') ? baseURL : `${baseURL}/`;
const servedOverrideResponse = await fetch(new URL('content/daily-text-overrides.v1.json', previewBaseURL));
assert.equal(servedOverrideResponse.status, 200, 'the production preview must serve the daily text override asset');
assert.deepEqual(
  await servedOverrideResponse.json(),
  dailyTextOverrides,
  'the production preview daily text override asset must match the checked-in browser fixture',
);
const browser = await chromium.launch({ headless: true });

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
    goal: 'هدف مصنوعی برای آزمون رابط دستیار',
    code: 'M28-ASSISTANT-BROWSER',
  },
  assessmentData: { answers: [2, 2, 2, 2, 2], total: 8, score: 4, motivation: 2, scaleMax: 4, version: 2 },
  final: null,
  archive: [],
  pathId: 'daily-assistant-browser-check',
  startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  lastView: 'dashboard',
};

async function openDay(page, { assistantDayMode = 'routine', problem = null, localModelInstalled = false } = {}) {
  const isLegacyMode = assistantDayMode === 'legacy' || assistantDayMode.startsWith('adaptedLegacy');
  const dayNumber = assistantDayMode === 'jealousy-communication'
    ? 16
    : assistantDayMode === 'relationship'
      ? 10
    : ['adaptedLegacyStreak', 'adaptedLegacyImprovement', 'adaptedAnxietyStreak', 'adaptedAnxietyImprovement'].includes(assistantDayMode)
      ? 3
      : ['adaptedLegacy', 'adaptedLegacySame', 'adaptedAnxiety'].includes(assistantDayMode)
        ? 2
        : isLegacyMode ? 2 : 1;
  const topicKey = problem || (isLegacyMode ? 'غم و سوگ' : 'خشم');
  const adaptationHistory = ['adaptedLegacy', 'adaptedAnxiety'].includes(assistantDayMode)
    ? { 1: { feedback: 'hard', score: 8 } }
    : ['adaptedLegacyStreak', 'adaptedAnxietyStreak'].includes(assistantDayMode)
      ? { 1: { feedback: 'hard', score: 8 }, 2: { feedback: 'worse', score: 9 } }
      : ['adaptedLegacyImprovement', 'adaptedAnxietyImprovement'].includes(assistantDayMode)
        ? { 1: { feedback: 'better', score: 3 }, 2: { feedback: 'better', score: 4 } }
        : assistantDayMode === 'adaptedLegacySame'
          ? { 1: { feedback: 'same', score: 5 } }
          : {};
  const testJourney = dayNumber === 1 && topicKey === journey.profileData.problem ? journey : {
    ...journey,
    profileData: { ...journey.profileData, problem: topicKey },
    completed: Array.from({ length: dayNumber - 1 }, (_, index) => index + 1),
    daily: adaptationHistory,
    startedAt: new Date(Date.now() - Math.max(12, dayNumber + 1) * 24 * 60 * 60 * 1000).toISOString(),
  };
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
  }, testJourney);

  if (localModelInstalled) {
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
  }

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/content/daily-text-overrides.v1.json')) {
      const overrideDay = dailyTextOverrides.categories?.[topicKey]?.days?.find((item) => Number(item.day) === dayNumber);
      if (assistantDayMode.startsWith('adaptedAnxiety') || assistantDayMode.startsWith('adaptedLegacy')) {
        assert.ok(overrideDay, 'the deterministic browser fixture must contain the selected topic override');
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(dailyTextOverrides),
      });
      return;
    }
    if (url.pathname.endsWith('/content/path-content.json')) {
      // Use the checked-in fixture directly: repeatedly proxying the large path JSON
      // through Chromium's route.fetch caused intermittent preview-server socket resets.
      const payload = structuredClone(canonicalPathContent);
      const day = payload.categories?.[topicKey]?.days?.find((item) => Number(item.day) === dayNumber);
      assert.ok(day, 'the deterministic browser fixture must contain the selected topic day');
      if (isLegacyMode) {
        assert.equal(Object.hasOwn(day, 'topic_id'), false);
        assert.equal(Object.hasOwn(day, 'review_status'), false);
        assert.equal(Object.hasOwn(day, 'risk_level'), false);
      } else {
        Object.assign(day, {
          topic_id: topicKey === 'اضطراب' ? 'T02' : topicKey === 'ترس' ? 'T03' : topicKey === 'نفرت' ? 'T04' : topicKey === 'حسادت' ? 'T05' : 'T01',
          day: dayNumber,
          review_status: assistantDayMode === 'blocked' ? 'draft' : 'approved',
          risk_level: 'routine',
        });
      }
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
  await page.getByRole('dialog', { name: 'دستیار راهنمای مسیر ۲۸' }).waitFor({ state: 'visible' });
}

try {
    // T05 jealousy uses its own prepared-only 28-day assistant and distinct examples.
    const jealousyGuidedPage = await browser.newPage();
    const jealousyErrors = [];
    jealousyGuidedPage.on('pageerror', error => jealousyErrors.push(String(error)));
    await openDay(jealousyGuidedPage, { problem: 'حسادت', assistantDayMode: 'blocked', localModelInstalled: true });
    const jealousyPanel = jealousyGuidedPage.locator('.globalAssistantDialog');
    await jealousyPanel.waitFor({ state: 'visible' });
    assert.equal(await jealousyPanel.locator('#global-assistant-message').count(), 0,
      'T05 must never expose free-form typing, even with a cached local model');
    assert.equal(await jealousyPanel.getByRole('button', { name: 'نصب مدل هوش مصنوعی محلی' }).count(), 0,
      'T05 must not expose local model installation');
    const jealousyTrigger = jealousyPanel.getByTestId('jealousy-daily-prompt-trigger');
    await jealousyTrigger.waitFor({ state: 'visible' });
    assert.match(await jealousyTrigger.getAttribute('aria-label'), /حسادت/,
      'T05 prompt trigger must have the correct accessible topic label');
    await jealousyTrigger.click();
    const jealousyPromptDialog = jealousyGuidedPage.locator('#library-assistant-prompt-dialog');
    await jealousyPromptDialog.waitFor({ state: 'visible' });
    assert.match(await jealousyPromptDialog.innerText(), /سؤال‌های آماده روز ۱ حسادت/);
    assert.equal(await jealousyPromptDialog.locator('.libraryAssistantPromptGroup').count(), 5);
    assert.equal(await jealousyPromptDialog.locator('[data-prompt-option]').count(), 14);
    await jealousyPromptDialog.getByRole('button', { name: 'برای تمرین امروز یک مثال می‌زنی؟' }).click();
    await jealousyPanel.getByRole('button', { name: 'ارسال' }).click();
    await jealousyGuidedPage.waitForFunction(() => Array.from(document.querySelectorAll('.globalAssistantDialog .assistantMessage'))
      .some(node => node.innerText.includes('راهنمای روز ۱ حسادت')));
    const jealousyExerciseExample = await jealousyPanel.locator('.assistantMessage').last().innerText();
    assert.match(jealousyExerciseExample, /مثال فرضی/);
    assert.match(jealousyExerciseExample, /دوستت با فرد دیگری/);
    assert.match(jealousyExerciseExample, /یک موقعیت را ثبت کن/);
    assert.ok(await jealousyPanel.locator('.assistantMessage').last().locator('strong').count() > 0,
      'T05 assistant headings must render as bold text');
    assert.equal(jealousyExerciseExample.includes('**'), false, 'T05 must not expose raw markdown markers');
    assert.equal(jealousyExerciseExample.includes(String.fromCharCode(92) + 'n'), false, 'T05 must not expose escaped newline tokens');
    assert.ok(jealousyExerciseExample.includes('\n'), 'T05 paragraphs must display on separate lines');
  
    await jealousyPanel.getByRole('button', { name: 'بستن پنجره دستیار' }).click();
    await jealousyPanel.waitFor({ state: 'detached' });
    await jealousyGuidedPage.getByRole('button', { name: 'باز کردن دستیار مسیر۲۸' }).click();
    await jealousyPanel.waitFor({ state: 'visible' });
    await jealousyPanel.getByTestId('jealousy-daily-prompt-trigger').click();
    await jealousyGuidedPage.locator('#library-assistant-prompt-dialog')
      .getByRole('button', { name: 'برای اقدام امروز یک مثال می‌زنی؟' }).click();
    await jealousyPanel.getByRole('button', { name: 'ارسال' }).click();
    await jealousyGuidedPage.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')]
      .some(node => node.innerText.includes('راهنمای روز ۱ حسادت')));
    const jealousyActionExample = await jealousyPanel.locator('.assistantMessage').last().innerText();
    assert.match(jealousyActionExample, /مثال فرضی/);
    assert.match(jealousyActionExample, /حسادت رابطه‌ای؛ نگرانی از کم‌شدن صمیمیت/);
    assert.notEqual(jealousyExerciseExample, jealousyActionExample,
      'T05 exercise and action examples must teach different tasks, not repeat the same text');
    assert.deepEqual(jealousyErrors, [], 'T05 prepared-only browser flow must not raise page errors');
    await jealousyGuidedPage.close();
  
  
    // Direct T05 relationship requests require the explicit relationship-safety check.
    const jealousyGatePage = await browser.newPage();
    await openDay(jealousyGatePage, { problem: 'حسادت', assistantDayMode: 'jealousy-communication' });
    const jealousyGatePanel = jealousyGatePage.locator('.globalAssistantDialog');
    await jealousyGatePanel.waitFor({ state: 'visible' });
    const jealousyGate = jealousyGatePanel.getByTestId('jealousy-relationship-safety-gate');
    await jealousyGate.waitFor({ state: 'visible' });
    assert.match(await jealousyGate.innerText(), /هر دو نفر می‌توانند آزادانه گفت‌وگو را رد یا متوقف کنند/);
    assert.equal(await jealousyGatePanel.getByTestId('jealousy-daily-prompt-trigger').isDisabled(), true,
      'T05 prepared interaction prompts remain unavailable until the relationship check is confirmed');
    await jealousyGate.getByTestId('jealousy-relationship-safety-unsafe').click();
    await jealousyGatePage.waitForFunction(() => document.querySelector('[data-testid="jealousy-relationship-safety-gate"]')?.innerText.includes('گفت‌وگوی مستقیم، مواجهه یا مذاکره'));
    assert.equal(await jealousyGate.getByTestId('jealousy-relationship-safety-safe').count(), 0,
      'an unsafe or uncertain answer must not allow direct interaction');
    await jealousyGatePage.close();
  
    const jealousySafeGatePage = await browser.newPage();
    await openDay(jealousySafeGatePage, { problem: 'حسادت', assistantDayMode: 'jealousy-communication' });
    const jealousySafePanel = jealousySafeGatePage.locator('.globalAssistantDialog');
    await jealousySafePanel.waitFor({ state: 'visible' });
    await jealousySafePanel.getByTestId('jealousy-relationship-safety-gate')
      .getByTestId('jealousy-relationship-safety-safe').click();
    await jealousySafeGatePage.waitForFunction(() => !document.querySelector('[data-testid="jealousy-relationship-safety-gate"]'));
    const enabledJealousyTrigger = jealousySafePanel.getByTestId('jealousy-daily-prompt-trigger');
    await jealousySafeGatePage.waitForFunction(() => {
      const button = document.querySelector('[data-testid="jealousy-daily-prompt-trigger"]');
      return button && !button.disabled;
    });
    await enabledJealousyTrigger.click();
    await jealousySafeGatePage.locator('#library-assistant-prompt-dialog').waitFor({ state: 'visible' });
    assert.match(await jealousySafeGatePage.locator('#library-assistant-prompt-dialog').innerText(), /سؤال‌های آماده روز ۱۶ حسادت/);
    await jealousySafeGatePage.close();
  
  process.stdout.write('PASS: T05 jealousy 28-day prepared assistant, distinct exercise/action examples, and relationship safety gate (T05 browser regression)\\n');
} finally {
  await browser.close();
}

// T05 package validation is intentionally isolated from the 34-topic full-project audit.
