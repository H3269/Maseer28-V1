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

const topics = [
  { name: 'خشم', guides: ANGER_DAILY_ASSISTANT_GUIDES, answer: answerAngerDailyPreparedQuestion },
  { name: 'اضطراب', guides: ANXIETY_DAILY_ASSISTANT_GUIDES, answer: answerAnxietyDailyPreparedQuestion },
];

test('anger and anxiety answers use the same outer headings and order for all 28 days and 14 questions', () => {
  let checked = 0;
  for (const topic of topics) {
    assert.equal(topic.guides.length, 28, topic.name);
    for (const guide of topic.guides) {
      assert.equal(guide.questions.length, 14, topic.name + ' day ' + guide.day);
      for (const question of guide.questions) {
        const answer = topic.answer({
          day: guide.day,
          message: question.value,
          dailyContent: { exercise: guide.exercise, actionText: guide.action },
        });
        assert.equal(typeof answer, 'string', topic.name + ' day ' + guide.day + ' ' + question.id);
        const sections = answer.split('\n\n');
        assert.equal(sections[0], '**راهنمای روز ' + guide.day + ' ' + topic.name + ' — ' + guide.title + '**');
        assert.equal(sections[1], '**پاسخ به پرسش**');
        assert.equal(sections[2], question.label);
        assert.equal(sections[3], '**توضیح و راهنمای امروز**');
        assert.ok(sections.slice(4).join('\n\n').trim().length > 20);
        for (const heading of [sections[0], sections[1], sections[3]]) {
          assert.equal(answer.split(heading).length - 1, 1, topic.name + ' day ' + guide.day + ' ' + question.id + ' outer heading count');
        }
        checked += 1;
      }
    }
  }
  assert.equal(checked, 28 * 14 * 2);
});

test('shared response frame preserves topic-specific examples and safety guidance', () => {
  for (const topic of topics) {
    for (const guide of topic.guides) {
      const exerciseQuestion = guide.questions.find((question) => question.kind === 'exercise_example');
      const actionQuestion = guide.questions.find((question) => question.kind === 'action_example');
      const safetyQuestion = guide.questions[10];
      const exerciseAnswer = topic.answer({ day: guide.day, message: exerciseQuestion.value });
      const actionAnswer = topic.answer({ day: guide.day, message: actionQuestion.value });
      const safetyAnswer = topic.answer({ day: guide.day, message: safetyQuestion.value });
      assert.ok(exerciseAnswer.includes(guide.exerciseExample), topic.name + ' day ' + guide.day + ' exercise example');
      assert.ok(actionAnswer.includes(guide.actionExample), topic.name + ' day ' + guide.day + ' action example');
      assert.ok(safetyAnswer.includes(guide.stopCondition), topic.name + ' day ' + guide.day + ' safety condition');
    }
  }
});
