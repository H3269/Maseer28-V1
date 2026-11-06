import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mergeDailyTextOverrides } from '../src/features/content/dailyTextOverrides.js';

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('the 34-topic daily text overlay replaces only exercise and action text for all 952 days', async () => {
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
      assert.equal(actual.title, original.title, 'daily title must remain unchanged');
      assert.equal(actual.intro, original.intro, 'daily introduction must remain unchanged');
      assert.equal(actual.closing, original.closing, 'daily closing must remain unchanged');
      assert.equal(actual.exercise, replacement.exercise);
      assert.equal(actual.actionText, replacement.actionText);
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
