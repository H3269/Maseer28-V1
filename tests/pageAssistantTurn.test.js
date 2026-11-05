import assert from 'node:assert/strict';
import test from 'node:test';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import { getCanonicalDailyRecordId } from '../src/features/content/dailyContentSelector.js';

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

test('daily assistant refuses content whose canonical review gate is blocked', () => {
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
  assert.equal(result.status, 'daily_guidance_unavailable');
  assert.match(result.message, /بازبینی ایمنی/);
  assert.doesNotMatch(result.message, /تمرین مسدود روز اول|راهکار مسدود روز اول/);
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
