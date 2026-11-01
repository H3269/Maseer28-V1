import test from 'node:test';
import assert from 'node:assert/strict';
import { formatAssistantPrompt } from '../src/features/assistant/assistantPreferences.js';

const question = { prompt: 'یک موقعیت مشخص را تعریف می‌کنی؟', stage: 'differential_clarification' };

test('supportive, direct, detail, and example preferences change non-safety prompts', () => {
  const supportive = formatAssistantPrompt(question, { communication_style: 'supportive', response_detail: 'detailed', example_style: 'practical' });
  assert.match(supportive, /با آرامش/);
  assert.match(supportive, /نمونه واقعی/);
  assert.match(supportive, /لازم نیست حدس بزنی/);
  const direct = formatAssistantPrompt(question, { communication_style: 'direct', example_style: 'conceptual' });
  assert.match(direct, /پاسخ کوتاه/);
  assert.match(direct, /الگوی کلی/);
});

test('safety prompts are never altered by personalization preferences', () => {
  const safety = { prompt: 'آیا همین الآن در خطر هستی؟', stage: 'safety_check' };
  assert.equal(formatAssistantPrompt(safety, { communication_style: 'supportive', response_detail: 'detailed', example_style: 'conceptual' }), safety.prompt);
});

test('missing question returns an empty prompt', () => {
  assert.equal(formatAssistantPrompt(null, {}), '');
});
