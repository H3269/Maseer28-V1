import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { routeSemanticIntake } from '../src/features/assistant/intentContextRouter.js';

const schema = JSON.parse(await readFile(new URL('../public/assistant/schemas/semantic-intake.v1.schema.json', import.meta.url), 'utf8'));

test('router emits the closed semantic-intake contract shape', () => {
  const result = routeSemanticIntake({ text: 'مدتی است اضطراب دارم', requestId: 'case-1' });
  assert.equal(result.schema_version, '1.0.0');
  assert.equal(result.request_id, 'case-1');
  for (const key of schema.required) assert.ok(Object.hasOwn(result, key), `missing ${key}`);
  assert.deepEqual(Object.keys(result).sort(), Object.keys(schema.properties).sort());
  assert.equal(result.topic_candidates[0].topic_id, 'T02');
  assert.equal(result.topic_candidates[0].evidence_quotes.length, 1);
});

test('attributed third-party quotes do not become the user topic', () => {
  const result = routeSemanticIntake({ text: 'دوستم گفت «تو بی‌ارزشی»، ولی من موافق نیستم.' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T23'), false);
  assert.ok(result.uncertainties.length > 0);
});

test('multiple candidate topics request disambiguation rather than false priority', () => {
  const result = routeSemanticIntake({ text: 'هم عصبانی‌ام، هم می‌ترسم.' });
  assert.ok(result.topic_candidates.some((item) => item.topic_id === 'T01'));
  assert.ok(result.topic_candidates.some((item) => item.topic_id === 'T03'));
  assert.equal(result.next_question.purpose, 'topic_disambiguation');
  assert.equal(result.topic_candidates.every((item) => item.role === 'unknown'), true);
});

test('safety-sensitive ambiguous phrases trigger conservative handoff', () => {
  const result = routeSemanticIntake({ text: 'دیگه نمی‌کشم. همه‌چی تمومه.' });
  assert.equal(result.safety_handoff.handoff_required, true);
  assert.equal(result.next_question.purpose, 'safety_clarification');
});

test('correction and negation remain explicit uncertainties', () => {
  const result = routeSemanticIntake({ text: 'من اضطراب ندارم؛ فقط نگران آینده‌ام.' });
  assert.ok(result.uncertainties.some((item) => item.includes('نفی')));
  assert.ok(result.topic_candidates.some((item) => item.topic_id === 'T02'));
});

test('prior structured facts are retained without inventing missing values', () => {
  const result = routeSemanticIntake({
    text: 'در محل کار تحت فشارم',
    priorContext: { situational_facts: { impact: 'اختلال در تمرکز' } },
  });
  assert.equal(result.situational_facts.impact, 'اختلال در تمرکز');
  assert.equal(result.situational_facts.duration, null);
});
