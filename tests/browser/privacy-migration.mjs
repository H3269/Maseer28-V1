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

async function openScenario(mode = 'normal') {
  const page = await browser.newPage();
  page.on('pageerror', (error) => browserErrors.push(String(error)));
  await page.addInitScript(({ state, failureMode }) => {
    localStorage.setItem('maseer28_state', JSON.stringify(state));
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
  }, { state: legacyJourney(), failureMode: mode });
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const root = document.querySelector('#root');
    return Boolean(root && root.children.length);
  }, null, { timeout: 15000 });
  return page;
}

try {
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

  assert.deepEqual(browserErrors, [], 'migration scenarios should not produce uncaught browser errors');
  process.stdout.write('PASS: Chromium privacy migration scenarios E2/E3/E4 (3 scenarios)\\n');
} finally {
  await browser.close();
}
