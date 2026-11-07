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
  let dialog = page.getByRole('dialog', { name: 'دستیار هوشمند مسیر ۲۸' });
  await dialog.waitFor({ state: 'visible' });
  const closeButton = dialog.getByRole('button', { name: 'بستن پنجره دستیار' });
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'بستن پنجره دستیار');
  assert.equal(await launcher.getAttribute('aria-expanded'), 'true');
  // DOM order is close button, message field, then enabled send button.
  // Start from the actual first control to verify Shift+Tab wraps to the last.
  await dialog.getByRole('textbox').fill('آزمون گردش فوکوس');
  await closeButton.focus();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await dialog.getByRole('button', { name: 'ارسال' }).evaluate((element) => element === document.activeElement), true, 'Shift+Tab from the first control must wrap to the last enabled control');
  await page.keyboard.press('Tab');
  assert.equal(await closeButton.evaluate((element) => element === document.activeElement), true, 'Tab from the last enabled control must wrap to the first');
  await dialog.getByRole('textbox').fill('');
  assert.match(await dialog.innerText(), /دستیار هوشمند مسیر ۲۸/);
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
  assert.equal(await sendButton.isDisabled(), true, 'send must start disabled while the composer is empty');
  await dialog.getByRole('textbox').fill('   ');
  assert.equal(await sendButton.isDisabled(), true, 'whitespace alone must not enable sending');
  await dialog.getByRole('textbox').fill('آزمون فعال شدن دکمه');
  assert.equal(await sendButton.isEnabled(), true, 'typing a non-empty question must enable sending');
  await dialog.getByRole('textbox').fill('');
  assert.equal(await sendButton.isDisabled(), true, 'clearing the question must disable sending again');
  assert.equal((await dialog.innerText()).includes('09123456789'), false, 'private profile data must not be exposed to the page assistant');
  await dialog.getByRole('textbox').fill('اینجا چه کارهایی می‌توانم انجام بدهم؟ 28');
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForTimeout(250);
  await page.waitForFunction(() => document.querySelector('.globalAssistantDialog')?.innerText.includes('ادامه مسیر امروز'));
  const firstAssistantReply = dialog.locator('.assistantMessage').last();
  assert.match(await firstAssistantReply.innerText(), /در صفحه «خانه» می‌توانی/);
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
  await closeButton.click();
  await dialog.waitFor({ state: 'detached' });
  assert.equal(await launcher.getAttribute('aria-expanded'), 'false');
  assert.equal(await launcher.evaluate((element) => element === document.activeElement), true, 'closing the dialog must restore focus to the launcher');

  await page.locator('#dashboard .heroAction').click();
  await page.locator('#day').waitFor({ state: 'visible' });
  await launcher.waitFor({ state: 'visible' });
  await launcher.click();
  dialog = page.getByRole('dialog', { name: 'دستیار هوشمند مسیر ۲۸' });
  await dialog.waitFor({ state: 'visible' });
  assert.doesNotMatch(await dialog.innerText(), /صفحه فعلی:|موضوع: خشم/);
  assert.equal(await page.locator('.dailyExerciseAssistant').count(), 0, 'the standalone daily assistant panel must be removed');
  await dialog.getByRole('textbox').fill('چطور انجامش بدم؟');
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some(node => /متن تمرین همین روز/.test(node.innerText)));
  const dailyReply = dialog.locator('.assistantMessage').last();
  assert.match(await dailyReply.innerText(), /خشم/);
  assert.match(await dailyReply.innerText(), /روز ۱/);
  assert.match(await dailyReply.innerText(), /متن تمرین همین روز/);
  assert.match(await dailyReply.innerText(), /راهکار اختصاصی همین روز/);
  await closeButton.click();
  await dialog.waitFor({ state: 'detached' });

  await page.getByRole('button', { name: 'خانه' }).click();
  await page.locator('#dashboard').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'مطالعه', exact: true }).click();
  await page.locator('.bottomNav button[data-view="books"].active').waitFor({ state: 'visible' });
  await launcher.click();
  dialog = page.getByRole('dialog', { name: 'دستیار هوشمند مسیر ۲۸' });
  await dialog.waitFor({ state: 'visible' });
  assert.match(await dialog.innerText(), /دستیار هوشمند مسیر ۲۸/);
  await dialog.getByRole('textbox').fill('این صفحه برای چیست؟');
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some((node) => node.innerText.includes('برای مرور کتاب‌های موجود')));

  // Exercise the actual library-book assistant path, not only the generic page helper.
  await dialog.getByRole('textbox').fill('خلاصه کتاب پنجم را بگو');
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')].some((node) => node.innerText.includes('خلاصه راهنمای محتوایی')));
  const librarySummary = dialog.locator('.assistantMessage').last();
  const librarySummaryText = await librarySummary.innerText();
  assert.match(librarySummaryText, /هنر شناخت و دگرگونی احساسات/u);
  assert.match(librarySummaryText, /شاهد کوتاه متن/u);
  assert.match(librarySummaryText, /منبع:/u);
  assert.match(librarySummaryText, /صفحه \d+/u);

  // The second turn must retain the selected book and answer the new question.
  await dialog.getByRole('textbox').fill('چه محدودیت‌هایی دارد؟');
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await page.waitForFunction(() => {
    const replies = [...document.querySelectorAll('.globalAssistantDialog .assistantMessage')];
    return replies.length >= 3 && /محدودیت/u.test(replies.at(-1)?.innerText || '');
  });
  const libraryFollowUp = dialog.locator('.assistantMessage').last();
  assert.match(await libraryFollowUp.innerText(), /هنر شناخت و دگرگونی احساسات/u);
  assert.match(await libraryFollowUp.innerText(), /محدودیت/u);

  await closeButton.click();
  await dialog.waitFor({ state: 'detached' });

  await page.getByRole('button', { name: 'ارتباط' }).click();
  await page.locator('.bottomNav button[data-view="support"].active').waitFor({ state: 'visible' });
  await launcher.click();
  dialog = page.getByRole('dialog', { name: 'دستیار هوشمند مسیر ۲۸' });
  await dialog.waitFor({ state: 'visible' });
  assert.match(await dialog.innerText(), /دستیار هوشمند مسیر ۲۸/);
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
    dialog = page.getByRole('dialog', { name: 'دستیار هوشمند مسیر ۲۸' });
    await dialog.waitFor({ state: 'visible' });
    const dialogBox = await dialog.boundingBox();
    assert.ok(dialogBox, 'mobile dialog must have a visible layout box');
    assert.ok(dialogBox.x >= 0 && dialogBox.x + dialogBox.width <= viewport.width, 'mobile dialog must fit horizontally');
    assert.ok(dialogBox.y >= 0 && dialogBox.y + dialogBox.height <= viewport.height, 'mobile dialog must fit vertically');
    await closeButton.click();
    await dialog.waitFor({ state: 'detached' });
  }

  assert.deepEqual(errors, [], 'global assistant navigation must not raise uncaught page errors');
  await page.close();
  process.stdout.write('PASS: Chromium global assistant placement, minimal chat UI, icon send control, daily-page shortcut, unsupported-page guard, X/Escape close, focus management and mobile layout (WV-BROWSER-GLOBAL-ASSISTANT)\\n');
} finally {
  await browser.close();
}
