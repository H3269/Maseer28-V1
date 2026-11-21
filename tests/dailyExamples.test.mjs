import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mergeDailyTextOverrides } from '../src/features/content/dailyTextOverrides.js';
import { makeDailyExerciseGuidanceTurn } from '../src/features/assistant/dailyExerciseAssistantGuidance.js';

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('T01 has a distinct, visible hypothetical example for each of its 28 exercises and actions', async () => {
  const [base, overrides] = await Promise.all([
    readJson('../public/content/path-content.json'),
    readJson('../public/content/daily-text-overrides.v1.json'),
  ]);
  const merged = mergeDailyTextOverrides(base, overrides);
  const days = merged.categories['خشم'].days;
  assert.equal(days.length, 28);
  for (const day of days) {
    assert.ok(day.exerciseExample?.trim(), 'T01 day ' + day.day + ' exercise example');
    assert.ok(day.actionExample?.trim(), 'T01 day ' + day.day + ' action example');
    assert.match(day.exerciseExample, /^نمونه فرضی/u);
    assert.match(day.actionExample, /^نمونه فرضی/u);
  }
  assert.equal(new Set(days.map(day => day.exerciseExample)).size, 28);
  assert.equal(new Set(days.map(day => day.actionExample)).size, 28);
});

test('daily assistant returns the matching hypothetical example, not a fabricated personal story', () => {
  const dayData = {
    topic_id: 'T04',
    day: 1,
    exercise: 'یک موقعیت را توصیف کن.',
    actionText: 'فعلاً تصمیم نگیر.',
    exerciseExample: 'نمونه فرضی تمرین.',
    actionExample: 'نمونه فرضی اقدام.',
  };
  const exercise = makeDailyExerciseGuidanceTurn({ message: 'برای تمرین مثال بزن', dayData, problem: 'نفرت', day: 1 });
  const action = makeDailyExerciseGuidanceTurn({ message: 'برای راهکار اختصاصی مثال بزن', dayData, problem: 'نفرت', day: 1 });
  assert.match(exercise.response, /نمونه فرضی تمرین/u);
  assert.match(action.response, /نمونه فرضی اقدام/u);
  assert.match(exercise.response, /عیناً به خودت نسبت نده/u);
});

test('daily assistant asks which section needs an example when exercise and action are requested together', () => {
  const result = makeDailyExerciseGuidanceTurn({
    message: 'برای تمرین و راهکار مثال بزن',
    dayData: { topic_id: 'T04', day: 1, exercise: 'تمرین', actionText: 'اقدام', exerciseExample: 'نمونه تمرین', actionExample: 'نمونه اقدام' },
    problem: 'نفرت',
    day: 1,
  });
  assert.match(result.response, /تمرین یا راهکار اختصاصی/u);
});

test('T02 has a distinct, visible hypothetical example for each of its 28 exercises and actions', async () => {
  const [base, overrides] = await Promise.all([
    readJson('../public/content/path-content.json'),
    readJson('../public/content/daily-text-overrides.v1.json'),
  ]);
  const merged = mergeDailyTextOverrides(base, overrides);
  const days = merged.categories['اضطراب'].days;
  assert.equal(days.length, 28);
  for (const day of days) {
    assert.ok(day.exerciseExample?.trim(), 'T02 day ' + day.day + ' exercise example');
    assert.ok(day.actionExample?.trim(), 'T02 day ' + day.day + ' action example');
    assert.match(day.exerciseExample, /^نمونه فرضی/u);
    assert.match(day.actionExample, /^نمونه فرضی/u);
  }
  assert.equal(new Set(days.map(day => day.exerciseExample)).size, 28);
  assert.equal(new Set(days.map(day => day.actionExample)).size, 28);
});

test('T03 has a distinct, safety-preserving hypothetical example for each of its 28 exercises and actions', async () => {
  const [base, overrides] = await Promise.all([
    readJson('../public/content/path-content.json'),
    readJson('../public/content/daily-text-overrides.v1.json'),
  ]);
  const merged = mergeDailyTextOverrides(base, overrides);
  const days = merged.categories['ترس'].days;
  assert.equal(days.length, 28);
  for (const day of days) {
    assert.ok(day.exerciseExample?.trim(), 'T03 day ' + day.day + ' exercise example');
    assert.ok(day.actionExample?.trim(), 'T03 day ' + day.day + ' action example');
    assert.match(day.exerciseExample, /^نمونه فرضی/u);
    assert.match(day.actionExample, /^نمونه فرضی/u);
  }
  assert.equal(new Set(days.map(day => day.exerciseExample)).size, 28);
  assert.equal(new Set(days.map(day => day.actionExample)).size, 28);
  assert.match(days[17].exerciseExample, /داده موجود|داده ناموجود/u);
  assert.match(days[20].actionExample, /فرد منتخب امن|ارسال اجباری نیست/u);
});

test('T04 has distinct hypothetical examples that separate feeling from harmful behavior', async () => {
  const [base, overrides] = await Promise.all([
    readJson('../public/content/path-content.json'),
    readJson('../public/content/daily-text-overrides.v1.json'),
  ]);
  const merged = mergeDailyTextOverrides(base, overrides);
  const days = merged.categories['نفرت'].days;
  assert.equal(days.length, 28);
  for (const day of days) {
    assert.ok(day.exerciseExample?.trim(), 'T04 day ' + day.day + ' exercise example');
    assert.ok(day.actionExample?.trim(), 'T04 day ' + day.day + ' action example');
    assert.match(day.exerciseExample, /^نمونه فرضی/u);
    assert.match(day.actionExample, /^نمونه فرضی/u);
  }
  assert.equal(new Set(days.map(day => day.exerciseExample)).size, 28);
  assert.equal(new Set(days.map(day => day.actionExample)).size, 28);
  assert.match(days[9].actionExample, /تمرین را متوقف/u);
  assert.match(days[21].actionExample, /فاصله/u);
});
