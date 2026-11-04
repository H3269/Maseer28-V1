import test from 'node:test';
import assert from 'node:assert/strict';
import { routeSemanticIntake } from '../src/features/assistant/intentContextRouter.js';

test('negative prefix «نمی» is not mistaken for a positive fear disclosure', () => {
  const result = routeSemanticIntake({ text: 'من از آینده نمی‌ترسم.' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T03'), false);
});

test('negation after a short topic modifier is recognized', () => {
  const result = routeSemanticIntake({ text: 'من از قضاوت دیگران نمی‌ترسم.' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T27'), false);
});

test('a negated behavior topic is not routed as a current problem', () => {
  const result = routeSemanticIntake({ text: 'من دیگر حسادت نمی‌کنم.' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T05'), false);
});

test('affirmative fear remains a topic candidate', () => {
  const result = routeSemanticIntake({ text: 'من از آینده می‌ترسم.' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T03'), true);
});

test('a later affirmative occurrence is preserved after an earlier negated occurrence', () => {
  const result = routeSemanticIntake({ text: 'من از آینده نمی‌ترسم، اما از شکست می‌ترسم.' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T03'), true);
});

test('attributed third-party negation does not become the user topic', () => {
  const result = routeSemanticIntake({ text: 'دوستم گفت «من از آینده نمی‌ترسم».' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T03'), false);
});
