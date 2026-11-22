import assert from 'node:assert/strict';
import test from 'node:test';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import { FEAR_DAILY_ASSISTANT_GUIDES, answerFearDailyPreparedQuestion, getFearDailyAssistantPromptGroups } from '../src/features/assistant/fearDailyAssistantPrompts.js';
import { getCanonicalDailyRecordId } from '../src/features/content/dailyContentSelector.js';
import { ANXIETY_DAILY_ASSISTANT_GUIDES } from '../src/features/assistant/anxietyDailyAssistantPrompts.js';
import { ANGER_DAILY_ASSISTANT_GUIDES } from '../src/features/assistant/angerDailyAssistantPrompts.js';
import { HATRED_DAILY_ASSISTANT_GUIDES, getHatredDailyAssistantPromptGroups } from '../src/features/assistant/hatredDailyAssistantPrompts.js';

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

test('daily page answers pre-authored anxiety questions only with matching canonical topic and day identity', () => {
  const guide = ANXIETY_DAILY_ASSISTANT_GUIDES[0];
  const question = guide.questions.find((item) => item.kind === 'exercise_action_difference');
  const dayData = {
    id: getCanonicalDailyRecordId('اضطراب', 1),
    topic_id: 'T02',
    day: 1,
    risk_level: 'routine',
    exercise: guide.exercise,
    actionText: guide.action,
  };
  const result = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: { day: 1, problem: 'اضطراب', data: dayData },
  });
  assert.equal(result.status, 'daily_guidance_available');

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


test('all exact prepared T03 FAQs answer through the real page router for all 28 days', () => {
  let checked = 0;
  for (const guide of FEAR_DAILY_ASSISTANT_GUIDES) {
    for (const question of guide.questions) {
      const result = makePageAssistantTurn({
        screen: 'day',
        text: question.value,
        dailyContext: {
          day: guide.day,
          problem: 'ترس',
          data: {
            id: getCanonicalDailyRecordId('ترس', guide.day),
            day: guide.day,
            risk_level: 'routine',
          },
          // Mirrors the live DayScreen adapter: legacy canonical source has no
          // topic_id, while splitDayContent preserves the absent identity as null.
          guidanceData: {
            id: getCanonicalDailyRecordId('ترس', guide.day),
            topic_id: null,
            day: guide.day,
          },
          relationshipSafetyConfirmed: false,
        },
      });
      assert.equal(result.status, 'daily_guidance_available');
      checked += 1;
    }
  }
  assert.equal(FEAR_DAILY_ASSISTANT_GUIDES.length, 28);
  assert.equal(checked, 392);
});

test('T03 prepared FAQs accept legacy category-derived identity but reject explicit topic/day conflicts', () => {
  const question = FEAR_DAILY_ASSISTANT_GUIDES[0].questions[0];
  const wrongTopic = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: {
      day: 1,
      problem: 'ترس',
      data: { id: getCanonicalDailyRecordId('اضطراب', 1), topic_id: 'T02', day: 1 },
    },
  });
  assert.equal(wrongTopic.status, 'daily_guidance_unavailable');

  const legacyTopicMissing = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: {
      day: 1,
      problem: 'ترس',
      data: { id: getCanonicalDailyRecordId('ترس', 1), day: 1 },
      guidanceData: { id: getCanonicalDailyRecordId('ترس', 1), topic_id: null, day: 1 },
    },
  });
  assert.equal(legacyTopicMissing.status, 'daily_guidance_available');

  const explicitTopicConflict = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: {
      day: 1,
      problem: 'ترس',
      data: { id: getCanonicalDailyRecordId('ترس', 1), topic_id: 'T02', day: 1 },
    },
  });
  assert.equal(explicitTopicConflict.status, 'daily_guidance_unavailable');

  const wrongDay = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: {
      day: 1,
      problem: 'ترس',
      data: { id: getCanonicalDailyRecordId('ترس', 2), topic_id: 'T03', day: 2 },
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


test('T03 prepared question groups match the five-section presentation used by T01 and T02', () => {
  for (let day = 1; day <= 28; day += 1) {
    const groups = getFearDailyAssistantPromptGroups(day);
    assert.equal(groups.length, 5, `day ${day}`);
    assert.deepEqual(groups.map((group) => group.questions.length), [2, 2, 1, 5, 4]);
    assert.equal(groups.reduce((count, group) => count + group.questions.length, 0), 14);
    assert.deepEqual(groups.map((group) => group.label), [
      'فهم تمرین روز ' + day,
      'فهم اقدام اختصاصی روز ' + day,
      'تفاوت تمرین و اقدام',
      'اجرا و موانع',
      'ارزیابی و ایمنی',
    ]);
  }
  assert.deepEqual(getFearDailyAssistantPromptGroups(29), []);
});

test('T03 prepared answers follow the shared answer hierarchy and remain specific to the selected day', () => {
  const guide = FEAR_DAILY_ASSISTANT_GUIDES[0];
  const exercise = answerFearDailyPreparedQuestion({ day: 1, message: guide.questions.find((item) => item.kind === 'exercise_meaning').value });
  const example = answerFearDailyPreparedQuestion({ day: 1, message: guide.questions.find((item) => item.kind === 'exercise_example').value });
  const action = answerFearDailyPreparedQuestion({ day: 1, message: guide.questions.find((item) => item.kind === 'action_meaning').value });
  assert.match(exercise, /راهنمای روز ۱ ترس/);
  assert.match(exercise, /چرا این تمرین انتخاب شده/);
  assert.match(exercise, /مهارت مورد توجه/);
  assert.match(exercise, /نکته امروز/);
  assert.match(example, /یک مثال فرضی از تمرین امروز/);
  assert.match(example, /ارتباط مثال با تمرین/);
  assert.match(action, /اقدام اختصاصی امروز چیست/);
  assert.match(action, /چطور اجرا کنی/);
  assert.ok(exercise.includes(guide.exercise));
  assert.ok(action.includes(guide.action));
  assert.equal(answerFearDailyPreparedQuestion({ day: 1, message: 'سؤال خارج از فهرست' }), null);
});


test('all 392 prepared T04 questions answer through the real page router for canonical day identity',()=>{
 let checked=0;
 for(const guide of HATRED_DAILY_ASSISTANT_GUIDES){
  for(const question of guide.questions){
   const result=makePageAssistantTurn({screen:'day',text:question.value,dailyContext:{day:guide.day,problem:'نفرت',data:{id:getCanonicalDailyRecordId('نفرت',guide.day),topic_id:'T04',day:guide.day,review_status:'pending_expert_review'},guidanceData:{id:getCanonicalDailyRecordId('نفرت',guide.day),topic_id:'T04',day:guide.day}}});
   assert.equal(result.status, 'daily_guidance_available');checked++;
  }
 }
 assert.equal(checked,392);
});

test('T04 prepared assistant accepts legacy missing topic_id but rejects topic and day conflicts',()=>{
 const q=HATRED_DAILY_ASSISTANT_GUIDES[0].questions[0];
 const legacy=makePageAssistantTurn({screen:'day',text:q.value,dailyContext:{day:1,problem:'نفرت',data:{id:getCanonicalDailyRecordId('نفرت',1),day:1},guidanceData:{id:getCanonicalDailyRecordId('نفرت',1),topic_id:null,day:1}}});
 assert.equal(legacy.status, 'daily_guidance_available');
 const wrongTopic=makePageAssistantTurn({screen:'day',text:q.value,dailyContext:{day:1,problem:'نفرت',data:{id:getCanonicalDailyRecordId('نفرت',1),topic_id:'T18',day:1}}});
 assert.equal(wrongTopic.status,'daily_guidance_unavailable');
 const wrongDay=makePageAssistantTurn({screen:'day',text:q.value,dailyContext:{day:1,problem:'نفرت',data:{id:getCanonicalDailyRecordId('نفرت',2),topic_id:'T04',day:2}}});
 assert.equal(wrongDay.status,'daily_guidance_unavailable');
});

test('T04 urgent safety status preempts prepared Q&A and free-form daily guidance is disabled',()=>{
 const urgent=makePageAssistantTurn({screen:'day',text:'امشب قصد دارم خودم را بکشم.',dailyContext:{day:1,problem:'نفرت',data:{id:getCanonicalDailyRecordId('نفرت',1),topic_id:'T04',day:1}}});
 assert.equal(urgent.status,'urgent_human_support_required');
 const free=makePageAssistantTurn({screen:'day',text:'چرا از یک نفر متنفرم؟',dailyContext:{day:1,problem:'نفرت',data:{id:getCanonicalDailyRecordId('نفرت',1),topic_id:'T04',day:1}}});
 assert.equal(free.status,'prepared_question_required');
 assert.match(free.message,/گفت‌وگوی آزاد برای این موضوع فعال نیست/);
});

test('T04 prompt groups use the same five-section ordering as T01-T03',()=>{
 for(let day=1;day<=28;day++){
  const groups=getHatredDailyAssistantPromptGroups(day);
  assert.deepEqual(groups.map(g=>g.questions.length),[2,2,1,5,4]);
  assert.deepEqual(groups.map(g=>g.label),['فهم تمرین روز '+day,'فهم اقدام اختصاصی روز '+day,'تفاوت تمرین و اقدام','اجرا و موانع','ارزیابی و ایمنی']);
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
