import test from 'node:test';
import assert from 'node:assert/strict';

import {
  burdenScoreFromAnswers,
  cloneForArchive,
  defaultJourneyState,
  nextRequiredDay,
  sanitizeJourneyState,
  migrateUserProfileToV2,
  PROFILE_V2_KEY,
  validName,
  validPhone,
  validScore,
} from '../src/features/journey/journeyStore.js';

test('validScore accepts integer scores from 0 through 10, including Persian digits', () => {
  assert.equal(validScore(0), true);
  assert.equal(validScore('۱۰'), true);
  assert.equal(validScore(' 7 '), true);
  assert.equal(validScore(10), true);
  for (const value of [null, undefined, '', '   ', 'abc', '1.5', '-1', '11', '1e1']) {
    assert.equal(validScore(value), false, `expected ${String(value)} to be rejected`);
  }
});

test('profile validators accept expected Persian values and reject malformed input', () => {
  assert.equal(validName('حسن عبادی'), true);
  assert.equal(validName('A Hassan'), false);
  assert.equal(validPhone('۰۹۱۲۳۴۵۶۷۸۹'), true);
  assert.equal(validPhone('0912345678'), false);
  assert.equal(validPhone(''), false);
});

test('burden score uses only the first four burden questions', () => {
  assert.equal(burdenScoreFromAnswers([4, 4, 4, 4, 0]), 10);
  assert.equal(burdenScoreFromAnswers([0, 0, 0, 0, 4]), 0);
  assert.equal(burdenScoreFromAnswers([1, 1, 1, 1]), 3);
  assert.equal(burdenScoreFromAnswers([1, 1, 1]), null);
});

test('nextRequiredDay returns the first incomplete sequential day', () => {
  assert.equal(nextRequiredDay(defaultJourneyState()), 1);
  assert.equal(nextRequiredDay({ completed: [1, 2, 3] }), 4);
  assert.equal(nextRequiredDay({ completed: Array.from({ length: 28 }, (_, i) => i + 1) }), 29);
});

test('sanitizeJourneyState keeps completed days contiguous and unique', () => {
  const state = sanitizeJourneyState({ completed: [1, 2, 4, 3, 3, 29, 0] });
  assert.deepEqual(state.completed, [1, 2, 3, 4]);

  const gap = sanitizeJourneyState({ completed: [1, 2, 4] });
  assert.deepEqual(gap.completed, [1, 2]);
});

test('sanitizeJourneyState drops invalid answer keys and truncates free text', () => {
  const longText = 'الف'.repeat(3100);
  const state = sanitizeJourneyState({
    answers: { 1: longText, 29: 'خارج از محدوده', bad: 'نامعتبر' },
  });
  assert.equal(state.answers[1].length, 3000);
  assert.equal(state.answers[29], undefined);
  assert.equal(state.answers.bad, undefined);
});

test('sanitizeJourneyState does not invent a zero score when score is missing', () => {
  const state = sanitizeJourneyState({
    daily: { 1: { feedback: 'better' }, 2: { score: '' } },
    assessment: true,
    assessmentData: {},
    final: { completedAt: '2026-01-01T00:00:00.000Z' },
  });

  assert.equal(state.daily[1].score, undefined);
  assert.equal(state.daily[2], undefined);
  assert.equal(state.assessmentData, null);
  assert.equal(state.assessment, false);
  assert.equal(state.final, null);
});

test('sanitizeJourneyState normalizes valid five-item assessment answers', () => {
  const state = sanitizeJourneyState({
    assessmentData: { answers: [0, 1, 2, 3, 4] },
  });
  assert.equal(state.assessmentData.total, 6);
  assert.equal(state.assessmentData.score, 4);
  assert.equal(state.assessmentData.motivation, 4);
  assert.equal(state.assessment, true);
});

test('sanitizeJourneyState limits archive retention to twenty entries', () => {
  const archive = Array.from({ length: 25 }, (_, index) => ({ pathId: String(index) }));
  const state = sanitizeJourneyState({ archive });
  assert.equal(state.archive.length, 20);
});


function withMemoryStorage(run) {
  const previous = globalThis.localStorage;
  const data = new Map();
  globalThis.localStorage = {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
  };
  try { run(data); } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
}

test('profile v2 migration fills only missing fields and preserves canonical values', async () => {
  const { migrateUserProfileToV2, PROFILE_KEY, PROFILE_V2_KEY, PROFILE_V2_MIGRATION_KEY } =
    await import('../src/features/journey/journeyStore.js');
  withMemoryStorage((data) => {
    data.set(PROFILE_KEY, JSON.stringify({ name: 'نام قدیمی', age: 34, phone: '09123456789' }));
    const state = { profileData: { name: 'نام مسیر', age: 41, gender: 'زن', medical: 'none' } };
    const result = migrateUserProfileToV2(state);
    assert.equal(result.migrated, true);
    assert.equal(result.profile.name, 'نام قدیمی');
    assert.equal(result.profile.age, 34);
    assert.equal(result.profile.gender, 'زن');
    assert.equal(result.profile.medical, 'none');
    assert.equal(data.get(PROFILE_V2_MIGRATION_KEY), '1');
    assert.equal(data.has(PROFILE_KEY), true);
    assert.equal(JSON.parse(data.get(PROFILE_V2_KEY)).name, 'نام قدیمی');
  });
});

test('profile v2 migration is idempotent and does not overwrite existing canonical values', async () => {
  const { migrateUserProfileToV2, PROFILE_V2_KEY } =
    await import('../src/features/journey/journeyStore.js');
  withMemoryStorage((data) => {
    data.set(PROFILE_V2_KEY, JSON.stringify({ name: 'نام معتبر', age: 29 }));
    const state = { profileData: { name: 'legacy', age: 45, gender: 'مرد' } };
    const first = migrateUserProfileToV2(state);
    const second = migrateUserProfileToV2({ profileData: { name: 'new legacy', age: 50 } });
    assert.equal(first.profile.name, 'نام معتبر');
    assert.equal(second.profile.name, 'نام معتبر');
    assert.equal(second.profile.age, 29);
    assert.equal(second.profile.gender, 'مرد');
  });
});

test('profile v2 migration fails closed when storage writes fail', async () => {
  const { migrateUserProfileToV2, PROFILE_V2_KEY, PROFILE_V2_MIGRATION_KEY } =
    await import('../src/features/journey/journeyStore.js');
  const previous = globalThis.localStorage;
  const data = new Map();
  globalThis.localStorage = {
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) {
      if (key === PROFILE_V2_KEY) throw new Error('blocked');
      data.set(key, String(value));
    },
  };
  try {
    const result = migrateUserProfileToV2({ profileData: { name: 'legacy' } });
    assert.equal(result.migrated, false);
    assert.equal(data.has(PROFILE_V2_MIGRATION_KEY), false);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});


test('profile reads and new writes use v2 while retaining the v1 fallback record', async () => {
  const { loadUserProfile, saveUserProfile, PROFILE_KEY, PROFILE_V2_KEY } =
    await import('../src/features/journey/journeyStore.js');
  withMemoryStorage((data) => {
    data.set(PROFILE_KEY, JSON.stringify({ name: 'نسخه قدیمی', age: 38 }));
    assert.equal(loadUserProfile().name, 'نسخه قدیمی');

    data.set(PROFILE_V2_KEY, JSON.stringify({ name: 'نسخه جدید', age: 39 }));
    assert.equal(loadUserProfile().name, 'نسخه جدید');

    saveUserProfile({ name: 'کاربر تازه', age: 40, gender: 'زن', phone: '09123456789' });
    assert.equal(JSON.parse(data.get(PROFILE_V2_KEY)).name, 'کاربر تازه');
    assert.equal(JSON.parse(data.get(PROFILE_KEY)).name, 'نسخه قدیمی');
  });
});

test('profile v2 normalization rejects invalid field values instead of copying them', async () => {
  const { migrateUserProfileToV2, PROFILE_KEY, PROFILE_V2_KEY } =
    await import('../src/features/journey/journeyStore.js');
  withMemoryStorage((data) => {
    data.set(PROFILE_KEY, JSON.stringify({
      name: '<script>',
      age: 140,
      phone: '123',
      medical: 'unrecognized',
      medicationRisk: 'maybe',
    }));
    const result = migrateUserProfileToV2({});
    assert.equal(result.migrated, false);
    assert.equal(data.has(PROFILE_V2_KEY), false);
  });
});


test('profile v2 read-back verification is independent of JSON key order', async () => {
  const { migrateUserProfileToV2, PROFILE_V2_KEY } =
    await import('../src/features/journey/journeyStore.js');
  withMemoryStorage((data) => {
    data.set(PROFILE_V2_KEY, JSON.stringify({ phone: '09123456789' }));
    const result = migrateUserProfileToV2({
      profileData: { name: 'نام معتبر', age: 35, gender: 'مرد' },
    });
    assert.equal(result.migrated, true);
    assert.equal(result.profile.name, 'نام معتبر');
    assert.equal(result.profile.age, 35);
    assert.equal(result.profile.phone, '09123456789');
  });
});


test('verified profile migration never restores fields intentionally cleared later', async () => {
  const { migrateUserProfileToV2, PROFILE_KEY, PROFILE_V2_KEY, PROFILE_V2_MIGRATION_KEY } =
    await import('../src/features/journey/journeyStore.js');
  withMemoryStorage((data) => {
    data.set(PROFILE_KEY, JSON.stringify({ name: 'نام قدیمی', age: 42, gender: 'مرد' }));
    data.set(PROFILE_V2_KEY, JSON.stringify({ name: 'نام فعلی' }));
    data.set(PROFILE_V2_MIGRATION_KEY, '1');
    const result = migrateUserProfileToV2({ profileData: { age: 55, gender: 'زن' } });
    assert.equal(result.migrated, true);
    assert.equal(result.reason, 'already_verified');
    assert.equal(result.profile.name, 'نام فعلی');
    assert.equal(result.profile.age, undefined);
    assert.equal(result.profile.gender, undefined);
  });
});


test('new archive snapshots retain path display fields but omit copied personal and health fields', () => {
  const archived = cloneForArchive({
    pathId: 'path-1',
    profileData: {
      name: 'نام کاربر',
      age: 42,
      gender: 'زن',
      phone: '09123456789',
      medical: 'other',
      medicalNote: 'private note',
      medication: 'yes_fixed',
      medicationRisk: 'unknown',
      problem: 'anxiety',
      code: 'M28-123456',
      durationYears: 3,
      durationMonths: 2,
      goal: 'هدف مسیر',
    },
    assessmentData: { score: 5 },
    completed: [1],
    answers: { 1: 'answer' },
    daily: { 1: { score: 5 } },
    final: null,
  });
  assert.deepEqual(Object.keys(archived.profileData).sort(), [
    'durationMonths', 'durationYears', 'goal', 'problem',
  ]);
  assert.equal(archived.profileData.problem, 'anxiety');
  assert.equal('name' in archived.profileData, false);
  assert.equal('code' in archived.profileData, false);
  assert.equal('medical' in archived.profileData, false);
  assert.equal('phone' in archived.profileData, false);
  assert.equal('age' in archived.profileData, false);
});

test('legacy journey privacy migration preflight blocks when canonical profile would lose current identity or health fields', async () => {
  const { prepareJourneyPrivacyMigration } = await import('../src/features/journey/journeyStore.js');
  const raw = { profileData: { name: 'نام کاربر', age: 35, medical: 'none', problem: 'anxiety' }, archive: [] };
  const result = prepareJourneyPrivacyMigration(raw, { name: 'نام کاربر', age: 35 });
  assert.equal(result.ready, false);
  assert.equal(result.reason, 'canonical_profile_incomplete');
  assert.deepEqual(result.missingCanonicalFields, ['medical']);
  assert.equal(raw.profileData.medical, 'none');
});

test('legacy journey privacy migration strips identity and health from current and archived snapshots without changing path data', async () => {
  const { prepareJourneyPrivacyMigration, JOURNEY_PRIVACY_MIGRATION_VERSION } = await import('../src/features/journey/journeyStore.js');
  const raw = {
    schema: 7,
    profileData: { name: 'نام کاربر', age: 35, gender: 'زن', phone: '09123456789', medical: 'none', medicalNote: 'private', medication: 'no', medicationRisk: 'no', code: 'M28-123', problem: 'anxiety', durationYears: 2, durationMonths: 3, goal: 'هدف' },
    answers: { 1: 'پاسخ خصوصی' }, daily: { 1: { score: 5 } },
    archive: [{ pathId: 'old-path', profileData: { name: 'نام قدیمی', age: 41, phone: '09111111111', medical: 'other', code: 'OLD-1', problem: 'stress', durationYears: 4, durationMonths: 1, goal: 'هدف قدیمی' }, answers: { 1: 'آرشیو قدیمی' } }],
  };
  const canonical = { name: 'نام کاربر', age: 35, gender: 'زن', phone: '09123456789', medical: 'none', medicalNote: 'private', medication: 'no', medicationRisk: 'no' };
  const result = prepareJourneyPrivacyMigration(raw, canonical);
  assert.equal(result.ready, true);
  assert.equal(result.reason, 'preflight_passed');
  assert.deepEqual(Object.keys(result.state.profileData).sort(), ['durationMonths', 'durationYears', 'goal', 'problem']);
  assert.deepEqual(Object.keys(result.state.archive[0].profileData).sort(), ['durationMonths', 'durationYears', 'goal', 'problem']);
  assert.equal(result.state.profileData.problem, 'anxiety');
  assert.equal(result.state.archive[0].profileData.problem, 'stress');
  assert.equal(result.state.answers[1], 'پاسخ خصوصی');
  assert.equal(result.state.archive[0].answers[1], 'آرشیو قدیمی');
  assert.equal(result.state.privacyMigrationVersion, JOURNEY_PRIVACY_MIGRATION_VERSION);
  assert.equal(raw.profileData.medical, 'none');
  assert.equal(raw.archive[0].profileData.name, 'نام قدیمی');
});

test('legacy journey privacy migration is idempotent and rejects invalid source state', async () => {
  const { prepareJourneyPrivacyMigration } = await import('../src/features/journey/journeyStore.js');
  assert.equal(prepareJourneyPrivacyMigration(null, {}).reason, 'invalid_journey_state');
  const raw = { profileData: { problem: 'anxiety', durationYears: 1, durationMonths: 0, goal: 'هدف' }, archive: [] };
  const first = prepareJourneyPrivacyMigration(raw, {});
  const second = prepareJourneyPrivacyMigration(first.state, {});
  assert.equal(first.ready, true);
  assert.equal(second.ready, true);
  assert.deepEqual(second.state, first.state);
});
test('legacy journey records remain readable before migration and preserve their path-specific data after migration', async () => {
  const { prepareJourneyPrivacyMigration, sanitizeJourneyState } = await import('../src/features/journey/journeyStore.js');
  const legacy = {
    started: true, profile: true, assessment: true, completed: [1, 2],
    profileData: { name: 'نام قدیمی', age: 39, gender: 'مرد', phone: '09123456789', medical: 'none', medicalNote: '', medication: 'no', medicationRisk: 'no', problem: 'anxiety', durationYears: 2, durationMonths: 4, goal: 'هدف مسیر', code: 'M28-OLD' },
    assessmentData: { score: 6 }, answers: { 1: 'پاسخ روز اول' }, daily: { 1: { score: 5, feedback: 'better' } },
    final: { score: 4, f1: 'تغییر اول', completedAt: '2026-10-01T00:00:00.000Z' },
    archive: [{ pathId: 'archive-1', profileData: { name: 'نام قدیمی', medical: 'other', problem: 'stress', durationYears: 1, durationMonths: 2, goal: 'هدف قدیمی', code: 'M28-A' }, answers: { 1: 'پاسخ آرشیو' }, completed: [1] }],
  };
  const before = sanitizeJourneyState(legacy);
  assert.equal(before.profileData.name, 'نام قدیمی');
  assert.equal(before.profileData.medical, 'none');
  assert.equal(before.answers[1], 'پاسخ روز اول');
  assert.equal(before.archive[0].profileData.name, 'نام قدیمی');
  const canonical = { name: 'نام قدیمی', age: 39, gender: 'مرد', phone: '09123456789', medical: 'none', medication: 'no', medicationRisk: 'no' };
  const plan = prepareJourneyPrivacyMigration(legacy, canonical);
  assert.equal(plan.ready, true);
  const after = sanitizeJourneyState(plan.state);
  assert.equal(after.profileData.name, '');
  assert.equal(after.profileData.medical, '');
  assert.equal(after.profileData.problem, 'anxiety');
  assert.equal(after.profileData.goal, 'هدف مسیر');
  assert.equal(after.answers[1], 'پاسخ روز اول');
  assert.equal(after.daily[1].score, 5);
  assert.equal(after.final.f1, 'تغییر اول');
  assert.equal(after.archive[0].profileData.name, undefined);
  assert.equal(after.archive[0].profileData.problem, 'stress');
  assert.equal(after.archive[0].answers[1], 'پاسخ آرشیو');
});

test('legacy archive migration preserves completion, assessments, reflections and daily results', async () => {
  const { prepareJourneyPrivacyMigration } = await import('../src/features/journey/journeyStore.js');
  const archive = {
    pathId: 'archive-legacy', startedAt: '2025-01-01', archivedAt: '2025-02-01',
    profileData: { name: 'نام', age: 30, phone: '09123456789', medical: 'none', problem: 'panic', durationYears: 3, durationMonths: 0, goal: 'هدف', code: 'CASE-1' },
    assessmentData: { score: 7, answers: [2, 2, 2, 2, 3] },
    final: { score: 3, f1: 'تغییر', f2: 'آگاهی', f3: 'اقدام', f4: 'ادامه' },
    completed: Array.from({ length: 28 }, (_, i) => i + 1),
    answers: { 1: 'متن روز یک' }, daily: { 1: { score: 8, feedback: 'worse', feedbackText: 'شرح' } },
  };
  const state = { profileData: { problem: 'new-path', durationYears: 0, durationMonths: 1, goal: 'هدف تازه' }, archive: [archive] };
  const result = prepareJourneyPrivacyMigration(state, {});
  assert.equal(result.ready, true);
  const migrated = result.state.archive[0];
  assert.equal(migrated.completed.length, 28);
  assert.equal(migrated.assessmentData.score, 7);
  assert.equal(migrated.final.f1, 'تغییر');
  assert.equal(migrated.answers[1], 'متن روز یک');
  assert.equal(migrated.daily[1].feedbackText, 'شرح');
  assert.deepEqual(Object.keys(migrated.profileData).sort(), ['durationMonths', 'durationYears', 'goal', 'problem']);
});

test('executed privacy migration writes, reads back, and preserves path/report data', async () => {
  const { executeJourneyPrivacyMigration, JOURNEY_KEY, JOURNEY_PRIVACY_MIGRATION_VERSION } = await import('../src/features/journey/journeyStore.js');
  const raw = {
    schema: 7, started: true, profile: true, assessment: true,
    profileData: { name: 'نام کاربر', age: 35, gender: 'زن', phone: '09123456789', medical: 'none', medicalNote: '', medication: 'no', medicationRisk: 'no', problem: 'anxiety', durationYears: 2, durationMonths: 3, goal: 'هدف مسیر' },
    assessmentData: { score: 6 }, answers: { 1: 'پاسخ روز اول' }, daily: { 1: { score: 5 } },
    final: { score: 3, f1: 'تغییر ثبت‌شده' },
    archive: [{ pathId: 'old', profileData: { name: 'نام قدیمی', medical: 'other', problem: 'stress', durationYears: 1, durationMonths: 0, goal: 'هدف قدیمی' }, answers: { 1: 'پاسخ آرشیو' } }],
  };
  const values = new Map([[JOURNEY_KEY, JSON.stringify(raw)]]);
  const storage = { getItem: (key) => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)) };
  const canonical = { name: 'نام کاربر', age: 35, gender: 'زن', phone: '09123456789', medical: 'none', medicalNote: '', medication: 'no', medicationRisk: 'no' };
  const result = executeJourneyPrivacyMigration({ storage, canonicalProfile: canonical });
  assert.deepEqual(result, { migrated: true, reason: 'verified', version: JOURNEY_PRIVACY_MIGRATION_VERSION });
  const saved = JSON.parse(values.get(JOURNEY_KEY));
  assert.equal(saved.profileData.name, undefined);
  assert.equal(saved.archive[0].profileData.medical, undefined);
  assert.equal(saved.profileData.problem, 'anxiety');
  assert.equal(saved.answers[1], 'پاسخ روز اول');
  assert.equal(saved.final.f1, 'تغییر ثبت‌شده');
  assert.equal(saved.archive[0].answers[1], 'پاسخ آرشیو');
});

test('executed privacy migration refuses incomplete canonical profile without writing', async () => {
  const { executeJourneyPrivacyMigration, JOURNEY_KEY } = await import('../src/features/journey/journeyStore.js');
  const raw = { profileData: { name: 'نام کاربر', medical: 'none', problem: 'anxiety' }, archive: [] };
  const original = JSON.stringify(raw);
  const values = new Map([[JOURNEY_KEY, original]]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
  const result = executeJourneyPrivacyMigration({ storage, canonicalProfile: { name: 'نام کاربر' } });
  assert.equal(result.migrated, false);
  assert.equal(result.reason, 'canonical_profile_incomplete');
  assert.equal(values.get(JOURNEY_KEY), original);
});

test('executed privacy migration compensates a write-then-throw failure and verifies the original record', async () => {
  const { executeJourneyPrivacyMigration, JOURNEY_KEY } = await import('../src/features/journey/journeyStore.js');
  const raw = { profileData: { name: 'نام کاربر', medical: 'none', problem: 'anxiety' }, archive: [] };
  const original = JSON.stringify(raw);
  const values = new Map([[JOURNEY_KEY, original]]);
  let failOnce = true;
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, String(value));
      if (failOnce) { failOnce = false; throw new Error('write completed then failed'); }
    },
  };
  const result = executeJourneyPrivacyMigration({ storage, canonicalProfile: { name: 'نام کاربر', medical: 'none' } });
  assert.equal(result.migrated, false);
  assert.equal(result.reason, 'write_failed_rolled_back');
  assert.equal(values.get(JOURNEY_KEY), original);
});

test('executed privacy migration reports recovery_required when compensation cannot be verified', async () => {
  const { executeJourneyPrivacyMigration, JOURNEY_KEY } = await import('../src/features/journey/journeyStore.js');
  const raw = { profileData: { name: 'نام کاربر', medical: 'none', problem: 'anxiety' }, archive: [] };
  const original = JSON.stringify(raw);
  const values = new Map([[JOURNEY_KEY, original]]);
  let writes = 0;
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      writes += 1;
      values.set(key, String(value));
      if (writes === 1) throw new Error('first write failed after mutation');
      throw new Error('compensation write failed');
    },
  };
  const result = executeJourneyPrivacyMigration({ storage, canonicalProfile: { name: 'نام کاربر', medical: 'none' } });
  assert.equal(result.migrated, false);
  assert.equal(result.reason, 'recovery_required');
});


test('executed privacy migration never overwrites a concurrent journey update', async () => {
  const { executeJourneyPrivacyMigration, JOURNEY_KEY } = await import('../src/features/journey/journeyStore.js');
  const raw = { profileData: { name: 'نام کاربر', medical: 'none', problem: 'anxiety' }, archive: [] };
  const original = JSON.stringify(raw);
  const concurrent = JSON.stringify({ ...raw, answers: { 1: 'تغییر هم‌زمان' } });
  const values = new Map([[JOURNEY_KEY, original]]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
  const originalGet = storage.getItem;
  let reads = 0;
  storage.getItem = (key) => {
    reads += 1;
    if (reads === 2) values.set(JOURNEY_KEY, concurrent);
    return originalGet(key);
  };
  const result = executeJourneyPrivacyMigration({ storage, canonicalProfile: { name: 'نام کاربر', medical: 'none' } });
  assert.equal(result.migrated, false);
  assert.equal(result.reason, 'source_changed_during_preflight');
  assert.equal(values.get(JOURNEY_KEY), concurrent);
});
