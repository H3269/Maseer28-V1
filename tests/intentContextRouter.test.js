import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { routeSemanticIntake, ROUTED_TOPIC_IDS } from '../src/features/assistant/intentContextRouter.js';

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

test('explicit self-hatred routes to T18 rather than duplicating the T04 candidate', () => {
  const result = routeSemanticIntake({ text: 'من از خودم متنفرم.' });
  assert.deepEqual(result.topic_candidates.map((item) => item.topic_id), ['T18']);
  assert.equal(result.next_question, null);
});

test('explicit hatred toward another person remains T04 and mixed targets remain ambiguous', () => {
  const otherDirected = routeSemanticIntake({ text: 'من از همکارم متنفرم.' });
  assert.deepEqual(otherDirected.topic_candidates.map((item) => item.topic_id), ['T04']);
  const mixed = routeSemanticIntake({ text: 'من از خودم متنفرم و از همکارم هم متنفرم.' });
  assert.ok(mixed.topic_candidates.some((item) => item.topic_id === 'T18'));
  assert.ok(mixed.topic_candidates.some((item) => item.topic_id === 'T04'));
  assert.equal(mixed.next_question.purpose, 'topic_disambiguation');
});

test('repeated calls alone require context before inferring emotional dependence', () => {
  const result = routeSemanticIntake({ text: 'وقتی جواب نمی‌دهد، چندین بار زنگ می‌زنم.' });
  assert.ok(result.topic_candidates.some((item) => item.topic_id === 'T08'));
  assert.equal(result.intent.ambiguity, 'high');
  assert.equal(result.next_question.purpose, 'topic_disambiguation');
  assert.equal(result.next_question.text, 'وقتی چند بار تماس می‌گیری، هدف اصلی چیست؟');
  assert.ok(result.uncertainties.some((item) => item.includes('تکرار تماس به‌تنهایی')));
});

test('explicitly rejected jealousy labels do not route as T05', () => {
  const negated = routeSemanticIntake({ text: 'این حسادت نیست؛ فقط غبطه است.' });
  assert.equal(negated.topic_candidates.some((item) => item.topic_id === 'T05'), false);
  assert.ok(negated.uncertainties.some((item) => item.includes('نفی')));
  assert.equal(negated.next_question.purpose, 'topic_disambiguation');
  const denied = routeSemanticIntake({ text: 'من حسادت ندارم.' });
  assert.equal(denied.topic_candidates.some((item) => item.topic_id === 'T05'), false);
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

test('additive «در واقع» wording preserves earlier semantic evidence', () => {
  const result = routeSemanticIntake({ text: 'مدتی است اضطراب دارم. در واقع در محل کار هم با خشم و عصبانیت درگیر می‌شوم.' });
  const ids = result.topic_candidates.map((item) => item.topic_id);
  assert.ok(ids.includes('T02'));
  assert.ok(ids.includes('T01'));
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

test('direct first-person future and ongoing harm declarations trigger the urgent safety route', () => {
  for (const text of ['امشب خودکشی می‌کنم.', 'من امشب خودم را می‌کشم.', 'به خودم آسیب می‌زنم.']) {
    const result = routeSemanticIntake({ text });
    assert.equal(result.safety_handoff.handoff_required, true, text);
  }

  const negated = routeSemanticIntake({ text: 'امشب خودکشی نمی‌کنم.' });
  assert.equal(negated.safety_handoff.handoff_required, false);
  assert.equal(negated.next_question.purpose, 'safety_clarification');

  const thirdParty = routeSemanticIntake({ text: 'دوستم امشب خودکشی می‌کند.' });
  assert.equal(thirdParty.safety_handoff.handoff_required, false);
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

test('short direct educational questions are classified as general information', () => {
  const result = routeSemanticIntake({ text: 'اضطراب چیست؟' });
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


test('router bounds identifiers and rejects non-string situational facts safely', () => {
  const result = routeSemanticIntake({
    text: 'یک تجربه نامشخص دارم',
    requestId: '  ' + 'x'.repeat(200),
    priorContext: { situational_facts: { impact: { untrusted: true }, duration: '  سه هفته  ' } },
  });
  assert.equal(result.request_id.length, 128);
  assert.equal(result.situational_facts.impact, null);
  assert.equal(result.situational_facts.duration, 'سه هفته');
});


test('describing difficulty explaining a personal issue is not misclassified as an information request', () => {
  const result = routeSemanticIntake({ text: 'یک مسئله پیچیده دارم که نمی‌دانم چطور توضیح بدهم.' });
  assert.equal(result.intent.label, 'share_experience');
  assert.equal(result.next_question.purpose, 'topic_disambiguation');
});


test('future-oriented worry phrasing is routed to T02', () => {
  const result = routeSemanticIntake({ text: 'موضوع اصلی من نگرانی از آینده است.' });
  assert.ok(result.topic_candidates.some((item) => item.topic_id === 'T02'));
});

test('router distinguishes information, understanding, strategy and professional-help intents', () => {
  assert.equal(routeSemanticIntake({ text: 'اضطراب چیست؟' }).intent.label, 'general_information');
  assert.equal(routeSemanticIntake({ text: 'می‌خواهم بدانم چرا این اتفاق می‌افتد.' }).intent.label, 'understand_problem');
  assert.equal(routeSemanticIntake({ text: 'چه کار کنم که این وضعیت بهتر شود؟' }).intent.label, 'request_strategy');
  assert.equal(routeSemanticIntake({ text: 'آیا بهتر است به روانشناس مراجعه کنم؟' }).intent.label, 'professional_help_decision');
});


test('runtime has an explicit routing rule for each real topic and keeps T34 as fallback only', async () => {
  const registry = JSON.parse(await readFile(new URL('../public/assistant/knowledge/topics.v1.json', import.meta.url), 'utf8'));
  const expected = registry.topics.map((item) => item.topic_id).filter((id) => id !== 'T34').sort();
  assert.deepEqual([...ROUTED_TOPIC_IDS].sort(), expected);
  assert.equal(ROUTED_TOPIC_IDS.includes('T34'), false);
});


test('educational questions containing safety terms do not trigger a personal safety interrogation', () => {
  const result = routeSemanticIntake({ text: 'خودکشی چیست؟' });
  assert.equal(result.intent.label, 'general_information');
  assert.equal(result.next_question, null);
  assert.equal(result.safety_handoff.handoff_required, false);
});

test('unquoted third-party report of suicidal intent asks for clarification without attributing intent to the user', () => {
  const result = routeSemanticIntake({ text: 'دوستم گفت می‌خواهم خودکشی کنم.' });
  assert.equal(result.safety_handoff.handoff_required, false);
  assert.equal(result.next_question.purpose, 'safety_clarification');
  assert.ok(result.uncertainties.some((item) => item.includes('باید مستقیماً روشن شود')));
});

test('a separate first-person harmful intent remains urgent after a third-party report', () => {
  const result = routeSemanticIntake({ text: 'دوستم گفت می‌خواهم خودکشی کنم، اما من قصد دارم به خودم آسیب بزنم.' });
  assert.equal(result.safety_handoff.handoff_required, true);
});

test('third-party attribution preserves a separate first-person topic after a conjunction', () => {
  const result = routeSemanticIntake({ text: 'دوستم گفت بی‌ارزشم و من هم احساس بی‌ارزشی دارم' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T23'), true);
});



test('third-party attributed questions do not become the user intent', () => {
  const reportedOnly = routeSemanticIntake({ text: 'دوستم گفت چه راهکاری پیشنهاد می‌کنی؟' });
  assert.equal(reportedOnly.intent.label, 'other_or_unclear');
  assert.equal(reportedOnly.topic_candidates.length, 0);

  const userFollowUp = routeSemanticIntake({
    text: 'دوستم گفت من اضطراب دارم. من هم اضطراب دارم؛ حالا برای خودم چه راهکاری پیشنهاد می‌کنی؟',
  });
  assert.equal(userFollowUp.intent.label, 'request_strategy');
  assert.ok(userFollowUp.topic_candidates.some((item) => item.topic_id === 'T02'));
});

test('colloquial third-party attribution removes friends and family speech before topic routing', () => {
  const cases = [
    ['دوستام گفتن من از خودم متنفرم', 'T18'],
    ['مامانم گفت که من بی‌ارزشم', 'T23'],
    ['بابام گفت من اضطراب دارم', 'T02'],
    ['اون گفت «من از خودم متنفرم»', 'T18'],
    ['اونا گفتن من بی‌ارزشم', 'T23'],
  ];
  for (const [text] of cases) {
    const result = routeSemanticIntake({ text });
    assert.equal(result.topic_candidates.length, 0, text);
  }
});

test('doctor and psychologist reports are attributed to the professional, not the user', () => {
  for (const text of [
    'دکترم گفت من بی‌ارزشم',
    'روان‌شناسم گفت که من از خودم متنفرم',
    'روانشناسم گفت من مضطربم',
  ]) {
    const result = routeSemanticIntake({ text });
    assert.equal(result.topic_candidates.length, 0, text);
  }
});

test('the user saying something to a doctor is not removed as third-party speech', () => {
  const result = routeSemanticIntake({ text: 'من به دکترم گفتم من بی‌ارزشم.' });
  assert.ok(result.topic_candidates.some((item) => item.topic_id === 'T23'));
});

test('the user quoted speech to a psychologist remains attributed to the user', () => {
  const result = routeSemanticIntake({ text: 'من به روان‌شناسم گفتم «از خودم متنفرم».' });
  assert.ok(result.topic_candidates.some((item) => item.topic_id === 'T18'));
});

test('colloquial third-party suicidal quote requests clarification without assigning intent to the user', () => {
  const result = routeSemanticIntake({ text: 'دوستام گفتن «می‌خوام خودکشی کنم».' });
  assert.equal(result.safety_handoff.handoff_required, false);
  assert.equal(result.next_question.purpose, 'safety_clarification');
});
