import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAssistantContext } from '../src/features/assistant/assistantContext.v1.js';
import { createAssessmentSession, submitAssessmentAnswer, stopAssessment } from '../src/features/assistant/assessmentEngine.js';

const now = '2026-11-09T12:00:00.000Z';
const granted = { purposes: { journey_context: { granted: true } } };
const withdrawn = { purposes: { journey_context: { granted: false } } };

test('assessment session accepts only valid, consented, minimal journey context', () => {
  const context = buildAssistantContext({
    journey: { active_day: 4, completed_days_count: 3 },
    consentState: granted,
    now,
  });
  const session = createAssessmentSession({ assistantContext: context, consentState: granted, now });
  assert.deepEqual(session.assistant_context.entries.map((item) => item.key), ['active_day', 'completed_days_count']);
  assert.equal(session.processing, 'local_in_memory_only');
});

test('assessment session rejects journey context when consent is absent', () => {
  const context = buildAssistantContext({
    journey: { active_day: 4 },
    consentState: granted,
    now,
  });
  const session = createAssessmentSession({ assistantContext: context, consentState: withdrawn, now });
  assert.equal(session.assistant_context, null);
});

test('assessment session clears journey context immediately after consent withdrawal', () => {
  const context = buildAssistantContext({
    journey: { active_day: 4 },
    consentState: granted,
    now,
  });
  const session = createAssessmentSession({ assistantContext: context, consentState: granted, now });
  const updated = submitAssessmentAnswer(session, 'می‌خواهم درباره یک موقعیت صحبت کنم', {
    consentState: withdrawn,
    now,
  });
  assert.equal(updated.assistant_context, null);
});

test('assessment session clears expired context and stop removes all context', () => {
  const context = buildAssistantContext({
    journey: { active_day: 4 },
    consentState: granted,
    now,
  });
  const session = createAssessmentSession({ assistantContext: context, consentState: granted, now });
  const expiredAt = new Date(Date.parse(now) + 25 * 60 * 60 * 1000).toISOString();
  const expired = submitAssessmentAnswer(session, 'می‌خواهم درباره یک موقعیت صحبت کنم', {
    consentState: granted,
    now: expiredAt,
  });
  assert.equal(expired.assistant_context, null);
  assert.equal(stopAssessment(session).assistant_context, null);
});
