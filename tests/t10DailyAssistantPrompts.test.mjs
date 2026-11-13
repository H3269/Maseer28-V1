import test from 'node:test';
import assert from 'node:assert/strict';
import { answerT10DailyPreparedQuestion, getT10DailyAssistantPromptGroups, T10_DAILY_ASSISTANT_GUIDES } from '../src/features/assistant/t10DailyAssistantPrompts.js';

test('T10 exposes all 28 daily prompt groups with 14 prepared questions per day', () => {
  assert.equal(T10_DAILY_ASSISTANT_GUIDES.length, 28);
  for (let day = 1; day <= 28; day += 1) {
    const groups = getT10DailyAssistantPromptGroups(day);
    const questions = groups.flatMap((group) => group.questions);
    assert.equal(questions.length, 14, `day ${day}`);
    assert.ok(questions.every((question) => question.value.trim() && question.answer.trim()));
  }
});

test('T10 prepared answer requires exact canonical day identity and matching topic', () => {
  const guide = T10_DAILY_ASSISTANT_GUIDES[0];
  const question = guide.questions[0];
  const dailyContent = {
    id: 'T10-D01',
    day: 1,
    topic_id: 'T10',
    exercise: guide.exercise,
    action: guide.action,
  };
  const answer = answerT10DailyPreparedQuestion({ day: 1, message: question.value, dailyContent });
  assert.ok(answer?.includes(guide.exercise));
  assert.equal(answerT10DailyPreparedQuestion({ day: 1, message: question.value, dailyContent: { ...dailyContent, id: 'T10-D02' } }), null);
  assert.equal(answerT10DailyPreparedQuestion({ day: 1, message: question.value, dailyContent: { ...dailyContent, topic_id: 'T09' } }), null);
});

test('T10 sleep-distress answer preserves stop conditions and safety guidance', () => {
  const guide = T10_DAILY_ASSISTANT_GUIDES[0];
  const question = guide.questions.find((item) => item.kind === 'sleep_distress');
  const answer = answerT10DailyPreparedQuestion({
    day: 1,
    message: question.value,
    dailyContent: { id: 'T10-D01', day: 1, topic_id: 'T10' },
  });
  assert.ok(answer.includes(guide.stopCondition));
  assert.ok(answer.includes('خواب‌آلودگی'));
  assert.ok(answer.includes('ارزیابی پزشکی'));
});

test('T10 rejects unknown questions and invalid days instead of improvising', () => {
  const dailyContent = { id: 'T10-D01', day: 1, topic_id: 'T10' };
  assert.equal(answerT10DailyPreparedQuestion({ day: 1, message: 'سؤال خارج از فهرست', dailyContent }), null);
  assert.deepEqual(getT10DailyAssistantPromptGroups(29), []);
});
