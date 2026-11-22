import assert from 'node:assert/strict';
import test from 'node:test';
import { makeDailyExerciseGuidanceTurn } from '../src/features/assistant/dailyExerciseAssistantGuidance.js';

const QUESTION = 'منظور از تمرین امروز چیست؟';
const T02_DAY_1 = {
  id: 'اضطراب-01',
  topic_id: 'T02',
  day: 1,
  title: 'عنوان canonical اضطراب',
  exercise: 'تمرین canonical اضطراب برای روز اول.',
  actionText: 'اقدام canonical اضطراب برای روز اول.',
};

test('T02 prepared questions are answered by the shared engine using the selected canonical day', () => {
  const result = makeDailyExerciseGuidanceTurn({
    message: QUESTION,
    problem: 'اضطراب',
    day: 1,
    dayData: T02_DAY_1,
  });
  assert.match(result.response, /در روز 1/u);
  assert.ok(result.response.includes(T02_DAY_1.exercise));
  assert.doesNotMatch(result.response, /راهنمای روز 1 اضطراب/u);
});

test('shared daily routing rejects a topic mismatch instead of borrowing another topic content', () => {
  const result = makeDailyExerciseGuidanceTurn({
    message: QUESTION,
    problem: 'اضطراب',
    day: 1,
    dayData: {
      ...T02_DAY_1,
      id: 'خشم-01',
      topic_id: 'T01',
    },
  });
  assert.match(result.response, /شناسه موضوعِ محتوای دریافتی/u);
  assert.doesNotMatch(result.response, /تمرین canonical اضطراب/u);
});

test('shared daily routing rejects a day mismatch instead of borrowing another day content', () => {
  const result = makeDailyExerciseGuidanceTurn({
    message: QUESTION,
    problem: 'اضطراب',
    day: 2,
    dayData: T02_DAY_1,
  });
  assert.match(result.response, /شناسه روزِ محتوای دریافتی/u);
  assert.doesNotMatch(result.response, /تمرین canonical اضطراب/u);
});

test('unregistered questions do not receive a fabricated prepared answer', () => {
  const result = makeDailyExerciseGuidanceTurn({
    message: 'یک سؤال خارج از فهرست',
    problem: 'اضطراب',
    day: 1,
    dayData: T02_DAY_1,
  });
  assert.doesNotMatch(result.response, /تمرین canonical اضطراب/u);
});
