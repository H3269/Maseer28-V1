import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ANGER_DAILY_ASSISTANT_GUIDES } from '../src/features/assistant/angerDailyAssistantPrompts.js';

const readJson = (path) => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);

test('T01 runtime guide contains 28 complete, day-specific learning units', () => {
  assert.equal(ANGER_DAILY_ASSISTANT_GUIDES.length, 28);
  assert.deepEqual(ANGER_DAILY_ASSISTANT_GUIDES.map((day) => day.day), Array.from({ length: 28 }, (_, index) => index + 1));
  for (const day of ANGER_DAILY_ASSISTANT_GUIDES) {
    for (const field of ['title', 'objective', 'skill', 'mechanism', 'exercise', 'action', 'lightVersion', 'successCriterion', 'stopCondition', 'exerciseExample', 'actionExample']) {
      assert.ok(typeof day[field] === 'string' && day[field].trim(), 'day ' + day.day + ' missing ' + field);
    }
    assert.equal(day.topicId, 'T01');
    assert.equal(day.questions.length, 14);
  }
  for (const field of ['title', 'exercise', 'action', 'exerciseExample', 'actionExample']) {
    assert.equal(new Set(ANGER_DAILY_ASSISTANT_GUIDES.map((day) => day[field])).size, 28, field + ' must remain day-specific');
  }
});

test('T01 runtime exercise and action overrides match the active assistant guide', async () => {
  const overlay = await readJson('../public/content/daily-text-overrides.v1.json');
  const runtime = overlay.categories['خشم']?.days ?? [];
  assert.equal(runtime.length, 28);
  for (const guide of ANGER_DAILY_ASSISTANT_GUIDES) {
    const day = runtime.find((item) => item.day === guide.day);
    assert.ok(day, 'missing runtime day ' + guide.day);
    assert.equal(day.exercise, guide.exercise, 'exercise mismatch day ' + guide.day);
    assert.equal(day.actionText, guide.action, 'action mismatch day ' + guide.day);
    assert.equal(day.title, guide.title, 'title mismatch day ' + guide.day);
  }
});

test('T01 exercises and actions have no exact duplicates across the other 33 topics', async () => {
  const overlay = await readJson('../public/content/daily-text-overrides.v1.json');
  const categories = overlay.categories;
  const anger = categories['خشم'].days;
  const normalize = (value) => String(value).normalize('NFKC').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ').trim();
  for (const field of ['exercise', 'actionText']) {
    const angerValues = new Set(anger.map((day) => normalize(day[field])));
    for (const [topic, category] of Object.entries(categories)) {
      if (topic === 'خشم') continue;
      for (const day of category.days ?? []) {
        assert.ok(!angerValues.has(normalize(day[field])), 'exact ' + field + ' duplicate: T01 day vs ' + topic + ' day ' + day.day);
      }
    }
  }
});

test('T01 day 9 title remains synchronized between guide and runtime overlay', async () => {
  const overlay = await readJson('../public/content/daily-text-overrides.v1.json');
  const guide = ANGER_DAILY_ASSISTANT_GUIDES.find((day) => day.day === 9);
  const runtime = overlay.categories['خشم'].days.find((day) => day.day === 9);
  assert.ok(guide && runtime);
  assert.equal(guide.title, runtime.title);
});
