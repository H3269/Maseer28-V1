import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import { mergeDailyTextOverrides } from '../src/features/content/dailyTextOverrides.js';
import { buildSharedDailyAssistantAnswerFromDailyContent, getSharedDailyAssistantPromptGroups } from '../src/features/assistant/sharedDailyAssistantEngine.js';
import { getCanonicalDailyRecordId } from '../src/features/content/dailyContentSelector.js';
import { getDailySafetyMode } from '../src/features/content/dailySafety.js';
import { getRelationshipSafetyGate } from '../src/features/journey/relationshipSafetyGate.js';
import { ANGER_DAILY_ASSISTANT_GUIDES } from '../src/features/assistant/angerDailyAssistantPrompts.js';

const mergedDailyContentPromise = Promise.all([
  readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8').then(JSON.parse),
]).then(([base, overrides]) => mergeDailyTextOverrides(base, overrides));

async function loadTopicDays(topicName) {
  const merged = await mergedDailyContentPromise;
  return merged.categories[topicName].days;
}

test('page-specific UI guidance is selected for the current screen', () => {
  const result = makePageAssistantTurn({
    screen: 'books',
    text: 'اینجا چه کارهایی می‌توانم انجام بدهم؟',
  });
  assert.equal(result.status, 'page_guidance_available');
  assert.equal(result.page_context, 'books');
  assert.match(result.message, /بازکردن کتاب/);
  assert.deepEqual(result.knowledge, []);
});

test('empty and overlong messages preserve the router input guards', () => {
  assert.equal(makePageAssistantTurn({ screen: 'books', text: '   ' }).status, 'invalid_input');
  assert.equal(makePageAssistantTurn({ screen: 'books', text: 'x'.repeat(3001) }).status, 'input_too_long');
});

test('daily page answers a prepared question with the selected topic and day', () => {
  const dayData = {
    id: getCanonicalDailyRecordId('خشم', 1),
    day: 1,
    exercise: 'سه موقعیت اخیر را که در آن عصبانی شدی، بدون قضاوت یادداشت کن.',
    actionText: 'امروز فقط یک موقعیت را انتخاب کن و شدت احساس را از صفر تا ده ثبت کن.',
  };
  const result = makePageAssistantTurn({
    screen: 'day',
    text: ANGER_DAILY_ASSISTANT_GUIDES[0].questions[0].value,
    dailyContext: { day: 1, problem: 'خشم', data: dayData, relationshipSafetyConfirmed: true },
  });
  assert.equal(result.status, 'daily_guidance_available');
  assert.equal(result.conversationState, null);
});

test('T01 prepared answers use visible adapted text when the canonical record omits topic_id', () => {
  const guide = ANGER_DAILY_ASSISTANT_GUIDES[0];
  const canonicalExercise = 'متن مرجع تمرین خشم برای آزمون هویت روز.';
  const visibleExercise = 'متن نمایشیِ تطبیق‌یافته برای تمرین خشم در روز انتخاب‌شده.';
  const visibleAction = 'اقدام نمایشیِ تطبیق‌یافته برای همان روز.';
  const result = makePageAssistantTurn({
    screen: 'day',
    text: guide.questions[0].value,
    dailyContext: {
      day: 1,
      problem: 'خشم',
      data: {
        id: getCanonicalDailyRecordId('خشم', 1),
        day: 1,
        exercise: canonicalExercise,
        actionText: 'اقدام مرجع روز.',
      },
      guidanceData: {
        exercise: visibleExercise,
        action: visibleAction,
      },
    },
  });
  assert.equal(result.status, 'daily_guidance_available');
  assert.ok(result.message.includes(visibleExercise),
    'T01 answer must quote the exact visible adapted exercise');
  assert.ok(!result.message.includes(canonicalExercise),
    'T01 answer must not silently fall back to stale canonical exercise wording');
});

test('T01 example answers stay anchored to the visible daily exercise and action', () => {
  const visibleExercise = 'تمرین نمایشی روز برای تفکیک رویداد، احساس، میل و رفتار واقعی.';
  const visibleAction = 'اقدام نمایشی روز برای بیان امن اعتراض به یک رفتار مشخص.';
  const guide = ANGER_DAILY_ASSISTANT_GUIDES[0];
  const dailyContext = {
    day: 1,
    problem: 'خشم',
    data: {
      id: getCanonicalDailyRecordId('خشم', 1),
      day: 1,
      exercise: 'تمرین مرجع قدیمی که نباید نمایش داده شود.',
      actionText: 'اقدام مرجع قدیمی که نباید نمایش داده شود.',
    },
    guidanceData: { exercise: visibleExercise, action: visibleAction },
  };

  const exerciseExample = makePageAssistantTurn({
    screen: 'day',
    text: guide.questions[1].value,
    dailyContext,
  });
  assert.equal(exerciseExample.status, 'daily_guidance_available');
  assert.ok(exerciseExample.message.includes(visibleExercise));
  assert.ok(!exerciseExample.message.includes('تمرین مرجع قدیمی'));

  const actionExample = makePageAssistantTurn({
    screen: 'day',
    text: guide.questions[3].value,
    dailyContext,
  });
  assert.equal(actionExample.status, 'daily_guidance_available');
  assert.ok(actionExample.message.includes(visibleAction));
  assert.ok(!actionExample.message.includes('اقدام مرجع قدیمی'));
});

test('shared-topic example answers include the exact daily exercise and action', () => {
  const visibleExercise = 'تمرین نمایشی اضطراب برای شناسایی نشانه‌های بدنی و فکرهای همراه.';
  const visibleAction = 'اقدام نمایشی اضطراب برای مکث کوتاه و بررسی شواهد پیش از واکنش.';
  const dailyContext = {
    day: 1,
    problem: 'اضطراب',
    data: {
      id: getCanonicalDailyRecordId('اضطراب', 1),
      topic_id: 'T02',
      day: 1,
      exercise: visibleExercise,
      actionText: visibleAction,
    },
    relationshipSafetyConfirmed: true,
  };

  const exerciseExample = makePageAssistantTurn({
    screen: 'day',
    text: 'برای تمرین امروز یک مثال می‌زنی؟',
    dailyContext,
  });
  assert.equal(exerciseExample.status, 'daily_guidance_available');
  assert.ok(exerciseExample.message.includes(visibleExercise));

  const actionExample = makePageAssistantTurn({
    screen: 'day',
    text: 'برای اقدام امروز یک مثال می‌زنی؟',
    dailyContext,
  });
  assert.equal(actionExample.status, 'daily_guidance_available');
  assert.ok(actionExample.message.includes(visibleAction));
});

test('daily assistant answers prepared questions regardless of canonical review status', () => {
  const dayData = {
    id: getCanonicalDailyRecordId('خشم', 1),
    topic_id: 'T01',
    day: 1,
    risk_level: 'routine',
    review_status: 'pending_expert_review',
    exercise: ANGER_DAILY_ASSISTANT_GUIDES[0].exercise,
    actionText: ANGER_DAILY_ASSISTANT_GUIDES[0].action,
  };
  const result = makePageAssistantTurn({
    screen: 'day',
    text: ANGER_DAILY_ASSISTANT_GUIDES[0].questions[0].value,
    dailyContext: { day: 1, problem: 'خشم', data: dayData, relationshipSafetyConfirmed: true },
  });
  assert.equal(result.status, 'daily_guidance_available');
  assert.doesNotMatch(result.message, /تمرین مسدود روز اول|راهکار مسدود روز اول/);
});

test('library book-list questions use only the currently available local titles', () => {
  const result = makePageAssistantTurn({
    screen: 'books',
    text: 'این کتابخانه چه کتاب‌هایی دارد؟',
    libraryContext: { titles: ['کتاب اول', 'کتاب دوم'] },
  });
  assert.equal(result.status, 'page_guidance_available');
  assert.match(result.message, /کتاب اول/);
  assert.match(result.message, /کتاب دوم/);
});

test('app-wide factual guidance is available from non-dashboard screens', () => {
  const result = makePageAssistantTurn({
    screen: 'profile',
    text: 'امکانات برنامه چیست؟',
  });
  assert.equal(result.status, 'page_guidance_available');
  assert.match(result.message, /تمرین روزانه/);
  assert.match(result.message, /کتابخانه/);
});

test('onboarding screen IDs resolve to their own grounded assistant guidance', () => {
  const result = makePageAssistantTurn({
    screen: 'howWorks',
    text: 'این صفحه برای چیست؟',
  });
  assert.equal(result.status, 'page_guidance_available');
  assert.match(result.message, /روند استفاده از مسیر ۲۸ روزه/);
});

test('T02 prepared questions use canonical daily content and reject topic/day identity conflicts', async () => {
  const question = getSharedDailyAssistantPromptGroups(1, 'T02').flatMap((group) => group.questions)
    .find((item) => item.kind === 'exercise_action_difference');
  const dayData = (await loadTopicDays('اضطراب'))[0];
  const result = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: { day: 1, problem: 'اضطراب', data: dayData },
  });
  assert.equal(result.status, 'daily_guidance_available');
  assert.ok(result.message.includes(dayData.exercise));
  assert.ok(result.message.includes(dayData.actionText));

  const wrongTopic = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: {
      day: 1,
      problem: 'اضطراب',
      data: { ...dayData, id: getCanonicalDailyRecordId('خشم', 1), topic_id: 'T01' },
    },
  });
  assert.equal(wrongTopic.status, 'daily_guidance_unavailable');

  const wrongDay = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: { day: 2, problem: 'اضطراب', data: dayData },
  });
  assert.equal(wrongDay.status, 'daily_guidance_unavailable');
});

test('all exact prepared T03 questions answer through the real page router for all 28 days', async () => {
  const sourceDays = await loadTopicDays('ترس');
  let checked = 0;
  for (let day = 1; day <= 28; day += 1) {
    const record = sourceDays.find((item) => item.day === day);
    for (const question of getSharedDailyAssistantPromptGroups(day, 'T03').flatMap((group) => group.questions)) {
      const result = makePageAssistantTurn({
        screen: 'day',
        text: question.value,
        dailyContext: {
          day,
          problem: 'ترس',
          data: record,
          guidanceData: { id: record.id, topic_id: null, day: record.day },
          relationshipSafetyConfirmed: true,
        },
      });
      assert.equal(result.status, 'daily_guidance_available', 'day ' + day + ' ' + question.kind);
      assert.ok(result.message.length > 0);
      checked += 1;
    }
  }
  assert.equal(checked, 392);
});

test('T03 prepared FAQs accept canonical category-derived identity but reject topic/day conflicts', async () => {
  const record = (await loadTopicDays('ترس'))[0];
  const question = getSharedDailyAssistantPromptGroups(1, 'T03')[0].questions[0];
  const wrongTopic = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: {
      day: 1,
      problem: 'ترس',
      data: { ...record, id: getCanonicalDailyRecordId('اضطراب', 1), topic_id: 'T02' },
    },
  });
  assert.equal(wrongTopic.status, 'daily_guidance_unavailable');

  const legacyTopicMissing = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: {
      day: 1,
      problem: 'ترس',
      data: record,
      guidanceData: { id: record.id, topic_id: null, day: 1 },
    },
  });
  assert.equal(legacyTopicMissing.status, 'daily_guidance_available');

  const explicitTopicConflict = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: {
      day: 1,
      problem: 'ترس',
      data: { ...record, topic_id: 'T02' },
    },
  });
  assert.equal(explicitTopicConflict.status, 'daily_guidance_unavailable');

  const wrongDay = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: {
      day: 1,
      problem: 'ترس',
      data: { ...record, id: getCanonicalDailyRecordId('ترس', 2), day: 2 },
    },
  });
  assert.equal(wrongDay.status, 'daily_guidance_unavailable');
});

test('T03 prepared FAQ route still gives urgent safety handoff precedence', () => {
  const result = makePageAssistantTurn({
    screen: 'day',
    text: 'امشب قصد دارم خودم را بکشم.',
    dailyContext: {
      day: 1,
      problem: 'ترس',
      data: {
        id: getCanonicalDailyRecordId('ترس', 1),
        topic_id: 'T03',
        day: 1,
      },
    },
  });
  assert.equal(result.status, 'urgent_human_support_required');
  assert.deepEqual(result.knowledge, []);
});


test('T03 prompt groups use the same five-section ordering as the T01 reference', () => {
  for (let day = 1; day <= 28; day += 1) {
    const groups = getSharedDailyAssistantPromptGroups(day, 'T03');
    assert.equal(groups.length, 5, 'day ' + day);
    assert.deepEqual(groups.map((group) => group.questions.length), [2, 2, 1, 5, 4]);
    assert.equal(groups.flatMap((group) => group.questions).length, 14);
    assert.deepEqual(groups.map((group) => group.label), [
      'فهم تمرین روز ' + day,
      'فهم اقدام اختصاصی روز ' + day,
      'تفاوت تمرین و اقدام',
      'اجرا و موانع',
      'ارزیابی و ایمنی',
    ]);
  }
  assert.deepEqual(getSharedDailyAssistantPromptGroups(29, 'T03'), []);
});

test('T03 prepared answers use the shared T01 response structure and canonical day content', async () => {
  const dailyContent = (await loadTopicDays('ترس'))[0];
  const questions = getSharedDailyAssistantPromptGroups(1, 'T03').flatMap((group) => group.questions);
  const exerciseQuestion = questions.find((item) => item.kind === 'exercise_meaning');
  const exampleQuestion = questions.find((item) => item.kind === 'exercise_example');
  const actionQuestion = questions.find((item) => item.kind === 'action_meaning');
  const exercise = buildSharedDailyAssistantAnswerFromDailyContent({
    topicId: 'T03', topicName: 'ترس', day: 1, message: exerciseQuestion.value, dailyContent,
  });
  const example = buildSharedDailyAssistantAnswerFromDailyContent({
    topicId: 'T03', topicName: 'ترس', day: 1, message: exampleQuestion.value, dailyContent,
  });
  const action = buildSharedDailyAssistantAnswerFromDailyContent({
    topicId: 'T03', topicName: 'ترس', day: 1, message: actionQuestion.value, dailyContent,
  });
  assert.match(exercise, /در روز 1/);
  assert.ok(exercise.includes(dailyContent.exercise));
  assert.ok(example.includes(dailyContent.exerciseExample));
  assert.ok(action.includes(dailyContent.actionText));
  assert.equal(buildSharedDailyAssistantAnswerFromDailyContent({
    topicId: 'T03', topicName: 'ترس', day: 1, message: 'سؤال خارج از فهرست', dailyContent,
  }), null);
});

test('all exact prepared T04 questions answer through the real page router for canonical day identity', async () => {
  const sourceDays = await loadTopicDays('نفرت');
  let checked = 0;
  for (let day = 1; day <= 28; day += 1) {
    const record = sourceDays.find((item) => item.day === day);
    for (const question of getSharedDailyAssistantPromptGroups(day, 'T04').flatMap((group) => group.questions)) {
      const result = makePageAssistantTurn({
        screen: 'day',
        text: question.value,
        dailyContext: {
          day,
          problem: 'نفرت',
          data: record,
          guidanceData: { id: record.id, topic_id: null, day: record.day },
          relationshipSafetyConfirmed: true,
        },
      });
      assert.equal(result.status, 'daily_guidance_available', 'day ' + day + ' ' + question.kind);
      checked += 1;
    }
  }
  assert.equal(checked, 392);
});

test('T04 prepared assistant accepts canonical identity without topic_id and rejects conflicts', async () => {
  const record = (await loadTopicDays('نفرت'))[0];
  const question = getSharedDailyAssistantPromptGroups(1, 'T04')[0].questions[0];
  const legacy = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: {
      day: 1,
      problem: 'نفرت',
      data: record,
      guidanceData: { id: record.id, topic_id: null, day: record.day },
    },
  });
  assert.equal(legacy.status, 'daily_guidance_available');
  const wrongTopic = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: { day: 1, problem: 'نفرت', data: { ...record, topic_id: 'T18' } },
  });
  assert.equal(wrongTopic.status, 'daily_guidance_unavailable');
  const wrongDay = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: { day: 1, problem: 'نفرت', data: { ...record, id: getCanonicalDailyRecordId('نفرت', 2), day: 2 } },
  });
  assert.equal(wrongDay.status, 'daily_guidance_unavailable');
});

test('T04 urgent safety status preempts prepared Q&A and free-form daily guidance is disabled',()=>{
 const urgent=makePageAssistantTurn({screen:'day',text:'امشب قصد دارم خودم را بکشم.',dailyContext:{day:1,problem:'نفرت',data:{id:getCanonicalDailyRecordId('نفرت',1),topic_id:'T04',day:1}}});
 assert.equal(urgent.status,'urgent_human_support_required');
 const free=makePageAssistantTurn({screen:'day',text:'چرا از یک نفر متنفرم؟',dailyContext:{day:1,problem:'نفرت',data:{id:getCanonicalDailyRecordId('نفرت',1),topic_id:'T04',day:1}}});
 assert.equal(free.status,'prepared_question_required');
 assert.match(free.message,/گفت‌وگوی آزاد برای این موضوع فعال نیست/);
});

test('T04 prompt groups use the same five-section ordering as the T01 reference', () => {
  for (let day = 1; day <= 28; day += 1) {
    const groups = getSharedDailyAssistantPromptGroups(day, 'T04');
    assert.deepEqual(groups.map((group) => group.questions.length), [2, 2, 1, 5, 4]);
    assert.deepEqual(groups.map((group) => group.label), [
      'فهم تمرین روز ' + day,
      'فهم اقدام اختصاصی روز ' + day,
      'تفاوت تمرین و اقدام',
      'اجرا و موانع',
      'ارزیابی و ایمنی',
    ]);
  }
});

test('non-prepared page text is rejected at the routing boundary', () => {
  const result = makePageAssistantTurn({ screen: 'dashboard', text: 'لطفاً یک سؤال آزاد از من بپرس' });
  assert.equal(result.status, 'prepared_question_required');
  assert.equal(result.conversationState, null);
  assert.deepEqual(result.knowledge, []);
});

test('daily topics without a prepared catalogue do not fall back to general text reasoning', () => {
  const result = makePageAssistantTurn({
    screen: 'day',
    text: 'چطور تمرین امروز را انجام بدهم؟',
    dailyContext: {
      day: 1,
      problem: 'موضوع در حال تکمیل',
      data: { id: 'T99-D01', topic_id: 'T99', day: 1 },
    },
  });
  assert.equal(result.status, 'prepared_question_required');
  assert.equal(result.conversationState, null);
});


test('T05 success answer explains an observable check and preserves the active visible exercise', () => {
  const canonicalExercise = 'تمرین مرجع روز حسادت برای ثبت محرک، احساس و برداشت بدون قضاوت.';
  const visibleExercise = 'تمرین نمایشی تطبیق‌یافته روز حسادت برای تفکیک واقعیت از حدس.';
  const visibleAction = 'اقدام نمایشی روز حسادت برای انتخاب یک گام امن و در اختیار خود.';
  const question = getSharedDailyAssistantPromptGroups(1, 'T05').flatMap((group) => group.questions)
    .find((item) => item.kind === 'success');
  const result = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: {
      day: 1,
      problem: 'حسادت',
      data: {
        id: getCanonicalDailyRecordId('حسادت', 1),
        topic_id: 'T05',
        day: 1,
        exercise: canonicalExercise,
        actionText: 'اقدام مرجع روز حسادت.',
      },
      guidanceData: {
        id: getCanonicalDailyRecordId('حسادت', 1),
        topic_id: 'T05',
        day: 1,
        exercise: visibleExercise,
        action: visibleAction,
      },
      relationshipSafetyConfirmed: true,
    },
  });
  assert.equal(result.status, 'daily_guidance_available');
  assert.ok(result.message.includes('برای بررسی'));
  assert.ok(result.message.includes(visibleExercise));
  assert.ok(!result.message.includes(canonicalExercise));
  assert.ok(!result.message.includes(ANGER_DAILY_ASSISTANT_GUIDES[0].exercise), 'T05 q06 must not append stale guide exercise beside the visible adapted exercise');
  assert.doesNotMatch(result.message, /توضیح این مورد در متن بالا آمده است/u);
});


test('T05 q06 uses the exact canonical exercise and an observable review method on all 28 days', async () => {
  const days = await loadTopicDays('حسادت');
  assert.equal(days.length, 28);
  for (let day = 1; day <= 28; day += 1) {
    const dailyContent = days.find((item) => Number(item.day) === day);
    const question = getSharedDailyAssistantPromptGroups(day, 'T05').flatMap((group) => group.questions)
      .find((item) => item.kind === 'success');
    const result = makePageAssistantTurn({
      screen: 'day',
      text: question.value,
      dailyContext: {
        day,
        problem: 'حسادت',
        data: dailyContent,
        relationshipSafetyConfirmed: true,
      },
    });
    assert.equal(result.status, 'daily_guidance_available', 'T05 day ' + day);
    assert.match(result.message, /برای بررسی/u, 'T05 day ' + day + ' must explain how to evaluate the exercise');
    assert.ok(result.message.includes(dailyContent.exercise), 'T05 day ' + day + ' must quote the exact canonical exercise');
    assert.doesNotMatch(result.message, /توضیح این مورد در متن بالا آمده است/u, 'T05 day ' + day + ' must not contain duplicate placeholders');
  }
});


test('every registered topic/day relationship gate blocks prepared answers until explicit safe confirmation', async () => {
  const merged = await mergedDailyContentPromise;
  const topicEntries = [
    ['T01', 'خشم'], ['T02', 'اضطراب'], ['T03', 'ترس'], ['T04', 'نفرت'],
    ['T05', 'حسادت'], ['T06', 'غم و سوگ'], ['T07', 'احساس گناه'], ['T08', 'وابستگی عاطفی'],
    ['T09', 'اهمال‌کاری'], ['T10', 'بی‌خوابی و مشکلات خواب'], ['T11', 'عادت‌های تکراری'],
    ['T12', 'مرزبندی و نه گفتن'], ['T13', 'تنهایی'], ['T14', 'کمبود انگیزه'],
    ['T15', 'اعتمادبه‌نفس پایین'], ['T16', 'افکار منفی و نشخوار فکری'], ['T17', 'مشکلات رابطه'],
    ['T18', 'نفرت از خود'], ['T19', 'خودسرزنشی'], ['T20', 'کمال‌گرایی'], ['T21', 'اجتناب'],
    ['T22', 'استرس'], ['T23', 'احساس بی‌ارزشی'], ['T24', 'مشکل در کنترل هیجان'],
    ['T25', 'رنجش و کینه'], ['T26', 'شرم'], ['T27', 'ترس از قضاوت'], ['T28', 'ترس از شکست'],
    ['T29', 'ترس از طرد شدن'], ['T30', 'شک و تردید'], ['T31', 'کنترل‌گری'], ['T32', 'بی‌انگیزگی'],
    ['T33', 'خودانتقادی'], ['T34', 'مشکل دیگر'],
  ];
  let checked = 0;
  for (const [topicId, topicName] of topicEntries) {
    const days = merged.categories[topicName]?.days || [];
    assert.equal(days.length, 28, topicId + ' canonical day count');
    for (const dailyContent of days) {
      const gate = getRelationshipSafetyGate(dailyContent);
      if (!gate || getDailySafetyMode(dailyContent) === 'blocked') continue;
      const day = Number(dailyContent.day);
      const question = getSharedDailyAssistantPromptGroups(day, topicId).flatMap((group) => group.questions)
        .find((item) => item.kind === 'exercise_meaning');
      const base = {
        screen: 'day',
        text: question.value,
        dailyContext: { day, problem: topicName, data: dailyContent, relationshipSafetyConfirmed: false },
      };
      const pending = makePageAssistantTurn(base);
      assert.equal(pending.status, 'relationship_safety_confirmation_required', topicId + ' day ' + day);
      assert.equal(pending.message, gate.question + '\n\n' + gate.disclaimer, topicId + ' day ' + day);
      const unsafe = makePageAssistantTurn({
        ...base,
        dailyContext: { ...base.dailyContext, relationshipSafetyResponse: 'unsafe' },
      });
      assert.equal(unsafe.status, 'relationship_safety_blocked', topicId + ' day ' + day);
      assert.equal(unsafe.message, gate.blockedMessage, topicId + ' day ' + day);
      const safe = makePageAssistantTurn({
        ...base,
        dailyContext: { ...base.dailyContext, relationshipSafetyConfirmed: true, relationshipSafetyResponse: 'safe' },
      });
      assert.equal(safe.status, 'daily_guidance_available', topicId + ' day ' + day);
      checked += 1;
    }
  }
  assert.ok(checked > 100, 'the full registered relationship-gate matrix must be exercised');
});


test('prepared answer rejects mismatched visible guidance identity instead of mixing another day or topic', () => {
  const canonical = {
    id: getCanonicalDailyRecordId('خشم', 1),
    topic_id: 'T01',
    day: 1,
    exercise: 'تمرین معتبر روز اول خشم.',
    actionText: 'اقدام معتبر روز اول خشم.',
  };
  const wrongDay = makePageAssistantTurn({
    screen: 'day',
    text: ANGER_DAILY_ASSISTANT_GUIDES[0].questions[0].value,
    dailyContext: {
      day: 1,
      problem: 'خشم',
      data: canonical,
      relationshipSafetyConfirmed: true,
      guidanceData: {
        id: getCanonicalDailyRecordId('خشم', 2),
        topic_id: 'T01',
        day: 2,
        exercise: 'متن اشتباه روز دوم.',
        action: 'اقدام اشتباه روز دوم.',
      },
    },
  });
  assert.equal(wrongDay.status, 'daily_guidance_unavailable');
  assert.doesNotMatch(wrongDay.message, /متن اشتباه روز دوم|اقدام اشتباه روز دوم/u);

  const wrongTopic = makePageAssistantTurn({
    screen: 'day',
    text: ANGER_DAILY_ASSISTANT_GUIDES[0].questions[0].value,
    dailyContext: {
      day: 1,
      problem: 'خشم',
      data: canonical,
      relationshipSafetyConfirmed: true,
      guidanceData: {
        id: canonical.id,
        topic_id: 'T02',
        day: 1,
        exercise: 'متن اشتباه موضوع دوم.',
        action: 'اقدام اشتباه موضوع دوم.',
      },
    },
  });
  assert.equal(wrongTopic.status, 'daily_guidance_unavailable');
  assert.doesNotMatch(wrongTopic.message, /متن اشتباه موضوع دوم|اقدام اشتباه موضوع دوم/u);
});
