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
    const question = guide.questions.find((item) => item.kind === 'procrastination_increased');
    const answer = answerT10DailyPreparedQuestion({ day: guide.day, message: question.value, dailyContent: dailyContent(guide) });
    assert.equal(typeof answer, 'string');
    assert.equal((answer.split(guide.stopCondition).length - 1), 1, 'stop condition count on day ' + guide.day);
    assert.equal((answer.split(guide.whenToSeekHumanSupport).length - 1), 1, 'support statement count on day ' + guide.day);
  }
});
