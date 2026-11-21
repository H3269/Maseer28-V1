import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANGER_DAILY_ASSISTANT_GUIDES,
  answerAngerDailyPreparedQuestion,
} from '../src/features/assistant/angerDailyAssistantPrompts.js';
import {
  ANXIETY_DAILY_ASSISTANT_GUIDES,
  answerAnxietyDailyPreparedQuestion,
} from '../src/features/assistant/anxietyDailyAssistantPrompts.js';

const headingLabels = (answer) => [...answer.matchAll(/\*\*([^*\n]+)\*\*/gu)]
  .slice(3)
  .map((match) => match[1].trim())
  .filter((heading) => !/شماره|۰۹۱|091/u.test(heading));

test('anxiety uses the exact anger heading names, count, and order for all 28 days and 14 questions', () => {
  assert.equal(ANGER_DAILY_ASSISTANT_GUIDES.length, 28);
  assert.equal(ANXIETY_DAILY_ASSISTANT_GUIDES.length, 28);
  let checked = 0;
  for (const anxietyGuide of ANXIETY_DAILY_ASSISTANT_GUIDES) {
    const angerGuide = ANGER_DAILY_ASSISTANT_GUIDES.find((item) => item.day === anxietyGuide.day);
    assert.ok(angerGuide, 'anger day ' + anxietyGuide.day);
    assert.equal(anxietyGuide.questions.length, 14, 'anxiety day ' + anxietyGuide.day);
    assert.equal(angerGuide.questions.length, 14, 'anger day ' + angerGuide.day);
    for (const anxietyQuestion of anxietyGuide.questions) {
      const angerQuestion = angerGuide.questions.find((item) => item.id === anxietyQuestion.id);
      assert.ok(angerQuestion, 'matching anger question ' + anxietyQuestion.id);
      const angerAnswer = answerAngerDailyPreparedQuestion({
        day: angerGuide.day,
        message: angerQuestion.value,
        dailyContent: { exercise: angerGuide.exercise, actionText: angerGuide.action },
      });
      const anxietyAnswer = answerAnxietyDailyPreparedQuestion({
        day: anxietyGuide.day,
        message: anxietyQuestion.value,
        dailyContent: { exercise: anxietyGuide.exercise, actionText: anxietyGuide.action },
      });
      assert.equal(typeof angerAnswer, 'string', 'anger day ' + angerGuide.day + ' ' + angerQuestion.id);
      assert.equal(typeof anxietyAnswer, 'string', 'anxiety day ' + anxietyGuide.day + ' ' + anxietyQuestion.id);
      assert.deepEqual(
        headingLabels(anxietyAnswer),
        headingLabels(angerAnswer),
        'heading mismatch on day ' + anxietyGuide.day + ' ' + anxietyQuestion.id,
      );
      if (anxietyQuestion.kind === 'exercise_meaning') {
        assert.ok(anxietyAnswer.includes(anxietyGuide.exercise), 'anxiety exercise preserved day ' + anxietyGuide.day);
      }
      if (anxietyQuestion.kind === 'action_meaning') {
        assert.ok(anxietyAnswer.includes(anxietyGuide.action), 'anxiety action preserved day ' + anxietyGuide.day);
      }
      checked += 1;
    }
  }
  assert.equal(checked, 28 * 14);
});

test('anxiety examples and safety guidance remain specific to anxiety after heading alignment', () => {
  for (const guide of ANXIETY_DAILY_ASSISTANT_GUIDES) {
    const exerciseQuestion = guide.questions.find((question) => question.kind === 'exercise_example');
    const actionQuestion = guide.questions.find((question) => question.kind === 'action_example');
    const safetyQuestion = guide.questions.find((question) => question.kind === 'anxiety_increased');
    const exerciseAnswer = answerAnxietyDailyPreparedQuestion({ day: guide.day, message: exerciseQuestion.value });
    const actionAnswer = answerAnxietyDailyPreparedQuestion({ day: guide.day, message: actionQuestion.value });
    const safetyAnswer = answerAnxietyDailyPreparedQuestion({ day: guide.day, message: safetyQuestion.value });
    assert.ok(exerciseAnswer.includes(guide.exerciseExample), 'anxiety exercise example day ' + guide.day);
    assert.ok(actionAnswer.includes(guide.actionExample), 'anxiety action example day ' + guide.day);
    assert.ok(safetyAnswer.includes(guide.stopCondition), 'anxiety stop condition day ' + guide.day);
  }
});
