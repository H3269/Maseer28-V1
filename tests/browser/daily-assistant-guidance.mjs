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


function normalizeVisibleDailyText(value) {
  return String(value || '').normalize('NFKC')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

async function readExpandedDailyText(page, selector) {
  assert.equal(await page.locator('.globalAssistantDialog').count(), 0,
    'close the modal assistant before interacting with daily-screen disclosures');
  const section = page.locator(selector);
  const disclosure = section.locator('details.dailyTextDisclosure');
  if (await disclosure.count()) {
    const isOpen = await disclosure.evaluate((element) => element.open);
    if (!isOpen) {
      await disclosure.locator('summary').click();
      await page.waitForFunction((details) => details?.open === true, await disclosure.elementHandle());
    }
  }
  const preview = await section.locator('.dailyTextPreview').innerText();
  const remaining = await section.locator('.dailyTextFull p').allInnerTexts();
  return [preview, ...remaining].join(' ');
}

async function assertAssistantUsesVisibleDailySource(page, panel, topic, dayNumber, sourceTypes = ['exercise', 'action']) {
  const dayBadge = normalizeVisibleDailyText(await page.locator('#dayBadge').innerText());
  assert.ok(dayBadge.includes(normalizeVisibleDailyText(topic)), 'day UI must show the selected canonical topic');
  assert.ok(dayBadge.includes('روز ' + dayNumber), 'day UI must show the selected canonical day');
  const reply = normalizeVisibleDailyText(await panel.locator('.assistantMessage').last().innerText());
  assert.ok(reply.includes(normalizeVisibleDailyText(topic)), 'assistant answer must identify the selected topic');
  assert.ok(reply.includes('روز ' + dayNumber), 'assistant answer must identify the selected day');
  await panel.getByRole('button', { name: 'بستن پنجره دستیار' }).click();
  await panel.waitFor({ state: 'detached' });
  const visibleExercise = normalizeVisibleDailyText(await readExpandedDailyText(page, '#dayExercise'));
  const visibleAction = normalizeVisibleDailyText(await readExpandedDailyText(page, '#dayAction'));
  const visibleSources = { exercise: visibleExercise, action: visibleAction };
  for (const label of sourceTypes) {
    const source = visibleSources[label];
    assert.ok(source, `unsupported daily source type: ${label}`);
    assert.ok(source.length > 20, `visible ${label} source must be substantial`);
    assert.ok(reply.includes(source),
      `assistant response must preserve the exact visible daily ${label} text for ${topic}, day ${dayNumber}`);
  }
  await page.getByRole('button', { name: 'باز کردن دستیار مسیر۲۸' }).click();
  await panel.waitFor({ state: 'visible' });
}

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
  const page = await browser.newPage();
  const errors = [];
  const workerRequests = [];
  const privateMarker = 'private-assistant-browser-marker-7f31c2';
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('request', (request) => {
    if (/\/v1\/assistant\/turn|assistant-api|workers\.dev/u.test(request.url())) {
      workerRequests.push(request.url());
    }
  });

  // The anger assistant remains prepared-only even after local model installation.
  const guidedPage = await browser.newPage();
  await openDay(guidedPage);
  const guidedPanel = guidedPage.locator('.globalAssistantDialog');
  await guidedPanel.waitFor({ state: 'visible' });
  const guidedTrigger = guidedPanel.getByTestId('anger-daily-prompt-trigger');
  await guidedTrigger.waitFor({ state: 'visible' });
  await guidedPage.waitForFunction(() => {
    const trigger = document.querySelector('[data-testid="anger-daily-prompt-trigger"]');
    return trigger && !trigger.disabled;
  });
  assert.equal(await guidedPanel.locator('#global-assistant-message').count(), 0,
    'free-form typing must remain unavailable before local model installation');
  await guidedTrigger.click();
  const promptDialog = guidedPage.locator('#library-assistant-prompt-dialog');
  await promptDialog.waitFor({ state: 'visible' });
  await promptDialog.locator('[data-prompt-option]').first().click();
  await guidedPanel.getByRole('button', { name: 'ارسال' }).click();
  await guidedPage.waitForFunction(() => document.querySelectorAll('.globalAssistantDialog .assistantMessage').length >= 1);
  const angerReply = guidedPanel.locator('.assistantMessage').last();
  assert.match(await angerReply.innerText(), /راهنمای روز ۱ خشم/);
  assert.ok(await angerReply.locator('strong').count() > 0, 'T01 assistant headings must render as bold text, not raw markdown');
  const angerVisibleText = await angerReply.innerText();
  assert.equal(angerVisibleText.includes('**'), false, 'T01 must not expose raw markdown markers');
  assert.equal(angerVisibleText.includes(String.fromCharCode(92) + 'n'), false, 'T01 must not expose escaped newline tokens');
  assert.ok(angerVisibleText.includes('\n'), 'T01 paragraphs must display on separate lines');
  await guidedPage.close();

  // T02 anxiety must expose the same day-scoped prepared guidance structure.
  const anxietyGuidedPage = await browser.newPage();
  await openDay(anxietyGuidedPage, { problem: 'اضطراب' });
  const anxietyGuidedPanel = anxietyGuidedPage.locator('.globalAssistantDialog');
  const anxietyGuidedTrigger = anxietyGuidedPanel.getByTestId('anxiety-daily-prompt-trigger');
  await anxietyGuidedTrigger.waitFor({ state: 'visible' });
  await anxietyGuidedTrigger.click();
  const anxietyPromptDialog = anxietyGuidedPage.locator('#library-assistant-prompt-dialog');
  await anxietyPromptDialog.waitFor({ state: 'visible' });
  assert.match(await anxietyPromptDialog.innerText(), /سؤال‌های آماده روز ۱ اضطراب/);
  await anxietyPromptDialog.getByRole('button', { name: 'تمرین و اقدام امروز چه تفاوتی دارند؟' }).click();
  await anxietyGuidedPanel.getByRole('button', { name: 'ارسال' }).click();
  await anxietyGuidedPage.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some((node) => /راهنمای روز ۱ اضطراب/.test(node.innerText)));
  const anxietyReply = anxietyGuidedPanel.locator('.assistantMessage').last();
  assert.ok(await anxietyReply.locator('strong').count() > 0, 'T02 assistant headings must render as bold text');
  const anxietyVisibleText = await anxietyReply.innerText();
  assert.equal(anxietyVisibleText.includes('**'), false, 'T02 must not expose raw markdown markers');
  assert.equal(anxietyVisibleText.includes(String.fromCharCode(92) + 'n'), false, 'T02 must not expose escaped newline tokens');
  assert.ok(anxietyVisibleText.includes('\n'), 'T02 paragraphs must display on separate lines');
  await assertAssistantUsesVisibleDailySource(anxietyGuidedPage, anxietyGuidedPanel, 'اضطراب', 1);
  await anxietyGuidedPage.locator('.globalAssistantDialog').getByRole('button', { name: 'بستن پنجره دستیار' }).click();
  await anxietyGuidedPanel.waitFor({ state: 'detached' });

  await anxietyGuidedPage.close();

  // T03 must remain prepared-only even when a local model is already cached.
  // The daily safety-review gate remains fail-closed for this unapproved fixture.
  const fearGuidedPage = await browser.newPage();
  const fearErrors = [];
  fearGuidedPage.on('pageerror', error => fearErrors.push(String(error)));
  await openDay(fearGuidedPage, { problem: 'ترس', assistantDayMode: 'blocked', localModelInstalled: true });
  const fearPanel = fearGuidedPage.locator('.globalAssistantDialog');
  await fearPanel.waitFor({ state: 'visible' });
  assert.equal(await fearPanel.locator('#global-assistant-message').count(), 0,
    'T03 must never expose a free-form composer, even with a cached local model');
  assert.equal(await fearPanel.getByRole('button', { name: 'نصب مدل هوش مصنوعی محلی' }).count(), 0,
    'T03 must not expose local model installation');
  const fearTrigger = fearPanel.getByTestId('fear-daily-prompt-trigger');
  await fearTrigger.waitFor({ state: 'visible' });
  await fearGuidedPage.waitForFunction(() => {
    const trigger = document.querySelector('[data-testid="fear-daily-prompt-trigger"]');
    return trigger && !trigger.disabled;
  });
  await fearTrigger.click();
  const fearPromptDialog = fearGuidedPage.locator('#library-assistant-prompt-dialog');
  await fearPromptDialog.waitFor({ state: 'visible' });
  assert.match(await fearPromptDialog.innerText(), /ترس/);
  await fearPromptDialog.locator('[data-prompt-option]').first().click();
  await fearPanel.getByRole('button', { name: 'ارسال' }).click();
  await fearGuidedPage.waitForFunction(() => Array.from(document.querySelectorAll('.globalAssistantDialog .assistantMessage')).some(node => node.innerText.includes('راهنمای روز ۱ ترس')));
  const fearReply = fearPanel.locator('.assistantMessage').last();
  assert.match(await fearReply.innerText(), /راهنمای روز ۱ ترس/);
  assert.ok(await fearReply.locator('strong').count() > 0, 'T03 assistant headings must render as bold text');
  const fearVisibleText = await fearReply.innerText();
  assert.equal(fearVisibleText.includes('**'), false, 'T03 must not expose raw markdown markers');
  assert.equal(fearVisibleText.includes(String.fromCharCode(92) + 'n'), false, 'T03 must not expose escaped newline tokens');
  assert.ok(fearVisibleText.includes('\n'), 'T03 paragraphs must display on separate lines');

  assert.deepEqual(fearErrors, [], 'T03 prepared-only assistant browser flow must not raise page errors');
  await fearGuidedPage.close();

  // T04 is also strictly prepared-only, with the same five-group selector and no model/free-text escape.
  const hatredGuidedPage = await browser.newPage();
  const hatredErrors = [];
  hatredGuidedPage.on('pageerror', error => hatredErrors.push(String(error)));
  await openDay(hatredGuidedPage, { problem: 'نفرت', assistantDayMode: 'blocked', localModelInstalled: true });
  const hatredPanel = hatredGuidedPage.locator('.globalAssistantDialog');
  await hatredPanel.waitFor({ state: 'visible' });
  assert.equal(await hatredPanel.locator('#global-assistant-message').count(), 0,
    'T04 must never expose free-form typing, even with a cached local model');
  assert.equal(await hatredPanel.getByRole('button', { name: 'نصب مدل هوش مصنوعی محلی' }).count(), 0,
    'T04 must not expose local model installation');
  const hatredTrigger = hatredPanel.getByTestId('hatred-daily-prompt-trigger');
  await hatredTrigger.waitFor({ state: 'visible' });
  await hatredTrigger.click();
  const hatredPromptDialog = hatredGuidedPage.locator('#library-assistant-prompt-dialog');
  await hatredPromptDialog.waitFor({ state: 'visible' });
  assert.match(await hatredPromptDialog.innerText(), /سؤال‌های آماده روز ۱ نفرت/);
  assert.equal(await hatredPromptDialog.locator('.libraryAssistantPromptGroup').count(), 5);
  assert.equal(await hatredPromptDialog.locator('[data-prompt-option]').count(), 14);
  await hatredPromptDialog.getByRole('button', { name: 'منظور از تمرین امروز چیست؟' }).click();
  await hatredPanel.getByRole('button', { name: 'ارسال' }).click();
  await hatredGuidedPage.waitForFunction(() => Array.from(document.querySelectorAll('.globalAssistantDialog .assistantMessage')).some(node => node.innerText.includes('راهنمای روز ۱ نفرت')));
  const hatredReply = await hatredPanel.locator('.assistantMessage').last().innerText();
  assert.match(hatredReply, /نفرت/);
  assert.match(hatredReply, /تمرین/);
  assert.ok(await hatredPanel.locator('.assistantMessage').last().locator('strong').count() > 0,
    'T04 assistant headings must render as bold text');
  assert.equal(hatredReply.includes('**'), false, 'T04 must not expose raw markdown markers');
  assert.equal(hatredReply.includes(String.fromCharCode(92) + 'n'), false, 'T04 must not expose escaped newline tokens');
  assert.ok(hatredReply.includes('\n'), 'T04 paragraphs must display on separate lines');
  assert.deepEqual(hatredErrors, [], 'T04 prepared-only assistant browser flow must not raise page errors');
  await hatredGuidedPage.close();


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

  // T01 is prepared-only: there are no nested safety action buttons or free-text composer.
  await openDay(page, { localModelInstalled: true });
  const panel = page.locator('.globalAssistantDialog');
  await panel.waitFor({ state: 'visible' });
  assert.equal(await panel.locator('#global-assistant-message').count(), 0,
    'T01 must never expose free-form typing, even with a cached local model');
  assert.equal(await panel.getByRole('button', { name: 'نصب مدل هوش مصنوعی محلی' }).count(), 0,
    'the local-model installation button must be absent from every assistant screen');
  assert.equal(await panel.getByTestId('daily-assistant-human-help').count(), 0,
    'the obsolete nested human-help button must be removed');
  assert.equal(await panel.getByTestId('daily-assistant-urgent-help').count(), 0,
    'the obsolete nested urgent-help button must be removed');
  assert.equal(await panel.getByTestId('daily-assistant-return-to-daily').count(), 0,
    'the obsolete return-to-questions button must be removed');
  const trigger = panel.getByTestId('anger-daily-prompt-trigger');
  await trigger.waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const item = document.querySelector('[data-testid="anger-daily-prompt-trigger"]');
    return item && !item.disabled;
  });
  await trigger.click();
  const dayPrompt = page.locator('#library-assistant-prompt-dialog');
  await dayPrompt.waitFor({ state: 'visible' });
  await dayPrompt.getByRole('button', { name: 'منظور از تمرین امروز چیست؟' }).click();
  await panel.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')]
    .some(node => /راهنمای روز ۱ خشم/.test(node.innerText)));
  let assistantReply = await panel.locator('.assistantMessage').last().innerText();
  assert.match(assistantReply, /خشم/);
  assert.match(assistantReply, /روز ۱/);
  assert.match(assistantReply, /بیا تمرین امروز را ساده و روشن باز کنیم/);
  assert.match(assistantReply, /چرا این تمرین به درد می‌خورد/);
  assert.match(assistantReply, /یک موقعیت کم‌فشار را انتخاب کن/);
  assert.match(assistantReply, /تفکیک رویداد، احساس و رفتار/);
  assert.equal(await panel.getByTestId('daily-assistant-safety-reminder').count(), 0,
    'ordinary exercise questions must not show the safety reminder card');
  const angerDayBadge = normalizeVisibleDailyText(await page.locator('#dayBadge').innerText());
  assert.ok(angerDayBadge.includes('خشم') && angerDayBadge.includes('روز 1'),
    'the prepared answer must correspond to the currently displayed anger day');
  await assertAssistantUsesVisibleDailySource(page, panel, 'خشم', 1, ['exercise']);

  // Each of the four questions in the evaluation/safety group gets the same footer.
  for (const safetyQuestion of [
    'اگر هنگام تمرین خشم یا ناراحتی بیشتر شد چه کنم؟',
    'آیا لازم است حتماً با فرد دیگری صحبت کنم؟',
    'از کجا بفهمم درست انجامش داده‌ام؟',
    'چه زمانی باید تمرین امروز را متوقف کنم؟',
  ]) {
    await panel.getByTestId('anger-daily-prompt-trigger').click();
    const promptDialog = page.locator('#library-assistant-prompt-dialog');
    await promptDialog.waitFor({ state: 'visible' });
    await promptDialog.getByRole('button', { name: safetyQuestion }).click();
    const previousReplyCount = await panel.locator('.assistantMessage').count();
    await panel.getByRole('button', { name: 'ارسال' }).click();
    await page.waitForFunction((previous) => {
      const replies = [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')];
      return replies.length > previous && Boolean(replies.at(-1)?.querySelector('[data-testid="daily-assistant-safety-reminder"]'));
    }, previousReplyCount, { timeout: 8000 });
    const reply = panel.locator('.assistantMessage').last();
    assert.equal(await reply.getByTestId('daily-assistant-safety-reminder').count(), 1,
      'each evaluation/safety answer must contain exactly one reminder card');
    assert.match(await reply.innerText(), /یادآوری مهم درباره ایمنی شما/);
    assert.match(await reply.innerText(), /به یاد داشته باشید: سلامت و امنیت شما از انجام هر تمرینی مهم‌تر است/);
    const shafaLine = reply.locator('.dailyAssistantSafetyReminderShafa');
    assert.equal(await shafaLine.innerText(), 'مرکز هیپنوتراپی شفا با شماره تماس ۰۹۱۹۰۸۸۹۰۶۲ همیشه در کل مسیر همراه شماست');
    assert.ok(Number(await shafaLine.evaluate(element => getComputedStyle(element).fontWeight)) >= 700,
      'the Shafa contact line must be visibly bold');
  }

  // Returning to a normal prepared question must not leak the reminder state.
  await panel.getByTestId('anger-daily-prompt-trigger').click();
  const normalPrompt = page.locator('#library-assistant-prompt-dialog');
  await normalPrompt.waitFor({ state: 'visible' });
  await normalPrompt.getByRole('button', { name: 'تمرین و اقدام امروز چه تفاوتی دارند؟' }).click();
  const previousNormalReplyCount = await panel.locator('.assistantMessage').count();
  await panel.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction((previous) => {
    const replies = [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')];
    return replies.length > previous && /فرق تمرین و اقدام امروز را این‌طور به خاطر بسپار/.test(replies.at(-1)?.innerText || '');
  }, previousNormalReplyCount, { timeout: 8000 });
  assert.equal(await panel.locator('.assistantMessage').last().getByTestId('daily-assistant-safety-reminder').count(), 0,
    'ordinary questions after a safety answer must not inherit the reminder card');

  const storedValues = await page.evaluate(() => Object.keys(localStorage).map((key) => localStorage.getItem(key) || '').join('\n'));
  assert.equal(storedValues.includes(privateMarker), false, 'assistant transcript must not be persisted to localStorage');
  assert.deepEqual(workerRequests, [], 'day-scoped assistant must not call a Worker or external assistant provider');
  assert.deepEqual(errors, [], 'assistant browser flow should not raise uncaught page errors');

  await page.close();

  // Legacy free-text fallback remains for legacy topics that are not in the prepared-only T01–T05 set.
  // T05 jealousy is intentionally prepared-only even when its source record is legacy-shaped.
  for (const problem of ['غم و سوگ', 'شرم']) {
    const legacyPage = await browser.newPage();
    const legacyErrors = [];
    legacyPage.on('pageerror', error => legacyErrors.push(String(error)));
    await openDay(legacyPage, { assistantDayMode: 'legacy', problem, localModelInstalled: true });
    const legacyPanel = legacyPage.locator('.globalAssistantDialog');
    await legacyPanel.waitFor({ state: 'visible' });
    const legacyComposer = legacyPanel.locator('#global-assistant-message');
    await legacyComposer.fill('چطور انجامش بدم؟');
    await legacyPanel.getByRole('button', { name: 'ارسال' }).click();
    await legacyPage.waitForFunction(() => document.querySelectorAll('.globalAssistantDialog .assistantMessage').length >= 1);
    const legacyReply = await legacyPanel.locator('.assistantMessage').last().innerText();
    assert.ok(legacyReply.includes(problem), `legacy assistant reply must retain selected topic ${problem}`);
    assert.match(legacyReply, /روز ۲/);
    assert.match(legacyReply, /متن تمرین همین روز/);
    assert.match(legacyReply, /راهکار اختصاصی همین روز/);
    await assertAssistantUsesVisibleDailySource(legacyPage, legacyPanel, problem, 2);
    assert.deepEqual(legacyErrors, [], `real legacy day content for ${problem} must not raise browser errors`);
    await legacyPage.close();
  }

  for (const scenario of [
    { mode: 'adaptedLegacy', topic: 'غم و سوگ', day: 2, expected: 'با توجه به نتیجه روز گذشته' },
    { mode: 'adaptedLegacyStreak', topic: 'غم و سوگ', day: 3, expected: 'در چند روز اخیر انجام تمرین دشوار بوده' },
    { mode: 'adaptedLegacyImprovement', topic: 'غم و سوگ', day: 3, expected: 'بهبود در چند روز اخیر دیده می‌شود' },
    { mode: 'adaptedLegacySame', topic: 'غم و سوگ', day: 2, expected: 'تغییر محسوسی ثبت نشده است' },
    { mode: 'adaptedAnxiety', topic: 'اضطراب', day: 2, expected: 'با توجه به نتیجه روز گذشته', fieldMode: 'light' },
    { mode: 'adaptedAnxietyStreak', topic: 'اضطراب', day: 3, expected: 'در چند روز اخیر انجام تمرین دشوار بوده', fieldMode: 'rest' },
    { mode: 'adaptedAnxietyImprovement', topic: 'اضطراب', day: 3, expected: 'بهبود در چند روز اخیر دیده می‌شود', fieldMode: 'progress' },
  ]) {
    const adaptedPage = await browser.newPage();
    const adaptedErrors = [];
    adaptedPage.on('pageerror', error => adaptedErrors.push(String(error)));
    await openDay(adaptedPage, { assistantDayMode: scenario.mode, problem: scenario.topic, localModelInstalled: true });
    const adaptedPanel = adaptedPage.locator('.globalAssistantDialog');
    await adaptedPanel.waitFor({ state: 'visible' });
    const visibleScenarioDay = String(scenario.day).replace(/[0-9]/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
    let adaptedReply;
    if (scenario.topic === 'اضطراب') {
      const visibleGuidance = normalizeVisibleDailyText(await adaptedPage.locator('#day .adaptiveGuidance').innerText());
      assert.ok(visibleGuidance.includes(normalizeVisibleDailyText(scenario.expected)),
        `the visible daily screen must show the expected adaptation for ${scenario.mode}`);
      assert.equal(await adaptedPanel.locator('#global-assistant-message').count(), 0,
        'T02 adapted days must not expose a free-form composer');
      assert.equal(await adaptedPanel.locator('.globalAssistantModelButton').count(), 0,
        'T02 adapted days must not expose local model installation');
      const adaptedTrigger = adaptedPanel.getByTestId('anxiety-daily-prompt-trigger');
      await adaptedTrigger.waitFor({ state: 'visible' });
      await adaptedPage.waitForFunction(() => {
        const item = document.querySelector('[data-testid="anxiety-daily-prompt-trigger"]');
        return item && !item.disabled;
      });
      await adaptedTrigger.click();
      const adaptedPrompt = adaptedPage.locator('#library-assistant-prompt-dialog');
      await adaptedPrompt.waitFor({ state: 'visible' });
      await adaptedPrompt.getByRole('button', { name: 'منظور از تمرین امروز چیست؟' }).click();
      await adaptedPanel.getByRole('button', { name: 'ارسال' }).click();
      await adaptedPage.waitForFunction((dayLabel) => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')]
        .some(node => node.innerText.includes(`راهنمای روز ${dayLabel} اضطراب`)), visibleScenarioDay);
      adaptedReply = await adaptedPanel.locator('.assistantMessage').last().innerText();
    } else {
      await adaptedPanel.locator('#global-assistant-message').fill('چطور انجامش بدم؟');
      await adaptedPanel.getByRole('button', { name: 'ارسال' }).click();
      await adaptedPage.waitForFunction(() => document.querySelectorAll('.globalAssistantDialog .assistantMessage').length >= 1);
      adaptedReply = await adaptedPanel.locator('.assistantMessage').last().innerText();
      assert.ok(adaptedReply.includes(scenario.expected),
        `assistant must expose the expected source-derived adaptation for ${scenario.mode}`);
      assert.match(adaptedReply, /متن تمرین همین روز/);
      assert.match(adaptedReply, /راهکار اختصاصی همین روز/);
      await assertAssistantUsesVisibleDailySource(adaptedPage, adaptedPanel, scenario.topic, scenario.day);
    }
    assert.match(adaptedReply, new RegExp(scenario.topic));
    assert.match(adaptedReply, new RegExp('روز ' + visibleScenarioDay));
    if (scenario.fieldMode) {
      // The assistant is a modal overlay; close it before interacting with
      // disclosures in the underlying daily screen. Playwright correctly
      // rejects clicks intercepted by the modal backdrop/dialog.
      await adaptedPanel.getByRole('button', { name: 'بستن پنجره دستیار' }).click();
      await adaptedPanel.waitFor({ state: 'detached' });
      const source = dailyTextOverrides.categories['اضطراب'].days.find((item) => item.day === scenario.day);
      const visibleExercise = normalizeVisibleDailyText(await readExpandedDailyText(adaptedPage, '#dayExercise'));
      const visibleAction = normalizeVisibleDailyText(await readExpandedDailyText(adaptedPage, '#dayAction'));
      const expectedExercise = scenario.fieldMode === 'light' ? source.lightExerciseText
        : scenario.fieldMode === 'rest' ? source.restExerciseText : source.exercise;
      const expectedAction = scenario.fieldMode === 'light' ? source.lightActionText
        : scenario.fieldMode === 'rest' ? source.restActionText : source.progressActionText;
      const normalizedExpectedExercise = normalizeVisibleDailyText(expectedExercise);
      assert.ok(visibleExercise.includes(normalizedExpectedExercise),
        `visible T02 ${scenario.fieldMode} exercise must come from its dedicated runtime field; expected=${JSON.stringify(normalizedExpectedExercise)}; visible=${JSON.stringify(visibleExercise)}`);
      assert.ok(visibleAction.includes(normalizeVisibleDailyText(expectedAction)),
        `visible T02 ${scenario.fieldMode} action must come from its dedicated runtime field`);
      assert.equal(normalizeVisibleDailyText(await adaptedPage.locator('#dayTitle').innerText()), normalizeVisibleDailyText(source.title));
      assert.ok(normalizeVisibleDailyText(await adaptedPage.locator('#dayClosing').innerText()).includes(normalizeVisibleDailyText(source.closing)),
        'visible T02 closing must preserve the day-specific criterion, reflection and stop condition');
    }
    assert.deepEqual(adaptedErrors, [], `adapted daily guidance ${scenario.mode} must not raise browser errors`);
    await adaptedPage.close();
  }

  const blockedPage = await browser.newPage();
  await openDay(blockedPage, { assistantDayMode: 'blocked', localModelInstalled: true });
  const blockedPanel = blockedPage.locator('.globalAssistantDialog');
  await blockedPanel.waitFor({ state: 'visible' });
  assert.equal(await blockedPanel.locator('#global-assistant-message').count(), 0,
    'the blocked T01 daily context must not expose free-form typing');
  const blockedTrigger = blockedPanel.getByTestId('anger-daily-prompt-trigger');
  await blockedTrigger.waitFor({ state: 'visible' });
  await blockedPage.waitForFunction(() => {
    const item = document.querySelector('[data-testid="anger-daily-prompt-trigger"]');
    return item && !item.disabled;
  });
  await blockedTrigger.click();
  const blockedPrompt = blockedPage.locator('#library-assistant-prompt-dialog');
  await blockedPrompt.waitFor({ state: 'visible' });
  await blockedPrompt.locator('[data-prompt-option]').first().click();
  await blockedPanel.getByRole('button', { name: 'ارسال' }).click();
  await blockedPage.waitForFunction(() => document.querySelectorAll('.globalAssistantDialog .assistantMessage').length >= 1);
  const blockedReply = await blockedPanel.locator('.assistantMessage').last().innerText();
  assert.match(blockedReply, /خشم/);
  assert.match(blockedReply, /روز ۱/);
  assert.doesNotMatch(blockedReply, /بازبینی ایمنی/);
  await blockedPage.close();

  const gatedPage = await browser.newPage();
  await openDay(gatedPage, { assistantDayMode: 'relationship', localModelInstalled: true });
  const gatedPanel = gatedPage.locator('.globalAssistantDialog');
  await gatedPanel.waitFor({ state: 'visible' });
  assert.equal(await gatedPage.locator('#dayExercise').count(), 1,
    'the Path28 daily screen must display the exercise without an assistant safety gate');
  assert.equal(await gatedPage.locator('#dayAction').count(), 1,
    'the Path28 daily screen must display the dedicated action without an assistant safety gate');
  assert.equal(await gatedPage.getByLabel('بله؛ هر دو نفر می‌توانند آزادانه گفت‌وگو را رد یا متوقف کنند.').count(), 0,
    'the original daily screen must not add a relationship confirmation prerequisite');

  assert.equal(await gatedPanel.locator('#global-assistant-message').count(), 0,
    'the relationship-gated T01 day must keep the prepared-only boundary');
  const gatedTrigger = gatedPanel.getByTestId('anger-daily-prompt-trigger');
  await gatedTrigger.waitFor({ state: 'visible' });
  await gatedPage.waitForFunction(() => {
    const item = document.querySelector('[data-testid="anger-daily-prompt-trigger"]');
    return item && !item.disabled;
  });
  await gatedTrigger.click();
  const gatedPrompt = gatedPage.locator('#library-assistant-prompt-dialog');
  await gatedPrompt.waitFor({ state: 'visible' });
  await gatedPrompt.locator('[data-prompt-option]').first().click();
  await gatedPanel.getByRole('button', { name: 'ارسال' }).click();
  await gatedPage.waitForFunction(() => document.querySelectorAll('.globalAssistantDialog .assistantMessage').length >= 1);
  const gatedReply = await gatedPanel.locator('.assistantMessage').last().innerText();
  assert.match(gatedReply, /خشم/);
  assert.match(gatedReply, /روز ۱۰/);
  assert.match(gatedReply, /برنامه مکث و فاصله‌گیری/);
  assert.match(gatedReply, /نشانه‌ای می‌گوید باید مکث کنی/);
  assert.doesNotMatch(gatedReply, /بررسی ایمنی همین روز/);

  await gatedPanel.getByRole('button', { name: 'بستن پنجره دستیار' }).click();
  await gatedPanel.waitFor({ state: 'detached' });
  await gatedPage.locator('#day button[aria-label="داشبورد"]').click();
  await gatedPage.locator('#dashboard').waitFor({ state: 'visible' });
  await gatedPage.locator('#dashboard .heroAction').click();
  await gatedPage.locator('#day').waitFor({ state: 'visible' });
  assert.equal(await gatedPage.locator('#dayExercise').count(), 1,
    're-entering the day must continue to show its original exercise');
  assert.equal(await gatedPage.getByLabel('بله؛ هر دو نفر می‌توانند آزادانه گفت‌وگو را رد یا متوقف کنند.').count(), 0);
  await gatedPage.getByRole('button', { name: 'باز کردن دستیار مسیر۲۸' }).click();
  await gatedPanel.waitFor({ state: 'visible' });
  await gatedPanel.getByTestId('anger-daily-prompt-trigger').click();
  await gatedPage.locator('#library-assistant-prompt-dialog').locator('[data-prompt-option]').first().click();
  await gatedPanel.getByRole('button', { name: 'ارسال' }).click();
  await gatedPage.waitForFunction(() => document.querySelectorAll('.globalAssistantDialog .assistantMessage').length >= 1);
  const reenteredReply = await gatedPanel.locator('.assistantMessage').last().innerText();
  assert.match(reenteredReply, /برنامه مکث و فاصله‌گیری/,
    're-entering the same Path28 day must keep its exercise-specific assistant guidance available');
  assert.match(reenteredReply, /نشانه‌ای می‌گوید باید مکث کنی/);
  assert.doesNotMatch(reenteredReply, /بررسی ایمنی همین روز|بازبینی ایمنی/);
  await gatedPage.close();

  process.stdout.write('PASS: Chromium daily assistant guidance, real legacy retrieval across three topics, four source-derived adaptation branches, follow-up context, input bounds, persistent safety handoff, local-only privacy, blocked-day denial, and assistant-only relationship gate (WV-BROWSER-ASSISTANT)\\n');
} finally {
  await browser.close();
}
