import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDailyExerciseGuidance, selectDailyExerciseGuidanceData } from '../src/features/assistant/dailyExerciseAssistantGuidance.js';
import { preserveDailyGuidanceSourceIdentity } from '../src/features/assistant/dailyGuidanceSourceIdentity.js';

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
  assert.notEqual(selected, adapted);
  assert.equal(selected.exercise, adapted.exercise);
  assert.equal(selected.actionText, adapted.actionText);
  assert.equal(selected.adaptation, '');

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
  assert.ok(second.nextState.lastAssistantMessage.length <= 2400);
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

test('a follow-up example request uses only a source-derived blank template', () => {
  const exampleDay = {
    ...dayData,
    exercise: 'دو ستون بکش: «چه احساسی داشتم؟» و «چه کاری انجام دادم؟».',
  };
  const first = makeDailyExerciseGuidanceTurn({ message: 'چطور انجامش بدم؟', dayData: exampleDay, problem: 'اضطراب', day: 4 });
  const second = makeDailyExerciseGuidanceTurn({ message: 'مثال بزن', dayData: exampleDay, problem: 'اضطراب', day: 4, conversationState: first.nextState });
  assert.match(second.response, /قالب خالی/);
  assert.match(second.response, /چه احساسی داشتم/u);
  assert.doesNotMatch(second.response, /مثال فرضی و غیرشخصی|موقعیت ساختگی/u);
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
  assert.match(lastSentence.response, /می‌خواهی همین بخش را توضیح بدهم/);
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
  assert.match(lastParagraph.response, /این گام‌ها فقط به بخش‌های موجود در متن اصلی شکسته شده‌اند/);
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


test('extended sentence ordinals retrieve the exact requested sentence and reject out-of-range values', () => {
  const first = makeDailyExerciseGuidanceTurn({ message: 'چطور انجامش بدم؟', dayData, problem: 'اضطراب', day: 4 });
  const fourthSentence = makeDailyExerciseGuidanceTurn({
    message: 'جمله چهارم رو بگو',
    dayData,
    problem: 'اضطراب',
    day: 4,
    conversationState: first.nextState,
  });
  assert.match(fourthSentence.response, /جمله 4 از پاسخ قبلی/u);
  assert.match(fourthSentence.response, /لطفاً جمله یا مرحله‌ای از متن بالا/u);

  const missingSentence = makeDailyExerciseGuidanceTurn({
    message: 'جمله دهم',
    dayData,
    problem: 'اضطراب',
    day: 4,
    conversationState: first.nextState,
  });
  assert.match(missingSentence.response, /به‌اندازه کافی جمله/u);
});

test('extended paragraph ordinals retrieve existing paragraphs and clarify missing ones', () => {
  const first = makeDailyExerciseGuidanceTurn({ message: 'چطور انجامش بدم؟', dayData, problem: 'اضطراب', day: 4 });
  const fourthParagraph = makeDailyExerciseGuidanceTurn({
    message: 'بند چهارم',
    dayData,
    problem: 'اضطراب',
    day: 4,
    conversationState: first.nextState,
  });
  assert.match(fourthParagraph.response, /بند 4 از پاسخ قبلی/u);
  assert.match(fourthParagraph.response, /برای اینکه دقیقاً همان چیزی/u);

  const missingParagraph = makeDailyExerciseGuidanceTurn({
    message: 'بند دهم',
    dayData,
    problem: 'اضطراب',
    day: 4,
    conversationState: first.nextState,
  });
  assert.match(missingParagraph.response, /چنین بندی وجود ندارد/u);
});


import { getDailyAssistantAccess } from '../src/features/assistant/dailyAssistantAccess.js';

test('daily assistant remains unavailable when the day content is blocked for safety review', () => {
  const blockedDay = {
    id: 'T03-D01',
    topic_id: 'T03',
    day: 1,
    review_status: 'draft',
    risk_level: 'routine',
    instructions: 'متن مصنوعی که نباید به دستیار برسد',
    actionText: 'اقدام مصنوعی',
  };
  const access = getDailyAssistantAccess({ day: blockedDay, relationshipSafetyConfirmed: true });
  assert.equal(access.available, false);
  assert.equal(access.reason, 'daily_content_blocked');
});

test('relationship-gated daily guidance stays closed until the day-specific safety check is confirmed', () => {
  const gatedDay = {
    id: 'T01-D10',
    topic_id: 'T01',
    day: 10,
    review_status: 'approved',
    risk_level: 'routine',
    instructions: 'متن مصنوعی تمرین',
  };
  const pending = getDailyAssistantAccess({ day: gatedDay, relationshipSafetyConfirmed: false });
  assert.equal(pending.available, false);
  assert.equal(pending.reason, 'relationship_safety_unconfirmed');

  const confirmed = getDailyAssistantAccess({ day: gatedDay, relationshipSafetyConfirmed: true });
  assert.equal(confirmed.available, true);
  assert.equal(confirmed.safetyMode, 'routine');
});

test('caution-level daily guidance is available but explicitly marked for cautious handling', () => {
  const cautionDay = {
    id: 'T01-D01',
    topic_id: 'T01',
    day: 1,
    review_status: 'approved',
    risk_level: 'caution',
    instructions: 'متن مصنوعی تمرین',
  };
  const access = getDailyAssistantAccess({ day: cautionDay });
  assert.equal(access.available, true);
  assert.equal(access.requiresCaution, true);
});

test('missing day data never enables the daily assistant', () => {
  const access = getDailyAssistantAccess({ day: null });
  assert.equal(access.available, false);
  assert.equal(access.reason, 'day_unavailable');
});

test('daily how-to response exposes source-ordered steps and separates source conditions', () => {
  const response = makeDailyExerciseGuidance({
    message: 'چطور انجامش بدم؟',
    dayData: {
      exercise: 'یک موقعیت امن را انتخاب کن. در سه خط بنویس: چه اتفاقی افتاد؟ چه احساسی داشتی؟ چه رفتاری انجام دادی؟ اگر نمونه‌ای پیدا نکردی، مثال نساز.',
      actionText: 'امروز فقط یک بار نام احساس را مشخص کن. اگر فشار بیشتر شد، مکث کن.',
    },
    problem: 'خشم',
    day: 2,
  });
  assert.match(response, /گام 1: یک موقعیت امن را انتخاب کن/u);
  assert.match(response, /گام 2: در سه خط بنویس/u);
  assert.match(response, /گام 3: چه احساسی داشتی/u);
  assert.match(response, /شرط یا یادآوری خود متن/u);
  assert.match(response, /گام‌بندی راهکار اختصاصی روز، فقط بر اساس متن اصلی/u);
});

test('two-column prompts are returned as exact source labels', () => {
  const response = makeDailyExerciseGuidance({
    message: 'چطور انجامش بدم؟',
    dayData: {
      exercise: 'دو ستون بکش: «چه احساسی داشتم؟» و «چه کاری انجام دادم؟». فقط نمونه امن انتخاب کن.',
      actionText: 'پیش از پاسخ، احساس را نام ببر.',
    },
    problem: 'خشم',
    day: 2,
  });
  assert.match(response, /ستون 1: «چه احساسی داشتم/u);
  assert.match(response, /ستون 2: «چه کاری انجام دادم/u);
  assert.match(response, /فقط نمونه امن انتخاب کن/u);
});

test('example requests create a blank template without inventing a personal scenario', () => {
  const response = makeDailyExerciseGuidance({
    message: 'مثال بزن',
    dayData: {
      exercise: 'دو ستون بکش: «چه احساسی داشتم؟» و «چه کاری انجام دادم؟».',
      actionText: 'یک بار احساس را نام ببر.',
    },
    problem: 'خشم',
    day: 2,
  });
  assert.match(response, /قالب خالی/u);
  assert.match(response, /چه احساسی داشتم/u);
  assert.match(response, /پاسخ خودت/u);
});

test('legacy day guidance does not invent rationale, duration, or success criteria', () => {
  const options = { dayData, problem: 'اضطراب', day: 4 };
  assert.match(makeDailyExerciseGuidance({ ...options, message: 'چرا این تمرین را انجام بدهم؟' }), /توضیح تأییدشده‌ای درباره چرایی/u);
  assert.match(makeDailyExerciseGuidance({ ...options, message: 'چند دقیقه طول می‌کشد؟' }), /مدت زمان تأییدشده‌ای/u);
  assert.match(makeDailyExerciseGuidance({ ...options, message: 'معیار انجام درست چیست؟' }), /معیار موفقیتِ تأییدشده‌ای/u);
});

test('legacy day introduction is quoted as the day purpose without inventing a clinical rationale', () => {
  const response = makeDailyExerciseGuidance({
    message: 'چرا این تمرین را انجام بدهم؟',
    dayData: { ...dayData, intro: 'امروز هدف شناخت تجربه اضطراب است.' },
    problem: 'اضطراب',
    day: 4,
  });
  assert.match(response, /در معرفی همین روز آمده است/u);
  assert.match(response, /هدف شناخت تجربه اضطراب/u);
  assert.match(response, /دلیل تخصصی یا درمانی جداگانه/u);
});

test('stop guidance includes the exact closing safety reminder from the current day', () => {
  const closing = 'اگر نشانه‌های جسمانی جدید یا شدید داری، آن را خودکار به اضطراب نسبت نده و ارزیابی پزشکی بگیر.';
  const response = makeDailyExerciseGuidance({
    message: 'شرایط توقف تمرین چیست؟',
    dayData: { ...dayData, closing },
    problem: 'اضطراب',
    day: 4,
  });
  assert.match(response, /یادآوری پایانی متن همین روز/u);
  assert.match(response, new RegExp(closing));
});

test('how-to guidance retains the day closing reminder after source-ordered steps', () => {
  const closing = 'اگر فشار شدید شد، تمرین را متوقف کن و به فعالیت عادی برگرد.';
  const response = makeDailyExerciseGuidance({
    message: 'چطور انجامش بدهم؟',
    dayData: { ...dayData, closing },
    problem: 'اضطراب',
    day: 4,
  });
  assert.match(response, /گام‌بندی تمرین روز/u);
  assert.match(response, /یادآوری پایانی متن روز/u);
  assert.match(response, new RegExp(closing));
});

test('approved day metadata supplies its reviewed rationale, duration, and success criterion', () => {
  const reviewedDay = {
    ...dayData,
    review_status: 'approved',
    teaching_point: 'هیجان و رفتار دو چیز جدا هستند.',
    duration_minutes: 8,
    success_criterion: 'یک تفاوت روشن میان احساس و رفتار نوشته شود.',
  };
  assert.match(makeDailyExerciseGuidance({ message: 'چرا این تمرین؟', dayData: reviewedDay, problem: 'خشم', day: 2 }), /هیجان و رفتار دو چیز جدا/u);
  assert.match(makeDailyExerciseGuidance({ message: 'چند دقیقه؟', dayData: reviewedDay, problem: 'خشم', day: 2 }), /۸ دقیقه/u);
  assert.match(makeDailyExerciseGuidance({ message: 'معیار موفقیت چیست؟', dayData: reviewedDay, problem: 'خشم', day: 2 }), /یک تفاوت روشن/u);
});

test('adapted daily content retains original review metadata', () => {
  const raw = {
    id: 'T01-D04',
    topic_id: 'T01',
    day: 4,
    review_status: 'approved',
    duration_minutes: 8,
    success_criterion: 'یک تفاوت روشن ثبت شود.',
    exercise: 'تمرین اصلی',
    actionText: 'اقدام اصلی',
  };
  const adapted = {
    exercise: 'تمرین سبک‌شده',
    action: 'اقدام سبک‌شده',
    adaptation: 'امروز فقط گام سبک را انجام بده.',
  };
  const selected = selectDailyExerciseGuidanceData({ guidanceData: adapted, data: raw });
  assert.equal(selected.review_status, 'approved');
  assert.equal(selected.duration_minutes, 8);
  assert.equal(selected.exercise, 'تمرین سبک‌شده');
  assert.equal(selected.actionText, 'اقدام سبک‌شده');
  assert.equal(selected.adaptation, 'امروز فقط گام سبک را انجام بده.');
});

test('rejects adapted guidance when its source day or topic differs from the canonical record', () => {
  const raw = {
    id: 'T01-D04',
    topic_id: 'T01',
    day: 4,
    exercise: 'تمرین معتبر روز چهارم',
    actionText: 'راهکار معتبر روز چهارم',
  };
  const wrongTopic = {
    id: 'T02-D04',
    topic_id: 'T02',
    day: 4,
    exercise: 'تمرین موضوع دیگر',
    action: 'راهکار موضوع دیگر',
  };
  const wrongDay = {
    id: 'T01-D05',
    topic_id: 'T01',
    day: 5,
    exercise: 'تمرین روز پنجم',
    action: 'راهکار روز پنجم',
  };

  assert.equal(selectDailyExerciseGuidanceData({ guidanceData: wrongTopic, data: raw }), raw);
  assert.equal(selectDailyExerciseGuidanceData({ guidanceData: wrongDay, data: raw }), raw);
});

test('rejects adapted guidance when any canonical identity field is missing from the adapted copy', () => {
  const raw = {
    id: 'T01-D04',
    topic_id: 'T01',
    day: 4,
    exercise: 'تمرین معتبر روز چهارم',
    actionText: 'راهکار معتبر روز چهارم',
  };
  const missingTopic = { id: 'T01-D04', day: 4, exercise: 'متن نامطمئن' };
  const missingDay = { id: 'T01-D04', topic_id: 'T01', exercise: 'متن نامطمئن' };
  const nullIdentity = { id: 'T01-D04', topic_id: 'T01', day: null, exercise: 'متن نامطمئن' };

  assert.equal(selectDailyExerciseGuidanceData({ guidanceData: missingTopic, data: raw }), raw);
  assert.equal(selectDailyExerciseGuidanceData({ guidanceData: missingDay, data: raw }), raw);
  assert.equal(selectDailyExerciseGuidanceData({ guidanceData: nullIdentity, data: raw }), raw);
});

test('rejects adapted guidance when the canonical record has no verifiable identity', () => {
  const canonical = { exercise: 'تمرین اصلی', actionText: 'راهکار اصلی' };
  const adapted = { exercise: 'تمرین تغییر یافته', action: 'راهکار تغییر یافته' };
  assert.equal(selectDailyExerciseGuidanceData({ guidanceData: adapted, data: canonical }), canonical);
  assert.equal(selectDailyExerciseGuidanceData({ guidanceData: adapted, data: null }), null);
});

test('refuses guidance when the source record day differs from the active day', () => {
  const response = makeDailyExerciseGuidance({
    message: 'چطور انجامش بدم؟',
    dayData: {
      ...dayData,
      day: 5,
      exercise: 'تمرین متعلق به روز پنجم',
      actionText: 'راهکار متعلق به روز پنجم',
    },
    problem: 'اضطراب',
    day: 4,
  });

  assert.match(response, /روزِ محتوای دریافتی با روز فعال یکسان نیست/u);
  assert.doesNotMatch(response, /تمرین متعلق به روز پنجم|راهکار متعلق به روز پنجم/u);
});

test('split day guidance preserves source id, topic, and day identity', () => {
  const source = { id: 'T03-D07', topic_id: 'T03', day: 7, instructions: 'متن تمرین روز هفتم', actionText: 'راهکار روز هفتم' };
  const adapted = preserveDailyGuidanceSourceIdentity(source, { exercise: 'تمرین روز هفتم', action: 'راهکار روز هفتم' });
  assert.equal(adapted.id, source.id);
  assert.equal(adapted.topic_id, source.topic_id);
  assert.equal(adapted.day, source.day);
});
