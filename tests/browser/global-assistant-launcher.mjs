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
    goal: 'هدف مصنوعی برای آزمون دسترسی سراسری',
    code: 'M28-GLOBAL-ASSISTANT-BROWSER',
  },
  assessmentData: { answers: [2, 2, 2, 2, 2], total: 8, score: 4, motivation: 2, scaleMax: 4, version: 2 },
  final: null,
  archive: [],
  pathId: 'global-assistant-browser-check',
  startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  lastView: 'dashboard',
};

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
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
  }, journey);
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/content/path-content.json')) {
      const response = await route.fetch();
      const payload = await response.json();
      const angerDay = payload.categories?.['خشم']?.days?.find((item) => Number(item.day) === 1);
      assert.ok(angerDay, 'the global assistant fixture must contain anger day 1');
      Object.assign(angerDay, {
        topic_id: 'T01',
        day: 1,
        review_status: 'approved',
        risk_level: 'routine',
      });
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

  const launcher = page.getByRole('button', { name: 'باز کردن دستیار مسیر۲۸' });
  await launcher.waitFor({ state: 'visible' });
  assert.equal(await launcher.isVisible(), true, 'global assistant launcher must appear on the dashboard');
  await launcher.click();
  let dialog = page.getByRole('dialog', { name: 'دستیار راهنمای مسیر ۲۸' });
  await dialog.waitFor({ state: 'visible' });
  let closeButton = dialog.getByRole('button', { name: 'بستن پنجره دستیار' });
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'بستن پنجره دستیار');
  assert.equal(await launcher.getAttribute('aria-expanded'), 'true');
  // The model-install action is intentionally absent; the close control is first.
  assert.equal(await dialog.getByRole('button', { name: 'نصب مدل هوش مصنوعی محلی' }).count(), 0,
    'the local-model installation button must be removed from the entire assistant');
  assert.equal(await dialog.getByRole('textbox').count(), 0, 'the assistant must never expose a free-text input');
  const pagePromptPicker = dialog.getByRole('button', { name: 'باز کردن سؤال‌های آماده دستیار این صفحه' });
  assert.equal(await pagePromptPicker.count(), 1, 'the current page must expose a fixed question list');
  const firstDialogControl = closeButton;
  await firstDialogControl.focus();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await pagePromptPicker.evaluate((element) => element === document.activeElement), true, 'focus must wrap to the prepared question picker');
  await page.keyboard.press('Tab');
  assert.equal(await firstDialogControl.evaluate((element) => element === document.activeElement), true, 'focus must remain contained in the dialog');
  assert.match(await dialog.innerText(), /دستیار راهنمای مسیر ۲۸/);
  const dialogBoxForLayout = await dialog.boundingBox();
  assert.ok(dialogBoxForLayout.width >= 500, 'assistant dialog should use a wider desktop layout');
  const titleBox = await dialog.locator('#global-assistant-title').boundingBox();
  const closeBox = await closeButton.boundingBox();
  assert.ok(titleBox && closeBox && Math.abs(titleBox.y - closeBox.y) < 8, 'title and close control must share one header row');
  assert.doesNotMatch(await dialog.innerText(), /پردازش این نسخه|می‌توانی بپرسی/);
  assert.equal(await dialog.getByRole('button', { name: 'متوجه شدم' }).count(), 0, 'the redundant bottom close action must be removed');
  assert.equal((await dialog.innerText()).includes('09123456789'), false, 'private profile data must not be exposed to the page assistant');
  await pagePromptPicker.click();
  const pagePromptDialog = page.locator('#library-assistant-prompt-dialog');
  await pagePromptDialog.waitFor({ state: 'visible' });
  await pagePromptDialog.locator('[data-prompt-option]').first().click();
  const pageSendButton = dialog.getByRole('button', { name: 'ارسال' });
  assert.equal(await pageSendButton.isEnabled(), true, 'only selecting a prepared question enables sending');
  await pageSendButton.click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some((node) => node.innerText.includes('این کارت خلاصه‌ای از اطلاعات مسیر فعال تو را نشان می‌دهد')));
  assert.equal(await dialog.getByRole('textbox').count(), 0, 'prepared page guidance must not expose a typing field');
  await page.locator('.globalAssistantDialog').getByRole('button', { name: 'بستن پنجره دستیار' }).click();
  await dialog.waitFor({ state: 'detached' });
  assert.equal(await launcher.getAttribute('aria-expanded'), 'false');
  assert.equal(await launcher.evaluate((element) => element === document.activeElement), true, 'closing the dialog must restore focus to the launcher');

  // A successfully installed local model must not reopen free-form chat
  // inside a topic/day assistant. The prepared-only boundary is unconditional.
  await page.evaluate(async () => {
    const cache = await caches.open('maseer28-local-model-state-v1');
    const markerUrl = new URL('local-model/qwen3-0.6b-ready.json', location.href);
    await cache.put(markerUrl.href, new Response(JSON.stringify({
      modelId: 'onnx-community/Qwen3-0.6B-Instruct-ONNX',
      revision: '54250909aca286a05b9d013c8af7a21859ee6ead',
    }), { headers: { 'content-type': 'application/json' } }));
  });
  await page.locator('#dashboard .heroAction').click();
  await page.locator('#day').waitFor({ state: 'visible' });
  await launcher.waitFor({ state: 'visible' });
  await launcher.click();
  dialog = page.getByRole('dialog', { name: 'دستیار راهنمای مسیر ۲۸' });
  await dialog.waitFor({ state: 'visible' });
  closeButton = dialog.getByRole('button', { name: 'بستن پنجره دستیار' });
  assert.doesNotMatch(await dialog.innerText(), /صفحه فعلی:|موضوع: خشم/);
  assert.equal(await page.locator('.dailyExerciseAssistant').count(), 0, 'the standalone daily assistant panel must be removed');
  assert.equal(await dialog.getByRole('textbox').count(), 0,
    'installing a local model must not enable free-form typing in a topic/day assistant');
  const angerPromptTrigger = dialog.getByTestId('anger-daily-prompt-trigger');
  await angerPromptTrigger.waitFor({ state: 'visible' });
  await angerPromptTrigger.click();
  const angerPromptDialog = page.locator('#library-assistant-prompt-dialog');
  await angerPromptDialog.waitFor({ state: 'visible' });
  await angerPromptDialog.locator('[data-prompt-option]').first().click();
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')]
    .some(node => /راهنمای روز ۱ خشم/.test(node.innerText)));
  const dailyReply = dialog.locator('.assistantMessage').last();
  assert.match(await dailyReply.innerText(), /خشم/);
  assert.match(await dailyReply.innerText(), /روز ۱/);
  assert.match(await dailyReply.innerText(), /راهنمای روز ۱ خشم/);
  assert.equal(await dialog.locator('.assistantComposer').getAttribute('data-anger-daily-prompt'), 'true',
    'the active anger day context must expose its prepared-question picker');
  assert.equal(await dialog.getByTestId('anger-daily-prompt-trigger').count(), 1,
    'the prepared-question picker must remain available after successful local-model installation');

  // Prepared safety FAQ answers render one highlighted reminder card; no nested controls remain.
  assert.equal(await dialog.getByTestId('daily-assistant-human-help').count(), 0);
  assert.equal(await dialog.getByTestId('daily-assistant-urgent-help').count(), 0);
  assert.equal(await dialog.getByTestId('daily-assistant-return-to-daily').count(), 0);
  await dialog.getByTestId('anger-daily-prompt-trigger').click();
  const safetyPromptDialog = page.locator('#library-assistant-prompt-dialog');
  await safetyPromptDialog.waitFor({ state: 'visible' });
  await safetyPromptDialog.getByRole('button', { name: 'از کجا بفهمم درست انجامش داده‌ام؟' }).click();
  const previousSafetyReplyCount = await dialog.locator('.assistantMessage').count();
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction((previous) => {
    const replies = [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')];
    return replies.length > previous && Boolean(replies.at(-1)?.querySelector('[data-testid="daily-assistant-safety-reminder"]'));
  }, previousSafetyReplyCount);
  const safetyReply = dialog.locator('.assistantMessage').last();
  assert.equal(await safetyReply.getByTestId('daily-assistant-safety-reminder').count(), 1);
  assert.equal(await safetyReply.locator('.dailyAssistantSafetyReminderShafa').innerText(),
    'مرکز هیپنوتراپی شفا با شماره تماس ۰۹۱۹۰۸۸۹۰۶۲ همیشه در کل مسیر همراه شماست');
  assert.ok(Number(await safetyReply.locator('.dailyAssistantSafetyReminderShafa')
    .evaluate(element => getComputedStyle(element).fontWeight)) >= 700);
  await dialog.getByTestId('anger-daily-prompt-trigger').click();
  const normalQuestionDialog = page.locator('#library-assistant-prompt-dialog');
  await normalQuestionDialog.waitFor({ state: 'visible' });
  await normalQuestionDialog.getByRole('button', { name: 'منظور از تمرین امروز چیست؟' }).click();
  const previousNormalReplyCount = await dialog.locator('.assistantMessage').count();
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction((previous) => {
    const replies = [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')];
    return replies.length > previous && /بیا تمرین امروز را ساده و روشن باز کنیم/.test(replies.at(-1)?.innerText || '');
  }, previousNormalReplyCount);
  assert.equal(await dialog.locator('.assistantMessage').last().getByTestId('daily-assistant-safety-reminder').count(), 0,
    'normal prepared answers must not inherit the safety reminder');

  await page.locator('.globalAssistantDialog').getByRole('button', { name: 'بستن پنجره دستیار' }).click();
  await dialog.waitFor({ state: 'detached' });

  // Restore the pre-install state before testing the Library guided composer.
  await page.evaluate(async () => {
    const cache = await caches.open('maseer28-local-model-state-v1');
    await cache.delete(new URL('local-model/qwen3-0.6b-ready.json', location.href).href);
  });

  await page.getByRole('button', { name: 'خانه' }).click();
  await page.locator('#dashboard').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'مطالعه', exact: true }).click();
  await page.locator('.bottomNav button[data-view="books"].active').waitFor({ state: 'visible' });
  await launcher.click();
  dialog = page.getByRole('dialog', { name: 'دستیار راهنمای مسیر ۲۸' });
  await dialog.waitFor({ state: 'visible' });
  assert.match(await dialog.innerText(), /دستیار راهنمای مسیر ۲۸/);

  // Before successful local-model installation, only the guided picker is shown.
  const libraryPromptPicker = dialog.getByRole('button', { name: 'باز کردن سؤال‌های آماده دستیار کتابخانه' });
  await libraryPromptPicker.waitFor({ state: 'visible' });
  assert.equal(await libraryPromptPicker.isVisible(), true, 'base library mode must expose guided questions');
  assert.equal(await dialog.getByRole('textbox').count(), 0, 'free typing must remain hidden before local-model installation');
  assert.equal(await dialog.locator('.libraryAssistantPromptGuide small, .libraryAssistantAdvancedHint').count(), 0, 'the helper text below the picker must not be shown');
  const promptBox = await libraryPromptPicker.boundingBox();
  const promptSendBox = await dialog.getByRole('button', { name: 'ارسال' }).boundingBox();
  assert.ok(promptBox && promptSendBox && Math.abs((promptBox.y + promptBox.height / 2) - (promptSendBox.y + promptSendBox.height / 2)) <= 2, 'the send button must sit beside the prompt picker on the same row');
  await libraryPromptPicker.click();
  let promptDialog = page.locator('#library-assistant-prompt-dialog');
  await promptDialog.waitFor({ state: 'visible' });
  assert.equal(await promptDialog.getAttribute('role'), 'dialog', 'the preset picker must expose a semantic dialog');
  assert.equal(await promptDialog.evaluate((element) => element.classList.contains('libraryAssistantPromptCard') && element.classList.contains('validationCard')), true, 'the preset picker must reuse the archive reminder card structure');
  assert.equal(await promptDialog.getByRole('button', { name: 'متوجه شدم' }).count(), 0, 'the preset picker must not add a redundant acknowledgement button');
  const promptOptions = promptDialog.locator('[data-prompt-option]');
  assert.ok(await promptOptions.count() >= 25, 'the full grouped preset question list must be available');
  const firstPromptOption = promptOptions.first();
  const lastPromptOption = promptOptions.last();
  await lastPromptOption.focus();
  await page.keyboard.press('Tab');
  assert.equal(await firstPromptOption.evaluate((element) => element === document.activeElement), true, 'Tab from the final preset must wrap to the first preset');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await lastPromptOption.evaluate((element) => element === document.activeElement), true, 'Shift+Tab from the first preset must wrap to the final preset');
  await page.keyboard.press('Escape');
  await promptDialog.waitFor({ state: 'detached' });
  assert.equal(await libraryPromptPicker.evaluate((element) => element === document.activeElement), true, 'closing the preset picker must restore focus to its trigger');
  await libraryPromptPicker.click();
  promptDialog = page.getByRole('dialog', { name: 'سؤال آماده دستیار کتابخانه' });
  await promptDialog.getByRole('button', { name: 'خلاصه کتاب پنجم را بگو.' }).click();
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  try {
    await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some((node) => node.innerText.includes('خلاصه راهنمای محتوایی')));
  } catch (error) {
    console.error('LIBRARY_ASSISTANT_MESSAGES', JSON.stringify(await dialog.locator('.assistantMessage').allInnerTexts()));
    console.error('LIBRARY_ASSISTANT_DIALOG', await dialog.innerText());
    console.error('LIBRARY_ASSISTANT_ERRORS', JSON.stringify(errors));
    throw error;
  }
  const guidedLibrarySummary = dialog.locator('.assistantMessage').last();
  assert.match(await guidedLibrarySummary.innerText(), /هنر شناخت و دگرگونی احساسات/u);
  assert.match(await guidedLibrarySummary.innerText(), /منبع:/u);

  const librarySummary = dialog.locator('.assistantMessage').last();
  const librarySummaryText = await librarySummary.innerText();
  assert.match(librarySummaryText, /هنر شناخت و دگرگونی احساسات/u);
  assert.match(librarySummaryText, /شاهد کوتاه متن/u);
  assert.match(librarySummaryText, /منبع:/u);
  assert.match(librarySummaryText, /صفحه [0-9۰-۹٠-٩]+/u);

  // A second guided question must continue to work without exposing a text box.
  const previousReplyCount = await dialog.locator('.assistantMessage').count();
  await libraryPromptPicker.click();
  promptDialog = page.getByRole('dialog', { name: 'سؤال آماده دستیار کتابخانه' });
  await promptDialog.getByRole('button', { name: 'مهم‌ترین نکات کتاب پنجم کدام‌اند؟' }).click();
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction((count) => {
    const replies = [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')];
    return replies.length > count && !/در حال بررسی پرسش/u.test(replies.at(-1)?.innerText || '');
  }, previousReplyCount);
  const libraryFollowUp = dialog.locator('.assistantMessage').last();
  assert.match(await libraryFollowUp.innerText(), /هنر شناخت و دگرگونی احساسات/u);
  assert.match(await libraryFollowUp.innerText(), /نکته|مهم/u);

  // Local-model installation is no longer offered anywhere in the assistant UI.
  assert.equal(await dialog.getByRole('button', { name: 'نصب مدل هوش مصنوعی محلی' }).count(), 0,
    'the library assistant must not expose a local-model installation button');
  const guidedLibraryPicker = dialog.getByRole('button', { name: 'باز کردن سؤال‌های آماده دستیار کتابخانه' });
  assert.equal(await guidedLibraryPicker.isVisible(), true,
    'removing the installation button must not disable the prepared library assistant');

  // A stale/forged installed-model marker must never enable conversational or free-form model mode.
  await page.evaluate(async () => {
    const cache = await caches.open('maseer28-local-model-state-v1');
    const markerUrl = new URL('local-model/qwen3-0.6b-ready.json', location.href);
    await cache.put(markerUrl.href, new Response(JSON.stringify({
      modelId: 'onnx-community/Qwen3-0.6B-Instruct-ONNX',
      revision: '54250909aca286a05b9d013c8af7a21859ee6ead',
    }), { headers: { 'content-type': 'application/json' } }));
  });
  await page.locator('.globalAssistantDialog').getByRole('button', { name: 'بستن پنجره دستیار' }).click();
  await dialog.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'خانه' }).click();
  await page.locator('#dashboard').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'مطالعه', exact: true }).click();
  await page.locator('.bottomNav button[data-view="books"].active').waitFor({ state: 'visible' });
  await launcher.click();
  dialog = page.getByRole('dialog', { name: 'دستیار راهنمای مسیر ۲۸' });
  await dialog.waitFor({ state: 'visible' });
  assert.equal(await dialog.getByRole('textbox').count(), 0, 'a cached model marker must not reveal free typing');
  assert.equal(await dialog.getByRole('button', { name: 'باز کردن سؤال‌های آماده دستیار کتابخانه' }).count(), 1, 'the prepared question list must remain available');
  await dialog.getByRole('button', { name: 'بستن پنجره دستیار' }).click();
  await dialog.waitFor({ state: 'detached' });

  // Regression: opening a book after the assistant has been mounted must not
  // reopen the assistant when the reader unmounts and the library remounts.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.locator('#books .libraryBook button').first().click();
    await page.locator('#bookReader').waitFor({ state: 'visible' });
    assert.equal(await page.getByRole('dialog', { name: 'دستیار راهنمای مسیر ۲۸' }).count(), 0,
      'the assistant must not overlay the immersive reader');
    await page.getByRole('button', { name: 'خروج از مطالعه' }).click();
    await page.locator('#bookReader').waitFor({ state: 'detached' });
    await page.locator('#books').waitFor({ state: 'visible' });
    assert.equal(await page.getByRole('dialog', { name: 'دستیار راهنمای مسیر ۲۸' }).count(), 0,
      'closing the reader must return directly to the library without reopening the global assistant');
    assert.equal(await page.getByRole('button', { name: 'باز کردن دستیار مسیر۲۸' }).getAttribute('aria-expanded'), 'false',
      'the global assistant launcher must remain closed after reader exit');
  }

  await page.getByRole('button', { name: 'ارتباط' }).click();
  await page.locator('.bottomNav button[data-view="support"].active').waitFor({ state: 'visible' });
  await launcher.click();
  dialog = page.getByRole('dialog', { name: 'دستیار راهنمای مسیر ۲۸' });
  await dialog.waitFor({ state: 'visible' });
  assert.match(await dialog.innerText(), /دستیار راهنمای مسیر ۲۸/);
  assert.equal(await dialog.getByRole('textbox').count(), 0, 'support page must not expose free-text input');
  await dialog.getByRole('button', { name: 'باز کردن سؤال‌های آماده دستیار این صفحه' }).click();
  const supportPromptDialog = page.locator('#library-assistant-prompt-dialog');
  await supportPromptDialog.waitFor({ state: 'visible' });
  await supportPromptDialog.locator('[data-prompt-option]').first().click();
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some((node) => node.innerText.includes('بخش پشتیبانی محل شروع مناسبی است')));
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });

  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    const launcherBox = await launcher.boundingBox();
    const navigationBox = await page.locator('.bottomNav').boundingBox();
    assert.ok(launcherBox && navigationBox, 'launcher and bottom navigation must remain measurable on mobile');
    assert.ok(
      launcherBox.y + launcherBox.height <= navigationBox.y,
      `launcher must not overlap bottom navigation at ${viewport.width}x${viewport.height}`,
    );

    await launcher.click();
    dialog = page.getByRole('dialog', { name: 'دستیار راهنمای مسیر ۲۸' });
    await dialog.waitFor({ state: 'visible' });
    const dialogBox = await dialog.boundingBox();
    assert.ok(dialogBox, 'mobile dialog must have a visible layout box');
    assert.ok(dialogBox.x >= 0 && dialogBox.x + dialogBox.width <= viewport.width, 'mobile dialog must fit horizontally');
    assert.ok(dialogBox.y >= 0 && dialogBox.y + dialogBox.height <= viewport.height, 'mobile dialog must fit vertically');
    await page.locator('.globalAssistantDialog').getByRole('button', { name: 'بستن پنجره دستیار' }).click();
    await dialog.waitFor({ state: 'detached' });
  }

  assert.deepEqual(errors, [], 'global assistant navigation must not raise uncaught page errors');
  await page.close();
  process.stdout.write('PASS: Chromium global assistant placement, minimal chat UI, icon send control, daily-page shortcut, unsupported-page guard, X/Escape close, focus management and mobile layout (WV-BROWSER-GLOBAL-ASSISTANT)\\n');
} finally {
  await browser.close();
}
