import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
    medicationRisk: 'no', problem: 'خشم', durationYears: 2,
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

async function openScenario(mode = 'normal', state = legacyJourney(), independentProfile = null, legacyIndependentProfile = null) {
  const page = await browser.newPage();
  page.on('pageerror', (error) => browserErrors.push(String(error)));
  await page.addInitScript(({ state, failureMode, independentProfile, legacyIndependentProfile }) => {
    // Seed each scenario once. addInitScript runs again on reload, so reseeding
    // here would silently restore deleted test data and invalidate persistence checks.
    if (!sessionStorage.getItem('__path28_scenario_seeded')) {
      localStorage.setItem('maseer28_state', JSON.stringify(state));
      if (independentProfile) localStorage.setItem('maseer28_user_profile_v2', JSON.stringify(independentProfile));
      if (legacyIndependentProfile) localStorage.setItem('maseer28_user_profile_v1', JSON.stringify(legacyIndependentProfile));
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
  }, { state, independentProfile, legacyIndependentProfile, failureMode: mode });
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

  // E2: migrate a legacy active profile and multiple archives; retain reports and path data.
  {
    const page = await openScenario('normal', legacyJourney(), null, {
      name: 'پروفایل مستقل قدیمی', age: 35, gender: 'زن', phone: '09123456789',
      medical: 'none', medicalNote: 'TEST-PRIVATE-001', medication: 'no', medicationRisk: 'no',
    });
    const result = await page.evaluate(() => ({
      journey: JSON.parse(localStorage.getItem('maseer28_state')),
      profile: JSON.parse(localStorage.getItem('maseer28_user_profile_v2')),
      legacyProfile: localStorage.getItem('maseer28_user_profile_v1'),
      marker: localStorage.getItem('maseer28_profile_v2_migration_v1'),
    }));
    assert.equal(result.marker, '1');
    assert.equal(result.legacyProfile, null, 'superseded v1 profile data must be removed after verified migration');
    assert.equal(result.profile.name, 'پروفایل مستقل قدیمی');
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

  // E3: malformed legacy archive data must block cleanup of both legacy profile copies.
  {
    const malformedArchiveState = {
      schema: 7, started: true, profile: true, assessment: true, completed: [1],
      answers: { 1: 'KEEP-ANSWER' }, daily: { 1: { score: 4 } },
      profileData: {
        name: 'هویت مسیر قدیمی', age: 35, gender: 'زن', phone: '09123456789',
        medical: 'none', medicalNote: 'KEEP-PRIVATE', medication: 'no',
        medicationRisk: 'no', problem: 'خشم', durationYears: 1,
        durationMonths: 0, goal: 'هدف قدیمی',
      },
      archive: {
        legacy: {
          pathId: 'malformed-legacy-archive',
          profileData: { name: 'هویت آرشیو قدیمی', medical: 'other' },
          answers: { 1: 'KEEP-ARCHIVE-ANSWER' },
        },
      },
      pathId: 'malformed-archive-path', startedAt: '2026-01-01T00:00:00.000Z',
      lastView: 'dashboard',
    };
    const page = await openScenario('normal', malformedArchiveState, {
      name: 'پروفایل مستقل معتبر', age: 35, gender: 'زن', phone: '09123456789',
      medical: 'none', medicalNote: 'KEEP-PRIVATE', medication: 'no', medicationRisk: 'no',
    }, {
      name: 'پروفایل v1 قدیمی', age: 35, gender: 'زن', phone: '09123456789',
      medical: 'none', medicalNote: 'KEEP-PRIVATE', medication: 'no', medicationRisk: 'no',
    });
    const result = await page.evaluate(() => ({
      journey: JSON.parse(localStorage.getItem('maseer28_state')),
      legacyProfile: localStorage.getItem('maseer28_user_profile_v1'),
      profile: JSON.parse(localStorage.getItem('maseer28_user_profile_v2')),
    }));
    assert.ok(result.profile, 'the independent v2 profile remains available');
    assert.ok(result.legacyProfile, 'v1 must not be removed when archive migration is blocked');
    assert.equal(result.journey.privacyMigrationVersion, undefined);
    assert.equal(result.journey.profileData.name, 'هویت مسیر قدیمی');
    assert.deepEqual(result.journey.archive, []);
    assert.equal(result.journey.archiveRecoveryRequired.legacy.profileData.name, 'هویت آرشیو قدیمی');
    assert.equal(result.journey.archiveRecoveryRequired.legacy.profileData.medical, 'other');
    await page.locator('#copyrightModal').waitFor({ state: 'visible' });
    await page.locator('#copyrightModal').getByRole('button', { name: /متوجه شدم و ورود به مسیر را ادامه می‌دهم/ }).click();
    await page.locator('#dashboard').waitFor({ state: 'visible' });
    await page.locator('#dashboard .quickAction').filter({ hasText: 'آرشیو' }).click();
    await page.locator('#archive').waitFor({ state: 'visible' });
    await page.getByText('بازیابی آرشیو لازم است').waitFor();
    assert.equal(await page.getByRole('button', { name: /شروع مسیر تازه/ }).isDisabled(), true);
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

  // E5: write-then-throw must roll back the candidate and preserve the original record.
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


  // E6: archive deletion requires confirmation, removes only the selected archive,
  // and survives reload without touching the active path or independent profile.
  {
    const state = {
      schema: 7, started: true, profile: true, assessment: true,
      privacyMigrationVersion: 1, completed: [1], answers: { 1: 'ACTIVE-ANSWER' },
      daily: { 1: { score: 4 } }, assessmentData: { score: 5 }, final: null,
      profileData: { problem: 'خشم', durationYears: 1, durationMonths: 2, goal: 'هدف فعال' },
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


  // E7: a full archive must block an additional completed-path archive without
  // truncating legacy records or resetting the active path.
  {
    const fullArchiveState = {
      ...legacyJourney(),
      completed: Array.from({ length: 28 }, (_, index) => index + 1),
      final: { score: 5, f1: 'ACTIVE-FINAL-REPORT', f2: '', f3: '', f4: '' },
      archive: Array.from({ length: 20 }, (_, index) => ({
        pathId: `retained-${index + 1}`,
        profileData: { problem: 'stress' },
        answers: { 1: `RETAINED-ANSWER-${index + 1}` },
        completed: [1],
        final: { score: 4, f1: `RETAINED-REPORT-${index + 1}` },
      })),
      pathId: 'active-at-capacity',
      lastView: 'dashboard',
    };
    const page = await openScenario('normal', fullArchiveState, {
      name: 'کاربر ظرفیت', age: 35, gender: 'زن', phone: '09123456789',
      medical: 'none', medicalNote: '', medication: 'no', medicationRisk: 'no',
    });
    await page.locator('#copyrightModal').waitFor({ state: 'visible' });
    await page.locator('#copyrightModal').getByRole('button', { name: /متوجه شدم و ورود به مسیر را ادامه می‌دهم/ }).click();
    await page.locator('#dashboard').waitFor({ state: 'visible' });
    await page.locator('#dashboard .quickAction').filter({ hasText: 'آرشیو' }).click();
    await page.locator('#archiveList').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: /شروع مسیر تازه/ }).click();
    await page.getByRole('heading', { name: 'ظرفیت آرشیو تکمیل شده است' }).waitFor({ state: 'visible' });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('maseer28_state') || '{}'));
    assert.equal(saved.archive.length, 20, 'all 20 existing archive records must remain intact');
    assert.equal(saved.archive[0].pathId, 'retained-1');
    assert.equal(saved.archive[19].pathId, 'retained-20');
    assert.equal(saved.pathId, 'active-at-capacity', 'the active path must not be reset when capacity is reached');
    assert.match(await page.locator('[role="dialog"]').innerText(), /هیچ آرشیوی خودکار پاک نمی‌شود|مسیر فعال و سایر آرشیوها حفظ شده‌اند/);
    await page.getByRole('button', { name: 'متوجه شدم' }).click();

    // E7: explicitly deleting one selected archive must free exactly one slot.
    await page.locator('#archiveList .answerItem').first().getByRole('button', { name: /حذف این آرشیو/ }).click();
    await page.locator('#archiveList .answerItem').first().getByRole('button', { name: 'بله، حذف شود' }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('maseer28_state') || '{}').archive?.length === 19);
    await page.getByRole('button', { name: /شروع مسیر تازه/ }).click();
    await page.locator('#pathSetup').waitFor({ state: 'visible' });
    const afterExplicitDelete = await page.evaluate(() => JSON.parse(localStorage.getItem('maseer28_state') || '{}'));
    assert.equal(afterExplicitDelete.archive.length, 20, 'one explicit deletion must free exactly one slot for the completed active path');
    assert.equal(afterExplicitDelete.archive.some((entry) => entry.pathId === 'retained-1'), false, 'only the explicitly selected archive may be removed');
    assert.equal(afterExplicitDelete.archive.some((entry) => entry.pathId === 'active-at-capacity'), true, 'the completed active path must be archived after the user frees a slot');
    assert.notEqual(afterExplicitDelete.pathId, 'active-at-capacity', 'a new path should start only after explicit deletion');
    await page.close();
  }

  // E8: a failed localStorage write must not dismiss the archive confirmation;
  // the selected archive remains available for a safe retry.
  {
    const state = {
      ...legacyJourney(),
      archive: [{ pathId: 'archive-write-failure', profileData: { problem: 'stress' }, answers: { 1: 'KEEP-ON-FAILURE' }, completed: [1], final: { score: 4 } }],
    };
    const page = await openScenario('normal', state, {
      name: 'کاربر خطای حذف', age: 33, gender: 'زن', phone: '09123456789',
      medical: 'none', medicalNote: '', medication: 'no', medicationRisk: 'no',
    });
    await page.locator('#copyrightModal').waitFor({ state: 'visible' });
    await page.locator('#copyrightModal').getByRole('button', { name: /متوجه شدم و ورود به مسیر را ادامه می‌دهم/ }).click();
    await page.locator('#dashboard').waitFor({ state: 'visible' });
    await page.locator('#dashboard .quickAction').filter({ hasText: 'آرشیو' }).click();
    await page.locator('#archiveList').waitFor({ state: 'visible' });
    await page.locator('#archiveList .answerItem').first().getByRole('button', { name: /حذف این آرشیو/ }).click();
    await page.evaluate(() => {
      const nativeSetItem = Storage.prototype.setItem;
      let failed = false;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'maseer28_state' && !failed) {
          failed = true;
          throw new Error('simulated archive deletion write failure');
        }
        return nativeSetItem.call(this, key, value);
      };
    });
    await page.locator('#archiveList .answerItem').first().getByRole('button', { name: 'بله، حذف شود' }).click();
    await page.getByRole('heading', { name: 'حذف آرشیو تأیید نشد' }).waitFor({ state: 'visible' });
    assert.equal(await page.locator('#archiveList .answerItem').count(), 1);
    assert.equal(await page.locator('[aria-label="تأیید حذف آرشیو 1"]').count(), 1, 'confirmation must remain open after failed deletion');
    const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('maseer28_state') || '{}'));
    assert.equal(persisted.archive[0].pathId, 'archive-write-failure');
    assert.equal(persisted.archive[0].answers[1], 'KEEP-ON-FAILURE');
    await page.close();
  }

  // E9: Support intentionally exposes no privacy/deletion controls; opening it is read-only.
  {
    const page = await openScenario('normal', legacyJourney(), {
      name: 'کاربر داده محلی', age: 32, gender: 'زن', phone: '09123456789',
      medical: 'none', medicalNote: 'LOCAL-ONLY-PRIVATE-001', medication: 'no', medicationRisk: 'no',
    });
    const externalAssistantRequests = [];
    page.on('request', request => {
      if (/\/v1\/assistant\/turn|assistant-api|workers\.dev|cloudflareworkers\.com/u.test(request.url())) {
        externalAssistantRequests.push(request.url());
      }
    });
    await page.locator('#copyrightModal').waitFor({ state: 'visible' });
    await page.locator('#copyrightModal').getByRole('button', { name: /متوجه شدم و ورود به مسیر را ادامه می‌دهم/ }).click();
    await page.locator('#dashboard').waitFor({ state: 'visible' });
    await page.evaluate(() => {
      localStorage.setItem('maseer28_test_sensitive', JSON.stringify({ marker: 'KEEP-LOCAL-001' }));
      localStorage.setItem('unrelated_site_preference', 'preserve-unrelated');
    });
    const before = await page.evaluate(() => ({
      journey: localStorage.getItem('maseer28_state'),
      profile: localStorage.getItem('maseer28_user_profile_v2'),
      marker: localStorage.getItem('maseer28_test_sensitive'),
    }));
    await page.locator('#bottomNav button[data-view="support"]').click();
    await page.locator('#support').waitFor({ state: 'visible' });
    const supportText = await page.locator('#support').innerText();
    assert.doesNotMatch(supportText, /حذف داده‌های محلی من|دریافت نسخه اطلاعات من|انتخاب فایل پشتیبان|بازیابی نسخه پشتیبان|دستیار آزمایشی|حریم خصوصی/u,
      'Support must not expose removed privacy, backup, restore, or standalone assistant UI');
    const after = await page.evaluate(() => ({
      journey: localStorage.getItem('maseer28_state'),
      profile: localStorage.getItem('maseer28_user_profile_v2'),
      marker: localStorage.getItem('maseer28_test_sensitive'),
      unrelated: localStorage.getItem('unrelated_site_preference'),
    }));
    const beforeJourney = JSON.parse(before.journey || '{}');
    const afterJourney = JSON.parse(after.journey || '{}');
    assert.deepEqual({ ...afterJourney, lastView: beforeJourney.lastView }, beforeJourney,
      'opening Support may update only the navigation marker, not journey content');
    assert.equal(after.profile, before.profile, 'opening Support must not mutate the independent local profile');
    assert.equal(after.marker, before.marker, 'opening Support must not delete local app data');
    assert.equal(after.unrelated, 'preserve-unrelated', 'unrelated browser data must remain untouched');
    assert.deepEqual(externalAssistantRequests, [], 'opening Support must not send assistant data to a cloud Worker');
    await page.close();
  }

  // E10: removing backup/restore controls from Support must not alter local archive state.
  {
    const malformedArchive = [
      { pathId: 'recoverable-entry', profileData: { problem: 'آرشیو قابل بازیابی' }, answers: { 1: 'پاسخ قدیمی' } },
      null,
      'legacy-unparsed-entry',
      ['unexpected-nested-array'],
    ];
    const state = { ...legacyJourney(), archive: malformedArchive };
    const page = await openScenario('normal', state, {
      name: 'پروفایل مستقل محلی', age: 35, gender: 'زن', phone: '09123456789',
      medical: 'none', medicalNote: '', medication: 'no', medicationRisk: 'no',
    });
    await page.locator('#copyrightModal').waitFor({ state: 'visible' });
    await page.locator('#copyrightModal').getByRole('button', { name: /متوجه شدم و ورود به مسیر را ادامه می‌دهم/ }).click();
    await page.locator('#dashboard').waitFor({ state: 'visible' });
    await page.locator('#bottomNav button[data-view="support"]').click();
    await page.locator('#support').waitFor({ state: 'visible' });
    const supportText = await page.locator('#support').innerText();
    assert.doesNotMatch(supportText, /دریافت نسخه اطلاعات من|انتخاب فایل پشتیبان|بازیابی نسخه پشتیبان/u);
    const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('maseer28_state') || '{}'));
    assert.deepEqual(persisted.archive, [], 'malformed archive records must remain outside the ordinary archive list');
    assert.deepEqual(persisted.archiveRecoveryRequired, malformedArchive,
      'opening Support must preserve the complete quarantined archive payload without exposing backup UI');
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('maseer28_user_profile_v2') || 'null')))?.name,
      'پروفایل مستقل محلی', 'the independent local profile must remain intact');
    await page.close();
  }

  // E11: local-only assistant and Support navigation never create cloud transcript/storage traffic.
  {
    const page = await openScenario('normal', legacyJourney());
    const cloudRequests = [];
    page.on('request', request => {
      if (/assistant-api|workers\.dev|cloudflareworkers\.com|\/v1\/assistant\/turn/u.test(request.url())) {
        cloudRequests.push(request.url());
      }
    });
    await page.locator('#copyrightModal').waitFor({ state: 'visible' });
    await page.locator('#copyrightModal').getByRole('button', { name: /متوجه شدم و ورود به مسیر را ادامه می‌دهم/ }).click();
    await page.locator('#dashboard').waitFor({ state: 'visible' });
    await page.locator('#bottomNav button[data-view="support"]').click();
    await page.locator('#support').waitFor({ state: 'visible' });
    assert.deepEqual(cloudRequests, [], 'Support navigation must not contact a cloud assistant or transcript store');
    await page.close();
  }

  assert.deepEqual(browserErrors, [], 'migration, deletion, and restore scenarios should not produce uncaught browser errors');
  process.stdout.write('PASS: Chromium privacy migration, selective archive deletion, retention-capacity, failure-retry, read-only Support navigation, hidden privacy/backup/restore UI, local-data preservation, and no cloud assistant traffic (E1-E11)\\n');
} finally {
  await browser.close();
}
