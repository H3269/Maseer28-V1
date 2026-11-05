import assert from 'node:assert/strict';
import test from 'node:test';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';

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

test('unsupported page questions fall back to the existing assistant router', () => {
  const result = makePageAssistantTurn({
    screen: 'report',
    text: 'آیا وضعیت من در این مسیر بهتر شده است؟',
  });
  assert.notEqual(result.status, 'page_guidance_available');
  assert.ok(typeof result.message === 'string' && result.message.length > 0);
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

test('unrecognized replies do not get guessed as a scope answer', () => {
  const first = makePageAssistantTurn({ screen: 'dashboard', text: 'چه راهکاری برای اضطراب وجود دارد؟' });
  const second = makePageAssistantTurn({
    screen: 'dashboard',
    text: 'شاید بعداً',
    conversationState: first.conversationState,
  });
  assert.notEqual(second.scope_resolution, 'personal');
  assert.notEqual(second.scope_resolution, 'general');
  assert.equal(second.status, 'clarification_required');
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
