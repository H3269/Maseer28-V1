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
