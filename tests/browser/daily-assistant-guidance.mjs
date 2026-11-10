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

async function assertAssistantUsesVisibleDailySource(page, panel, topic, dayNumber) {
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
  for (const [label, source] of [['exercise', visibleExercise], ['action', visibleAction]]) {
    assert.ok(source.length > 20, `visible ${label} source must be substantial`);
    assert.ok(reply.includes(source),
      `assistant response must preserve the exact visible daily ${label} text for ${topic}, day ${dayNumber}`);
  }
  await page.getByRole('button', { name: 'باز کردن دستیار مسیر۲۸' }).click();
  await panel.waitFor({ state: 'visible' });
}

async function openDay(page, { assistantDayMode = 'routine', problem = null, localModelInstalled = false } = {}) {
  const isLegacyMode = assistantDayMode === 'legacy' || assistantDayMode.startsWith('adaptedLegacy');
  const dayNumber = assistantDayMode === 'relationship'
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
    startedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
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
          topic_id: topicKey === 'اضطراب' ? 'T02' : 'T01',
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

  // Before model installation, the anger assistant must expose prepared
  // questions only; free-form typing is enabled only after a valid local-model marker.
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
  assert.match(await guidedPanel.locator('.assistantMessage').last().innerText(), /راهنمای روز ۱ خشم/);
  await guidedPage.close();

  // T02 anxiety must expose the same day-scoped prepared guidance structure.
  const anxietyGuidedPage = await browser.newPage();
  await openDay(anxietyGuidedPage, { problem: 'اضطراب', localModelInstalled: true });
  const anxietyGuidedPanel = anxietyGuidedPage.locator('.globalAssistantDialog');
  const anxietyGuidedTrigger = anxietyGuidedPanel.getByTestId('anxiety-daily-prompt-trigger');
  await anxietyGuidedTrigger.waitFor({ state: 'visible' });
  assert.equal(await anxietyGuidedPanel.locator('#global-assistant-message').count(), 0,
    'T02 must keep free-form typing disabled even when a local model is installed');
  assert.equal(await anxietyGuidedPanel.locator('.globalAssistantModelButton').count(), 0,
    'T02 must not expose a local-model generation/install route');
  await anxietyGuidedTrigger.click();
  const anxietyPromptDialog = anxietyGuidedPage.locator('#library-assistant-prompt-dialog');
  await anxietyPromptDialog.waitFor({ state: 'visible' });
  assert.match(await anxietyPromptDialog.innerText(), /سؤال‌های آماده روز ۱ اضطراب/);
  await anxietyPromptDialog.getByRole('button', { name: 'تمرین و اقدام امروز چه تفاوتی دارند؟' }).click();
  await anxietyGuidedPanel.getByRole('button', { name: 'ارسال' }).click();
  await anxietyGuidedPage.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some((node) => /راهنمای روز ۱ اضطراب/.test(node.innerText)));
  await assertAssistantUsesVisibleDailySource(anxietyGuidedPage, anxietyGuidedPanel, 'اضطراب', 1);
  await anxietyGuidedPage.locator('.globalAssistantDialog').getByRole('button', { name: 'بستن پنجره دستیار' }).click();
  await anxietyGuidedPanel.waitFor({ state: 'detached' });
  await anxietyGuidedPage.close();

  await openDay(page, { localModelInstalled: true });
  const panel = page.locator('.globalAssistantDialog');
  await panel.waitFor({ state: 'visible' });
  const composer = panel.locator('#global-assistant-message');
  const send = panel.getByRole('button', { name: 'ارسال' });

  assert.equal(await composer.getAttribute('maxlength'), '2000');
  assert.equal(await send.isDisabled(), true, 'empty assistant messages must not be sent');

  await composer.fill(`چطور انجامش بدم؟ ${privateMarker}`);
  assert.equal(await send.isDisabled(), false);
  await send.click();
  await page.waitForFunction(() => document.querySelectorAll('.globalAssistantDialog .assistantMessage').length >= 1);

  let assistantReply = await panel.locator('.assistantMessage').last().innerText();
  assert.match(assistantReply, /خشم/);
  assert.match(assistantReply, /روز ۱/);
  assert.match(assistantReply, /متن تمرین همین روز/);
  assert.match(assistantReply, /راهکار اختصاصی همین روز/);
  await assertAssistantUsesVisibleDailySource(page, panel, 'خشم', 1);

  await composer.fill('تمرین را بیشتر توضیح بده');
  await send.click();
  await page.waitForFunction(() => document.querySelectorAll('.globalAssistantDialog .assistantMessage').length >= 2);
  assistantReply = await panel.locator('.assistantMessage').last().innerText();
  assert.match(assistantReply, /متن تمرین همین روز/);
  assert.match(assistantReply, /جمله یا واژه‌اش را بیشتر باز کنم/);

  await composer.click();
  await composer.pressSequentially('آ'.repeat(2001));
  const boundedValue = await composer.inputValue();
  assert.equal(boundedValue.length, 2000, 'composer must enforce its 2000-character limit');
  await composer.fill('دیگه نمی‌کشم. همه‌چی تمومه.');
  await send.click();
  await page.waitForFunction(() => { const replies = document.querySelectorAll('.globalAssistantDialog .assistantMessage'); return replies.length >= 3 && /آیا همین الآن خطر فوری/.test(replies[replies.length - 1]?.innerText || ''); });
  assistantReply = await panel.locator('.assistantMessage').last().innerText();
  assert.match(assistantReply, /آیا همین الآن خطر فوری/);
  assert.doesNotMatch(assistantReply, /متن تمرین همین روز/);

  await composer.fill('شاید، مطمئن نیستم');
  await send.click();
  await page.waitForFunction(() => { const replies = document.querySelectorAll('.globalAssistantDialog .assistantMessage'); return replies.length >= 4 && /کمک فوری انسانی/.test(replies[replies.length - 1]?.innerText || ''); });
  assistantReply = await panel.locator('.assistantMessage').last().innerText();
  assert.match(assistantReply, /کمک فوری انسانی/);
  assert.doesNotMatch(assistantReply, /متن تمرین همین روز/);

  await composer.fill('حالا تمرین امروز را توضیح بده');
  await send.click();
  await page.waitForFunction(() => document.querySelectorAll('.globalAssistantDialog .assistantMessage').length >= 5);
  assistantReply = await panel.locator('.assistantMessage').last().innerText();
  assert.match(assistantReply, /کمک فوری انسانی/);
  assert.doesNotMatch(assistantReply, /متن تمرین همین روز/);

  const storedValues = await page.evaluate(() => Object.keys(localStorage).map((key) => localStorage.getItem(key) || '').join('\n'));
  assert.equal(storedValues.includes(privateMarker), false, 'assistant transcript must not be persisted to localStorage');
  assert.deepEqual(workerRequests, [], 'day-scoped assistant must not call a Worker or external assistant provider');
  assert.deepEqual(errors, [], 'assistant browser flow should not raise uncaught page errors');

  await page.close();

  for (const problem of ['غم و سوگ', 'حسادت', 'شرم']) {
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
      const adaptedGuidance = normalizeVisibleDailyText(await adaptedPage.locator('#day .adaptiveGuidance').innerText());
      assert.ok(adaptedGuidance.includes(normalizeVisibleDailyText(scenario.expected)),
        `the visible daily screen must show the expected adaptation for ${scenario.mode}`);
      assert.equal(await adaptedPanel.locator('#global-assistant-message').count(), 0,
        'T02 adapted days must not expose a free-form composer');
      assert.equal(await adaptedPanel.locator('.globalAssistantModelButton').count(), 0,
        'T02 adapted days must not expose a local-model generation route');
      const adaptedTrigger = adaptedPanel.getByTestId('anxiety-daily-prompt-trigger');
      await adaptedTrigger.waitFor({ state: 'visible' });
      await adaptedTrigger.click();
      const adaptedPromptDialog = adaptedPage.locator('#library-assistant-prompt-dialog');
      await adaptedPromptDialog.waitFor({ state: 'visible' });
      await adaptedPromptDialog.getByRole('button', { name: 'منظور از تمرین امروز چیست؟' }).click();
      await adaptedPanel.getByRole('button', { name: 'ارسال' }).click();
      await adaptedPage.waitForFunction((dayLabel) => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')]
        .some((node) => node.innerText.includes(`راهنمای روز ${dayLabel} اضطراب`)), visibleScenarioDay);
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
  const blockedComposer = blockedPanel.locator('#global-assistant-message');
  assert.equal(await blockedComposer.count(), 1, 'the global launcher remains available, but the blocked day must deny guidance');
  await blockedComposer.fill('چطور انجامش بدم؟');
  await blockedPanel.getByRole('button', { name: 'ارسال' }).click();
  await blockedPage.waitForFunction(() => document.querySelectorAll('.globalAssistantDialog .assistantMessage').length >= 1);
  const blockedReply = await blockedPanel.locator('.assistantMessage').last().innerText();
  assert.match(blockedReply, /خشم/);
  assert.match(blockedReply, /روز ۱/);
  assert.match(blockedReply, /متن تمرین همین روز/);
  assert.match(blockedReply, /راهکار اختصاصی همین روز/);
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

  const gatedComposer = gatedPanel.locator('#global-assistant-message');
  await gatedComposer.fill('چطور انجامش بدم؟');
  await gatedPanel.getByRole('button', { name: 'ارسال' }).click();
  await gatedPage.waitForFunction(() => document.querySelectorAll('.globalAssistantDialog .assistantMessage').length >= 1);
  const gatedReply = await gatedPanel.locator('.assistantMessage').last().innerText();
  assert.match(gatedReply, /خشم/);
  assert.match(gatedReply, /روز ۱۰/);
  assert.match(gatedReply, /متن تمرین همین روز/);
  assert.match(gatedReply, /راهکار اختصاصی همین روز/);
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
  await gatedPanel.locator('#global-assistant-message').fill('چطور انجامش بدم؟');
  await gatedPanel.getByRole('button', { name: 'ارسال' }).click();
  await gatedPage.waitForFunction(() => document.querySelectorAll('.globalAssistantDialog .assistantMessage').length >= 1);
  const reenteredReply = await gatedPanel.locator('.assistantMessage').last().innerText();
  assert.match(reenteredReply, /متن تمرین همین روز/,
    're-entering the same Path28 day must keep daily assistant guidance available');
  assert.match(reenteredReply, /راهکار اختصاصی همین روز/);
  assert.doesNotMatch(reenteredReply, /بررسی ایمنی همین روز|بازبینی ایمنی/);
  await gatedPage.close();

  process.stdout.write('PASS: Chromium daily assistant guidance, real legacy retrieval across three topics, four source-derived adaptation branches, follow-up context, input bounds, persistent safety handoff, local-only privacy, blocked-day denial, and assistant-only relationship gate (WV-BROWSER-ASSISTANT)\\n');
} finally {
  await browser.close();
}
