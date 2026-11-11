import test from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN } from '../src/features/assistant/dailyAssistantSafetyReminder.js';
import { ANGER_DAILY_ASSISTANT_GUIDES, answerAngerDailyPreparedQuestion } from '../src/features/assistant/angerDailyAssistantPrompts.js';
import { ANXIETY_DAILY_ASSISTANT_GUIDES, answerAnxietyDailyPreparedQuestion } from '../src/features/assistant/anxietyDailyAssistantPrompts.js';
import { FEAR_DAILY_ASSISTANT_GUIDES, answerFearDailyPreparedQuestion } from '../src/features/assistant/fearDailyAssistantPrompts.js';
import { HATRED_DAILY_ASSISTANT_GUIDES, answerHatredDailyPreparedQuestion } from '../src/features/assistant/hatredDailyAssistantPrompts.js';
import { JEALOUSY_DAILY_ASSISTANT_GUIDES, answerJealousyDailyPreparedQuestion } from '../src/features/assistant/jealousyDailyAssistantPrompts.js';

const safetyKindsByTopic = {
  T01: new Set(['anger_increased', 'talk_other', 'success', 'stop']),
  T02: new Set(['anxiety_increased', 'talk_other', 'success', 'stop']),
  T03: new Set(['fear_increased', 'talk_other', 'success', 'stop']),
  T04: new Set(['hostility_increased', 'talk_other', 'success', 'stop']),
  T05: new Set(['hostility_increased', 'talk_other', 'success', 'stop']),
};

const packages = [
  { id: 'T01', guides: ANGER_DAILY_ASSISTANT_GUIDES, answer: answerAngerDailyPreparedQuestion },
  { id: 'T02', guides: ANXIETY_DAILY_ASSISTANT_GUIDES, answer: answerAnxietyDailyPreparedQuestion },
  { id: 'T03', guides: FEAR_DAILY_ASSISTANT_GUIDES, answer: answerFearDailyPreparedQuestion },
  { id: 'T04', guides: HATRED_DAILY_ASSISTANT_GUIDES, answer: answerHatredDailyPreparedQuestion },
  { id: 'T05', guides: JEALOUSY_DAILY_ASSISTANT_GUIDES, answer: answerJealousyDailyPreparedQuestion },
];

test('T01-T05 append the shared safety reminder to exactly the four safety/evaluation answers on every day', () => {
  for (const topic of packages) {
    const safetyKinds = safetyKindsByTopic[topic.id];
    assert.equal(topic.guides.length, 28, `${topic.id} must retain all 28 days`);

    for (const guide of topic.guides) {
      assert.equal(guide.questions.length, 14, `${topic.id} day ${guide.day} must retain all 14 prepared questions`);
      assert.equal(
        guide.questions.filter((question) => safetyKinds.has(question.kind)).length,
        4,
        `${topic.id} day ${guide.day} must have exactly four safety/evaluation questions`,
      );

      for (const question of guide.questions) {
        const expected = safetyKinds.has(question.kind);
        const answer = topic.answer({ day: guide.day, message: question.value, dailyContent: { exercise: guide.exercise, actionText: guide.action } });
        assert.equal(typeof answer, 'string', `${topic.id} day ${guide.day} ${question.kind} must resolve to an answer`);
        const reminderCount = answer.split(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN).length - 1;
        assert.equal(reminderCount, expected ? 1 : 0,
          `${topic.id} day ${guide.day} ${question.kind} reminder count mismatch`);
        assert.equal(answer.endsWith(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN), expected,
          `${topic.id} day ${guide.day} ${question.kind} reminder placement mismatch`);
      }
    }
  }
});
