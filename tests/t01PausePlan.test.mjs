import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getT01PausePlan } from '../src/features/journey/t01PausePlan.js';

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

test('T01 day 10 content is consent-led and remains unapproved', async () => {
  const content = JSON.parse(await readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8'));
  const day = content.categories['خشم'].days.find((item) => item.day === 10);
  assert.equal(day.review_status, 'pending_expert_review');
  assert.match(day.exercise, /هر دو نفر آزادانه رضایت دارند/);
  assert.match(day.exercise, /تعیین زمان بازگشت یا وعده ادامه گفتگو الزامی نیست/);
  assert.doesNotMatch(day.exercise, /زمان بازگشت واقع‌بینانه تعیین کن/);
  assert.match(day.actionText, /لازم نیست زمان بازگشت تعیین کنی/);
});

test('T01 day 11 does not impose a return obligation after a pause', async () => {
  const content = JSON.parse(await readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8'));
  const day = content.categories['خشم'].days.find((item) => item.day === 11);
  assert.equal(day.review_status, 'pending_expert_review');
  assert.match(day.exercise, /اگر یکی از شما نمی‌خواهد ادامه دهد/);
  assert.match(day.actionText, /اگر یکی از شما آمادگی ندارد، ادامه نده/);
  assert.match(day.teaching_point, /مکث به‌خودی‌خود تعهد به بازگشت نیست/);
  assert.doesNotMatch(day.exercise, /چه زمانی می‌توانی به گفت‌وگو برگردی/);
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
  assert.equal(getT01PausePlan(null), '');
});
