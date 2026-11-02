import test from 'node:test';
import assert from 'node:assert/strict';

import {
  burdenScoreFromAnswers,
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
    data.set(PROFILE_V2_KEY, JSON.stringify({ name: 'canonical', age: 29 }));
    const state = { profileData: { name: 'legacy', age: 45, gender: 'مرد' } };
    const first = migrateUserProfileToV2(state);
    const second = migrateUserProfileToV2({ profileData: { name: 'new legacy', age: 50 } });
    assert.equal(first.profile.name, 'canonical');
    assert.equal(second.profile.name, 'canonical');
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
