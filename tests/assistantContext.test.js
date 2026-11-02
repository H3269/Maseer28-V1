import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSISTANT_CONTEXT_TTL_MS,
  buildAssistantContext,
  validateAssistantContext,
} from '../src/features/assistant/assistantContext.v1.js';

const now = '2026-11-02T12:00:00.000Z';
const journeyConsent = { granted: true };
const memoryConsent = { granted: true };
const consent = (journey = false, memory = false) => ({
  purposes: {
    journey_context: journey ? journeyConsent : { granted: false },
    long_term_ai_memory: memory ? memoryConsent : { granted: false },
  },
});

test('no consent means no personal context is included', () => {
  const context = buildAssistantContext({
    journey: { active_day: 9, completed_days_count: 8, current_goal: 'understand' },
    preferences: { response_detail: 'detailed', communication_style: 'supportive', example_style: 'practical' },
    consentState: consent(),
    now,
  });
  assert.deepEqual(context.entries, []);
  assert.equal(validateAssistantContext(context, { now }).valid, true);
});

test('journey context and interaction preferences require separate independent consent', () => {
  const context = buildAssistantContext({
    journey: { active_day: 9, completed_days_count: 8, current_goal: 'understand' },
    preferences: { response_detail: 'detailed', communication_style: 'supportive', example_style: 'practical' },
    consentState: consent(true, false),
    now,
  });
  assert.deepEqual(context.entries.map((item) => item.key), ['active_day', 'completed_days_count', 'current_goal']);
  assert.ok(context.entries.every((item) => item.consent_purpose === 'journey_context'));
  assert.equal(validateAssistantContext(context, { now }).valid, true);
});

test('saved interaction preferences are not inferred from journey consent', () => {
  const context = buildAssistantContext({
    journey: { active_day: 9 },
    preferences: { response_detail: 'detailed', communication_style: 'supportive' },
    consentState: consent(false, true),
    now,
  });
  assert.deepEqual(context.entries.map((item) => item.key), ['response_detail', 'communication_style']);
  assert.ok(context.entries.every((item) => item.consent_purpose === 'long_term_ai_memory'));
});

test('unapproved, malformed, or out-of-range values are omitted by the builder', () => {
  const context = buildAssistantContext({
    journey: { active_day: 29, completed_days_count: -1, current_goal: 'diagnosis' },
    preferences: { response_detail: 'extreme', communication_style: 'clinical', example_style: 'mixed' },
    consentState: consent(true, true),
    now,
  });
  assert.deepEqual(context.entries.map((item) => item.key), ['example_style']);
});

test('context excludes raw text, identity, diagnosis, risk and archive fields', () => {
  const context = buildAssistantContext({
    journey: {
      active_day: 3,
      user_name: 'نام',
      raw_answers: ['متن خصوصی'],
      diagnosis: 'anxiety',
      risk_history: 'private',
      archive: [{ id: 'old-path' }],
    },
    consentState: consent(true, false),
    now,
  });
  assert.deepEqual(context.entries.map((item) => item.key), ['active_day']);
  assert.equal(JSON.stringify(context).includes('متن خصوصی'), false);
});

test('validator rejects unknown keys and forged provenance', () => {
  const context = buildAssistantContext({
    journey: { active_day: 3 },
    consentState: consent(true, false),
    now,
  });
  const forged = {
    ...context,
    entries: [...context.entries, {
      key: 'diagnosis', value: 'anxiety', source: 'app_journey_state',
      observed_at: context.created_at, expires_at: context.expires_at, consent_purpose: 'journey_context',
    }],
  };
  const result = validateAssistantContext(forged, { now });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('not allowlisted')));
});

test('validator rejects context older than its expiry or beyond the 24-hour maximum', () => {
  const context = buildAssistantContext({ consentState: consent(), now });
  assert.equal(validateAssistantContext(context, { now: new Date(Date.parse(now) + ASSISTANT_CONTEXT_TTL_MS).toISOString() }).valid, false);
  const extended = { ...context, expires_at: new Date(Date.parse(now) + ASSISTANT_CONTEXT_TTL_MS + 1).toISOString() };
  assert.equal(validateAssistantContext(extended, { now }).valid, false);
});

test('entries cannot outlive or claim a different observation time than the context envelope', () => {
  const context = buildAssistantContext({
    journey: { active_day: 3 },
    consentState: consent(true, false),
    now,
  });
  const changed = { ...context, entries: context.entries.map((item) => ({ ...item, observed_at: '2026-11-01T12:00:00.000Z' })) };
  assert.equal(validateAssistantContext(changed, { now }).valid, false);
});
