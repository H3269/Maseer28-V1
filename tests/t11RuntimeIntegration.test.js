import assert from 'node:assert/strict';
import test from 'node:test';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import {
  T11_DAILY_ASSISTANT_GUIDES,
  getT11DailyAssistantPromptGroups,
} from '../src/features/assistant/t11DailyAssistantPrompts.js';
import { getCanonicalDailyRecordId } from '../src/features/content/dailyContentSelector.js';

function contextFor(guide, overrides = {}) {
  const data = {
    id: getCanonicalDailyRecordId('عادت‌های تکراری', guide.day),
    topic_id: 'T11',
    day: guide.day,
    review_status: 'pending_expert_review',
    risk_level: 'human_review_required',
    exercise: guide.exercise,
    actionText: guide.action,
  };
  return {
    day: guide.day,
    problem: 'عادت‌های تکراری',
    data,
    ...overrides,
  };
}

test('all 392 exact T11 prepared questions route through the real page assistant', () => {
  let checked = 0;
  for (const guide of T11_DAILY_ASSISTANT_GUIDES) {
    for (const question of guide.questions) {
      const result = makePageAssistantTurn({
        screen: 'day',
        text: question.value,
        dailyContext: contextFor(guide),
      });
      assert.equal(result.status, 'daily_guidance_available', `day ${guide.day}: ${question.id}`);
      assert.ok(result.message.includes(guide.title));
      assert.ok(result.message.includes(`راهنمای روز ${guide.day}`));
      assert.ok(result.message.endsWith(question.answer));
      checked += 1;
    }
  }
  assert.equal(checked, 392);
});

test('T11 assistant refuses mismatched day/topic and all free-form prompts', () => {
  const guide = T11_DAILY_ASSISTANT_GUIDES[0];
  const question = guide.questions[0];
  const wrongTopic = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: contextFor(guide, {
      data: { ...contextFor(guide).data, topic_id: 'T10' },
    }),
  });
  assert.equal(wrongTopic.status, 'daily_guidance_unavailable');

  const wrongDay = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: contextFor(guide, {
      day: 2,
      data: { ...contextFor(guide).data, id: getCanonicalDailyRecordId('عادت‌های تکراری', 1), day: 1 },
    }),
  });
  assert.equal(wrongDay.status, 'daily_guidance_unavailable');

  const freeForm = makePageAssistantTurn({
    screen: 'day',
    text: 'چرا نمی‌توانم این رفتار را کنترل کنم؟',
    dailyContext: contextFor(guide),
  });
  assert.equal(freeForm.status, 'prepared_question_required');
});

test('explicit safety disclosures preempt T11 prepared questions', () => {
  const guide = T11_DAILY_ASSISTANT_GUIDES[0];
  const first = makePageAssistantTurn({
    screen: 'day',
    text: 'قصد دارم همین الآن به خودم آسیب بزنم و به کمک فوری نیاز دارم.',
    dailyContext: contextFor(guide),
  });
  assert.equal(first.status, 'urgent_human_support_required');
});

test('T11 prompt groups retain the five shared UI groups and fixed 14-question coverage', () => {
  for (let day = 1; day <= 28; day += 1) {
    const groups = getT11DailyAssistantPromptGroups(day);
    assert.deepEqual(groups.map((group) => group.questions.length), [2, 2, 1, 5, 4]);
    assert.equal(groups.reduce((sum, group) => sum + group.questions.length, 0), 14);
  }
});
