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
  const second = makeDailyExerciseGuidanceTurn({ message: 'متوجه نشدم', dayData, problem: 'اضطراب', day: 4, conversationState: first.nextState });
  assert.equal(second.nextState.safetyStatus, 'pending');
  assert.match(second.response, /خطر فوری/);
  assert.doesNotMatch(second.response, /سه موقعیت اخیر/);
  const third = makeDailyExerciseGuidanceTurn({ message: 'شاید، مطمئن نیستم', dayData, problem: 'اضطراب', day: 4, conversationState: second.nextState });
  assert.equal(third.nextState.safetyStatus, 'handoff');
  assert.match(third.response, /کمک فوری انسانی/);
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
  assert.match(second.response, /متن تمرین همین روز/);
  assert.match(second.response, /جمله یا واژه‌اش را بیشتر باز کنم/);
  assert.ok(second.nextState.lastAssistantMessage.length <= 1200);
});

test('conversation context is cleared when the day or topic changes in the UI lifecycle', () => {
  const first = makeDailyExerciseGuidanceTurn({ message: 'چطور انجامش بدم؟', dayData, problem: 'اضطراب', day: 4 });
  const fresh = makeDailyExerciseGuidanceTurn({ message: 'بیشتر توضیح بده', dayData, problem: 'خشم', day: 5, conversationState: { safetyStatus: 'none' } });
  assert.equal(fresh.nextState.lastTopic, 'خشم');
  assert.notEqual(fresh.nextState.lastAssistantMessage, first.nextState.lastAssistantMessage);
});


test('follow-up can explicitly retrieve the exercise or the dedicated action from prior context', () => {
  const first = makeDailyExerciseGuidanceTurn({ message: 'چطور انجامش بدم؟', dayData, problem: 'اضطراب', day: 4 });
  const exercise = makeDailyExerciseGuidanceTurn({ message: 'نه، منظورم خود تمرینه', dayData, problem: 'اضطراب', day: 4, conversationState: first.nextState });
  assert.match(exercise.response, /متن تمرین همین روز: سه موقعیت اخیر/);
  const action = makeDailyExerciseGuidanceTurn({ message: 'راهکار اختصاصی رو بگو', dayData, problem: 'اضطراب', day: 4, conversationState: first.nextState });
  assert.match(action.response, /راهکار اختصاصی همین روز: امروز فقط یک موقعیت/);
  assert.doesNotMatch(action.response, /متن تمرین همین روز/);
});

test('changing day or topic discards stale chat references but preserves a pending safety gate', () => {
  const first = makeDailyExerciseGuidanceTurn({ message: 'دیگه نمی‌کشم.', dayData, problem: 'اضطراب', day: 4 });
  assert.equal(first.nextState.safetyStatus, 'pending');
  const changed = makeDailyExerciseGuidanceTurn({
    message: 'چطور انجامش بدم؟',
    dayData,
    problem: 'خشم',
    day: 5,
    conversationState: { ...first.nextState, contextDay: '4', contextTopic: 'اضطراب' },
  });
  assert.equal(changed.nextState.safetyStatus, 'pending');
  assert.match(changed.response, /آیا همین الآن خطر فوری/);
  assert.doesNotMatch(changed.response, /سه موقعیت اخیر/);
});

test('changing day or topic prevents follow-up from quoting an unrelated previous exercise', () => {
  const first = makeDailyExerciseGuidanceTurn({ message: 'چطور انجامش بدم؟', dayData, problem: 'اضطراب', day: 4 });
  const changed = makeDailyExerciseGuidanceTurn({
    message: 'راهکار رو بیشتر توضیح بده',
    dayData: { exercise: 'تمرین روز جدید', actionText: 'اقدام روز جدید' },
    problem: 'خشم',
    day: 5,
    conversationState: first.nextState,
  });
  assert.doesNotMatch(changed.response, /سه موقعیت اخیر|فقط یک موقعیت/);
  assert.equal(changed.nextState.contextDay, '5');
  assert.equal(changed.nextState.contextTopic, 'خشم');
});


test('contradictory negative safety replies cannot clear the safety gate', () => {
  for (const reply of ['نه، ولی شاید به خودم آسیب بزنم', 'نه، برنامه دارم', 'نه، مطمئن نیستم']) {
    const first = makeDailyExerciseGuidanceTurn({ message: 'دیگه نمی‌کشم.', dayData, problem: 'اضطراب', day: 4 });
    const second = makeDailyExerciseGuidanceTurn({ message: reply, dayData, problem: 'اضطراب', day: 4, conversationState: first.nextState });
    assert.equal(second.nextState.safetyStatus, 'handoff', reply);
    assert.match(second.response, /کمک فوری انسانی/);
    assert.doesNotMatch(second.response, /سه موقعیت اخیر/);
  }
});

test('an unclear negative elaboration keeps the safety gate pending', () => {
  const first = makeDailyExerciseGuidanceTurn({ message: 'دیگه نمی‌کشم.', dayData, problem: 'اضطراب', day: 4 });
  const second = makeDailyExerciseGuidanceTurn({ message: 'نه، حالم خوب نیست', dayData, problem: 'اضطراب', day: 4, conversationState: first.nextState });
  assert.equal(second.nextState.safetyStatus, 'pending');
  assert.match(second.response, /آیا همین الآن خطر فوری/);
  assert.doesNotMatch(second.response, /سه موقعیت اخیر/);
});

test('exercise barriers ask one focused question instead of repeating the whole exercise', () => {
  const response = makeDailyExerciseGuidanceTurn({
    message: 'این تمرین خیلی سخته و نمی‌تونم انجامش بدم.',
    dayData,
    problem: 'اضطراب',
    day: 4,
  });
  assert.match(response.response, /مانع اصلی کدام بود/);
  assert.match(response.response, /کمبود وقت/);
  assert.match(response.response, /شدت ناراحتی/);
  assert.doesNotMatch(response.response, /سه موقعیت اخیر را که/);
});

test('exercise completion is acknowledged without assuming success or inventing outcomes', () => {
  const response = makeDailyExerciseGuidanceTurn({
    message: 'تمرین را انجام دادم.',
    dayData,
    problem: 'اضطراب',
    day: 4,
  });
  assert.match(response.response, /چه چیزی مشاهده کردی/);
  assert.doesNotMatch(response.response, /نتیجه عالی|حتماً بهتر شدی/);
});

test('the assistant asks for the actual steps before judging whether an exercise was done correctly', () => {
  const response = makeDailyExerciseGuidanceTurn({
    message: 'نمی‌دانم درست انجام دادم یا نه.',
    dayData,
    problem: 'اضطراب',
    day: 4,
  });
  assert.match(response.response, /دقیقاً چه مراحلی را انجام دادی/);
  assert.doesNotMatch(response.response, /درست انجام دادی|اشتباه انجام دادی/);
});

test('exercise barrier handling never overrides an unresolved safety clarification', () => {
  const first = makeDailyExerciseGuidanceTurn({
    message: 'دیگه نمی‌کشم.',
    dayData,
    problem: 'اضطراب',
    day: 4,
  });
  const second = makeDailyExerciseGuidanceTurn({
    message: 'تمرین خیلی سخته و نمی‌تونم انجامش بدم.',
    dayData,
    problem: 'اضطراب',
    day: 4,
    conversationState: first.nextState,
  });
  assert.equal(second.nextState.safetyStatus, 'pending');
  assert.match(second.response, /آیا همین الآن خطر فوری/);
  assert.doesNotMatch(second.response, /مانع اصلی کدام بود/);
});

test('a short why follow-up stays anchored to the previous answer and asks what needs explaining', () => {
  const first = makeDailyExerciseGuidanceTurn({ message: 'چطور انجامش بدم؟', dayData, problem: 'اضطراب', day: 4 });
  const second = makeDailyExerciseGuidanceTurn({ message: 'چرا؟', dayData, problem: 'اضطراب', day: 4, conversationState: first.nextState });
  assert.match(second.response, /کدام جمله از پاسخ قبلی/);
  assert.doesNotMatch(second.response, /کدام بخش تجربه‌ات مسئله اصلی توست/);
  assert.equal(second.nextState.contextTopic, 'اضطراب');
});

test('a summary follow-up retrieves only the exercise and action already supplied for that day', () => {
  const first = makeDailyExerciseGuidanceTurn({ message: 'چطور انجامش بدم؟', dayData, problem: 'اضطراب', day: 4 });
  const second = makeDailyExerciseGuidanceTurn({ message: 'خلاصه کن', dayData, problem: 'اضطراب', day: 4, conversationState: first.nextState });
  assert.match(second.response, /خلاصه محتوای همان روز/);
  assert.match(second.response, /سه موقعیت اخیر/);
  assert.match(second.response, /فقط یک موقعیت/);
  assert.doesNotMatch(second.response, /نتیجه می‌گیری|احتمالاً مشکل تو/);
});

test('an example request asks which prior sentence needs an illustrative example', () => {
  const first = makeDailyExerciseGuidanceTurn({ message: 'چطور انجامش بدم؟', dayData, problem: 'اضطراب', day: 4 });
  const second = makeDailyExerciseGuidanceTurn({ message: 'مثال بزن', dayData, problem: 'اضطراب', day: 4, conversationState: first.nextState });
  assert.match(second.response, /مثال فرضی و غیرشخصی/);
  assert.match(second.response, /کدام جمله یا مرحله/);
});



test('colloquial first and second references resolve to the labelled day-content items', () => {
  const first = makeDailyExerciseGuidanceTurn({ message: 'چطور انجامش بدم؟', dayData, problem: 'اضطراب', day: 4 });
  const firstItem = makeDailyExerciseGuidanceTurn({
    message: 'اولی رو بگو',
    dayData,
    problem: 'اضطراب',
    day: 4,
    conversationState: first.nextState,
  });
  assert.match(firstItem.response, /متن تمرین همین روز: سه موقعیت اخیر/);

  const secondItem = makeDailyExerciseGuidanceTurn({
    message: 'دومی رو بگو',
    dayData,
    problem: 'اضطراب',
    day: 4,
    conversationState: first.nextState,
  });
  assert.match(secondItem.response, /راهکار اختصاصی همین روز: امروز فقط یک موقعیت/);
  assert.doesNotMatch(secondItem.response, /متن تمرین همین روز/);
});

test('ambiguous colloquial references ask for clarification instead of guessing', () => {
  const first = makeDailyExerciseGuidanceTurn({ message: 'چطور انجامش بدم؟', dayData, problem: 'اضطراب', day: 4 });
  for (const message of ['همون قبلی', 'همون قبلی رو بگو', 'اون قسمت رو بگو']) {
    const followUp = makeDailyExerciseGuidanceTurn({
      message,
      dayData,
      problem: 'اضطراب',
      day: 4,
      conversationState: first.nextState,
    });
    assert.match(followUp.response, /کدام مورد است: متن تمرین، راهکار اختصاصی/u, message);
  }
});

test('explicit prior-action references still retrieve only the dedicated action', () => {
  const first = makeDailyExerciseGuidanceTurn({ message: 'چطور انجامش بدم؟', dayData, problem: 'اضطراب', day: 4 });
  const followUp = makeDailyExerciseGuidanceTurn({
    message: 'راهکار قبلی رو بگو',
    dayData,
    problem: 'اضطراب',
    day: 4,
    conversationState: first.nextState,
  });
  assert.match(followUp.response, /راهکار اختصاصی همین روز: امروز فقط یک موقعیت/);
  assert.doesNotMatch(followUp.response, /متن تمرین همین روز/);
});


test('explicit sentence references retrieve the matching sentence from the prior assistant turn', () => {
  const first = makeDailyExerciseGuidanceTurn({ message: 'چطور انجامش بدم؟', dayData, problem: 'اضطراب', day: 4 });
  const secondSentence = makeDailyExerciseGuidanceTurn({
    message: 'جمله دوم رو بگو',
    dayData,
    problem: 'اضطراب',
    day: 4,
    conversationState: first.nextState,
  });
  assert.match(secondSentence.response, /متن تمرین همین روز: سه موقعیت اخیر/);
  assert.match(secondSentence.response, /جمله 2 از پاسخ قبلی/);

  const lastSentence = makeDailyExerciseGuidanceTurn({
    message: 'جمله آخر',
    dayData,
    problem: 'اضطراب',
    day: 4,
    conversationState: first.nextState,
  });
  assert.match(lastSentence.response, /جمله آخر از پاسخ قبلی/);
  assert.match(lastSentence.response, /جمله یا مرحله‌ای از متن بالا/);
});

test('paragraph references retrieve the requested prior paragraph without crossing day content', () => {
  const first = makeDailyExerciseGuidanceTurn({ message: 'چطور انجامش بدم؟', dayData, problem: 'اضطراب', day: 4 });
  const lastParagraph = makeDailyExerciseGuidanceTurn({
    message: 'بند آخر رو بگو',
    dayData,
    problem: 'اضطراب',
    day: 4,
    conversationState: first.nextState,
  });
  assert.match(lastParagraph.response, /بند آخر از پاسخ قبلی/);
  assert.match(lastParagraph.response, /برای اینکه دقیقاً همان چیزی را که لازم داری روشن کنم/);
  assert.doesNotMatch(lastParagraph.response, /راهکار اختصاصی همین روز/);
});

test('ambiguous same-sentence and other-one references ask for clarification instead of guessing', () => {
  const first = makeDailyExerciseGuidanceTurn({ message: 'چطور انجامش بدم؟', dayData, problem: 'اضطراب', day: 4 });
  for (const message of ['همون جمله', 'همون جمله قبلی', 'اون یکی']) {
    const followUp = makeDailyExerciseGuidanceTurn({
      message,
      dayData,
      problem: 'اضطراب',
      day: 4,
      conversationState: first.nextState,
    });
    assert.match(followUp.response, /کدام جمله است/u, message);
    assert.doesNotMatch(followUp.response, /این جمله از پاسخ قبلی است/u);
  }
});

test('out-of-range sentence references request clarification rather than selecting a different sentence', () => {
  const first = makeDailyExerciseGuidanceTurn({ message: 'بله', dayData, problem: 'اضطراب', day: 4 });
  const followUp = makeDailyExerciseGuidanceTurn({
    message: 'جمله سوم',
    dayData,
    problem: 'اضطراب',
    day: 4,
    conversationState: first.nextState,
  });
  assert.match(followUp.response, /به‌اندازه کافی جمله/);
});
