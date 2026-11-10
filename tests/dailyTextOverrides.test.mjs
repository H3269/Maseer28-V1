import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mergeDailyTextOverrides } from '../src/features/content/dailyTextOverrides.js';

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('the 34-topic daily text overlay merges every configured runtime text field and keeps unconfigured fields unchanged for all 952 days', async () => {
  const [base, overrides, registry] = await Promise.all([
    readJson('../public/content/path-content.json'),
    readJson('../public/content/daily-text-overrides.v1.json'),
    readJson('../public/assistant/knowledge/topics.v1.json'),
  ]);
  const merged = mergeDailyTextOverrides(base, overrides);
  const topicNames = registry.topics.map((topic) => topic.name);

  assert.equal(Object.keys(overrides.categories).length, 34);
  assert.deepEqual(Object.keys(overrides.categories).sort(), [...topicNames].sort());

  let total = 0;
  let changedExercise = 0;
  let changedAction = 0;
  const normalized = (value) => String(value ?? '').normalize('NFKC')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u200c\u200f\u202a-\u202e]/g, '')
    .replace(/\s+/g, ' ').trim();
  const exerciseTexts = new Set();
  const actionTexts = new Set();
  for (const topic of topicNames) {
    const originalDays = base.categories[topic]?.days || [];
    const overrideDays = overrides.categories[topic]?.days || [];
    const mergedDays = merged.categories[topic]?.days || [];
    assert.equal(originalDays.length, 28, topic + ' original day count');
    assert.equal(overrideDays.length, 28, topic + ' override day count');
    assert.equal(mergedDays.length, 28, topic + ' merged day count');

    for (let index = 0; index < 28; index += 1) {
      const original = originalDays[index];
      const replacement = overrideDays[index];
      const actual = mergedDays[index];
      assert.equal(replacement.day, index + 1);
      assert.ok(replacement.exercise.trim(), topic + ' day ' + (index + 1) + ' exercise');
      assert.ok(replacement.actionText.trim(), topic + ' day ' + (index + 1) + ' action');
      assert.equal(actual.id, original.id, 'canonical day ID must remain unchanged');
      for (const field of ['title', 'intro', 'exercise', 'actionText', 'closing', 'lightExerciseText', 'lightActionText', 'progressActionText', 'restExerciseText', 'restActionText']) {
        if (typeof replacement[field] === 'string' && replacement[field].trim()) {
          assert.equal(actual[field], replacement[field], topic + ' day ' + (index + 1) + ' ' + field + ' override');
        } else {
          assert.equal(actual[field], original[field], topic + ' day ' + (index + 1) + ' ' + field + ' fallback');
        }
      }
      const normalizedExercise = normalized(actual.exercise);
      const normalizedAction = normalized(actual.actionText);
      assert.ok(!exerciseTexts.has(normalizedExercise), topic + ' day ' + (index + 1) + ' exercise must not duplicate another topic/day');
      assert.ok(!actionTexts.has(normalizedAction), topic + ' day ' + (index + 1) + ' action must not duplicate another topic/day');
      exerciseTexts.add(normalizedExercise);
      actionTexts.add(normalizedAction);
      if (actual.exercise !== original.exercise) changedExercise += 1;
      if (actual.actionText !== original.actionText) changedAction += 1;
      total += 1;
    }
  }

  assert.equal(total, 952);
  assert.equal(changedExercise, 952);
  assert.equal(changedAction, 952);
  assert.equal(exerciseTexts.size, 952);
  assert.equal(actionTexts.size, 952);
});

test('T02 anxiety overrides all ten runtime text fields uniquely across all 28 days', async () => {
  const [base, overrides] = await Promise.all([
    readJson('../public/content/path-content.json'),
    readJson('../public/content/daily-text-overrides.v1.json'),
  ]);
  const merged = mergeDailyTextOverrides(base, overrides);
  const fields = ['title', 'intro', 'exercise', 'actionText', 'closing', 'lightExerciseText', 'lightActionText', 'progressActionText', 'restExerciseText', 'restActionText'];
  const normalizeField = (value) => String(value ?? '').normalize('NFKC').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[\u064B-\u065F\u0670]/g, '').replace(/[\u200c\u200f\u202a-\u202e]/g, '').replace(/\s+/g, ' ').trim();
  const original = base.categories['اضطراب'].days;
  const actual = merged.categories['اضطراب'].days;
  const allRecords = Object.entries(merged.categories).flatMap(([topic, category]) =>
    (category.days || []).map((day) => ({ topic, day })),
  );
  assert.equal(actual.length, 28);
  for (const field of fields) {
    const values = actual.map((day) => normalizeField(day[field]));
    assert.equal(values.filter(Boolean).length, 28, field + ' coverage');
    assert.equal(new Set(values).size, 28, field + ' must be unique within T02');
    for (let index = 0; index < 28; index += 1) {
      assert.equal(actual[index][field], overrides.categories['اضطراب'].days[index][field], field + ' day ' + (index + 1));
      const normalized = normalizeField(actual[index][field]);
      const duplicate = allRecords.find(({ topic, day }) =>
        !(topic === 'اضطراب' && Number(day.day) === index + 1)
        && normalizeField(day[field]) === normalized,
      );
      assert.equal(duplicate, undefined, field + ' T02 day ' + (index + 1) + ' must not exactly duplicate another topic/day');
    }
  }
  assert.deepEqual(actual.map(day => day.id), original.map(day => day.id), 'canonical IDs remain unchanged');
});

test('T03 fear overrides all ten runtime text fields uniquely across all 28 days', async () => {
  const [base, overrides] = await Promise.all([
    readJson('../public/content/path-content.json'),
    readJson('../public/content/daily-text-overrides.v1.json'),
  ]);
  const merged = mergeDailyTextOverrides(base, overrides);
  const fields = ['title', 'intro', 'exercise', 'actionText', 'closing', 'lightExerciseText', 'lightActionText', 'progressActionText', 'restExerciseText', 'restActionText'];
  const normalizeField = (value) => String(value ?? '').normalize('NFKC')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u200c\u200f\u202a-\u202e]/g, '')
    .replace(/\s+/g, ' ').trim();
  const original = base.categories['ترس'].days;
  const actual = merged.categories['ترس'].days;
  const allRecords = Object.entries(merged.categories).flatMap(([topic, category]) =>
    (category.days || []).map((day) => ({ topic, day })),
  );
  assert.equal(actual.length, 28);
  for (const field of fields) {
    const values = actual.map((day) => normalizeField(day[field]));
    assert.equal(values.filter(Boolean).length, 28, field + ' coverage');
    assert.equal(new Set(values).size, 28, field + ' must be unique within T03');
    for (let index = 0; index < 28; index += 1) {
      assert.equal(actual[index][field], overrides.categories['ترس'].days[index][field], field + ' day ' + (index + 1));
      const normalized = normalizeField(actual[index][field]);
      const duplicate = allRecords.find(({ topic, day }) =>
        !(topic === 'ترس' && Number(day.day) === index + 1)
        && normalizeField(day[field]) === normalized,
      );
      assert.equal(duplicate, undefined, field + ' T03 day ' + (index + 1) + ' must not exactly duplicate another topic/day');
    }
  }
  assert.deepEqual(actual.map(day => day.id), original.map(day => day.id), 'canonical IDs remain unchanged');
});

test('T03 daily override fetch uses a fresh cache key', async () => {
 const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
 assert.match(app, /daily-text-overrides\\.v1\\.json\\?v=20261110-t03/);
});
