import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GRIEF_DAILY_ASSISTANT_GUIDES,
  answerGriefDailyPreparedQuestion,
  getGriefDailyAssistantPromptGroups,
} from '../src/features/assistant/griefDailyAssistantPrompts.js';

test('T06 contains 28 complete days and 14 unchanged prepared questions per day', () => {
  assert.equal(GRIEF_DAILY_ASSISTANT_GUIDES.length, 28);
  const expectedQuestions = GRIEF_DAILY_ASSISTANT_GUIDES[0].questions.map((q) => q.value);
  for (const guide of GRIEF_DAILY_ASSISTANT_GUIDES) {
    assert.ok(guide.title && guide.objective && guide.skill && guide.mechanism);
    assert.ok(guide.exercise && guide.action && guide.exerciseExample && guide.actionExample);
    assert.equal(guide.questions.length, 14);
    assert.equal(new Set(guide.questions.map((q) => q.value)).size, 14);
    assert.deepEqual(guide.questions.map((q) => q.value), expectedQuestions);
    assert.ok(/^T06-S0[1-3]$/.test(guide.subtopic));
  }
});

test('T06 prompt groups preserve the shared five-section structure for all 28 days', () => {
  for (let day = 1; day <= 28; day += 1) {
    const groups = getGriefDailyAssistantPromptGroups(day);
    assert.deepEqual(groups.map((group) => group.questions.length), [2, 2, 1, 5, 4]);
    assert.deepEqual(groups.map((group) => group.label), [
      'فهم تمرین روز ' + day,
      'فهم اقدام اختصاصی روز ' + day,
      'تفاوت تمرین و اقدام',
      'اجرا و موانع',
      'ارزیابی و ایمنی',
    ]);
  }
  assert.deepEqual(getGriefDailyAssistantPromptGroups(29), []);
  assert.deepEqual(getGriefDailyAssistantPromptGroups(0), []);
});

test('all 392 T06 prepared questions return substantive and meaningfully varied answers', () => {
  let count = 0;
  const answers = new Set();
  for (const guide of GRIEF_DAILY_ASSISTANT_GUIDES) {
    for (const question of guide.questions) {
      const answer = answerGriefDailyPreparedQuestion({
        day: guide.day,
        message: question.value,
        dailyContent: { exercise: guide.exercise, actionText: guide.action },
      });
      assert.ok(answer && answer.length >= 450, 'missing/short answer day ' + guide.day + ' ' + question.kind);
      assert.match(answer, /راهنمای روز/);
      assert.ok(answer.includes(guide.title), 'answer must identify the exact day title');
      answers.add(answer);
      count += 1;
    }
  }
  assert.equal(count, 392);
  assert.ok(answers.size > 300, 'answers must be meaningfully varied across day/question pairs');
  assert.equal(answerGriefDailyPreparedQuestion({ day: 1, message: 'سؤال آزاد خارج از فهرست' }), null);
  assert.equal(answerGriefDailyPreparedQuestion({ day: 29, message: GRIEF_DAILY_ASSISTANT_GUIDES[0].questions[0].value }), null);
});
