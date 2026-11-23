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

test('T15-T18 have 28 source-bound, distinct hypothetical exercise and action examples each', async () => {
  const [base, overrides, catalog] = await Promise.all([
    readJson('../public/content/path-content.json'),
    readJson('../public/content/daily-text-overrides.v1.json'),
    readJson('../src/features/assistant/sharedDailyAssistantExamples.v1.json'),
  ]);
  const merged = mergeDailyTextOverrides(base, overrides);
  const topics = [
    ['T15', 'اعتمادبه‌نفس پایین'],
    ['T16', 'افکار منفی و نشخوار فکری'],
    ['T17', 'مشکلات رابطه'],
    ['T18', 'نفرت از خود'],
  ];
  const allExamples = [];
  for (const [topicId, topicName] of topics) {
    const days = merged.categories[topicName].days;
    const records = catalog.records.filter((record) => record.topicId === topicId);
    assert.equal(days.length, 28, topicId + ' canonical days');
    assert.equal(records.length, 28, topicId + ' example records');
    for (const day of days) {
      const record = records.find((item) => item.day === day.day);
      assert.ok(record, topicId + ' day ' + day.day + ' record');
      assert.equal(record.exerciseSource, day.exercise, topicId + ' day ' + day.day + ' exercise provenance');
      assert.equal(record.actionSource, day.actionText, topicId + ' day ' + day.day + ' action provenance');
      assert.match(record.exerciseExample, /^نمونه فرضی/u);
      assert.match(record.actionExample, /^نمونه فرضی/u);
      assert.notEqual(record.exerciseExample, day.exercise);
      assert.notEqual(record.actionExample, day.actionText);
      allExamples.push(record.exerciseExample, record.actionExample);
    }
    assert.equal(new Set(records.map((record) => record.exerciseExample)).size, 28, topicId + ' distinct exercise examples');
    assert.equal(new Set(records.map((record) => record.actionExample)).size, 28, topicId + ' distinct action examples');
  }
  assert.equal(new Set(allExamples).size, 224, 'T15-T18 examples must not repeat exactly across topics or days');
  const relationshipRisk = catalog.records.find((record) => record.topicId === 'T17' && record.day === 25);
  assert.match(relationshipRisk.exerciseExample, /تهدید|کنترل اجباری|ترس از تلافی/u);
  assert.match(relationshipRisk.actionExample, /محرمانه|خطر را بیشتر/u);
  const selfSafety = catalog.records.find((record) => record.topicId === 'T18' && record.day === 22);
  assert.match(selfSafety.actionExample, /فکر آسیب به خود|خدمات اضطراری/u);
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

test('T05 has distinct hypothetical examples that preserve privacy and mutual consent', async () => {
  const [base, overrides] = await Promise.all([
    readJson('../public/content/path-content.json'),
    readJson('../public/content/daily-text-overrides.v1.json'),
  ]);
  const merged = mergeDailyTextOverrides(base, overrides);
  const days = merged.categories['حسادت'].days;
  assert.equal(days.length, 28);
  for (const day of days) {
    assert.ok(day.exerciseExample?.trim(), 'T05 day ' + day.day + ' exercise example');
    assert.ok(day.actionExample?.trim(), 'T05 day ' + day.day + ' action example');
    assert.match(day.exerciseExample, /^نمونه فرضی/u);
    assert.match(day.actionExample, /^نمونه فرضی/u);
  }
  assert.equal(new Set(days.map(day => day.exerciseExample)).size, 28);
  assert.equal(new Set(days.map(day => day.actionExample)).size, 28);
  assert.match(days[9].exerciseExample, /رمز|موقعیت مکانی/u);
  assert.match(days[23].actionExample, /حمایت امن/u);
});

test('T06 has distinct hypothetical examples that do not impose a grief timeline or disclosure', async () => {
  const [base, overrides] = await Promise.all([
    readJson('../public/content/path-content.json'),
    readJson('../public/content/daily-text-overrides.v1.json'),
  ]);
  const merged = mergeDailyTextOverrides(base, overrides);
  const days = merged.categories['غم و سوگ'].days;
  assert.equal(days.length, 28);
  for (const day of days) {
    assert.ok(day.exerciseExample?.trim(), 'T06 day ' + day.day + ' exercise example');
    assert.ok(day.actionExample?.trim(), 'T06 day ' + day.day + ' action example');
    assert.match(day.exerciseExample, /^نمونه فرضی/u);
    assert.match(day.actionExample, /^نمونه فرضی/u);
  }
  assert.equal(new Set(days.map(day => day.exerciseExample)).size, 28);
  assert.equal(new Set(days.map(day => day.actionExample)).size, 28);
  assert.match(days[17].actionExample, /اگر میلی ندارم|کنار می‌گذارم/u);
  assert.match(days[23].exerciseExample, /مجبور/u);
});

test('T07 has distinct hypothetical examples that separate responsibility from self-punishment', async () => {
  const [base, overrides] = await Promise.all([
    readJson('../public/content/path-content.json'),
    readJson('../public/content/daily-text-overrides.v1.json'),
  ]);
  const merged = mergeDailyTextOverrides(base, overrides);
  const days = merged.categories['احساس گناه'].days;
  assert.equal(days.length, 28);
  for (const day of days) {
    assert.ok(day.exerciseExample?.trim(), 'T07 day ' + day.day + ' exercise example');
    assert.ok(day.actionExample?.trim(), 'T07 day ' + day.day + ' action example');
    assert.match(day.exerciseExample, /^نمونه فرضی/u);
    assert.match(day.actionExample, /^نمونه فرضی/u);
  }
  assert.equal(new Set(days.map(day => day.exerciseExample)).size, 28);
  assert.equal(new Set(days.map(day => day.actionExample)).size, 28);
  assert.match(days[10].exerciseExample, /مجازات/u);
  assert.match(days[23].actionExample, /حق فاصله/u);
});

test('T08 has distinct hypothetical examples that preserve autonomy, consent, and safe support', async () => {
  const [base, overrides] = await Promise.all([
    readJson('../public/content/path-content.json'),
    readJson('../public/content/daily-text-overrides.v1.json'),
  ]);
  const merged = mergeDailyTextOverrides(base, overrides);
  const days = merged.categories['وابستگی عاطفی'].days;
  assert.equal(days.length, 28);
  for (const day of days) {
    assert.ok(day.exerciseExample?.trim(), 'T08 day ' + day.day + ' exercise example');
    assert.ok(day.actionExample?.trim(), 'T08 day ' + day.day + ' action example');
    assert.match(day.exerciseExample, /^نمونه فرضی/u);
    assert.match(day.actionExample, /^نمونه فرضی/u);
  }
  assert.equal(new Set(days.map(day => day.exerciseExample)).size, 28);
  assert.equal(new Set(days.map(day => day.actionExample)).size, 28);
  assert.match(days[24].actionExample, /فرد امن|خدمت حمایتی/u);
  assert.match(days[25].exerciseExample, /پاسخ منفی/u);
});

test('T09 has distinct hypothetical examples that model small, realistic starts and structural barriers', async () => {
  const [base, overrides] = await Promise.all([
    readJson('../public/content/path-content.json'),
    readJson('../public/content/daily-text-overrides.v1.json'),
  ]);
  const merged = mergeDailyTextOverrides(base, overrides);
  const days = merged.categories['اهمال‌کاری'].days;
  assert.equal(days.length, 28);
  for (const day of days) {
    assert.ok(day.exerciseExample?.trim(), 'T09 day ' + day.day + ' exercise example');
    assert.ok(day.actionExample?.trim(), 'T09 day ' + day.day + ' action example');
    assert.match(day.exerciseExample, /^نمونه فرضی/u);
    assert.match(day.actionExample, /^نمونه فرضی/u);
  }
  assert.equal(new Set(days.map(day => day.exerciseExample)).size, 28);
  assert.equal(new Set(days.map(day => day.actionExample)).size, 28);
  assert.match(days[25].actionExample, /پیام کوتاه برای مسئول پروژه/u);
  assert.match(days[25].actionExample, /تاریخ پیگیری/u);
});

test('T10 has distinct hypothetical examples that preserve sleep and medical safety', async () => {
  const [base, overrides] = await Promise.all([
    readJson('../public/content/path-content.json'),
    readJson('../public/content/daily-text-overrides.v1.json'),
  ]);
  const merged = mergeDailyTextOverrides(base, overrides);
  const days = merged.categories['بی‌خوابی و مشکلات خواب'].days;
  assert.equal(days.length, 28);
  for (const day of days) {
    assert.ok(day.exerciseExample?.trim(), 'T10 day ' + day.day + ' exercise example');
    assert.ok(day.actionExample?.trim(), 'T10 day ' + day.day + ' action example');
    assert.match(day.exerciseExample, /^نمونه فرضی/u);
    assert.match(day.actionExample, /^نمونه فرضی/u);
  }
  assert.equal(new Set(days.map(day => day.exerciseExample)).size, 28);
  assert.equal(new Set(days.map(day => day.actionExample)).size, 28);
  assert.match(days[16].actionExample, /رانندگی/u);
  assert.match(days[24].exerciseExample, /ارزیابی پزشکی/u);
});
