import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const canonicalUrl = new URL('../docs/T06-T34-PACKAGES/T10/T10_CANONICAL_CONTENT_DRAFT_V2_20261113.json', import.meta.url);
const guideUrl = new URL('../docs/T06-T34-PACKAGES/T10/T10_ASSISTANT_GUIDE_DRAFT_FULL_20261113.json', import.meta.url);

const [canonical, guide] = await Promise.all([
  readFile(canonicalUrl, 'utf8').then(JSON.parse),
  readFile(guideUrl, 'utf8').then(JSON.parse),
]);

test('T10 canonical draft covers 28 unique daily units with the v2 contract', async () => {
  assert.equal(canonical.topic_id, 'T10');
  assert.equal(canonical.daily_unit_contract, 'v2');
  assert.equal(canonical.status, 'draft_not_runtime_eligible');
  assert.equal(canonical.records.length, 28);
  const sourceRegistry = JSON.parse(await readFile(new URL('../public/assistant/evidence/sources.v1.json', import.meta.url), 'utf8'));
  const evidenceMap = JSON.parse(await readFile(new URL('../docs/T06-T34-PACKAGES/T10/T10_EVIDENCE_CLAIM_MAP_20261113.json', import.meta.url), 'utf8'));
  const sourceIds = new Set(sourceRegistry.sources.map((source) => source.source_id));
  assert.equal(evidenceMap.mappings.length, 28);
  const sharedClaimIds = new Set(evidenceMap.shared_safety_claims.map((claim) => claim.claim_id));
  assert.equal(sharedClaimIds.size, 5);
  assert.equal(evidenceMap.status, 'draft_pending_expert_review');
  assert.equal(sourceRegistry.status, 'curated_draft_sources_pending_evidence_review');
  assert.ok(evidenceMap.shared_safety_claims.every((claim) => claim.review_status === 'pending_expert_review'));
  const allClaimIds = [...evidenceMap.shared_safety_claims.map((claim) => claim.claim_id), ...evidenceMap.mappings.flatMap((item) => item.claim_mappings.map((claim) => claim.claim_id))];
  assert.equal(new Set(allClaimIds).size, allClaimIds.length, 'all day-specific and shared claim IDs must be unique');
  for (const claim of evidenceMap.shared_safety_claims) {
    assert.ok(sourceIds.has(claim.source_id));
    assert.equal(claim.applies_to_days.length, 28);
  }
  for (const day of [7, 19, 22]) {
    const mapping = evidenceMap.mappings[day - 1];
    assert.equal(mapping.claim_mappings.length, 0, `day ${day}: do not invent unsupported clinical efficacy claims`);
    assert.ok(mapping.claim_mapping_note?.trim(), `day ${day}: explain why no day-specific clinical claim is mapped`);
  }
  for (const item of evidenceMap.mappings) {
    assert.ok(item.claim_mappings.every((claim) => sourceIds.has(claim.source_id)));
    assert.deepEqual(new Set(item.shared_safety_claim_ids), sharedClaimIds);
    const mappedIds = new Set([...item.claim_mappings.map((claim) => claim.source_id), ...evidenceMap.shared_safety_claims.map((claim) => claim.source_id)]);
    assert.deepEqual([...mappedIds].sort(), [...item.source_ids].sort(),
      `day ${item.day}: all daily and shared safety sources must be mapped`);
  }
  assert.ok(sourceRegistry.sources.every((source) => source.title?.trim() && source.url?.startsWith('https://')));
  assert.ok(canonical.records.every((record) => record.source_ids.includes('SRC-SLEEP-NHTSA-DROWSY-DRIVING-2026-001')),
    'shared driving-safety evidence must be linked to every daily unit');
  assert.ok(canonical.records[24].source_ids.includes('SRC-SLEEP-NIMH-BIPOLAR-SIGNS-001'));
  assert.ok(evidenceMap.mappings[24].claim_mappings.some((claim) =>
    claim.claim_id === 'T10-D25-C05' && claim.source_id === 'SRC-SLEEP-NIMH-BIPOLAR-SIGNS-001'));

  for (const record of canonical.records) {
    assert.ok(record.source_ids.every((id) => sourceIds.has(id)), `day ${record.day}: source ID must exist`);
    assert.deepEqual(record.source_ids, evidenceMap.mappings[record.day - 1].source_ids);
  }
  assert.deepEqual(canonical.records.map((record) => record.day), Array.from({ length: 28 }, (_, i) => i + 1));
  assert.equal(new Set(canonical.records.map((record) => record.id)).size, 28);

  for (const record of canonical.records) {
    assert.equal(record.topic_id, 'T10');
    assert.equal(record.id, `T10-D${String(record.day).padStart(2, '0')}`);
    for (const field of [
      'subtopic_ids', 'learning_objective', 'target_skill', 'teaching_point',
      'instructions', 'action', 'light_version', 'progress_version', 'rest_version',
      'reflection_prompt', 'success_criterion', 'stop_conditions', 'risk_level',
      'when_to_seek_human_support', 'source_ids', 'evidence_grade', 'review_status',
    ]) {
      assert.ok(record[field] !== undefined, `${record.id} is missing ${field}`);
    }
    assert.equal(record.review_status, 'draft');
    assert.equal(record.evidence_grade, 'not_assessed');
    assert.ok(Array.isArray(record.source_ids));
    assert.equal(record.subtopic_mapping_status, 'proposed_not_approved');
  }
  assert.equal(new Set(canonical.records.map((record) => record.success_criterion)).size, 28,
    'success criteria must be day-specific');
  assert.equal(new Set(canonical.records.map((record) => record.action)).size, 28,
    'actions must not be exact copies within T10');
});

test('T10 assistant guide has 392 non-empty, unique answers and 14 questions per day', () => {
  assert.equal(guide.topicId, 'T10');
  assert.equal(guide.status, 'draft_not_runtime_eligible');
  assert.equal(guide.expectedDays, 28);
  assert.equal(guide.questionsPerDay, 14);
  assert.equal(guide.records.length, 28);

  const answers = [];
  const q02 = [];
  const q04 = [];
  const q13 = [];
  for (const record of guide.records) {
    assert.equal(record.questions.length, 14, `day ${record.day} must have 14 questions`);
    assert.equal(new Set(record.questions.map((question) => question.id)).size, 14);
    for (const question of record.questions) {
      assert.ok(question.answer.trim(), `day ${record.day} ${question.id} has an empty answer`);
      answers.push(question.answer);
    }
    q02.push(record.questions.find((question) => question.id === 'q02').answer);
    q04.push(record.questions.find((question) => question.id === 'q04').answer);
    q13.push(record.questions.find((question) => question.id === 'q13').answer);
    assert.match(record.questions.find((question) => question.id === 'q11').answer, /خواب|خواب‌آلودگی|بیدار/);
    assert.equal(record.reviewStatus, 'draft');
    assert.equal(record.evidenceGrade, 'not_assessed');
    const canonicalDay = canonical.records[record.day - 1];
    assert.deepEqual(record.sourceIds, canonicalDay.source_ids);
    assert.equal(record.successCriterion, canonicalDay.success_criterion,
      `day ${record.day} guide success criterion must match canonical content`);
    const durationMatch = record.questions.find((question) => question.id === 'q14').answer.match(/حدود\s+(\d+)\s+دقیقه/);
    assert.ok(durationMatch, `day ${record.day} q14 must state an estimated duration`);
    assert.equal(Number(durationMatch[1]), canonicalDay.duration_minutes,
      `day ${record.day} duration must match q14`);
  }
  assert.equal(answers.length, 392);
  assert.equal(new Set(answers).size, 392, 'full answer bodies must not be exact duplicates');
  assert.equal(new Set(q02).size, 28, 'exercise examples must be day-specific');
  assert.equal(new Set(q04).size, 28, 'action examples must be day-specific');
  assert.equal(new Set(q13).size, 28, 'adaptation guidance must be day-specific');
  const referralGuidance = guide.records.map((record) => record.whenToSeekHumanSupport);
  assert.equal(new Set(referralGuidance).size, 28, 'human-support guidance must include day-specific context');
  assert.ok(referralGuidance.every((answer) => answer.includes('پزشک یا متخصص خواب')));
  const q11 = guide.records.map((record) => record.questions.find((question) => question.id === 'q11').answer);
  assert.equal(new Set(q11).size, 28, 'sleep-safety guidance must remain day-specific');
  assert.ok(guide.records.every((record) => record.questions.find((question) => question.id === 'q11').answer !== record.questions.find((question) => question.id === 'q07').answer));
  const q07 = guide.records.map((record) => record.questions.find((question) => question.id === 'q07').answer);
  assert.equal(new Set(q07).size, 28, 'stop guidance must remain day-specific');
  assert.ok(q07.every((answer) => answer.split(/\s+/u).length <= 150), 'q07 must remain concise');
  assert.ok(q11.every((answer) => answer.split(/\s+/u).length <= 120), 'q11 must remain concise');
});

test('T10 guide and canonical records remain aligned across all daily fields and FAQs', () => {
  const fields = [
    ['title', 'title'], ['objective', 'learning_objective'], ['skill', 'target_skill'],
    ['mechanism', 'teaching_point'], ['exercise', 'instructions'], ['action', 'action'],
    ['lightVersion', 'light_version'], ['progressVersion', 'progress_version'],
    ['restVersion', 'rest_version'], ['durationMinutes', 'duration_minutes'],
    ['successCriterion', 'success_criterion'], ['stopCondition', 'stop_condition_text'],
    ['exerciseType', 'exercise_type'], ['reflectionPrompt', 'reflection_prompt'],
    ['whenToSeekHumanSupport', 'when_to_seek_human_support'],
    ['durationStatus', 'duration_status'], ['evidenceGrade', 'evidence_grade'],
    ['reviewStatus', 'review_status'],
  ];
  for (let index = 0; index < 28; index += 1) {
    const g = guide.records[index];
    const c = canonical.records[index];
    for (const [gf, cf] of fields) assert.equal(g[gf], c[cf], `day ${index + 1}: ${gf}`);
    assert.deepEqual(g.stopConditions, c.stop_conditions);
    assert.deepEqual(g.sourceIds, c.source_ids);
    assert.deepEqual(g.subtopicIds, c.subtopic_ids);
    assert.deepEqual(g.contraindications, c.contraindications);
    const answer = (id) => g.questions.find((q) => q.id === id).answer;
    assert.ok(answer('q01').includes(g.exercise));
    assert.ok(answer('q03').includes(g.action));
    assert.equal(answer('q05'), g.lightVersion);
    assert.equal(answer('q06'), g.successCriterion);
    assert.ok(answer('q07').includes(g.stopCondition));
    assert.ok(answer('q07').includes(g.restVersion));
    assert.ok(answer('q07').includes('دارو، مکمل، الکل یا مواد را برای خواب خودسرانه'));
    assert.ok(answer('q07').includes('محدودسازی خواب یا درمان ساختارمند بی‌خوابی را خودسرانه اجرا نکن'));
    assert.ok(answer('q07').includes('پزشک یا متخصص خواب') || answer('q07').includes('ارزیابی پزشک یا متخصص خواب') || answer('q07').includes('پزشک/متخصص خواب'));
    assert.ok(g.stopConditions.every((v) => answer('q07').includes(v)));
    assert.ok(answer('q09').includes(g.exercise));
    assert.ok(answer('q09').includes(g.action));
    assert.ok(answer('q10').includes(g.lightVersion));
    assert.ok(answer('q10').includes(g.restVersion));
    assert.ok(answer('q11').includes(g.stopCondition));
    assert.ok(answer('q11').includes(g.restVersion));
    assert.ok(answer('q11').includes('ادامه‌دادن معیار موفقیت نیست'));
    assert.ok(answer('q11').includes('خواب‌آلودگی ایمنی رانندگی یا کار پرخطر را مختل می‌کند'));
    assert.ok(answer('q11').includes('پزشک یا متخصص خواب'));
    const duration = answer('q14').match(/حدود\s+(\d+)\s+دقیقه/);
    assert.ok(duration, `day ${index + 1}: q14 duration`);
    assert.equal(Number(duration[1]), g.durationMinutes);
    assert.ok(answer('q14').includes('این زمان تخمینی و غیرالزامی است'));
  }
});

test('T10 retains sleep-specific safety boundaries and avoids unsafe self-treatment instructions', () => {
  assert.match(canonical.records[8].instructions, /برنامه خواب\/بیداری و شیفت/);
  assert.doesNotMatch(canonical.records[8].instructions, /پس از بیداری/);
  assert.match(canonical.records[13].instructions, /بدون نتیجه‌گیری درباره علت/);
  assert.match(canonical.records[13].action, /اگر بررسی مکرر ساعت برایت فشار ایجاد می‌کند/);
  assert.match(canonical.records[13].action, /پایش ضروری/);
  assert.match(guide.records[13].questions.find((question) => question.id === 'q13').answer, /پایش لازم را مختل نکند/);
  assert.doesNotMatch(canonical.records[13].instructions, /برانگیختگی بیشتر/);
  assert.match(canonical.records[14].instructions, /پروتکل تخصصی کنترل محرک نیست/);
  assert.doesNotMatch(canonical.records[14].instructions, /هنگام خواب‌آلودگی بازگرد/);
  assert.match(canonical.records[24].instructions, /کاهش غیرمعمول نیاز به خواب/);
  assert.match(canonical.records[4].instructions, /غیرمرتبط با مواد/);
  assert.doesNotMatch(canonical.records[4].instructions, /کافئین، نیکوتین، الکل/);
  assert.ok(!canonical.records[4].source_ids.includes('SRC-SLEEP-NIOSH-CAFFEINE-SHIFTWORK-001'));
  assert.match(canonical.records[11].instructions, /کافئین، نیکوتین و الکل/);

  assert.match(canonical.records[24].instructions, /این نشانه به‌تنهایی تشخیص نیست/);
  const joined = JSON.stringify({ canonical, guide });
  assert.match(joined, /رانندگی/);
  assert.match(joined, /وقفه تنفسی|خفگی/);
  assert.match(joined, /متخصص خواب|پزشک/);
  assert.match(joined, /دارو/);
  assert.match(joined, /محرومیت از خواب|خواب را محدود/);
  assert.match(joined, /خطر افتادن شبانه یا دشواری انتقال از تخت/);
  assert.match(joined, /درمان مواجهه‌محور PTSD/);
  assert.ok(guide.records.every((record) => {
    const answer = record.questions.find((question) => question.id === 'q07').answer;
    return answer.includes('خطر افتادن/دشواری انتقال') && answer.includes('درمان مواجهه‌محور PTSD');
  }), 'each day-specific stop answer must retain both VA/DoD adaptation cautions');
  assert.doesNotMatch(joined, /دوز دارو را افزایش بده|الکل مصرف کن تا بخوابی|عمداً تمام شب بیدار بمان/);
  assert.ok(guide.records.every((record) => record.questions.find((question) => question.id === 'q07').answer.split(/\s+/u).length <= 135));
  for (const day of [1, 4, 5, 9, 12, 13, 15, 17, 21, 22, 24, 25, 26]) {
    assert.equal(canonical.records[day - 1].risk_level, 'caution',
      `day ${day} contains an explicit sleepiness or warning-sign safety gate`);
  }
});

test('T10 draft exercises and actions do not exactly duplicate another topic runtime text', async () => {
  const overlay = JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
  const t10Texts = canonical.records.flatMap((record) => [record.instructions, record.action]);
  const otherTopicTexts = Object.entries(overlay.categories)
    .filter(([name]) => name !== 'بی‌خوابی و مشکلات خواب')
    .flatMap(([, category]) => (category.days || []).flatMap((day) => [day.exercise, day.actionText]))
    .map((text) => String(text).normalize('NFKC').replace(/\s+/g, ' ').trim());
  const normalized = new Set(otherTopicTexts);
  for (const text of t10Texts) {
    assert.ok(!normalized.has(String(text).normalize('NFKC').replace(/\s+/g, ' ').trim()),
      'T10 text must not be an exact duplicate of another topic exercise/action');
  }

  // Lexical Jaccard is a screening heuristic, not proof of conceptual uniqueness.
  const tokens = (value) => new Set(String(value || '').normalize('NFKC')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').toLowerCase()
    .split(/\s+/u).filter((token) => token.length > 1));
  const otherSets = otherTopicTexts.map(tokens);
  let maxJaccard = 0;
  let closestPair = '';
  for (let index = 0; index < t10Texts.length; index += 1) {
    const left = tokens(t10Texts[index]);
    for (let otherIndex = 0; otherIndex < otherSets.length; otherIndex += 1) {
      const right = otherSets[otherIndex];
      let intersection = 0;
      for (const token of left) if (right.has(token)) intersection += 1;
      const union = left.size + right.size - intersection;
      const score = union ? intersection / union : 0;
      if (score > maxJaccard) {
        maxJaccard = score;
        closestPair = `T10 text ${index + 1} vs other-topic text ${otherIndex + 1}`;
      }
    }
  }
  assert.ok(maxJaccard < 0.4, `cross-topic lexical overlap must remain below 0.4; ${closestPair}: ${maxJaccard.toFixed(3)}`);
});
