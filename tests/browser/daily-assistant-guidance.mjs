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
  if (topic !== 'خشم') {
    assert.ok(reply.includes(normalizeVisibleDailyText(topic)), 'assistant answer must identify the selected topic');
    assert.ok(reply.includes('روز ' + dayNumber), 'assistant answer must identify the selected day');
  } else {
    assert.doesNotMatch(reply, /موضوع: خشم|دستیار هوشمند مسیر ۲۸|جمع‌بندی امروز/u,
      'anger answer must not repeat topic labels or a daily summary');
  }
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
    : assistantDayMode === 'grief-support'
      ? 15
      : assistantDayMode === 'relationship'
        ? 10
    : ['adaptedLegacyStreak', 'adaptedLegacyImprovement', 'adaptedAnxietyStreak', 'adaptedAnxietyImprovement', 'adaptedGriefStreak', 'adaptedGriefImprovement'].includes(assistantDayMode)
      ? 3
      : ['adaptedLegacy', 'adaptedLegacySame', 'adaptedAnxiety', 'adaptedGrief'].includes(assistantDayMode)
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
          : assistantDayMode === 'adaptedGrief'
            ? { 1: { feedback: 'hard', score: 8 } }
            : assistantDayMode === 'adaptedGriefStreak'
              ? { 1: { feedback: 'hard', score: 8 }, 2: { feedback: 'worse', score: 9 } }
              : assistantDayMode === 'adaptedGriefImprovement'
                ? { 1: { feedback: 'better', score: 3 }, 2: { feedback: 'better', score: 4 } }
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
        // Recreate a pre-canonical legacy record from the canonical fixture.
        // The checked-in source now contains these fields, so asserting their
        // absence without stripping them made the browser fixture self-contradictory.
        delete day.topic_id;
        delete day.review_status;
        delete day.risk_level;
        assert.equal(Object.hasOwn(day, 'topic_id'), false);
        assert.equal(Object.hasOwn(day, 'review_status'), false);
        assert.equal(Object.hasOwn(day, 'risk_level'), false);
      } else {
        Object.assign(day, {
          topic_id: ({ 'خشم':'T01','اضطراب':'T02','ترس':'T03','نفرت':'T04','حسادت':'T05','غم و سوگ':'T06','احساس گناه':'T07','وابستگی عاطفی':'T08','اهمال‌کاری':'T09','بی‌خوابی و مشکلات خواب':'T10','عادت‌های تکراری':'T11','مرزبندی و نه گفتن':'T12','تنهایی':'T13','کمبود انگیزه':'T14' })[topicKey] || 'T01',
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

async function assertGriefAdaptiveDay(mode, dayNumber, exerciseField, actionField) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await openDay(page, { problem: 'غم و سوگ', assistantDayMode: mode });
  const panel = page.locator('.globalAssistantDialog');
  await panel.waitFor({ state: 'visible' });
  await panel.getByRole('button', { name: 'بستن پنجره دستیار' }).click();
  await panel.waitFor({ state: 'detached' });
  const visibleExercise = normalizeVisibleDailyText(await readExpandedDailyText(page, '#dayExercise'));
  const visibleAction = normalizeVisibleDailyText(await readExpandedDailyText(page, '#dayAction'));
  const source = dailyTextOverrides.categories['غم و سوگ'].days.find((item) => item.day === dayNumber);
  assert.ok(source, 'T06 adaptation fixture must exist for day ' + dayNumber);
  assert.ok(visibleExercise.includes(normalizeVisibleDailyText(source[exerciseField])),
    'T06 day ' + dayNumber + ' must display ' + exerciseField);
  assert.ok(visibleAction.includes(normalizeVisibleDailyText(source[actionField])),
    'T06 day ' + dayNumber + ' must display ' + actionField);
  assert.deepEqual(errors, [], 'T06 adaptive daily guidance must not raise page errors');
  await page.close();
}

 
try {
  const questions = [
    'منظور از تمرین امروز چیست؟',
    'برای تمرین امروز یک مثال می‌زنی؟',
    'منظور از اقدام اختصاصی امروز چیست؟',
    'برای اقدام امروز یک مثال می‌زنی؟',
    'اگر انجام کاملش برایم سخت بود چه کنم؟',
    'از کجا بفهمم درست انجامش داده‌ام؟',
    'چه زمانی باید تمرین امروز را متوقف کنم؟',
    'اگر امروز نمونه یا آمادگی انجام تمرین را نداشتم چه کنم؟',
    'تمرین و اقدام امروز چه تفاوتی دارند؟',
    'اگر تمرین را انجام ندادم یا فراموش کردم چه کنم؟',
    'اگر هنگام تمرین فشار یا ناراحتی‌ام بیشتر شد چه کنم؟',
    'آیا لازم است حتماً با فرد دیگری صحبت کنم؟',
    'می‌توانم تمرین را تغییر بدهم یا به روش خودم انجام بدهم؟',
    'این تمرین چقدر زمان می‌برد؟',
  ];
  const topics = [
    { name: 'خشم', id: 'T01', trigger: 'anger-daily-prompt-trigger' },
    { name: 'اضطراب', id: 'T02', trigger: 'anxiety-daily-prompt-trigger' },
    { name: 'ترس', id: 'T03', trigger: 'fear-daily-prompt-trigger' },
    { name: 'نفرت', id: 'T04', trigger: 'hatred-daily-prompt-trigger' },
    { name: 'حسادت', id: 'T05', trigger: 'jealousy-daily-prompt-trigger' },
    { name: 'غم و سوگ', id: 'T06', trigger: 'grief-daily-prompt-trigger' },
    { name: 'احساس گناه', id: 'T07', trigger: 'guilt-daily-prompt-trigger' },
    { name: 'وابستگی عاطفی', id: 'T08', trigger: 'emotional-dependency-daily-prompt-trigger' },
    { name: 'اهمال‌کاری', id: 'T09', trigger: 't09-daily-prompt-trigger' },
    { name: 'بی‌خوابی و مشکلات خواب', id: 'T10', trigger: 't10-daily-prompt-trigger' },
    { name: 'عادت‌های تکراری', id: 'T11', trigger: 't11-daily-prompt-trigger' },
    { name: 'مرزبندی و نه گفتن', id: 'T12', trigger: 't12-daily-prompt-trigger' },
    { name: 'تنهایی', id: 'T13', trigger: 't13-daily-prompt-trigger' },
    { name: 'کمبود انگیزه', id: 'T14', trigger: 't14-daily-prompt-trigger' },
  ];
  const workerRequests = [];
  const privateMarker = 'private-assistant-browser-marker-7f31c2';
  let completedAnswers = 0;

  for (const topic of topics) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('request', request => {
      if (/\/v1\/assistant\/turn|assistant-api|workers\.dev/u.test(request.url())) workerRequests.push(request.url());
    });
    await openDay(page, { problem: topic.name });
    const panel = page.locator('.globalAssistantDialog');
    await panel.waitFor({ state: 'visible' });
    assert.equal(await panel.locator('#global-assistant-message').count(), 0,
      topic.id + ' must remain prepared-only and must not expose free-form typing');
    const trigger = panel.getByTestId(topic.trigger);
    await trigger.waitFor({ state: 'visible' });
    await page.waitForFunction((testId) => {
      const button = document.querySelector('[data-testid="' + testId + '"]');
      return button && !button.disabled;
    }, topic.trigger);
    await trigger.click();
    const prompt = page.locator('#library-assistant-prompt-dialog');
    await prompt.waitFor({ state: 'visible' });
    assert.equal(await prompt.locator('.libraryAssistantPromptGroup').count(), 5,
      topic.id + ' must expose the same five shared question groups');
    assert.equal(await prompt.locator('[data-prompt-option]').count(), 14,
      topic.id + ' must expose exactly the same fourteen fixed questions');

    for (let questionIndex = 0; questionIndex < questions.length; questionIndex += 1) {
      if (questionIndex > 0) {
        await trigger.click();
        await prompt.waitFor({ state: 'visible' });
      }
      const question = questions[questionIndex];
      await prompt.getByRole('button', { name: question, exact: true }).click();
      const previousReplyCount = await panel.locator('.assistantMessage').count();
      await panel.getByRole('button', { name: 'ارسال' }).click();
      await page.waitForFunction((previous) => {
        const replies = [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')];
        return replies.length > previous && !replies.at(-1).innerText.includes('در حال بررسی پرسش');
      }, previousReplyCount, { timeout: 15000 }).catch(async error => {
        const replies = await panel.locator('.assistantMessage').allInnerTexts();
        throw new Error(topic.id + ' ' + question + ' did not settle; replies='
          + JSON.stringify(replies) + '; pageErrors=' + JSON.stringify(errors)
          + '; cause=' + error.message);
      });

      const userQuestion = normalizeVisibleDailyText(await panel.locator('.userMessage').last().innerText());
      assert.ok(userQuestion.includes(normalizeVisibleDailyText(question)),
        topic.id + ' must display the selected fixed question before its answer');
      const answer = panel.locator('.assistantMessage').last();
      const visibleAnswer = await answer.innerText();
      const normalizedAnswer = normalizeVisibleDailyText(visibleAnswer);
      assert.ok(normalizedAnswer.length >= 45,
        topic.id + ' ' + question + ' must return a substantive prepared answer');
      assert.match(visibleAnswer, /روز\s*(?:1|۱)/u,
        topic.id + ' ' + question + ' must use the active day context');
      assert.doesNotMatch(visibleAnswer, /آره عزیزم|حتماً عزیزم|بله عزیزم|نه عزیزم/u,
        'assistant answers must not use intimate pet names or the removed opening phrase');
      assert.doesNotMatch(visibleAnswer, /راهنمای روز\s*\d|دستیار هوشمند مسیر ۲۸|جمع‌بندی امروز|موضوع:\s/u,
        topic.id + ' must use the shared answer body, not retired per-topic headings or labels');
      assert.equal(visibleAnswer.includes('**'), false,
        topic.id + ' must not expose raw Markdown markers');
      assert.equal(visibleAnswer.includes(String.fromCharCode(92) + 'n'), false,
        topic.id + ' must not expose escaped newline tokens');
      assert.ok(visibleAnswer.includes('\n'),
        topic.id + ' answer paragraphs must render as separate lines');
      assert.ok(await answer.locator('p').count() > 0,
        topic.id + ' answer must render structured paragraph content');
      assert.ok(await answer.locator('.dailyAssistantSafetyReminder').count() <= 1,
        topic.id + ' answer must never duplicate the shared safety reminder card');
      completedAnswers += 1;

      // These three questions prove that the renderer uses the active topic/day
      // canonical exercise and action, not stale or cross-topic source data.
      if (questionIndex === 0) {
        await assertAssistantUsesVisibleDailySource(page, panel, topic.name, 1, ['exercise']);
      } else if (questionIndex === 2) {
        await assertAssistantUsesVisibleDailySource(page, panel, topic.name, 1, ['action']);
      } else if (questionIndex === 8) {
        await assertAssistantUsesVisibleDailySource(page, panel, topic.name, 1, ['exercise', 'action']);
      }
    }

    const dayBadge = normalizeVisibleDailyText(await page.locator('#dayBadge').innerText());
    assert.ok(dayBadge.includes(normalizeVisibleDailyText(topic.name)) && dayBadge.includes('روز 1'),
      topic.id + ' browser scenario must remain on the requested topic and day');
    const storedValues = await page.evaluate(() =>
      Object.keys(localStorage).map(key => localStorage.getItem(key) || '').join('\n'));
    assert.equal(storedValues.includes(privateMarker), false,
      topic.id + ' assistant transcript must not be persisted to localStorage');
    assert.deepEqual(errors, [], topic.id + ' prepared daily assistant must not raise page errors');
    await page.close();
  }

  assert.equal(completedAnswers, topics.length * questions.length,
    'all fourteen prepared questions must complete for each of the fourteen supported topics');
  assert.deepEqual(workerRequests, [],
    'prepared daily answers must not call a Worker or external assistant provider');

  // An unsupported topic must fail closed rather than silently borrowing another topic's engine.
  const pendingTopicPage = await browser.newPage();
  await openDay(pendingTopicPage, { assistantDayMode: 'legacy', problem: 'شرم', localModelInstalled: true });
  const pendingTopicPanel = pendingTopicPage.locator('.globalAssistantDialog');
  await pendingTopicPanel.waitFor({ state: 'visible' });
  assert.equal(await pendingTopicPanel.locator('#global-assistant-message').count(), 0,
    'topics without a prepared catalogue must not expose free-text input');
  assert.equal(await pendingTopicPanel.getByRole('button', { name: 'ارسال' }).count(), 0,
    'topics without a prepared catalogue must not expose a send action');
  assert.match(await pendingTopicPanel.innerText(), /هنوز سؤال آماده‌ای برای این بخش ثبت نشده است/);
  await pendingTopicPage.close();

  process.stdout.write('PASS: Chromium shared daily assistant contract: 14 fixed questions × 14 topics (196 answers), identical five-group selector, active topic/day exercise and action source binding, shared answer formatting, prepared-only boundary, privacy, and no external assistant calls.\n');
} finally {
  await browser.close();
}
