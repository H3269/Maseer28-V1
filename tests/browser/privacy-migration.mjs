import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const browserErrors = [];

function legacyJourney() {
  const profileData = {
    name: 'کاربر آزمایشی', age: 35, gender: 'زن', phone: '09123456789',
    medical: 'none', medicalNote: 'TEST-PRIVATE-001', medication: 'no',
    medicationRisk: 'no', problem: 'anxiety', durationYears: 2,
    durationMonths: 3, goal: 'هدف آزمایشی', code: 'M28-123456',
  };
  return {
    schema: 7, started: true, profile: true, assessment: true, completed: [1],
    answers: { 1: 'TEST-ANSWER-001' },
    daily: { 1: { score: 5, feedback: 'same', feedbackText: 'TEST-FEEDBACK-001' } },
    profileData, assessmentData: { score: 4 },
    final: { score: 6, f1: 'TEST-FINAL-REPORT-001', f2: 'TEST-FINAL-002', f3: '', f4: '' },
    archive: [
      { pathId: 'archive-1', profileData: { ...profileData, name: 'هویت آرشیو اول', code: 'M28-OLD001' },
        answers: { 1: 'TEST-ARCHIVE-ANSWER-1' }, completed: [1], final: { score: 5, f1: 'TEST-ARCHIVE-REPORT-1' } },
      { pathId: 'archive-2', profileData: { ...profileData, name: 'هویت آرشیو دوم', medicalNote: 'TEST-ARCHIVE-PRIVATE-2', code: 'M28-OLD002' },
        answers: { 2: 'TEST-ARCHIVE-ANSWER-2' }, completed: [1, 2], final: { score: 7, f1: 'TEST-ARCHIVE-REPORT-2' } },
    ],
    pathId: 'active-path-1', startedAt: '2026-01-01T00:00:00.000Z', lastView: 'dashboard',
  };
}

async function openScenario(mode = 'normal', state = legacyJourney(), independentProfile = null) {
  const page = await browser.newPage();
  page.on('pageerror', (error) => browserErrors.push(String(error)));
  await page.addInitScript(({ state, failureMode, independentProfile }) => {
    // Seed each scenario once. addInitScript runs again on reload, so reseeding
    // here would silently restore deleted test data and invalidate persistence checks.
    if (!sessionStorage.getItem('__path28_scenario_seeded')) {
      localStorage.setItem('maseer28_state', JSON.stringify(state));
      if (independentProfile) localStorage.setItem('maseer28_user_profile_v2', JSON.stringify(independentProfile));
      sessionStorage.setItem('__path28_scenario_seeded', '1');
    }
    const nativeSetItem = Storage.prototype.setItem;
    if (failureMode === 'profile-write-fails') {
      Storage.prototype.setItem = function (key, value) {
        if (key === 'maseer28_user_profile_v2') throw new Error('simulated profile storage failure');
        return nativeSetItem.call(this, key, value);
      };
    }
    if (failureMode === 'journey-write-then-throw') {
      let failed = false;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'maseer28_state' && !failed) {
          let candidate;
          try { candidate = JSON.parse(String(value)); } catch { candidate = null; }
          if (candidate?.privacyMigrationVersion === 1) {
            nativeSetItem.call(this, key, value);
            failed = true;
            throw new Error('simulated write-then-throw');
          }
        }
        return nativeSetItem.call(this, key, value);
      };
    }
  }, { state, independentProfile, failureMode: mode });
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const root = document.querySelector('#root');
    return Boolean(root && root.children.length);
  }, null, { timeout: 15000 });
  return page;
}

try {
  // E1: a new user with an already independent profile must start cleanly.
  {
    const freshState = {
      schema: 7, started: false, profile: false, assessment: false,
      completed: [], answers: {}, daily: {}, final: null, profileData: null, archive: [],
    };
    const independentProfile = {
      name: 'کاربر تازه', age: 30, gender: 'مرد', phone: '09123456789',
      medical: 'none', medicalNote: '', medication: 'no', medicationRisk: 'no',
    };
    const page = await openScenario('normal', freshState, independentProfile);
    const result = await page.evaluate(() => ({
      journey: JSON.parse(localStorage.getItem('maseer28_state')),
      profile: JSON.parse(localStorage.getItem('maseer28_user_profile_v2')),
      marker: localStorage.getItem('maseer28_profile_v2_migration_v1'),
    }));
    assert.equal(result.profile.name, 'کاربر تازه');
    assert.equal(result.journey.profileData, null);
    assert.equal(result.marker, '1');
    await page.close();
  }

  // E2/E3: migrate a legacy active profile and multiple archives; retain reports and path data.
  {
    const page = await openScenario();
    const result = await page.evaluate(() => ({
      journey: JSON.parse(localStorage.getItem('maseer28_state')),
      profile: JSON.parse(localStorage.getItem('maseer28_user_profile_v2')),
      marker: localStorage.getItem('maseer28_profile_v2_migration_v1'),
    }));
    assert.equal(result.marker, '1');
    assert.equal(result.profile.name, 'کاربر آزمایشی');
    assert.equal(result.profile.medicalNote, 'TEST-PRIVATE-001');
    assert.equal(result.journey.profileData.name, undefined);
    assert.equal(result.journey.profileData.medical, undefined);
    assert.equal(result.journey.profileData.medication, undefined);
    assert.equal(result.journey.profileData.code, 'M28-123456');
    assert.equal(result.journey.answers[1], 'TEST-ANSWER-001');
    assert.equal(result.journey.final.f1, 'TEST-FINAL-REPORT-001');
    assert.equal(result.journey.archive.length, 2);
    for (const archive of result.journey.archive) {
      assert.equal(archive.profileData.name, undefined);
      assert.equal(archive.profileData.medicalNote, undefined);
      assert.equal(archive.profileData.code, undefined);
      assert.ok(Object.values(archive.answers).some((value) => value.startsWith('TEST-ARCHIVE-ANSWER')));
      assert.ok(archive.final.f1.startsWith('TEST-ARCHIVE-REPORT'));
    }
    await page.close();
  }

  // E4: failed independent-profile persistence must not clean the legacy journey.
  {
    const page = await openScenario('profile-write-fails');
    const result = await page.evaluate(() => ({
      journey: JSON.parse(localStorage.getItem('maseer28_state')),
      profile: localStorage.getItem('maseer28_user_profile_v2'),
    }));
    assert.equal(result.profile, null);
    assert.equal(result.journey.profileData.name, 'کاربر آزمایشی');
    assert.equal(result.journey.profileData.medical, 'none');
    assert.equal(result.journey.privacyMigrationVersion, undefined);
    await page.close();
  }

  // E4: write-then-throw must roll back the candidate and preserve the original record.
  {
    const page = await openScenario('journey-write-then-throw');
    const result = await page.evaluate(() => ({
      journey: JSON.parse(localStorage.getItem('maseer28_state')),
      profile: JSON.parse(localStorage.getItem('maseer28_user_profile_v2')),
    }));
    assert.equal(result.profile.name, 'کاربر آزمایشی');
    assert.equal(result.journey.profileData.name, 'کاربر آزمایشی');
    assert.equal(result.journey.profileData.medical, 'none');
    assert.equal(result.journey.privacyMigrationVersion, undefined);
    await page.close();
  }


  // E5: archive deletion requires confirmation, removes only the selected archive,
  // and survives reload without touching the active path or independent profile.
  {
    const state = {
      schema: 7, started: true, profile: true, assessment: true,
      privacyMigrationVersion: 1, completed: [1], answers: { 1: 'ACTIVE-ANSWER' },
      daily: { 1: { score: 4 } }, assessmentData: { score: 5 }, final: null,
      profileData: { problem: 'anxiety', durationYears: 1, durationMonths: 2, goal: 'هدف فعال' },
      pathId: 'active-path-preserved', lastView: 'dashboard',
      archive: [
        { pathId: 'archive-delete-me', profileData: { problem: 'stress' }, answers: { 1: 'ARCHIVE-DELETE-ME' }, completed: [1], assessmentData: { score: 4 }, final: { score: 3 } },
        { pathId: 'archive-keep-me', profileData: { problem: 'sleep' }, answers: { 1: 'ARCHIVE-KEEP-ME' }, completed: [1], assessmentData: { score: 6 }, final: { score: 5 } },
      ],
    };
    const profile = {
      name: 'کاربر آرشیو', age: 34, gender: 'زن', phone: '09123456789',
      medical: 'none', medicalNote: '', medication: 'no', medicationRisk: 'no',
    };
    const page = await openScenario('normal', state, profile);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#copyrightModal').waitFor({ state: 'visible' });
    await page.locator('#copyrightModal').getByRole('button', { name: /متوجه شدم و ورود به مسیر را ادامه می‌دهم/ }).click();
    await page.locator('#dashboard').waitFor({ state: 'visible' });
    await page.locator('#dashboard .quickAction').filter({ hasText: 'آرشیو' }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('maseer28_state') || '{}').lastView === 'archive');
    const firstArchive = page.locator('#archiveList .answerItem').first();
    await firstArchive.getByRole('button', { name: /حذف این آرشیو/ }).click();
    await firstArchive.getByRole('button', { name: 'انصراف' }).click();
    assert.equal(await page.locator('#archiveList .answerItem').count(), 2);
    await page.locator('#archiveList .answerItem').first().getByRole('button', { name: /حذف این آرشیو/ }).click();
    await page.locator('#archiveList .answerItem').first().getByRole('button', { name: 'بله، حذف شود' }).click();
    await page.waitForFunction(() => document.querySelectorAll('#archiveList .answerItem').length === 1);
    await page.waitForFunction(() => {
      const saved = JSON.parse(localStorage.getItem('maseer28_state') || '{}');
      return saved.archive?.length === 1 && saved.archive[0]?.pathId === 'archive-keep-me' && saved.lastView === 'archive';
    });
    const persisted = await page.evaluate(() => ({
      journey: JSON.parse(localStorage.getItem('maseer28_state')),
      profile: JSON.parse(localStorage.getItem('maseer28_user_profile_v2')),
    }));
    assert.equal(persisted.journey.pathId, 'active-path-preserved');
    assert.equal(persisted.journey.answers[1], 'ACTIVE-ANSWER');
    assert.equal(persisted.profile.name, 'کاربر آرشیو');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#dashboard').waitFor({ state: 'visible' });
    const afterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('maseer28_state') || '{}').archive?.map((entry) => entry.pathId) || []);
    assert.deepEqual(afterReload, ['archive-keep-me'], 'only the retained archive should remain after reload');
    await page.locator('#dashboard .quickAction').filter({ hasText: 'آرشیو' }).click();
    await page.locator('#archiveList').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#archiveList .answerItem').count(), 1);
    await page.locator('#archiveList .answerItem').first().getByRole('button', { name: /مشاهده جزئیات مسیر/ }).click();
    assert.match(await page.locator('#archiveDetail').innerText(), /ARCHIVE-KEEP-ME/);
    assert.doesNotMatch(await page.locator('#archiveDetail').innerText(), /ARCHIVE-DELETE-ME/);
    await page.close();
  }

  assert.deepEqual(browserErrors, [], 'migration and archive deletion scenarios should not produce uncaught browser errors');
  process.stdout.write('PASS: Chromium privacy migration and selective archive deletion scenarios E1-E5 (5 scenarios)\\n');
} finally {
  await browser.close();
}
