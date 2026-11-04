import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDailyExerciseGuidance } from '../src/features/assistant/dailyExerciseAssistantGuidance.js';

const dayData = {
  exercise: 'سه موقعیت اخیر را که در آن مضطرب شدی، بدون قضاوت یادداشت کن.',
  actionText: 'امروز فقط یک موقعیت را انتخاب کن و شدت احساس را از صفر تا ده ثبت کن.',
};

test('day context answers a generic how-to question instead of asking for a topic already known', () => {
  const response = makeDailyExerciseGuidance({
    message: 'چطور انجامش بدم؟',
    dayData,
    problem: 'اضطراب',
    day: 4,
  });
  assert.match(response, /اضطراب/);
  assert.match(response, /روز 4/);
  assert.match(response, /سه موقعیت اخیر/);
  assert.match(response, /فقط یک موقعیت/);
});

test('safety clarification takes priority over daily exercise guidance', () => {
  const response = makeDailyExerciseGuidance({
    message: 'دیگه نمی‌کشم. همه‌چی تمومه.',
    dayData,
    problem: 'اضطراب',
    day: 4,
  });
  assert.match(response, /آیا همین الآن خطر فوری/);
  assert.doesNotMatch(response, /سه موقعیت اخیر/);
});

test('explicit immediate harm intent stops ordinary guidance', () => {
  const response = makeDailyExerciseGuidance({
    message: 'امشب قصد دارم خودم را بکشم.',
    dayData,
    problem: 'اضطراب',
    day: 4,
  });
  assert.match(response, /خطر فوری/);
  assert.doesNotMatch(response, /سه موقعیت اخیر/);
});

test('multiple explicit topics still request clarification', () => {
  const response = makeDailyExerciseGuidance({
    message: 'هم عصبانی‌ام، هم می‌ترسم.',
    dayData,
    problem: 'اضطراب',
    day: 4,
  });
  assert.match(response, /کدام بخش تجربه‌ات مسئله اصلی توست/);
});

test('missing day content never invents an exercise or action', () => {
  const response = makeDailyExerciseGuidance({
    message: 'چطور انجامش بدم؟',
    dayData: {},
    problem: 'اضطراب',
    day: 4,
  });
  assert.match(response, /متن تمرین و راهکار این روز در دسترس نیست/);
  assert.doesNotMatch(response, /تمرین پیشنهادی/);
});

test('empty messages do not produce contextual guidance', () => {
  const response = makeDailyExerciseGuidance({
    message: '   ',
    dayData,
    problem: 'اضطراب',
    day: 4,
  });
  assert.match(response, /پیامت خالی است/);
});
