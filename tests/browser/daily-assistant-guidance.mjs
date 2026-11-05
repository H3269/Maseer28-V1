import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173';
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
  const section = page.locator(selector);
  const disclosure = section.locator('details.dailyTextDisclosure');
  if (await disclosure.count()) await disclosure.locator('summary').click();
  const preview = await section.locator('.dailyTextPreview').innerText();
  const remaining = await section.locator('.dailyTextFull p').allInnerTexts();
  return [preview, ...remaining].join(' ');
}

async function assertAssistantUsesVisibleDailySource(page, panel, topic, dayNumber) {
  const dayBadge = normalizeVisibleDailyText(await page.locator('#dayBadge').innerText());
  const assistantContext = normalizeVisibleDailyText(await panel.locator('.dailyAssistantContext').innerText());
  assert.ok(dayBadge.includes(normalizeVisibleDailyText(topic)), 'day UI must show the selected canonical topic');
  assert.ok(dayBadge.includes('روز ' + dayNumber), 'day UI must show the selected canonical day');
  assert.ok(assistantContext.includes(normalizeVisibleDailyText(topic)), 'assistant context must show the selected topic');
  assert.ok(assistantContext.includes('روز ' + dayNumber), 'assistant context must show the selected day');

  const visibleExercise = normalizeVisibleDailyText(await readExpandedDailyText(page, '#dayExercise'));
  const visibleAction = normalizeVisibleDailyText(await readExpandedDailyText(page, '#dayAction'));
  const reply = normalizeVisibleDailyText(await panel.locator('.assistantMessage').last().innerText());
  for (const [label, source] of [['exercise', visibleExercise], ['action', visibleAction]]) {
    assert.ok(source.length > 20, `visible ${label} source must be substantial`);
    assert.ok(reply.includes(source),
      `assistant response must preserve the exact visible daily ${label} text for ${topic}, day ${dayNumber}`);
  }
}

async function openDay(page, { assistantDayMode = 'routine', problem = null } = {}) {
  const isLegacyMode = assistantDayMode === 'legacy' || assistantDayMode.startsWith('adaptedLegacy');
  const dayNumber = assistantDayMode === 'relationship'
    ? 10
    : assistantDayMode === 'adaptedLegacyStreak' || assistantDayMode === 'adaptedLegacyImprovement'
      ? 3
      : isLegacyMode ? 2 : 1;
  const topicKey = problem || (isLegacyMode ? 'غم و سوگ' : 'خشم');
  const adaptationHistory = assistantDayMode === 'adaptedLegacy'
    ? { 1: { feedback: 'hard', score: 8 } }
    : assistantDayMode === 'adaptedLegacyStreak'
      ? { 1: { feedback: 'hard', score: 8 }, 2: { feedback: 'worse', score: 9 } }
      : assistantDayMode === 'adaptedLegacyImprovement'
        ? { 1: { feedback: 'better', score: 3 }, 2: { feedback: 'better', score: 4 } }
        : assistantDayMode === 'adaptedLegacySame'
          ? { 1: { feedback: 'same', score: 5 } }
          : {};
  const testJourney = dayNumber === 1 ? journey : {
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

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/content/path-content.json')) {
      const response = await route.fetch();
      const payload = await response.json();
      const day = payload.categories?.[topicKey]?.days?.find((item) => Number(item.day) === dayNumber);
      assert.ok(day, 'the deterministic browser fixture must contain the selected topic day');
      if (isLegacyMode) {
        assert.equal(Object.hasOwn(day, 'topic_id'), false);
        assert.equal(Object.hasOwn(day, 'review_status'), false);
        assert.equal(Object.hasOwn(day, 'risk_level'), false);
      } else {
        Object.assign(day, {
          topic_id: 'T01',
          day: dayNumber,
          review_status: assistantDayMode === 'blocked' ? 'draft' : 'approved',
          risk_level: 'routine',
        });
      }
      await route.fulfill({ response, json: payload });
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
  await page.getByRole('dialog', { name: 'دستیار مسیر۲۸' }).waitFor({ state: 'visible' });
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

  await openDay(page);
  const panel = page.locator('.globalAssistantDialog');
  await panel.waitFor({ state: 'visible' });
  const composer = panel.locator('#global-assistant-message');
  const send = panel.getByRole('button', { name: 'ارسال' });

  assert.equal(await composer.getAttribute('maxlength'), '2000');
  assert.equal(await send.isDisabled(), true, 'empty assistant messages must not be sent');

  await composer.fill(`چطور انجامش بدم؟ ${privateMarker}`);
  assert.equal(await send.isDisabled(), false);
  await send.click();
  await page.waitForFunction(() => document.querySelectorAll('.globalAssistantDialog .assistantMessage').length >= 6);

  let assistantReply = await panel.locator('.assistantMessage').last().innerText();
  assert.match(assistantReply, /خشم/);
  assert.match(assistantReply, /روز 1/);
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
    await openDay(legacyPage, { assistantDayMode: 'legacy', problem });
    const legacyPanel = legacyPage.locator('.globalAssistantDialog');
    await legacyPanel.waitFor({ state: 'visible' });
    const legacyComposer = legacyPanel.locator('#global-assistant-message');
    await legacyComposer.fill('چطور انجامش بدم؟');
    await legacyPanel.getByRole('button', { name: 'ارسال' }).click();
    await legacyPage.waitForFunction(() => document.querySelectorAll('.globalAssistantDialog .assistantMessage').length >= 1);
    const legacyReply = await legacyPanel.locator('.assistantMessage').last().innerText();
    assert.ok(legacyReply.includes(problem), `legacy assistant reply must retain selected topic ${problem}`);
    assert.match(legacyReply, /روز 2/);
    assert.match(legacyReply, /متن تمرین همین روز/);
    assert.match(legacyReply, /راهکار اختصاصی همین روز/);
    await assertAssistantUsesVisibleDailySource(legacyPage, legacyPanel, problem, 2);
    assert.deepEqual(legacyErrors, [], `real legacy day content for ${problem} must not raise browser errors`);
    await legacyPage.close();
  }

  for (const scenario of [
    { mode: 'adaptedLegacy', day: 2, expected: 'با توجه به نتیجه روز گذشته' },
    { mode: 'adaptedLegacyStreak', day: 3, expected: 'در چند روز اخیر انجام تمرین دشوار بوده' },
    { mode: 'adaptedLegacyImprovement', day: 3, expected: 'بهبود در چند روز اخیر دیده می‌شود' },
    { mode: 'adaptedLegacySame', day: 2, expected: 'تغییر محسوسی ثبت نشده است' },
  ]) {
    const adaptedPage = await browser.newPage();
    const adaptedErrors = [];
    adaptedPage.on('pageerror', error => adaptedErrors.push(String(error)));
    await openDay(adaptedPage, { assistantDayMode: scenario.mode });
    const adaptedPanel = adaptedPage.locator('.globalAssistantDialog');
    await adaptedPanel.waitFor({ state: 'visible' });
    await adaptedPanel.locator('#global-assistant-message').fill('چطور انجامش بدم؟');
    await adaptedPanel.getByRole('button', { name: 'ارسال' }).click();
    await adaptedPage.waitForFunction(() => document.querySelectorAll('.globalAssistantDialog .assistantMessage').length >= 1);
    const adaptedReply = await adaptedPanel.locator('.assistantMessage').last().innerText();
    assert.ok(adaptedReply.includes(scenario.expected),
      `assistant must expose the expected source-derived adaptation for ${scenario.mode}`);
    assert.match(adaptedReply, /متن تمرین همین روز/);
    assert.match(adaptedReply, /راهکار اختصاصی همین روز/);
    await assertAssistantUsesVisibleDailySource(adaptedPage, adaptedPanel, 'غم و سوگ', scenario.day);
    assert.match(adaptedReply, /غم و سوگ/);
    assert.match(adaptedReply, new RegExp('روز ' + scenario.day));
    assert.deepEqual(adaptedErrors, [], `adapted legacy daily guidance ${scenario.mode} must not raise browser errors`);
    await adaptedPage.close();
  }

  const blockedPage = await browser.newPage();
  await openDay(blockedPage, { assistantDayMode: 'blocked' });
  const blockedPanel = blockedPage.locator('.globalAssistantDialog');
  await blockedPanel.waitFor({ state: 'visible' });
  const blockedComposer = blockedPanel.locator('#global-assistant-message');
  assert.equal(await blockedComposer.count(), 1, 'the global launcher remains available, but the blocked day must deny guidance');
  await blockedComposer.fill('چطور انجامش بدم؟');
  await blockedPanel.getByRole('button', { name: 'ارسال' }).click();
  await blockedPage.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some(node => /بازبینی ایمنی/.test(node.innerText)));
  const blockedReply = await blockedPanel.locator('.assistantMessage').last().innerText();
  assert.match(blockedReply, /بازبینی ایمنی/);
  assert.doesNotMatch(blockedReply, /متن تمرین همین روز|راهکار اختصاصی همین روز/);
  await blockedPage.close();

  const gatedPage = await browser.newPage();
  await openDay(gatedPage, { assistantDayMode: 'relationship' });
  const gatedPanel = gatedPage.locator('.globalAssistantDialog');
  await gatedPanel.waitFor({ state: 'visible' });
  const safeChoice = gatedPage.getByLabel('بله؛ هر دو نفر می‌توانند آزادانه گفت‌وگو را رد یا متوقف کنند.');
  assert.equal(await safeChoice.isChecked(), false);
  const gatedComposer = gatedPanel.locator('#global-assistant-message');
  await gatedComposer.fill('چطور انجامش بدم؟');
  await gatedPanel.getByRole('button', { name: 'ارسال' }).click();
  await gatedPage.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some(node => /بررسی ایمنی همین روز/.test(node.innerText)));
  assert.match(await gatedPanel.locator('.assistantMessage').last().innerText(), /بررسی ایمنی همین روز/);
  await safeChoice.evaluate((element) => element.click());
  await gatedPanel.waitFor({ state: 'detached' });
  await gatedPage.getByRole('button', { name: 'باز کردن دستیار مسیر۲۸' }).click();
  await gatedPanel.waitFor({ state: 'visible' });
  await gatedPanel.locator('#global-assistant-message').fill('چطور انجامش بدم؟');
  await gatedPanel.getByRole('button', { name: 'ارسال' }).click();
  await gatedPage.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some(node => /متن تمرین همین روز/.test(node.innerText)));
  await gatedPage.getByRole('button', { name: /شرایط امن نیست یا پاسخ من تغییر کرده است/ }).click();
  await gatedPanel.waitFor({ state: 'detached' });
  await gatedPage.getByRole('button', { name: 'باز کردن دستیار مسیر۲۸' }).click();
  await gatedPanel.waitFor({ state: 'visible' });
  await gatedPanel.locator('#global-assistant-message').fill('چطور انجامش بدم؟');
  await gatedPanel.getByRole('button', { name: 'ارسال' }).click();
  await gatedPage.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some(node => /بررسی ایمنی همین روز/.test(node.innerText)));
  await gatedPage.locator('#day button[aria-label="داشبورد"]').click();
  await gatedPage.locator('#dashboard').waitFor({ state: 'visible' });
  await gatedPage.locator('#dashboard .heroAction').click();
  await gatedPage.locator('#day').waitFor({ state: 'visible' });
  assert.equal(await gatedPage.getByLabel('بله؛ هر دو نفر می‌توانند آزادانه گفت‌وگو را رد یا متوقف کنند.').isChecked(), false,
    'leaving and re-entering the day must require a fresh safety confirmation');
  await gatedPage.getByRole('button', { name: 'باز کردن دستیار مسیر۲۸' }).click();
  await gatedPanel.waitFor({ state: 'visible' });
  await gatedPanel.locator('#global-assistant-message').fill('چطور انجامش بدم؟');
  await gatedPanel.getByRole('button', { name: 'ارسال' }).click();
  await gatedPage.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some(node => /بررسی ایمنی همین روز/.test(node.innerText)));
  await gatedPage.close();

  process.stdout.write('PASS: Chromium daily assistant guidance, real legacy retrieval across three topics, four source-derived adaptation branches, follow-up context, input bounds, persistent safety handoff, local-only privacy, blocked-day denial, relationship gate, and confirmation reset (WV-BROWSER-ASSISTANT)\\n');
} finally {
  await browser.close();
}
