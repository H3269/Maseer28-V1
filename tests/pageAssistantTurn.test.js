import assert from 'node:assert/strict';
import test from 'node:test';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import { FEAR_DAILY_ASSISTANT_GUIDES, answerFearDailyPreparedQuestion, getFearDailyAssistantPromptGroups } from '../src/features/assistant/fearDailyAssistantPrompts.js';
import { getCanonicalDailyRecordId } from '../src/features/content/dailyContentSelector.js';
import { ANXIETY_DAILY_ASSISTANT_GUIDES } from '../src/features/assistant/anxietyDailyAssistantPrompts.js';
import { ANGER_DAILY_ASSISTANT_GUIDES } from '../src/features/assistant/angerDailyAssistantPrompts.js';
import { HATRED_DAILY_ASSISTANT_GUIDES, getHatredDailyAssistantPromptGroups } from '../src/features/assistant/hatredDailyAssistantPrompts.js';

test('non-prepared page text is rejected at the routing boundary', () => {
  const result = makePageAssistantTurn({ screen: 'dashboard', text: 'لطفاً یک سؤال آزاد از من بپرس' });
  assert.equal(result.status, 'prepared_question_required');
  assert.equal(result.conversationState, null);
  assert.deepEqual(result.knowledge, []);
});

test('daily topics without a prepared catalogue do not fall back to general text reasoning', () => {
  const result = makePageAssistantTurn({
    screen: 'day',
    text: 'چطور تمرین امروز را انجام بدهم؟',
    dailyContext: {
      day: 1,
      problem: 'موضوع در حال تکمیل',
      data: { id: 'T99-D01', topic_id: 'T99', day: 1 },
    },
  });
  assert.equal(result.status, 'prepared_question_required');
  assert.equal(result.conversationState, null);
});
