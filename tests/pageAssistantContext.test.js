import assert from 'node:assert/strict';
import test from 'node:test';
import {
  answerPageAssistantQuestion,
  getPageAssistantContext,
  PAGE_ASSISTANT_CONTEXT_SCREENS,
} from '../src/features/assistant/pageAssistantContext.js';

test('page context is a fixed allowlist and excludes journey or profile records', () => {
  assert.deepEqual(PAGE_ASSISTANT_CONTEXT_SCREENS, [
    'dashboard', 'profile', 'pathSetup', 'day', 'dailyResult',
    'books', 'support', 'final', 'done', 'report', 'archive',
  ]);
  const context = getPageAssistantContext('report');
  assert.deepEqual(Object.keys(context), ['screen', 'label', 'purpose', 'actions', 'returnHint']);
  assert.equal(Object.hasOwn(context, 'journey'), false);
  assert.equal(Object.hasOwn(context, 'userProfile'), false);
  assert.equal(Object.hasOwn(context, 'answers'), false);
  assert.equal(Object.hasOwn(context, 'phone'), false);
  assert.equal(Object.hasOwn(context, 'medical'), false);
  assert.equal(Object.isFrozen(context), true);
  assert.equal(Object.isFrozen(context.actions), true);
});

test('page context describes only fixed visible capabilities for each supported screen', () => {
  const cases = [
    ['dashboard', 'ادامه مسیر امروز'],
    ['profile', 'ذخیره تغییرات'],
    ['pathSetup', 'انتخاب موضوع مسیر'],
    ['day', 'راهنمای متنی همان روز'],
    ['dailyResult', 'خودگزارشی'],
    ['books', 'بازکردن کتاب'],
    ['support', 'راه‌های ارتباط'],
    ['final', 'ارزیابی خودگزارشی'],
    ['done', 'مشاهده گزارش'],
    ['report', 'ابزار تشخیص'],
    ['archive', 'حذف انتخابی'],
  ];
  for (const [screen, expected] of cases) {
    const context = getPageAssistantContext(screen);
    assert.ok(
      [context.label, context.purpose, ...context.actions].join(' ').includes(expected),
      `expected ${screen} context to include its grounded page capability`,
    );
  }
});

test('answers what actions are available on the current page', () => {
  const answer = answerPageAssistantQuestion({
    screen: 'books',
    message: 'اینجا چه کارهایی می‌توانم انجام بدهم؟',
  });
  assert.match(answer, /کتابخانه/);
  assert.match(answer, /بازکردن کتاب/);
});

test('answers page-purpose and return-navigation questions from fixed context', () => {
  const purpose = answerPageAssistantQuestion({
    screen: 'dailyResult',
    message: 'این صفحه برای چیست؟',
  });
  assert.match(purpose, /خودگزارشی/);

  const navigation = answerPageAssistantQuestion({
    screen: 'support',
    message: 'چطور به خانه برگردم؟',
  });
  assert.match(navigation, /خانه/);
});

test('unknown screens and unsupported questions fail closed without guessing', () => {
  assert.equal(getPageAssistantContext('unregistered-screen').screen, 'unknown');
  assert.equal(answerPageAssistantQuestion({
    screen: 'unregistered-screen',
    message: 'اینجا چه کارهایی می‌توانم انجام بدهم؟',
  }), null);
  assert.equal(answerPageAssistantQuestion({
    screen: 'dashboard',
    message: 'آیا وضعیت شخصی من بهتر شده است؟',
  }), null);
  assert.equal(answerPageAssistantQuestion({
    screen: 'dashboard',
    message: '',
  }), null);
});

test('extra personal data passed by a caller is ignored and never enters page context', () => {
  const privatePayload = {
    userProfile: { name: 'نام آزمایشی', phone: 'شماره آزمایشی', medical: 'اطلاعات آزمایشی' },
    journey: { answers: { 1: 'پاسخ آزمایشی' }, profileData: { problem: 'موضوع آزمایشی' } },
  };
  const context = getPageAssistantContext('report', privatePayload);
  const answer = answerPageAssistantQuestion({
    screen: 'report',
    message: 'این صفحه برای چیست؟',
    ...privatePayload,
  });
  const serialized = JSON.stringify({ context, answer });
  assert.equal(serialized.includes('شماره آزمایشی'), false);
  assert.equal(serialized.includes('اطلاعات آزمایشی'), false);
  assert.equal(serialized.includes('پاسخ آزمایشی'), false);
  assert.equal(serialized.includes('موضوع آزمایشی'), false);
});
