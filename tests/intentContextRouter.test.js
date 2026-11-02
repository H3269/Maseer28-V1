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

test('safety-sensitive ambiguous phrases trigger direct clarification without automatic handoff', () => {
  const result = routeSemanticIntake({ text: 'دیگه نمی‌کشم. همه‌چی تمومه.' });
  assert.equal(result.safety_handoff.handoff_required, false);
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


test('quoted third-party safety language is not treated as the current user intent', () => {
  const result = routeSemanticIntake({ text: 'دوستم گفت «می‌خواهم خودکشی کنم»، من نگران او هستم.' });
  assert.equal(result.safety_handoff.handoff_required, false);
  assert.ok(result.uncertainties.some((item) => item.includes('نقل‌قول')));
  assert.equal(result.next_question.purpose, 'safety_clarification');
});

test('a negated safety phrase requests clarification but does not trigger automatic handoff', () => {
  const result = routeSemanticIntake({ text: 'من قصد خودکشی ندارم و برنامه‌ای برای آسیب به خودم ندارم.' });
  assert.equal(result.safety_handoff.handoff_required, false);
  assert.ok(result.uncertainties.some((item) => item.includes('نفی')));
});

test('explicit immediate intent is distinguished from a generic safety keyword', () => {
  const result = routeSemanticIntake({ text: 'امشب قصد دارم خودم را بکشم.' });
  assert.equal(result.safety_handoff.handoff_required, true);
  assert.equal(result.next_question.purpose, 'safety_clarification');
});

test('semantic output is deeply immutable', () => {
  const result = routeSemanticIntake({ text: 'مدتی است اضطراب دارم' });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.intent), true);
  assert.equal(Object.isFrozen(result.topic_candidates), true);
  assert.throws(() => result.topic_candidates.push({ topic_id: 'T34' }), TypeError);
});


test('informational requests do not create personal topic hypotheses', () => {
  const result = routeSemanticIntake({ text: 'من فقط برای ترجمه یک متن درباره اضطراب سؤال دارم؛ خودم چنین تجربه‌ای ندارم.' });
  assert.equal(result.intent.label, 'general_information');
  assert.deepEqual(result.topic_candidates, []);
  assert.equal(result.next_question, null);
});

test('a corrected meaning takes precedence over an earlier quoted label', () => {
  const result = routeSemanticIntake({ text: 'وقتی می‌گویم «از خودم متنفرم»، منظورم این است که از رفتار دیروزم خجالت می‌کشم.' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T18'), false);
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T26'), true);
});

test('active threat at home is separated from generic topic matching', () => {
  const result = routeSemanticIntake({ text: 'از همسرم می‌ترسم؛ دیشب تهدیدم کرد و الان هم خانه امن نیست.' });
  assert.equal(result.safety_handoff.handoff_required, true);
  assert.equal(result.next_question.purpose, 'safety_clarification');
});


test('router output conforms to nested enum and length constraints in the schema', () => {
  const result = routeSemanticIntake({
    text: 'من هم نگران آینده‌ام و هم از قضاوت دیگران می‌ترسم؛ می‌خواهم بدانم چه کار کنم.',
    requestId: 'schema-case',
    priorContext: { situational_facts: { impact: 'اختلال در تمرکز', duration: 'چند هفته' } },
  });
  assert.ok(schema.properties.intent.properties.label.enum.includes(result.intent.label));
  assert.ok(schema.properties.intent.properties.ambiguity.enum.includes(result.intent.ambiguity));
  assert.deepEqual(Object.keys(result.situational_facts).sort(), Object.keys(schema.properties.situational_facts.properties).sort());
  assert.ok(result.topic_candidates.length <= schema.properties.topic_candidates.maxItems);
  for (const item of result.topic_candidates) {
    assert.match(item.topic_id, /^T(0[1-9]|[12][0-9]|3[0-4])$/);
    assert.ok(['primary', 'accompanying', 'unknown'].includes(item.role));
    assert.ok(['low', 'moderate', 'high', 'not_assessed'].includes(item.confidence_band));
    assert.ok(item.evidence_quotes.length >= 1 && item.evidence_quotes.length <= 4);
    assert.ok(typeof item.uncertainty_reason === 'string' || item.uncertainty_reason === null);
  }
  assert.ok(result.uncertainties.length <= 10);
  assert.ok(result.contradictions.length <= 10);
  if (result.next_question) {
    assert.ok(schema.properties.next_question.properties.purpose.enum.includes(result.next_question.purpose));
    assert.ok(result.next_question.text.length <= 500);
    assert.ok(result.next_question.discriminates_between.length <= 3);
  }
  assert.equal(result.safety_handoff.trigger_evidence.length <= 5, true);
  assert.ok(result.limitations.length >= 1 && result.limitations.length <= 10);
});
