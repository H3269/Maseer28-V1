import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendDailyAssistantSafetyReminder,
  DAILY_ASSISTANT_SAFETY_QUESTION_KINDS,
  DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN,
  shouldShowDailyAssistantSafetyReminder,
} from '../src/features/assistant/dailyAssistantSafetyReminder.js';
import {
  getSharedDailyAssistantPromptGroups,
  SHARED_DAILY_ASSISTANT_DISTRESS_KINDS,
} from '../src/features/assistant/sharedDailyAssistantEngine.js';

const TOPIC_IDS = Array.from({ length: 34 }, (_, index) => 'T' + String(index + 1).padStart(2, '0'));

test('all four safety/evaluation questions receive exactly one reminder for T01-T34 on all 28 days', () => {
  const requiredQuestionIds = ['q06', 'q07', 'q11', 'q12'];
  for (const topicId of TOPIC_IDS) {
    const distressKind = SHARED_DAILY_ASSISTANT_DISTRESS_KINDS[topicId];
    assert.ok(distressKind, topicId + ' must define a dedicated distress kind');

    for (let day = 1; day <= 28; day += 1) {
      const questions = getSharedDailyAssistantPromptGroups(day, topicId).flatMap((group) => group.questions);
      for (const questionId of requiredQuestionIds) {
        const question = questions.find((item) => item.id === questionId);
        assert.ok(question, topicId + ' day ' + day + ' must include ' + questionId);
        assert.ok(DAILY_ASSISTANT_SAFETY_QUESTION_KINDS.has(question.kind),
          topicId + ' day ' + day + ' ' + questionId + ' must be in the shared safety reminder contract');
        if (questionId === 'q11') {
          assert.equal(question.kind, distressKind, topicId + ' day ' + day + ' q11 kind');
        }
        const shouldShowReminder = shouldShowDailyAssistantSafetyReminder(topicId, question.kind);
        assert.equal(shouldShowReminder, topicId !== 'T01',
          topicId + ' day ' + day + ' ' + questionId + ' topic-aware reminder policy');
        if (topicId === 'T01') continue;
        const answer = appendDailyAssistantSafetyReminder('پاسخ ایمنی اختصاصی', question.kind);
        assert.equal(answer.split(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN).length - 1, 1,
          topicId + ' day ' + day + ' ' + questionId + ' must append exactly one safety reminder');
        assert.ok(answer.endsWith(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN),
          topicId + ' day ' + day + ' ' + questionId + ' reminder must remain at the end of the answer');
      }
    }
  }
});

test('ordinary prepared questions do not receive the distress-only reminder by accident', () => {
  const ordinaryQuestion = getSharedDailyAssistantPromptGroups(1, 'T34')
    .flatMap((group) => group.questions)
    .find((question) => question.id === 'q01');
  const answer = appendDailyAssistantSafetyReminder('پاسخ عادی', ordinaryQuestion.kind);
  assert.equal(answer, 'پاسخ عادی');
  for (const topicId of TOPIC_IDS) {
    assert.equal(shouldShowDailyAssistantSafetyReminder(topicId, ordinaryQuestion.kind), false,
      topicId + ' q01 must never show the safety reminder card');
  }
});
