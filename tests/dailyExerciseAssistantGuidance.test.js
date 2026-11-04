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

import { makeDailyExerciseGuidanceTurn } from '../src/features/assistant/dailyExerciseAssistantGuidance.js';

test('safety clarification state persists across turns and does not fall through to exercise guidance', () => {
  const first = makeDailyExerciseGuidanceTurn({ message: 'دیگه نمی‌کشم. همه‌چی تمومه.', dayData, problem: 'اضطراب', day: 4 });
  assert.equal(first.nextState.safetyStatus, 'pending');
  const second = makeDailyExerciseGuidanceTurn({ message: 'نمی‌دانم', dayData, problem: 'اضطراب', day: 4, conversationState: first.nextState });
  assert.equal(second.nextState.safetyStatus, 'pending');
  assert.match(second.response, /خطر فوری/);
  assert.doesNotMatch(second.response, /سه موقعیت اخیر/);
  const third = makeDailyExerciseGuidanceTurn({ message: 'شاید، مطمئن نیستم', dayData, problem: 'اضطراب', day: 4, conversationState: second.nextState });
  assert.equal(third.nextState.safetyStatus, 'handoff');
  assert.match(third.response, /کمک انسانی/);
  const fourth = makeDailyExerciseGuidanceTurn({ message: 'حالا تمرین را توضیح بده', dayData, problem: 'اضطراب', day: 4, conversationState: third.nextState });
  assert.equal(fourth.nextState.safetyStatus, 'handoff');
  assert.doesNotMatch(fourth.response, /سه موقعیت اخیر/);
});

test('a clear negative answer resolves the pending immediate-danger check without inventing facts', () => {
  const first = makeDailyExerciseGuidanceTurn({ message: 'دیگه نمی‌کشم.', dayData, problem: 'اضطراب', day: 4 });
  const second = makeDailyExerciseGuidanceTurn({ message: 'نه، الان خطر فوری ندارم', dayData, problem: 'اضطراب', day: 4, conversationState: first.nextState });
  assert.equal(second.nextState.safetyStatus, 'cleared');
  assert.match(second.response, /خطر فوری یا قصد و برنامه عملی نداری/);
});

test('a clear yes or uncertain answer to a safety check moves to human-help handoff', () => {
  const first = makeDailyExerciseGuidanceTurn({ message: 'دیگه نمی‌کشم.', dayData, problem: 'اضطراب', day: 4 });
  const second = makeDailyExerciseGuidanceTurn({ message: 'بله، قصد دارم', dayData, problem: 'اضطراب', day: 4, conversationState: first.nextState });
  assert.equal(second.nextState.safetyStatus, 'handoff');
  assert.match(second.response, /کمک فوری انسانی/);
});

test('follow-up references use bounded prior-turn context and can identify the second paragraph', () => {
  const first = makeDailyExerciseGuidanceTurn({ message: 'چطور انجامش بدم؟', dayData, problem: 'اضطراب', day: 4 });
  const second = makeDailyExerciseGuidanceTurn({ message: 'قسمت دوم را بیشتر توضیح بده', dayData, problem: 'اضطراب', day: 4, conversationState: first.nextState });
  assert.match(second.response, /راهکار اختصاصی همین روز/);
  assert.match(second.response, /جمله یا واژه‌اش را بیشتر باز کنم/);
  assert.ok(second.nextState.lastAssistantMessage.length <= 1200);
});

test('conversation context is cleared when the day or topic changes in the UI lifecycle', () => {
  const first = makeDailyExerciseGuidanceTurn({ message: 'چطور انجامش بدم؟', dayData, problem: 'اضطراب', day: 4 });
  const fresh = makeDailyExerciseGuidanceTurn({ message: 'بیشتر توضیح بده', dayData, problem: 'خشم', day: 5, conversationState: { safetyStatus: 'none' } });
  assert.equal(fresh.nextState.lastTopic, 'خشم');
  assert.notEqual(fresh.nextState.lastAssistantMessage, first.nextState.lastAssistantMessage);
});
