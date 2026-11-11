import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRIEF_DAILY_ASSISTANT_GUIDES,
  answerGriefDailyPreparedQuestion,
  getGriefDailyAssistantPromptGroups,
  toGriefDayNumber,
} from '../src/features/assistant/griefDailyAssistantPrompts.js';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import { getCanonicalDailyRecordId } from '../src/features/content/dailyContentSelector.js';

const questionKinds = [
  'exercise_meaning', 'exercise_example', 'action_meaning', 'action_example',
  'light_version', 'success', 'stop', 'no_event', 'exercise_action_difference',
  'not_done', 'grief_increased', 'talk_other', 'can_change', 'duration',
];

function fa(value) { return String(value).replace(/[0-9]/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]); }

function contextFor(day) {
  const guide = GRIEF_DAILY_ASSISTANT_GUIDES[day - 1];
  return {
    screen: 'day',
    problem: 'غم و سوگ',
    day,
    data: {
      id: getCanonicalDailyRecordId('غم و سوگ', day),
      topic_id: 'T06',
      day,
      exercise: guide.exercise,
      actionText: guide.action,
    },
  };
}

test('T06 contains 28 complete days and 14 unique prepared questions per day', () => {
  assert.equal(GRIEF_DAILY_ASSISTANT_GUIDES.length, 28);
  for (const guide of GRIEF_DAILY_ASSISTANT_GUIDES) {
    assert.equal(guide.topicId, 'T06');
    assert.equal(guide.topic, 'غم و سوگ');
    assert.ok(guide.title && guide.objective && guide.skill && guide.mechanism);
    assert.ok(guide.exercise && guide.action && guide.lightVersion && guide.progressVersion);
    assert.ok(guide.restVersion && guide.successCriterion && guide.reflectionQuestion && guide.stopCondition);
    assert.ok(guide.exerciseExample && guide.actionExample);
    assert.equal(guide.questions.length, 14);
    assert.equal(new Set(guide.questions.map(question => question.value)).size, 14);
    assert.deepEqual(new Set(guide.questions.map(question => question.kind)), new Set(questionKinds));
  }
});

test('T06 prompt groups expose all 14 prepared questions in five understandable groups', () => {
  for (let day = 1; day <= 28; day += 1) {
    const groups = getGriefDailyAssistantPromptGroups(day);
    assert.equal(groups.length, 5);
    assert.equal(groups.flatMap(group => group.questions).length, 14);
  }
  assert.deepEqual(getGriefDailyAssistantPromptGroups(0), []);
  assert.deepEqual(getGriefDailyAssistantPromptGroups(29), []);
});

test('T06 answers every prepared question with day-specific content and distinct examples', () => {
  for (const guide of GRIEF_DAILY_ASSISTANT_GUIDES) {
    for (const question of guide.questions) {
      const answer = answerGriefDailyPreparedQuestion({
        day: guide.day,
        message: question.value,
        dailyContent: { exercise: guide.exercise, actionText: guide.action },
      });
      assert.equal(typeof answer, 'string', `day ${guide.day} ${question.kind} must return an answer`);
      assert.ok(answer.includes(`راهنمای روز ${fa(guide.day)} غم و سوگ`));
      assert.ok(answer.includes(guide.title), `day ${guide.day} answer must use its day title`);
    }
    const exerciseExample = answerGriefDailyPreparedQuestion({ day: guide.day, message: guide.questions.find(q => q.kind === 'exercise_example').value });
    const actionExample = answerGriefDailyPreparedQuestion({ day: guide.day, message: guide.questions.find(q => q.kind === 'action_example').value });
    assert.notEqual(exerciseExample, actionExample);
    assert.ok(exerciseExample.includes(guide.exerciseExample));
    assert.ok(actionExample.includes(guide.actionExample));
  }
});

test('T06 uses transformed visible daily text in its prepared answer', () => {
  const guide = GRIEF_DAILY_ASSISTANT_GUIDES[2];
  const result = makePageAssistantTurn({
    screen: 'day',
    text: guide.questions.find(q => q.kind === 'exercise_meaning').value,
    dailyContext: {
      ...contextFor(3),
      guidanceData: {
        exercise: 'متن نمایشی تبدیل‌شده برای آزمون روز سوم',
        actionText: 'اقدام نمایشی تبدیل‌شده برای آزمون روز سوم',
      },
    },
  });
  assert.equal(result.status, 'daily_guidance_available');
  assert.match(result.message, /متن نمایشی تبدیل‌شده برای آزمون روز سوم/);
});

test('T06 prepared-only routing validates canonical topic/day identity and rejects free-form questions', () => {
  const guide = GRIEF_DAILY_ASSISTANT_GUIDES[0];
  const question = guide.questions.find(q => q.kind === 'exercise_meaning').value;
  const valid = makePageAssistantTurn({ screen: 'day', text: question, dailyContext: contextFor(1) });
  assert.equal(valid.status, 'daily_guidance_available');
  assert.match(valid.message, /راهنمای روز ۱ غم و سوگ/);

  const freeForm = makePageAssistantTurn({ screen: 'day', text: 'لطفاً درباره موضوع دیگری به‌صورت آزاد توضیح بده.', dailyContext: contextFor(1) });
  assert.equal(freeForm.status, 'prepared_question_required');

  const wrongDay = makePageAssistantTurn({
    screen: 'day',
    text: question,
    dailyContext: { ...contextFor(1), day: 2 },
  });
  assert.equal(wrongDay.status, 'daily_guidance_unavailable');

  const wrongTopic = makePageAssistantTurn({
    screen: 'day',
    text: question,
    dailyContext: {
      ...contextFor(1),
      data: { ...contextFor(1).data, topic_id: 'T05' },
    },
  });
  assert.equal(wrongTopic.status, 'daily_guidance_unavailable');
});

test('T06 explicit immediate risk and pending safety exchange take precedence over prepared FAQs', () => {
  const guide = GRIEF_DAILY_ASSISTANT_GUIDES[0];
  const question = guide.questions.find(q => q.kind === 'exercise_meaning').value;
  const urgent = makePageAssistantTurn({
    screen: 'day',
    text: 'قصد دارم همین الآن به خودم آسیب بزنم و به کمک فوری نیاز دارم.',
    dailyContext: contextFor(1),
  });
  assert.equal(urgent.status, 'urgent_human_support_required');

  const pending = makePageAssistantTurn({
    screen: 'day',
    text: question,
    dailyContext: contextFor(1),
    conversationState: { dailyState: { safetyStatus: 'pending' } },
  });
  assert.notEqual(pending.status, 'daily_guidance_available');
});

test('T06 day parser accepts Persian numerals and rejects invalid days', () => {
  assert.equal(toGriefDayNumber('۲۸'), 28);
  assert.equal(toGriefDayNumber('۰'), null);
  assert.equal(toGriefDayNumber('۲۹'), null);
  assert.equal(toGriefDayNumber('روز سوم'), null);
});
