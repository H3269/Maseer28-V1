import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ANGER_DAILY_ASSISTANT_GUIDES,
  answerAngerDailyPreparedQuestion,
  getAngerDailyAssistantPromptGroups,
} from '../src/features/assistant/angerDailyAssistantPrompts.js';
import { makeDailyExerciseGuidanceTurn } from '../src/features/assistant/dailyExerciseAssistantGuidance.js';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';

test('anger assistant guide covers all 28 days with fourteen day-scoped prepared questions each', () => {
  assert.equal(ANGER_DAILY_ASSISTANT_GUIDES.length, 28);
  assert.deepEqual(ANGER_DAILY_ASSISTANT_GUIDES.map((item) => item.day), Array.from({ length: 28 }, (_, index) => index + 1));
  for (const guide of ANGER_DAILY_ASSISTANT_GUIDES) {
    assert.equal(guide.topicId, 'T01');
    assert.equal(guide.questions.length, 14, `day ${guide.day}`);
    assert.equal(new Set(guide.questions.map((item) => item.value)).size, 14, `day ${guide.day}`);
    assert.ok(guide.exercise && guide.action && guide.exerciseExample && guide.actionExample);
    assert.ok(guide.lightVersion && guide.successCriterion && guide.stopCondition);
  }
});

test('prompt groups are scoped to the selected day and contain all prepared questions', () => {
  for (let day = 1; day <= 28; day += 1) {
    const groups = getAngerDailyAssistantPromptGroups(day);
    assert.equal(groups.length, 5);
    assert.equal(groups.reduce((count, group) => count + group.questions.length, 0), 14);
    assert.ok(groups.flatMap((group) => group.questions).every((question) => question.value === question.label && !question.value.includes('خشم')));
  }
  assert.deepEqual(getAngerDailyAssistantPromptGroups(29), []);
  assert.equal(getAngerDailyAssistantPromptGroups('۱').reduce((count, group) => count + group.questions.length, 0), 14);
});

test('anger guide exercise and action text match the 28 runtime overrides exactly', async () => {
  const override = JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
  const days = override.categories['خشم'].days;
  assert.equal(days.length, 28);
  for (const guide of ANGER_DAILY_ASSISTANT_GUIDES) {
    const source = days.find((item) => item.day === guide.day);
    assert.ok(source, `missing runtime day ${guide.day}`);
    assert.equal(guide.exercise, source.exercise, `exercise mismatch day ${guide.day}`);
    assert.equal(guide.action, source.actionText, `action mismatch day ${guide.day}`);
  }
});

test('prepared exercise answer is explicit, stepwise, and grounded in the selected day', () => {
  const guide = ANGER_DAILY_ASSISTANT_GUIDES[0];
  const question = guide.questions.find((item) => item.kind === 'exercise_meaning');
  const answer = answerAngerDailyPreparedQuestion({ day: 1, message: question.value });
  assert.match(answer, /چه اتفاقی افتاد/);
  assert.match(answer, /این کار را این‌طور پیش ببر/);
  assert.match(answer, /هدف امروز/);
  assert.match(answer, /تفکیک رویداد، احساس و رفتار/);
});

test('prepared action example stays distinct from the exercise and preserves safety boundaries', () => {
  const guide = ANGER_DAILY_ASSISTANT_GUIDES[9];
  const question = guide.questions.find((item) => item.kind === 'action_example');
  const answer = answerAngerDailyPreparedQuestion({ day: 10, message: question.value });
  assert.match(answer, /رفتار خروج خودت|فضای امن|مکث/);
  assert.match(answer, /اگر موقعیت تو ناامن است، آن را اجرا نکن/);
});

test('light version answer does not shame or force the user', () => {
  const guide = ANGER_DAILY_ASSISTANT_GUIDES[3];
  const question = guide.questions.find((item) => item.kind === 'light_version');
  const answer = answerAngerDailyPreparedQuestion({ day: 4, message: question.value });
  assert.ok(answer.includes(guide.lightVersion));
  assert.match(answer, /خودت را مجبور نکن/);
  assert.match(answer, /شکست محسوب نمی‌شود/);
});

test('stop answer includes the exact daily stop condition and a general urgent safety handoff', () => {
  const guide = ANGER_DAILY_ASSISTANT_GUIDES[22];
  const question = guide.questions.find((item) => item.kind === 'stop');
  const answer = answerAngerDailyPreparedQuestion({ day: 23, message: question.value });
  assert.ok(answer.includes(guide.stopCondition));
  assert.match(answer, /فاصله امن ایجاد کن/);
  assert.match(answer, /خدمات اضطراری/);
});

test('no-event answer never asks the user to create an anger-provoking situation', () => {
  const guide = ANGER_DAILY_ASSISTANT_GUIDES[14];
  const question = guide.questions.find((item) => item.kind === 'no_event');
  const answer = answerAngerDailyPreparedQuestion({ day: 15, message: question.value });
  assert.match(answer, /عمداً خودت را وارد بحث یا موقعیت خشم‌آور/);
  assert.match(answer, /نمونه کم‌فشار قبلی/);
});

test('neutral prepared question text is resolved against the active day, not a day embedded in the prompt', () => {
  const dayOne = ANGER_DAILY_ASSISTANT_GUIDES[0].questions[0].value;
  const dayTwoAnswer = answerAngerDailyPreparedQuestion({ day: 2, message: dayOne });
  assert.match(dayTwoAnswer, /راهنمای روز 2 خشم/);
  assert.doesNotMatch(dayTwoAnswer, /راهنمای روز 1 خشم/);
  assert.equal(answerAngerDailyPreparedQuestion({ day: 1, message: 'این سؤال آماده در فهرست نیست' }), null);
});

test('daily turn routes prepared anger questions only after source identity and safety checks', () => {
  const guide = ANGER_DAILY_ASSISTANT_GUIDES[0];
  const question = guide.questions.find((item) => item.kind === 'exercise_meaning');
  const ok = makeDailyExerciseGuidanceTurn({
    message: question.value,
    problem: 'خشم',
    day: 1,
    dayData: { id: 'T01-D01', topic_id: 'T01', day: 1, exercise: guide.exercise, actionText: guide.action },
  });
  assert.match(ok.response, /راهنمای روز 1 خشم/);
  assert.match(ok.response, /تفکیک رویداد، احساس و رفتار/);

  const mismatch = makeDailyExerciseGuidanceTurn({
    message: question.value,
    problem: 'خشم',
    day: 2,
    dayData: { id: 'T01-D01', topic_id: 'T01', day: 1, exercise: guide.exercise, actionText: guide.action },
  });
  assert.match(mismatch.response, /شناسه روزِ محتوای دریافتی/);
  assert.doesNotMatch(mismatch.response, /راهنمای روز 1 خشم/);

  const topicMismatch = makeDailyExerciseGuidanceTurn({
    message: question.value,
    problem: 'خشم',
    day: 1,
    dayData: { id: 'T02-D01', topic_id: 'T02', day: 1, exercise: guide.exercise, actionText: guide.action },
  });
  assert.match(topicMismatch.response, /شناسه موضوعِ محتوای دریافتی/);
  assert.doesNotMatch(topicMismatch.response, /راهنمای روز 1 خشم/);

  const pending = makeDailyExerciseGuidanceTurn({
    message: question.value,
    problem: 'خشم',
    day: 1,
    dayData: { id: 'T01-D01', topic_id: 'T01', day: 1, exercise: guide.exercise, actionText: guide.action },
    conversationState: { safetyStatus: 'pending' },
  });
  assert.match(pending.response, /آیا همین الآن خطر فوری/);
  assert.doesNotMatch(pending.response, /راهنمای روز 1 خشم/);
});

test('anger prepared answers are not returned for another selected topic', () => {
  const question = ANGER_DAILY_ASSISTANT_GUIDES[0].questions[0].value;
  const response = makeDailyExerciseGuidanceTurn({
    message: question,
    problem: 'اضطراب',
    day: 1,
    dayData: { day: 1, exercise: 'تمرین اضطراب', actionText: 'اقدام اضطراب' },
  });
  assert.doesNotMatch(response.response, /راهنمای روز 1 خشم/);
});

test('additional prepared answers distinguish exercise from action and handle missed days without shame', () => {
  const guide = ANGER_DAILY_ASSISTANT_GUIDES[6];
  const difference = guide.questions.find((item) => item.kind === 'exercise_action_difference');
  const missed = guide.questions.find((item) => item.kind === 'not_done');
  const differenceAnswer = answerAngerDailyPreparedQuestion({ day: 7, message: difference.value });
  const missedAnswer = answerAngerDailyPreparedQuestion({ day: 7, message: missed.value });
  assert.ok(differenceAnswer.includes(guide.exercise));
  assert.ok(differenceAnswer.includes(guide.action));
  assert.match(differenceAnswer, /تمرین را برای فهم و ثبت/);
  assert.ok(missedAnswer.includes(guide.lightVersion));
  assert.match(missedAnswer, /خودت را سرزنش نکن/);
});

test('prepared answer for increased anger prioritizes stopping and immediate safety', () => {
  const guide = ANGER_DAILY_ASSISTANT_GUIDES[26];
  const question = guide.questions.find((item) => item.kind === 'anger_increased');
  const answer = answerAngerDailyPreparedQuestion({ day: 27, message: question.value });
  assert.ok(answer.includes(guide.stopCondition));
  assert.match(answer, /تمرین را متوقف کن/);
  assert.match(answer, /خدمات اضطراری/);
});

test('talking to another person is never presented as mandatory', () => {
  const guide = ANGER_DAILY_ASSISTANT_GUIDES[10];
  const question = guide.questions.find((item) => item.kind === 'talk_other');
  const answer = answerAngerDailyPreparedQuestion({ day: 11, message: question.value });
  assert.match(answer, /لازم نیست.*با فرد دیگری صحبت کنی/);
  assert.match(answer, /آزادانه رضایت داشته باشند/);
});

test('duration answer does not invent a number that is absent from reviewed source content', () => {
  const guide = ANGER_DAILY_ASSISTANT_GUIDES[0];
  const question = guide.questions.find((item) => item.kind === 'duration');
  const answer = answerAngerDailyPreparedQuestion({ day: 1, message: question.value });
  assert.match(answer, /مدت زمان تأییدشده و مشخصی.*ثبت نشده/);
  assert.doesNotMatch(answer, /\d+ دقیقه/);
});


test('exercise explanation preserves the source-requested number of examples for days that need more than one', () => {
  const guide = ANGER_DAILY_ASSISTANT_GUIDES[2];
  const question = guide.questions.find((item) => item.kind === 'exercise_meaning');
  const answer = answerAngerDailyPreparedQuestion({ day: 3, message: question.value });
  assert.match(answer, /دو تجربه کم‌فشار/);
  assert.match(answer, /تعداد نمونه‌ها.*خود متن تمرین خواسته/);
  assert.doesNotMatch(answer, /فقط یک نمونه کم‌فشار و امن انتخاب کن/);
});


test('anger day 11 prepared FAQs remain available while free-form interpersonal guidance keeps its safety gate', () => {
  const guide = ANGER_DAILY_ASSISTANT_GUIDES[10];
  const dayData = {
    id: 'خشم-11',
    topic_id: 'T01',
    day: 11,
    review_status: 'approved',
    risk_level: 'routine',
    exercise: guide.exercise,
    action: guide.action,
  };
  for (const question of guide.questions) {
    const turn = makePageAssistantTurn({
      screen: 'day',
      text: question.value,
      dailyContext: {
        day: 11,
        problem: 'خشم',
        data: dayData,
        relationshipSafetyConfirmed: false,
      },
    });
    assert.equal(turn.status, 'daily_guidance_available', question.kind);
    assert.match(turn.message, /راهنمای روز 11 خشم/, question.kind);
  }

  const freeForm = makePageAssistantTurn({
    screen: 'day',
    text: 'چطور با طرف مقابل وارد گفت‌وگو شوم؟',
    dailyContext: {
      day: 11,
      problem: 'خشم',
      data: dayData,
      relationshipSafetyConfirmed: false,
    },
  });
  assert.equal(freeForm.status, 'daily_guidance_unavailable');
  assert.match(freeForm.message, /بررسی ایمنی همین روز/);
  assert.doesNotMatch(freeForm.message, /راهنمای روز 11 خشم/);
});
