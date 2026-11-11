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
      const day = payload.categories?.['خشم']?.days?.find((item) => Number(item.day) === 1);
      assert.ok(day, 'the global assistant fixture must contain anger day 1');
      Object.assign(day, {
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
  // The visible model-install button is the first focusable control in DOM order;
  // the enabled send button is last. Test the actual order rather than assuming
  // the close button is first (the install action was added to the header later).
  await dialog.getByRole('textbox').fill('آزمون گردش فوکوس');
  const firstDialogControl = dialog.getByRole('button', { name: 'نصب مدل هوش مصنوعی محلی' });
  const lastDialogControl = dialog.getByRole('button', { name: 'ارسال' });
  await firstDialogControl.focus();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await lastDialogControl.evaluate((element) => element === document.activeElement), true, 'Shift+Tab from the actual first control must wrap to the last enabled control');
  await page.keyboard.press('Tab');
  assert.equal(await firstDialogControl.evaluate((element) => element === document.activeElement), true, 'Tab from the actual last control must wrap to the first');
  await dialog.getByRole('textbox').fill('');
  assert.match(await dialog.innerText(), /دستیار راهنمای مسیر ۲۸/);
  const dialogBoxForLayout = await dialog.boundingBox();
  assert.ok(dialogBoxForLayout.width >= 500, 'assistant dialog should use a wider desktop layout');
  const titleBox = await dialog.locator('#global-assistant-title').boundingBox();
  const closeBox = await closeButton.boundingBox();
  assert.ok(titleBox && closeBox && Math.abs(titleBox.y - closeBox.y) < 8, 'title and close control must share one header row');
  const sendButton = dialog.getByRole('button', { name: 'ارسال' });
  const sendButtonBox = await sendButton.boundingBox();
  assert.ok(sendButtonBox && Math.abs(sendButtonBox.width - 36) <= 1 && Math.abs(sendButtonBox.height - 36) <= 1 && Math.abs(sendButtonBox.width - sendButtonBox.height) <= 1, 'send control must be a compact 36px square');
  assert.equal(await sendButton.locator('svg path').count(), 1, 'send icon must contain only the arrowhead without a shaft');
  assert.equal(await sendButton.locator('svg path').first().getAttribute('d'), 'm5 14 7-7 7 7', 'send arrowhead must point upward without an inner line');
  assert.doesNotMatch(await dialog.innerText(), /پردازش این نسخه|می‌توانی بپرسی/);
  assert.equal(await dialog.getByRole('button', { name: 'متوجه شدم' }).count(), 0, 'the redundant bottom close action must be removed');
  assert.equal(await dialog.getByPlaceholder('چطور میتونم کمکت کنم؟').count(), 1, 'the composer must show the concise prompt');
  assert.equal(await dialog.getByRole('textbox').count(), 1, 'the limited local page assistant must expose its message composer');
  const composerInput = dialog.getByRole('textbox');
  const emptyInputBox = await composerInput.boundingBox();
  assert.ok(emptyInputBox && Math.abs(emptyInputBox.height - 54) <= 1, 'the empty composer must start at one line high');
  const composerBox = await dialog.locator('.assistantComposer').boundingBox();
  const sendBox = await dialog.getByRole('button', { name: 'ارسال' }).boundingBox();
  assert.ok(emptyInputBox && composerBox && sendBox, 'the composer controls must have measurable layout boxes');
  assert.ok(Math.abs(emptyInputBox.y - sendBox.y) <= Math.abs(emptyInputBox.height - sendBox.height) + 2, 'the send button must remain beside the input, not wrap below it');
  const composerMetrics = await dialog.locator('.assistantComposer').evaluate((element) => { const style = getComputedStyle(element); return { padding: parseFloat(style.paddingInlineStart) + parseFloat(style.paddingInlineEnd), gap: parseFloat(style.columnGap || style.gap || '0') }; });
  const expectedFullWidth = composerBox.width - composerMetrics.padding - sendBox.width - composerMetrics.gap;
  assert.ok(Math.abs(emptyInputBox.width - expectedFullWidth) <= 2, 'the composer input must use the maximum available horizontal width from the start');
  await composerInput.fill('می‌خواهم یک سؤال بپرسم');
  const shortInputBox = await composerInput.boundingBox();
  assert.ok(shortInputBox && Math.abs(shortInputBox.width - emptyInputBox.width) <= 1, 'typing must not change the maximum horizontal width');
  assert.ok(Math.abs(shortInputBox.height - 54) <= 1, 'a one-line question must keep the composer one line high');
  await composerInput.fill('پرسش طولانی '.repeat(28));
  const longInputBox = await composerInput.boundingBox();
  assert.ok(longInputBox && Math.abs(longInputBox.width - emptyInputBox.width) <= 1, 'the input width must remain fixed at its maximum while text grows');
  assert.ok(longInputBox.height > 54, 'the input height must grow automatically when the text wraps to additional lines');
  await composerInput.fill('');
  const clearedInputBox = await composerInput.boundingBox();
  assert.ok(clearedInputBox && Math.abs(clearedInputBox.width - emptyInputBox.width) <= 1 && Math.abs(clearedInputBox.height - 54) <= 1, 'clearing the question must restore one-line height without changing width');
  assert.equal(await sendButton.isDisabled(), true, 'send must start disabled while the composer is empty');
  await dialog.getByRole('textbox').fill('   ');
  assert.equal(await sendButton.isDisabled(), true, 'whitespace alone must not enable sending');
  await dialog.getByRole('textbox').fill('آزمون فعال شدن دکمه');
  assert.equal(await sendButton.isEnabled(), true, 'typing a non-empty question must enable sending');
  await dialog.getByRole('textbox').fill('');
  assert.equal(await sendButton.isDisabled(), true, 'clearing the question must disable sending again');
  assert.equal((await dialog.innerText()).includes('09123456789'), false, 'private profile data must not be exposed to the page assistant');
  await dialog.getByRole('textbox').fill('اینجا چه کارهایی می‌توانم انجام بدهم؟');
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => document.querySelector('.globalAssistantDialog')?.innerText.includes('ادامه مسیر امروز'));
  const firstAssistantReply = dialog.locator('.assistantMessage').last();
  assert.match(await firstAssistantReply.innerText(), /در صفحه «خانه» می‌توانی/);
  await dialog.getByRole('textbox').fill('روز 28');
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .userMessage')].some((node) => node.innerText.includes('۲۸')));
  assert.match(await dialog.locator('.userMessage').last().innerText(), /۲۸/, 'visible user messages must localize typed ASCII digits');
  assert.doesNotMatch(await dialog.locator('.userMessage').last().innerText(), /[0-9]/, 'visible user messages must not expose ASCII digits');
  assert.equal(await dialog.locator('.assistantChatShell').count(), 1, 'the assistant must use one continuous chat surface');
  assert.equal(await dialog.locator('.assistantTranscript').count(), 1, 'user and assistant messages must share one transcript');
  const rtlLayout = await dialog.locator('.assistantTranscript, .userMessage, .assistantMessage, .assistantComposer textarea').evaluateAll((nodes) => nodes.map((node) => ({ direction: getComputedStyle(node).direction, align: getComputedStyle(node).textAlign })));
  assert.ok(rtlLayout.every((item) => item.direction === 'rtl' && item.align === 'right'), 'the transcript, both speaker bubbles and composer must be right-to-left and right-aligned');
  const messageRows = await dialog.locator('.userMessage, .assistantMessage').evaluateAll((nodes) => nodes.map((node) => {
    const style = getComputedStyle(node);
    return { background: style.backgroundColor, borderStyle: style.borderTopStyle, labelColor: getComputedStyle(node.querySelector('b')).color };
  }));
  assert.ok(messageRows.every((row) => row.background === 'rgba(0, 0, 0, 0)' && row.borderStyle === 'none'), 'individual user and assistant message cards must be removed');
  assert.notEqual(messageRows[0].labelColor, messageRows[1].labelColor, 'speaker labels should remain visually distinct without separate cards');
  await dialog.getByRole('textbox').fill('چه راهکاری برای اضطراب وجود دارد؟');
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some((node) => node.innerText.includes('این پرسش درباره تجربه و وضعیت شخصی خودت است')));
  await dialog.getByRole('textbox').fill('برای خودم');
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some((node) => node.innerText.includes('موضوع فعلاً فقط یک فرضیه اولیه است')));
  const scopedReply = dialog.locator('.assistantMessage').last();
  assert.match(await scopedReply.innerText(), /موضوع فعلاً فقط یک فرضیه اولیه است/);
  assert.doesNotMatch(await scopedReply.innerText(), /در صفحه «خانه» می‌توانی/);

  await dialog.getByRole('textbox').fill('چه راهکاری برای اضطراب وجود دارد؟');
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some((node) => node.innerText.includes('این پرسش درباره تجربه و وضعیت شخصی خودت است')));
  await dialog.getByRole('textbox').fill('شاید بعداً');
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some((node) => node.innerText.includes('فقط مشخص کن منظورت تجربه و وضعیت شخصی خودت است یا اطلاعات عمومی')));
  await dialog.getByRole('textbox').fill('برای خودم');
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some((node) => node.innerText.includes('موضوع فعلاً فقط یک فرضیه اولیه است')));
  const retriedScopedReply = dialog.locator('.assistantMessage').last();
  assert.match(await retriedScopedReply.innerText(), /موضوع فعلاً فقط یک فرضیه اولیه است/);
  assert.doesNotMatch(await retriedScopedReply.innerText(), /در صفحه «خانه» می‌توانی/);

  await dialog.getByRole('textbox').fill('من اضطراب دارم؛ این صفحه برای چیست؟');
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some((node) => node.innerText.includes('موضوع فعلاً فقط')));
  const personalReply = dialog.locator('.assistantMessage').last();
  assert.match(await personalReply.innerText(), /موضوع فعلاً فقط یک فرضیه اولیه است/);
  assert.doesNotMatch(await personalReply.innerText(), /در صفحه «خانه» می‌توانی/);
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

  // Safety handoff must expose the Shafa call link without replacing emergency guidance.
  const humanHelp = dialog.getByTestId('daily-assistant-human-help');
  const urgentHelp = dialog.getByTestId('daily-assistant-urgent-help');
  assert.ok(await humanHelp.isVisible() && await urgentHelp.isVisible(), 'both safety actions must remain visible');
  const safetyButtonMetrics = await Promise.all([humanHelp, urgentHelp].map((button) => button.evaluate((element) => {
    const style = getComputedStyle(element);
    return { height: element.getBoundingClientRect().height, border: style.borderTopColor, background: style.backgroundColor };
  })));
  assert.ok(safetyButtonMetrics.every((item) => item.height <= 42), 'safety buttons must stay compact');
  assert.notEqual(safetyButtonMetrics[0].border, safetyButtonMetrics[1].border, 'help and urgent-risk actions must have distinct but restrained colors');
  // The explicit urgent-risk action must trigger the handoff text and Shafa contact.
  await urgentHelp.click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')]
    .some((node) => /اورژانس|خدمات اورژانسی/u.test(node.innerText)));
  const shafaContact = dialog.getByTestId('daily-assistant-shafa-contact');
  await shafaContact.waitFor({ state: 'visible' });
  assert.equal(await shafaContact.getByRole('link').getAttribute('href'), 'tel:+989190889062');
  assert.match(await shafaContact.innerText(), /۰۹۱۹۰۸۸۹۰۶۲/u);
  assert.match(await dialog.locator('.assistantMessage').last().innerText(), /اورژانس|خدمات اورژانسی/u,
    'the Shafa contact must supplement, not replace, emergency guidance');
  assert.equal(await dialog.getByTestId('anger-daily-prompt-trigger').count(), 0,
    'prepared daily questions must be hidden while the human-support stage is active');
  const returnToDaily = dialog.getByTestId('daily-assistant-return-to-daily');
  await returnToDaily.waitFor({ state: 'visible' });
  await returnToDaily.click();
  assert.equal(await dialog.getByTestId('anger-daily-prompt-trigger').count(), 0,
    'the handoff must remain active until the user explicitly confirms that immediate danger has passed');
  await dialog.getByTestId('daily-assistant-confirm-safe-return').click();
  const restoredDailyPicker = dialog.getByTestId('anger-daily-prompt-trigger');
  await restoredDailyPicker.waitFor({ state: 'visible' });
  await restoredDailyPicker.click();
  const restoredQuestionDialog = page.locator('#library-assistant-prompt-dialog');
  await restoredQuestionDialog.waitFor({ state: 'visible' });
  await restoredQuestionDialog.locator('[data-prompt-option]').first().click();
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')]
    .some((node) => /راهنمای روز ۱ خشم/u.test(node.innerText)));
  assert.match(await dialog.locator('.assistantMessage').last().innerText(), /راهنمای روز ۱ خشم/u,
    'closing the support stage must restore the exact prepared answer for the same day');

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
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some((node) => node.innerText.includes('خلاصه راهنمای محتوایی')));
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

  // A failed optional model installation must not disable the deterministic library assistant.
  const installModelButton = dialog.getByRole('button', { name: 'نصب مدل هوش مصنوعی محلی' });
  assert.equal(await installModelButton.isVisible(), true, 'model installation must be discoverable without memorizing a command');
  // Force a deterministic offline failure across every model CDN/redirect host.
  // Intercepting only huggingface.co can miss CDN subdomains and start a real download.
  await page.context().setOffline(true);
  await installModelButton.click();
  await dialog.getByRole('button', { name: 'بله، شروع نصب' }).waitFor({ state: 'visible' });
  await dialog.getByRole('button', { name: 'بله، شروع نصب' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some((node) => /دستیار پایه همچنان فعال است/u.test(node.innerText)));
  await page.context().setOffline(false);
  const fallbackPromptPicker = dialog.getByRole('button', { name: 'باز کردن سؤال‌های آماده دستیار کتابخانه' });
  await fallbackPromptPicker.waitFor({ state: 'visible' });
  await fallbackPromptPicker.click();
  promptDialog = page.getByRole('dialog', { name: 'سؤال آماده دستیار کتابخانه' });
  await promptDialog.getByRole('button', { name: 'خلاصه کتاب چهارم را بگو.' }).click();
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some((node) => /خلاصه راهنمای محتوایی/u.test(node.innerText)));
  const fallbackAfterInstallFailure = dialog.locator('.assistantMessage').last();
  assert.equal(await fallbackPromptPicker.isVisible(), true, 'failed installation must retain the guided base-mode question list');
  assert.equal(await dialog.getByRole('textbox').count(), 0, 'failed installation must keep free typing hidden');
  assert.match(await fallbackAfterInstallFailure.innerText(), /شاهد کوتاه متن|منبع:/u, 'the book assistant must continue returning a grounded base answer after model installation fails');
  assert.doesNotMatch(await fallbackAfterInstallFailure.innerText(), /این گوشی یا مرورگر نتوانست مدل محلی را اجرا کند/u, 'the installation failure must not replace later answers');

  // A valid installed-model marker switches only the Library composer to free-form mode.
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
  await page.getByRole('button', { name: 'ارتباط' }).click();
  await page.locator('.bottomNav button[data-view="support"].active').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'خانه' }).click();
  await page.locator('#dashboard').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'مطالعه', exact: true }).click();
  await page.locator('.bottomNav button[data-view="books"].active').waitFor({ state: 'visible' });
  await launcher.click();
  dialog = page.getByRole('dialog', { name: 'دستیار راهنمای مسیر ۲۸' });
  await dialog.waitFor({ state: 'visible' });
  await page.getByPlaceholder('سؤال پیشرفته‌ات را اینجا بنویس...').waitFor({ state: 'visible' });
  assert.equal(await dialog.getByRole('textbox').count(), 1, 'successful local-model installation must reveal free typing');
  assert.equal(await dialog.getByRole('button', { name: 'باز کردن سؤال‌های آماده دستیار کتابخانه' }).count(), 0, 'installed local mode must hide the guided list');
  await page.locator('.globalAssistantDialog').getByRole('button', { name: 'بستن پنجره دستیار' }).click();
  await dialog.waitFor({ state: 'detached' });

  await page.getByRole('button', { name: 'ارتباط' }).click();
  await page.locator('.bottomNav button[data-view="support"].active').waitFor({ state: 'visible' });
  await launcher.click();
  dialog = page.getByRole('dialog', { name: 'دستیار راهنمای مسیر ۲۸' });
  await dialog.waitFor({ state: 'visible' });
  assert.match(await dialog.innerText(), /دستیار راهنمای مسیر ۲۸/);
  await dialog.getByRole('textbox').fill('این صفحه برای چیست؟');
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some((node) => node.innerText.includes('راه‌های ارتباط با مرکز')));
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
