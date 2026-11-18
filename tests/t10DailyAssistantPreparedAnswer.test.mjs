import assert from 'node:assert/strict';
import test from 'node:test';
import { T10_DAILY_ASSISTANT_GUIDES, answerT10DailyPreparedQuestion } from '../src/features/assistant/t10DailyAssistantPrompts.js';

function dailyContent(guide) {
  return {
    id: 'بی‌خوابی و مشکلات خواب-' + String(guide.day).padStart(2, '0'),
    day: guide.day,
    topic_id: 'T10',
    exercise: guide.exercise,
    actionText: guide.action
  };
}

test('T10 q11 renders the canonical stop condition only once on all 28 days', () => {
  assert.equal(T10_DAILY_ASSISTANT_GUIDES.length, 28);
  for (const guide of T10_DAILY_ASSISTANT_GUIDES) {
    assert.equal((guide.stopConditions || []).includes(guide.stopCondition), false, 'duplicate stop condition in day ' + guide.day);
    const question = guide.questions.find((item) => item.kind === 'sleep_distress');
    const answer = answerT10DailyPreparedQuestion({ day: guide.day, message: question.value, dailyContent: dailyContent(guide) });
    assert.equal(typeof answer, 'string');
    assert.equal((answer.split(guide.stopCondition).length - 1), 1, 'stop condition count on day ' + guide.day);
    assert.match(answer, /حمایت انسانی/u, 'human-support route on day ' + guide.day);
  }
});

test('T10 day 28 review label and light answer remain sleep-specific', () => {
  const guide = T10_DAILY_ASSISTANT_GUIDES.find((item) => item.day === 28);
  assert.equal(guide.title, 'مرور مسیر خواب و گام بعدی');
  assert.equal(guide.lightVersion, 'یک نکته از الگوی خواب و یک گام پیگیری متناسب را یادداشت کن.');
  assert.equal(guide.questions.find((item) => item.kind === 'light_version').answer, guide.lightVersion);
  assert.doesNotMatch(guide.lightVersion, /فقط یک یادگیری و یک گام بعدی بنویس/);
});
