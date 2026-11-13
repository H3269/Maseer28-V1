test('T02 q05 explains the daily light version, rest option, success criterion, and stop condition', () => {
  for (const guide of ANXIETY_DAILY_ASSISTANT_GUIDES) {
    const question = guide.questions.find(item => item.id === 'q05');
    const answer = answerAnxietyDailyPreparedQuestion({ day: guide.day, message: question.value });
    for (const field of ['lightVersion', 'restVersion', 'successCriterion', 'stopCondition']) {
      assert.ok(answer.includes(guide[field]), 'day ' + guide.day + ' q05 must include ' + field);
    }
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ANXIETY_DAILY_ASSISTANT_GUIDES,
  ANXIETY_DAILY_PLAIN_LANGUAGE_STEPS,
  answerAnxietyDailyPreparedQuestion,
  getAnxietyDailyAssistantPromptGroups,
} from '../src/features/assistant/anxietyDailyAssistantPrompts.js';
import { makeDailyExerciseGuidanceTurn } from '../src/features/assistant/dailyExerciseAssistantGuidance.js';

test('anxiety assistant guide covers all 28 days with fourteen day-scoped prepared questions', () => {
  assert.equal(ANXIETY_DAILY_ASSISTANT_GUIDES.length, 28);
  assert.deepEqual(ANXIETY_DAILY_ASSISTANT_GUIDES.map((item) => item.day), Array.from({ length: 28 }, (_, index) => index + 1));
  for (const guide of ANXIETY_DAILY_ASSISTANT_GUIDES) {
    assert.equal(guide.topicId, 'T02');
    assert.equal(guide.topic, 'اضطراب');
    assert.equal(guide.questions.length, 14, 'day ' + guide.day);
    assert.equal(new Set(guide.questions.map((item) => item.value)).size, 14, 'day ' + guide.day);
    assert.ok(guide.exercise && guide.action && guide.exerciseExample && guide.actionExample);
    assert.ok(guide.lightVersion && guide.successCriterion && guide.stopCondition);
  }
});

test('all 28 anxiety days have distinct plain-language instructions for exercise and action', () => {
  assert.equal(Object.keys(ANXIETY_DAILY_PLAIN_LANGUAGE_STEPS).length, 28);
  const exerciseSteps = new Set();
  const actionSteps = new Set();
  for (let day = 1; day <= 28; day += 1) {
    const steps = ANXIETY_DAILY_PLAIN_LANGUAGE_STEPS[day];
    assert.ok(steps.exercise.length > 80, 'day ' + day + ' exercise steps');
    assert.ok(steps.action.length > 80, 'day ' + day + ' action steps');
    exerciseSteps.add(steps.exercise);
    actionSteps.add(steps.action);
    const guide = ANXIETY_DAILY_ASSISTANT_GUIDES[day - 1];
    assert.ok(answerAnxietyDailyPreparedQuestion({ day, message: guide.questions[0].value }).includes(guide.exercise));
    assert.ok(answerAnxietyDailyPreparedQuestion({ day, message: guide.questions[2].value }).includes(guide.action));
  }
  assert.equal(exerciseSteps.size, 28);
  assert.equal(actionSteps.size, 28);
});

test('anxiety prompt groups are scoped to the selected day and contain all prepared questions', () => {
  for (let day = 1; day <= 28; day += 1) {
    const groups = getAnxietyDailyAssistantPromptGroups(day);
    assert.equal(groups.length, 5);
    assert.equal(groups.reduce((count, group) => count + group.questions.length, 0), 14);
    assert.ok(groups.flatMap((group) => group.questions).every((question) => question.value === question.label));
  }
  assert.deepEqual(getAnxietyDailyAssistantPromptGroups(29), []);
  assert.equal(getAnxietyDailyAssistantPromptGroups('۱').reduce((count, group) => count + group.questions.length, 0), 14);
});

test('anxiety guide exercise and action text match all 28 runtime overrides exactly', async () => {
  const override = JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
  const days = override.categories['اضطراب'].days;
  assert.equal(days.length, 28);
  for (const guide of ANXIETY_DAILY_ASSISTANT_GUIDES) {
    const source = days.find((item) => item.day === guide.day);
    assert.ok(source, 'missing runtime day ' + guide.day);
    assert.equal(guide.exercise, source.exercise, 'exercise mismatch day ' + guide.day);
    assert.equal(guide.action, source.actionText, 'action mismatch day ' + guide.day);
  }
});

test('exercise example is explicitly hypothetical and does not claim the user experienced it', () => {
  const guide = ANXIETY_DAILY_ASSISTANT_GUIDES[0];
  const answer = answerAnxietyDailyPreparedQuestion({ day: 1, message: guide.questions.find((item) => item.kind === 'exercise_example').value });
  assert.match(answer, /مثال فرضی/);
  assert.match(answer, /تجربه واقعی تو را فرض نمی‌کند/);
  assert.ok(answer.includes(guide.exerciseExample));
});

test('days 17, 19 and 21 preserve strict boundaries around safety checks and low-risk experiments', () => {
  for (const day of [17, 19, 21]) {
    const guide = ANXIETY_DAILY_ASSISTANT_GUIDES[day - 1];
    const answer = answerAnxietyDailyPreparedQuestion({ day, message: guide.questions.find((item) => item.kind === 'action_meaning').value });
    assert.match(answer, /کم‌خطر|ایمنی/);
    assert.match(answer, /اجباری|تردیدی|اجرا/);
  }
});

test('stop answer includes the exact daily stop condition and urgent safety handoff', () => {
  const guide = ANXIETY_DAILY_ASSISTANT_GUIDES[26];
  const answer = answerAnxietyDailyPreparedQuestion({ day: 27, message: guide.questions.find((item) => item.kind === 'stop').value });
  assert.ok(answer.includes(guide.stopCondition));
  assert.match(answer, /خدمات اورژانسی/);
  assert.match(answer, /ارزیابی پزشکی/);
});

test('no-event answer never asks the user to create an anxiety-provoking situation', () => {
  const guide = ANXIETY_DAILY_ASSISTANT_GUIDES[14];
  const answer = answerAnxietyDailyPreparedQuestion({ day: 15, message: guide.questions.find((item) => item.kind === 'no_event').value });
  assert.match(answer, /لازم نیست عمداً خودت را نگران کنی/);
  assert.match(answer, /نمونه قبلی کم‌فشار/);
});

test('duration answer does not invent a time estimate', () => {
  const guide = ANXIETY_DAILY_ASSISTANT_GUIDES[0];
  const answer = answerAnxietyDailyPreparedQuestion({ day: 1, message: guide.questions.find((item) => item.kind === 'duration').value });
  assert.match(answer, /زمان قطعی و تأییدشده‌ای ثبت نشده/);
  assert.doesNotMatch(answer, /دقیقه|ساعت/);
});

test('prepared question is scoped to the active anxiety day and refuses unknown questions', () => {
  const dayOneQuestion = ANXIETY_DAILY_ASSISTANT_GUIDES[0].questions[0].value;
  const dayTwoAnswer = answerAnxietyDailyPreparedQuestion({ day: 2, message: dayOneQuestion });
  assert.match(dayTwoAnswer, /راهنمای روز 2 اضطراب/);
  assert.doesNotMatch(dayTwoAnswer, /راهنمای روز 1 اضطراب/);
  assert.equal(answerAnxietyDailyPreparedQuestion({ day: 1, message: 'سؤال خارج از فهرست' }), null);
});

test('daily turn routes anxiety prepared answers only for matching source topic and day', () => {
  const guide = ANXIETY_DAILY_ASSISTANT_GUIDES[0];
  const question = guide.questions.find((item) => item.kind === 'exercise_meaning');
  const ok = makeDailyExerciseGuidanceTurn({
    message: question.value,
    problem: 'اضطراب',
    day: 1,
    dayData: { id: 'T02-D01', topic_id: 'T02', day: 1, exercise: guide.exercise, actionText: guide.action },
  });
  assert.match(ok.response, /راهنمای روز 1 اضطراب/);
  assert.match(ok.response, /نقشه تجربه اضطراب/);

  const topicMismatch = makeDailyExerciseGuidanceTurn({
    message: question.value,
    problem: 'اضطراب',
    day: 1,
    dayData: { id: 'T01-D01', topic_id: 'T01', day: 1, exercise: guide.exercise, actionText: guide.action },
  });
  assert.match(topicMismatch.response, /شناسه موضوعِ محتوای دریافتی/);
  assert.doesNotMatch(topicMismatch.response, /راهنمای روز 1 اضطراب/);

  const dayMismatch = makeDailyExerciseGuidanceTurn({
    message: question.value,
    problem: 'اضطراب',
    day: 2,
    dayData: { id: 'T02-D01', topic_id: 'T02', day: 1, exercise: guide.exercise, actionText: guide.action },
  });
  assert.match(dayMismatch.response, /شناسه روزِ محتوای دریافتی/);
  assert.doesNotMatch(dayMismatch.response, /راهنمای روز 1 اضطراب/);
});
