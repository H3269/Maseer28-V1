import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDailyExerciseGuidance, selectDailyExerciseGuidanceData } from '../src/features/assistant/dailyExerciseAssistantGuidance.js';

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

test('uses the exact normalized instructions and adapted action passed by the day screen', () => {
  const response = makeDailyExerciseGuidance({
    message: 'چطور انجامش بدم؟',
    dayData: {
      instructions: 'امروز فقط یک موقعیت امن را انتخاب کن.',
      action: 'شدت احساس را از صفر تا ده ثبت کن.',
      title: 'تمرین متناسب‌شده امروز',
    },
    problem: 'اضطراب',
    day: 9,
  });
  assert.match(response, /فقط یک موقعیت امن/);
  assert.match(response, /شدت احساس را از صفر تا ده/);
  assert.match(response, /روز 9/);
});

test('prefers the adapted day content over the raw day content', () => {
  const raw = {
    exercise: 'تمرین خام و سخت‌تر',
    actionText: 'اقدام خام',
  };
  const adapted = {
    exercise: 'تمرین متناسب‌شده و امن‌تر',
    actionText: 'اقدام متناسب‌شده امروز',
  };
  const selected = selectDailyExerciseGuidanceData({ guidanceData: adapted, data: raw });
  assert.equal(selected, adapted);

  const response = makeDailyExerciseGuidance({
    message: 'چطور انجامش بدم؟',
    dayData: selected,
    problem: 'اضطراب',
    day: 9,
  });
  assert.match(response, /تمرین متناسب‌شده و امن‌تر/);
  assert.match(response, /اقدام متناسب‌شده امروز/);
  assert.doesNotMatch(response, /تمرین خام و سخت‌تر|اقدام خام/);
});

test('falls back to raw day content only when adapted content is unavailable', () => {
  const raw = { exercise: 'تمرین خام', actionText: 'اقدام خام' };
  assert.equal(selectDailyExerciseGuidanceData({ guidanceData: null, data: raw }), raw);
});
