import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendDailyAssistantSafetyReminder,
  DAILY_ASSISTANT_SAFETY_QUESTION_KINDS,
  DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN,
} from '../src/features/assistant/dailyAssistantSafetyReminder.js';
import {
  getSharedDailyAssistantPromptGroups,
  SHARED_DAILY_ASSISTANT_DISTRESS_KINDS,
} from '../src/features/assistant/sharedDailyAssistantEngine.js';

const TOPIC_IDS = Array.from({ length: 34 }, (_, index) => 'T' + String(index + 1).padStart(2, '0'));

test('every T01-T34 daily q11 distress answer receives exactly one shared safety reminder', () => {
  for (const topicId of TOPIC_IDS) {
    const distressKind = SHARED_DAILY_ASSISTANT_DISTRESS_KINDS[topicId];
    assert.ok(distressKind, topicId + ' must define a dedicated distress kind');
    assert.ok(DAILY_ASSISTANT_SAFETY_QUESTION_KINDS.has(distressKind),
      topicId + ' q11 distress kind must be included in the shared safety reminder contract');

    for (let day = 1; day <= 28; day += 1) {
      const questions = getSharedDailyAssistantPromptGroups(day, topicId).flatMap((group) => group.questions);
      const distressQuestion = questions.find((question) => question.id === 'q11');
      assert.equal(distressQuestion?.kind, distressKind, topicId + ' day ' + day + ' q11 kind');
      const answer = appendDailyAssistantSafetyReminder('پاسخ ایمنی اختصاصی', distressQuestion.kind);
      assert.equal(answer.split(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN).length - 1, 1,
        topicId + ' day ' + day + ' must append exactly one safety reminder');
      assert.ok(answer.endsWith(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN),
        topicId + ' day ' + day + ' reminder must remain at the end of the answer');
    }
  }
});

test('ordinary prepared questions do not receive the distress-only reminder by accident', () => {
  const ordinaryQuestion = getSharedDailyAssistantPromptGroups(1, 'T34')
    .flatMap((group) => group.questions)
    .find((question) => question.id === 'q01');
  const answer = appendDailyAssistantSafetyReminder('پاسخ عادی', ordinaryQuestion.kind);
  assert.equal(answer, 'پاسخ عادی');
});
