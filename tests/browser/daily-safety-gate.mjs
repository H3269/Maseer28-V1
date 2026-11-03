import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });

function makeState(completedDays, problem = 'خشم') {
  const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const daily = Object.fromEntries(completedDays.map((day) => [day, {
    score: 4,
    feedback: 'same',
    feedbackText: 'ثبت آزمایشی قبلی',
    updatedAt: old,
  }]));
  return {
    schema: 7,
    started: true,
    profile: true,
    assessment: true,
    completed: completedDays,
    answers: {},
    daily,
    profileData: {
      problem,
      durationYears: 1,
      durationMonths: 0,
      goal: 'هدف آزمایشی',
      code: 'M28-SAFETY',
    },
    assessmentData: { score: 4 },
    final: null,
    archive: [],
    pathId: `safety-gate-${completedDays.length}`,
    startedAt: old,
    lastView: 'dashboard',
  };
}

async function seedPage(page, state, approvedContentIds = []) {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has('_m28_time')) {
      await route.fulfill({
        status: 200,
        headers: { date: new Date().toUTCString() },
      });
      return;
    }
    if (approvedContentIds.length > 0 && url.pathname.endsWith('/content/path-content.json')) {
      const response = await route.fetch();
      const content = await response.json();
      // Synthetic approval is used only to exercise the visible UI branch.
      // It does not alter repository content or represent clinical sign-off.
      for (const category of Object.values(content.categories || {})) {
        for (const day of category.days || []) {
          if (approvedContentIds.includes(day.id)) {
            day.review_status = 'approved';
            if (!day.risk_level) day.risk_level = 'caution';
          }
        }
      }
      await route.fulfill({ response, body: JSON.stringify(content) });
      return;
    }
    await route.continue();
  });
  await page.addInitScript((journey) => {
    localStorage.setItem('maseer28_onboarding_complete_v1', '1');
    localStorage.setItem('maseer28_state', JSON.stringify(journey));
    localStorage.setItem('maseer28_user_profile_v2', JSON.stringify({
      version: 2,
      name: 'کاربر آزمایشی',
      age: 35,
      gender: 'زن',
      phone: '09123456789',
      medical: 'none',
      medicalNote: '',
      medication: 'no',
      medicationRisk: 'no',
    }));
  }, state);
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('#copyrightModal').waitFor({ state: 'visible' });
  await page.locator('#copyrightModal').getByRole('button', { name: /متوجه شدم و ورود به مسیر را ادامه می‌دهم/ }).click();
  await page.locator('#dashboard').waitFor({ state: 'visible' });
  await page.locator('#dashboard .heroAction').click();
  await page.locator('#day').waitFor({ state: 'visible' });
}

try {
  const relationshipPage = await browser.newPage();
  const relationshipErrors = [];
  relationshipPage.on('pageerror', (error) => relationshipErrors.push(String(error)));
  await seedPage(relationshipPage, makeState([1, 2, 3, 4, 5, 6, 7, 8, 9]), ['خشم-10']);
  const relationshipText = await relationshipPage.locator('#day').innerText();
  assert.match(relationshipText, /آیا در این رابطه یا تعامل، هر دو نفر می‌توانند آزادانه گفت‌وگو را رد یا متوقف کنند/);
  assert.doesNotMatch(relationshipText, /یک برنامه مکث امن با سه جزء بنویس/);
  await relationshipPage.getByLabel(/نه، مطمئن نیستم/).check();
  await relationshipPage.getByText(/تمرین ارتباطی امروز نمایش داده نمی‌شود/).waitFor({ state: 'visible' });
  await relationshipPage.getByRole('button', { name: 'ثبت عدم اجرای تمرین و ادامه مسیر' }).click();
  await relationshipPage.locator('#dailyResult').waitFor({ state: 'visible' });
  await relationshipPage.waitForFunction(() => JSON.parse(localStorage.getItem('maseer28_state')).daily?.[10]?.status === 'skipped_safety_gate');
  assert.equal(await relationshipPage.locator('#resultScore').innerText(), '—');
  assert.equal(await relationshipPage.locator('#resultFeedback').innerText(), 'تمرین اجرا نشد');
  const relationshipState = await relationshipPage.evaluate(() => JSON.parse(localStorage.getItem('maseer28_state')));
  assert.equal(relationshipState.daily[10].status, 'skipped_safety_gate');
  assert.equal('score' in relationshipState.daily[10], false);
  assert.equal('feedback' in relationshipState.daily[10], false);
  assert.ok(relationshipState.completed.includes(10));
  assert.deepEqual(relationshipErrors, []);
  await relationshipPage.close();

  const sharedPromptPage = await browser.newPage();
  const sharedPromptErrors = [];
  sharedPromptPage.on('pageerror', (error) => sharedPromptErrors.push(String(error)));
  await seedPage(sharedPromptPage, makeState([1, 2, 3, 4, 5], 'ترس'));
  const sharedPromptText = await sharedPromptPage.locator('#day').innerText();
  assert.match(sharedPromptText, /این تمرین در نسخه فعلی فعال نیست/);
  assert.match(sharedPromptText, /نیازمند بازبینی انسانی/);
  assert.doesNotMatch(sharedPromptText, /آیا در این رابطه یا تعامل، هر دو نفر می‌توانند آزادانه گفت‌وگو را رد یا متوقف کنند/);
  await sharedPromptPage.getByRole('button', { name: 'ثبت عدم اجرای تمرین و ادامه مسیر' }).click();
  await sharedPromptPage.locator('#dailyResult').waitFor({ state: 'visible' });
  await sharedPromptPage.waitForFunction(() => JSON.parse(localStorage.getItem('maseer28_state')).daily?.[6]?.status === 'skipped_human_review');
  assert.equal(await sharedPromptPage.locator('#resultScore').innerText(), '—');
  const sharedPromptState = await sharedPromptPage.evaluate(() => JSON.parse(localStorage.getItem('maseer28_state')));
  assert.equal(sharedPromptState.daily[6].status, 'skipped_human_review');
  assert.equal('score' in sharedPromptState.daily[6], false);
  assert.equal('feedback' in sharedPromptState.daily[6], false);
  assert.ok(sharedPromptState.completed.includes(6));
  assert.deepEqual(sharedPromptErrors, []);
  await sharedPromptPage.close();

  const solutionPage = await browser.newPage();
  const solutionErrors = [];
  solutionPage.on('pageerror', (error) => solutionErrors.push(String(error)));
  await seedPage(solutionPage, makeState(Array.from({ length: 18 }, (_, index) => index + 1)), ['خشم-19']);
  const solutionText = await solutionPage.locator('#day').innerText();
  assert.match(solutionText, /آیا در این رابطه یا تعامل، هر دو نفر می‌توانند آزادانه گفت‌وگو را رد یا متوقف کنند/);
  await solutionPage.getByLabel(/نه، مطمئن نیستم/).check();
  await solutionPage.getByText(/تمرین ارتباطی امروز نمایش داده نمی‌شود/).waitFor({ state: 'visible' });
  await solutionPage.getByRole('button', { name: 'ثبت عدم اجرای تمرین و ادامه مسیر' }).click();
  await solutionPage.locator('#dailyResult').waitFor({ state: 'visible' });
  await solutionPage.waitForFunction(() => JSON.parse(localStorage.getItem('maseer28_state')).daily?.[19]?.status === 'skipped_safety_gate');
  assert.equal(await solutionPage.locator('#resultScore').innerText(), '—');
  const solutionState = await solutionPage.evaluate(() => JSON.parse(localStorage.getItem('maseer28_state')));
  assert.equal(solutionState.daily[19].status, 'skipped_safety_gate');
  assert.equal('score' in solutionState.daily[19], false);
  assert.equal('feedback' in solutionState.daily[19], false);
  assert.ok(solutionState.completed.includes(19));
  assert.deepEqual(solutionErrors, []);
  await solutionPage.close();
  const safeRelationshipPage = await browser.newPage();
  await seedPage(safeRelationshipPage, makeState([1, 2, 3, 4, 5, 6, 7, 8, 9]), ['خشم-10']);
  await safeRelationshipPage.getByLabel(/بله؛ هر دو نفر می‌توانند آزادانه گفت‌وگو را رد یا متوقف کنند/).click({ noWaitAfter: true });
  await safeRelationshipPage.locator('#dayExercise').waitFor({ state: 'visible' });
  const pausePlan = safeRelationshipPage.locator('#day #t01PausePlan');
  await pausePlan.waitFor({ state: 'visible' });
  assert.equal(await pausePlan.count(), 1, 'the pause plan must render once inside the active day card');
  const pausePlanText = await pausePlan.innerText();
  assert.match(pausePlanText, /یک برنامه مکث امن با سه جزء بنویس/);
  assert.match(pausePlanText, /نشانه مکث/);
  assert.match(pausePlanText, /محل فاصله‌گیری/);
  assert.match(pausePlanText, /شرط ادامه گفتگو/);
  assert.match(pausePlanText, /رضایت آزادانه هر دو نفر/);
  assert.match(pausePlanText, /تعیین زمان بازگشت یا وعده ادامه گفتگو الزامی نیست/);
  const safeRelationshipText = await safeRelationshipPage.locator('#day').innerText();
  assert.match(safeRelationshipText, /بررسی اولیه ایمنی/);
  const safeRelationshipState = await safeRelationshipPage.evaluate(() => JSON.parse(localStorage.getItem('maseer28_state')));
  assert.equal('relationshipSafetyResponse' in safeRelationshipState, false);
  assert.equal('relationshipSafetyState' in safeRelationshipState, false);
  await safeRelationshipPage.close();

  const humanReviewPage = await browser.newPage();
  const humanReviewErrors = [];
  humanReviewPage.on('pageerror', (error) => humanReviewErrors.push(String(error)));
  await seedPage(humanReviewPage, makeState(Array.from({ length: 26 }, (_, index) => index + 1)));
  const humanReviewText = await humanReviewPage.locator('#day').innerText();
  assert.match(humanReviewText, /این تمرین در نسخه فعلی فعال نیست/);
  assert.match(humanReviewText, /نیازمند بازبینی انسانی/);
  assert.doesNotMatch(humanReviewText, /فقط اگر در حال حاضر خطر فوری وجود ندارد/);
  await humanReviewPage.getByRole('button', { name: 'ثبت عدم اجرای تمرین و ادامه مسیر' }).click();
  await humanReviewPage.locator('#dailyResult').waitFor({ state: 'visible' });
  await humanReviewPage.waitForFunction(() => JSON.parse(localStorage.getItem('maseer28_state')).daily?.[27]?.status === 'skipped_human_review');
  assert.equal(await humanReviewPage.locator('#resultScore').innerText(), '—');
  const humanReviewState = await humanReviewPage.evaluate(() => JSON.parse(localStorage.getItem('maseer28_state')));
  assert.equal(humanReviewState.daily[27].status, 'skipped_human_review');
  assert.equal('score' in humanReviewState.daily[27], false);
  assert.equal('feedback' in humanReviewState.daily[27], false);
  assert.ok(humanReviewState.completed.includes(27));
  assert.deepEqual(humanReviewErrors, []);
  await humanReviewPage.close();

  process.stdout.write('PASS: Chromium blocks unsafe T01 communication and human-review-only exercises, records non-scored skips, and preserves progression (WV-BROWSER-SAFETY)\n');
} finally {
  await browser.close();
}
