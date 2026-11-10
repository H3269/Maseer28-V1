import assert from 'node:assert/strict';
import test from 'node:test';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import { FEAR_DAILY_ASSISTANT_GUIDES, answerFearDailyPreparedQuestion, getFearDailyAssistantPromptGroups } from '../src/features/assistant/fearDailyAssistantPrompts.js';
import { getCanonicalDailyRecordId } from '../src/features/content/dailyContentSelector.js';
import { ANXIETY_DAILY_ASSISTANT_GUIDES } from '../src/features/assistant/anxietyDailyAssistantPrompts.js';
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

test('urgent safety handoff takes precedence over page help', () => {
  const result = makePageAssistantTurn({
    screen: 'dashboard',
    text: 'می‌خواهم خودم را بکشم؛ اینجا چه کار کنم؟',
  });
  assert.equal(result.status, 'urgent_human_support_required');
  assert.deepEqual(result.knowledge, []);
});

test('personal requests do not become page instructions or invented advice', () => {
  const result = makePageAssistantTurn({
    screen: 'dashboard',
    text: 'من برای اضطرابم چه راهکاری انجام بدهم؟',
  });
  assert.notEqual(result.status, 'page_guidance_available');
  assert.equal(result.status, 'personal_intake_required');
  assert.deepEqual(result.knowledge, []);
});

test('unsupported non-dashboard questions stay inside the current page scope', () => {
  const result = makePageAssistantTurn({
    screen: 'report',
    text: 'آیا وضعیت من در این مسیر بهتر شده است؟',
  });
  assert.equal(result.status, 'page_scope_required');
  assert.match(result.message, /فقط درباره محتوای همین صفحه/);
});

test('empty and overlong messages preserve the router input guards', () => {
  assert.equal(makePageAssistantTurn({ screen: 'books', text: '   ' }).status, 'invalid_input');
  assert.equal(makePageAssistantTurn({ screen: 'books', text: 'x'.repeat(3001) }).status, 'input_too_long');
});

test('a personal disclosure cannot be overridden by a page-purpose question', () => {
  const result = makePageAssistantTurn({
    screen: 'dashboard',
    text: 'من اضطراب دارم؛ این صفحه برای چیست؟',
  });
  assert.equal(result.status, 'personal_intake_required');
  assert.deepEqual(result.knowledge, []);
});

test('ambiguous personal topics cannot be overridden by page guidance', () => {
  const result = makePageAssistantTurn({
    screen: 'dashboard',
    text: 'هم عصبانی‌ام و هم می‌ترسم؛ این صفحه برای چیست؟',
  });
  assert.equal(result.status, 'clarification_required');
  assert.deepEqual(result.knowledge, []);
});

test('general strategy scope clarification cannot be overridden by page guidance', () => {
  const result = makePageAssistantTurn({
    screen: 'dashboard',
    text: 'چه راهکاری برای اضطراب وجود دارد؟ این صفحه برای چیست؟',
  });
  assert.equal(result.status, 'intent_scope_clarification_required');
  assert.deepEqual(result.knowledge, []);
});

test('scope clarification is resolved by a personal answer and resumes the original question once', () => {
  const first = makePageAssistantTurn({ screen: 'dashboard', text: 'چه راهکاری برای اضطراب وجود دارد؟' });
  assert.equal(first.status, 'intent_scope_clarification_required');
  assert.equal(first.conversationState.pendingScope.text, 'چه راهکاری برای اضطراب وجود دارد؟');

  const second = makePageAssistantTurn({
    screen: 'dashboard',
    text: 'برای خودم',
    conversationState: first.conversationState,
  });
  assert.equal(second.status, 'personal_intake_required');
  assert.equal(second.scope_resolution, 'personal');
  assert.equal(second.conversationState, null);
  assert.deepEqual(second.knowledge, []);
});

test('scope clarification can resolve to general information without inventing missing knowledge', () => {
  const first = makePageAssistantTurn({ screen: 'dashboard', text: 'چه راهکاری برای اضطراب وجود دارد؟' });
  const second = makePageAssistantTurn({
    screen: 'dashboard',
    text: 'اطلاعات عمومی می‌خواهم',
    conversationState: first.conversationState,
  });
  assert.equal(second.status, 'knowledge_unavailable');
  assert.equal(second.scope_resolution, 'general');
  assert.deepEqual(second.knowledge, []);
});

test('an unsafe scope reply is handed off before the original question is resumed', () => {
  const first = makePageAssistantTurn({ screen: 'dashboard', text: 'چه راهکاری برای اضطراب وجود دارد؟' });
  const second = makePageAssistantTurn({
    screen: 'dashboard',
    text: 'برای خودم؛ امشب قصد دارم خودم را بکشم.',
    conversationState: first.conversationState,
  });
  assert.equal(second.status, 'urgent_human_support_required');
  assert.equal(second.conversationState, null);
  assert.deepEqual(second.knowledge, []);
});

test('one unrecognized scope reply preserves the original question for one explicit retry', () => {
  const first = makePageAssistantTurn({ screen: 'dashboard', text: 'چه راهکاری برای اضطراب وجود دارد؟' });
  const second = makePageAssistantTurn({
    screen: 'dashboard',
    text: 'شاید بعداً',
    conversationState: first.conversationState,
  });
  assert.equal(second.status, 'intent_scope_clarification_required');
  assert.match(second.message, /تجربه و وضعیت شخصی خودت است یا اطلاعات عمومی/);
  assert.equal(second.conversationState.pendingScope.text, 'چه راهکاری برای اضطراب وجود دارد؟');
  assert.equal(second.conversationState.pendingScope.clarificationAttempts, 1);

  const third = makePageAssistantTurn({
    screen: 'dashboard',
    text: 'برای خودم',
    conversationState: second.conversationState,
  });
  assert.equal(third.status, 'personal_intake_required');
  assert.equal(third.scope_resolution, 'personal');
  assert.equal(third.conversationState, null);
});

test('a second unrecognized scope reply clears pending context and prevents a clarification loop', () => {
  const first = makePageAssistantTurn({ screen: 'dashboard', text: 'چه راهکاری برای اضطراب وجود دارد؟' });
  const second = makePageAssistantTurn({
    screen: 'dashboard',
    text: 'شاید بعداً',
    conversationState: first.conversationState,
  });
  const third = makePageAssistantTurn({
    screen: 'dashboard',
    text: 'نمی‌دانم',
    conversationState: second.conversationState,
  });
  assert.equal(third.status, 'clarification_required');
  assert.equal(third.conversationState, null);
  assert.equal(third.scope_resolution, undefined);
});

test('pending scope context is discarded when the user changes screens', () => {
  const first = makePageAssistantTurn({ screen: 'dashboard', text: 'چه راهکاری برای اضطراب وجود دارد؟' });
  const second = makePageAssistantTurn({
    screen: 'books',
    text: 'برای خودم',
    conversationState: first.conversationState,
  });
  assert.notEqual(second.scope_resolution, 'personal');
  assert.equal(second.conversationState, null);
});


test('daily page uses the local canonical day guidance engine with the selected topic and day', () => {
  const dayData = {
    id: getCanonicalDailyRecordId('خشم', 1),
    day: 1,
    exercise: 'سه موقعیت اخیر را که در آن عصبانی شدی، بدون قضاوت یادداشت کن.',
    actionText: 'امروز فقط یک موقعیت را انتخاب کن و شدت احساس را از صفر تا ده ثبت کن.',
  };
  const result = makePageAssistantTurn({
    screen: 'day',
    text: 'چطور انجامش بدم؟',
    dailyContext: { day: 1, problem: 'خشم', data: dayData, relationshipSafetyConfirmed: true },
  });
  assert.equal(result.status, 'daily_guidance_available');
  assert.match(result.message, /خشم/);
  assert.match(result.message, /روز 1/);
  assert.match(result.message, /سه موقعیت اخیر/);
  assert.match(result.message, /فقط یک موقعیت/);
  assert.ok(result.conversationState?.dailyState);
});

test('daily assistant does not block guidance based on canonical review status', () => {
  const dayData = {
    id: getCanonicalDailyRecordId('خشم', 1),
    topic_id: 'T01',
    day: 1,
    review_status: 'draft',
    risk_level: 'routine',
    exercise: 'تمرین مسدود روز اول.',
    actionText: 'راهکار مسدود روز اول.',
  };
  const result = makePageAssistantTurn({
    screen: 'day',
    text: 'چطور انجامش بدم؟',
    dailyContext: { day: 1, problem: 'خشم', data: dayData, relationshipSafetyConfirmed: true },
  });
  assert.equal(result.status, 'daily_guidance_available');
  assert.match(result.message, /تمرین مسدود روز اول/);
  assert.match(result.message, /راهکار مسدود روز اول/);
});

test('library book-list questions use only the currently available local titles', () => {
  const result = makePageAssistantTurn({
    screen: 'books',
    text: 'چه کتاب‌هایی در کتابخانه داریم؟',
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

test('app-wide topic registry is searchable from a non-dashboard page and reports draft status', () => {
  const result = makePageAssistantTurn({
    screen: 'profile',
    text: 'فهرست ۳۴ موضوع مسیر چیست؟',
  });
  assert.equal(result.status, 'page_guidance_available');
  assert.match(result.message, /خشم/);
  assert.match(result.message, /ترس از طرد شدن/);
  assert.match(result.message, /پیش‌نویس/);
  assert.match(result.message, /بازبینی تخصصی/);
});

test('topic subtopic lookup returns names but never presents draft definitions as approved facts', () => {
  const result = makePageAssistantTurn({
    screen: 'support',
    text: 'زیرموضوع‌های خشم چیست؟',
  });
  assert.equal(result.status, 'page_guidance_available');
  assert.match(result.message, /محرک‌ها و ارزیابی موقعیت/);
  assert.match(result.message, /نشانه‌های بدنی و برانگیختگی/);
  assert.match(result.message, /پیش‌نویس/);
  assert.doesNotMatch(result.message, /تعریف قطعی/);
});

test('dashboard can answer app topic index questions without depending on the empty approved-content catalog', () => {
  const result = makePageAssistantTurn({
    screen: 'dashboard',
    text: 'فهرست موضوعات مسیر چیست؟',
  });
  assert.equal(result.status, 'page_guidance_available');
  assert.match(result.message, /34 مورد/);
  assert.match(result.message, /پیش‌نویس/);
});

test('personal-intake and ambiguity routes still take precedence over app topic lookup', () => {
  const result = makePageAssistantTurn({
    screen: 'dashboard',
    text: 'من برای اضطرابم چه راهکاری انجام بدهم؟',
  });
  assert.equal(result.status, 'personal_intake_required');
  assert.deepEqual(result.knowledge, []);
});


test('daily page answers pre-authored anxiety questions only with matching canonical topic and day identity', () => {
  const guide = ANXIETY_DAILY_ASSISTANT_GUIDES[0];
  const question = guide.questions.find((item) => item.kind === 'exercise_action_difference');
  const dayData = {
    id: getCanonicalDailyRecordId('اضطراب', 1),
    topic_id: 'T02',
    day: 1,
    review_status: 'draft',
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
  assert.match(result.message, /راهنمای روز 1 اضطراب/);
  assert.ok(result.message.includes(guide.exercise));
  assert.ok(result.message.includes(guide.action));

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


test('all exact prepared T03 FAQs answer through the real page router for all 28 days despite review gates', () => {
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
            review_status: 'pending_expert_review',
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
      assert.equal(result.status, 'daily_guidance_available', `T03 prepared FAQ must answer on day ${guide.day}: ${question.id}`);
      assert.match(result.message, new RegExp('راهنمای روز'));
      assert.doesNotMatch(result.message, /نیاز به بازبینی ایمنی|بررسی ایمنی همین روز/u);
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
      data: { id: getCanonicalDailyRecordId('اضطراب', 1), topic_id: 'T02', day: 1, review_status: 'pending_expert_review' },
    },
  });
  assert.equal(wrongTopic.status, 'daily_guidance_unavailable');

  const legacyTopicMissing = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: {
      day: 1,
      problem: 'ترس',
      data: { id: getCanonicalDailyRecordId('ترس', 1), day: 1, review_status: 'pending_expert_review' },
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
      data: { id: getCanonicalDailyRecordId('ترس', 2), topic_id: 'T03', day: 2, review_status: 'pending_expert_review' },
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
        review_status: 'pending_expert_review',
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
   assert.equal(result.status,'daily_guidance_available',`T04 day ${guide.day} question ${question.id}`);
   assert.match(result.message,/راهنمای روز/);checked++;
  }
 }
 assert.equal(checked,392);
});

test('T04 prepared assistant accepts legacy missing topic_id but rejects topic and day conflicts',()=>{
 const q=HATRED_DAILY_ASSISTANT_GUIDES[0].questions[0];
 const legacy=makePageAssistantTurn({screen:'day',text:q.value,dailyContext:{day:1,problem:'نفرت',data:{id:getCanonicalDailyRecordId('نفرت',1),day:1},guidanceData:{id:getCanonicalDailyRecordId('نفرت',1),topic_id:null,day:1}}});
 assert.equal(legacy.status,'daily_guidance_available');
 const wrongTopic=makePageAssistantTurn({screen:'day',text:q.value,dailyContext:{day:1,problem:'نفرت',data:{id:getCanonicalDailyRecordId('نفرت',1),topic_id:'T18',day:1}}});
 assert.equal(wrongTopic.status,'daily_guidance_unavailable');
 const wrongDay=makePageAssistantTurn({screen:'day',text:q.value,dailyContext:{day:1,problem:'نفرت',data:{id:getCanonicalDailyRecordId('نفرت',2),topic_id:'T04',day:2}}});
 assert.equal(wrongDay.status,'daily_guidance_unavailable');
});

test('T04 urgent safety status preempts prepared Q&A and free-form daily guidance is disabled',()=>{
 const urgent=makePageAssistantTurn({screen:'day',text:'امشب قصد دارم خودم را بکشم.',dailyContext:{day:1,problem:'نفرت',data:{id:getCanonicalDailyRecordId('نفرت',1),topic_id:'T04',day:1}}});
 assert.equal(urgent.status,'urgent_human_support_required');
 const free=makePageAssistantTurn({screen:'day',text:'چرا از یک نفر متنفرم؟',dailyContext:{day:1,problem:'نفرت',data:{id:getCanonicalDailyRecordId('نفرت',1),topic_id:'T04',day:1}}});
 assert.equal(free.status,'daily_guidance_unavailable');
 assert.match(free.message,/فقط سؤال‌های آماده/);
});

test('T04 prompt groups use the same five-section ordering as T01-T03',()=>{
 for(let day=1;day<=28;day++){
  const groups=getHatredDailyAssistantPromptGroups(day);
  assert.deepEqual(groups.map(g=>g.questions.length),[2,2,1,5,4]);
  assert.deepEqual(groups.map(g=>g.label),['فهم تمرین روز '+day,'فهم اقدام اختصاصی روز '+day,'تفاوت تمرین و اقدام','اجرا و موانع','ارزیابی و ایمنی']);
 }
});
