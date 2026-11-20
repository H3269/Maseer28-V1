import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getT01PausePlan } from '../src/features/journey/t01PausePlan.js';
import { mergeDailyTextOverrides } from '../src/features/content/dailyTextOverrides.js';

test('T01 day 10 provides a three-part, conditional pause plan', () => {
  const plan = getT01PausePlan({ topic_id: 'T01', day: 10, id: 'T01-D10' });
  assert.match(plan, /یک برنامه مکث امن با سه جزء بنویس/);
  assert.match(plan, /نشانه مکث/);
  assert.match(plan, /محل فاصله‌گیری/);
  assert.match(plan, /شرط ادامه گفتگو/);
  assert.match(plan, /ادامه فقط با رضایت آزادانه هر دو نفر/);
  assert.match(plan, /تعیین زمان بازگشت یا وعده ادامه گفتگو الزامی نیست/);
  assert.match(plan, /اگر درباره امنیت یا رضایت آزادانه تردید داری/);
});

test('T01 days 10 and 11 use the rewritten exercise and action text without changing the day UI', async () => {
  const [base, overrides] = await Promise.all([
    readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  const content = mergeDailyTextOverrides(base, overrides);
  const day10 = content.categories['خشم'].days.find((item) => item.day === 10);
  const day11 = content.categories['خشم'].days.find((item) => item.day === 11);
  for (const day of [day10, day11]) {
    assert.ok(day.exercise.trim());
    assert.ok(day.actionText.trim());
  }
  assert.notEqual(day10.exercise, base.categories['خشم'].days.find((item) => item.day === 10).exercise);
  assert.notEqual(day10.actionText, base.categories['خشم'].days.find((item) => item.day === 10).actionText);
  const ui = await readFile(new URL('../src/features/journey/JourneyScreens.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(ui, /getT01PausePlan|t01PausePlan/);
});

test('production topic name resolves T01 day 10 when runtime IDs omit topic metadata', () => {
  const plan = getT01PausePlan({ day: 10, instructions: 'تمرین روزانه' }, 'خشم');
  assert.match(plan, /یک برنامه مکث امن با سه جزء بنویس/);
});

test('production anger-category ID resolves T01 day 10 without optional metadata', () => {
  const plan = getT01PausePlan({ id: 'خشم-10', day: 10, instructions: 'تمرین روزانه' });
  assert.match(plan, /یک برنامه مکث امن با سه جزء بنویس/);
});

test('legacy canonical ID resolves T01 day 10 without optional metadata', () => {
  const plan = getT01PausePlan({ id: 'T01-D10', instructions: 'تمرین روزانه' });
  assert.match(plan, /یک برنامه مکث امن با سه جزء بنویس/);
});

test('pause plan is not attached to other topics or days', () => {
  assert.equal(getT01PausePlan({ topic_id: 'T01', day: 9 }), '');
  assert.equal(getT01PausePlan({ topic_id: 'T02', day: 10 }), '');
  assert.equal(getT01PausePlan({ id: 'T01-D09' }), '');
  assert.equal(getT01PausePlan({ id: 'T02-D10' }), '');
  assert.equal(getT01PausePlan({ id: 'خشم-09', day: 9 }), '');
  assert.equal(getT01PausePlan({ id: 'غم-10', day: 10 }), '');
  assert.equal(getT01PausePlan({ id: 'غم-10', day: 10 }, 'خشم'), '');
  assert.equal(getT01PausePlan({ id: 'خشم-09', day: 10 }, 'خشم'), '');
  assert.equal(getT01PausePlan({ topic_id: 'T02', id: 'T02-D10', day: 10 }, 'خشم'), '');
  assert.equal(getT01PausePlan({ topic_id: 'T01', id: 'T01-D09', day: 10 }), '');
  assert.equal(getT01PausePlan({ topic_id: 'T02', id: 'خشم-10', day: 10 }), '');
  assert.equal(getT01PausePlan(null), '');
});
