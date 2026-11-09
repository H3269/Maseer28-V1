import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContentRedesign } from '../scripts/validate-content-redesign.mjs';


function makeFullData() {
  const data = makeData();
  for (const item of data.queue.records) {
    item.draft_content_id = 'DRAFT_' + item.topic_id + '_D' + String(item.day_number).padStart(2, '0');
    item.redesign_status = 'draft_created_pending_review';
  }
  const allDays = Array.from({ length: 28 }, (_, index) => {
    const day = index + 1;
    if (day <= 3) return data['day' + day];
    return {
      records: data.topics.topics.map((topic) => ({
        content_id: 'DRAFT_' + topic.topic_id + '_D' + String(day).padStart(2, '0'),
        source_content_id: topic.topic_id + '-' + String(day).padStart(2, '0'),
        topic_id: topic.topic_id,
        topic_name: topic.name,
        subtopic_id: topic.topic_id + '-S01',
        day_number: day,
        phase: 'phase-' + day,
        learning_objective: 'هدف اختصاصی ' + topic.topic_id + ' روز ' + day,
        mechanism_focus: 'سازوکار ' + topic.topic_id + ' روز ' + day,
        exercise: 'تمرین مستقل ' + topic.topic_id + ' روز ' + day,
        action: 'اقدام مستقل ' + topic.topic_id + ' روز ' + day,
        progress_measure: 'سنجه اختصاصی ' + topic.topic_id + ' روز ' + day,
        safety_and_limits: 'محدودیت ایمنی موضوع ' + topic.topic_id,
        evidence_ids: [],
        source_reference_ids: [],
        review_status: 'draft_pending_expert_review',
        runtime_eligible: false,
      })),
    };
  });
  return { ...data, allDays };
}

function makeData() {
  const reviewedMappings = new Map([
    ['DRAFT_T14_D02', 'T14-S01'],
    ['DRAFT_T14_D03', 'T14-S02'],
    ['DRAFT_T19_D02', 'T19-S01'],
    ['DRAFT_T23_D03', 'T23-S02'],
    ['DRAFT_T32_D02', 'T32-S01'],
    ['DRAFT_T33_D03', 'T33-S02'],
  ]);
  const topics = Array.from({ length: 34 }, (_, i) => ({
    topic_id: 'T' + String(i + 1).padStart(2, '0'),
    name: 'موضوع ' + (i + 1),
  }));
  const subtopics = topics.flatMap((topic) =>
    [1, 2, 3].map((day) => ({
      subtopic_id: reviewedMappings.get('DRAFT_' + topic.topic_id + '_D0' + day) ?? topic.topic_id + '-S0' + day,
      topic_id: topic.topic_id,
    })),
  );
  const records = topics.flatMap((topic) =>
    Array.from({ length: 28 }, (_, i) => {
      const day = i + 1;
      return {
        review_id: 'QREV_' + topic.topic_id + '_D' + String(day).padStart(2, '0'),
        topic_id: topic.topic_id,
        day_number: day,
        source_content_id: topic.topic_id + '-' + String(day).padStart(2, '0'),
        draft_content_id: day <= 3
          ? 'DRAFT_' + topic.topic_id + '_D0' + day
          : null,
        redesign_status: day <= 3 ? 'draft_created_pending_review' : 'not_started',
        review_status: 'pending_review',
        runtime_eligible: false,
        scores: { dimension: null },
      };
    }),
  );
  const buildDrafts = (day) => topics.map((topic) => ({
    content_id: 'DRAFT_' + topic.topic_id + '_D0' + day,
    source_content_id: topic.topic_id + '-0' + day,
    topic_id: topic.topic_id,
    topic_name: topic.name,
    subtopic_id: reviewedMappings.get('DRAFT_' + topic.topic_id + '_D0' + day) ?? topic.topic_id + '-S0' + day,
    day_number: day,
    phase: ({
      1: 'orientation_and_safe_observation',
      2: 'pattern_discrimination_and_context',
      3: 'functional_context_and_impact',
    })[day],
    learning_objective: 'هدف روز ' + day + ' برای ' + topic.topic_id,
    mechanism_focus: 'سازوکار روز ' + day + ' برای ' + topic.topic_id,
    exercise: 'تمرین روز ' + day + ' برای ' + topic.topic_id,
    action: 'اقدام روز ' + day + ' برای ' + topic.topic_id,
    progress_measure: 'سنجه روز ' + day + ' برای ' + topic.topic_id,
    safety_and_limits: 'حدود ایمنی',
    evidence_ids: [],
    source_reference_ids: [],
    review_status: 'draft_pending_expert_review',
    runtime_eligible: false,
  }));
  return {
    queue: { records },
    day1: { records: buildDrafts(1) },
    day2: { records: buildDrafts(2) },
    day3: { records: buildDrafts(3) },
    topics: { topics },
    subtopics: { subtopics },
  };
}

test('validates full 952 queue and first three 34-topic draft batches', () => {
  const result = validateContentRedesign(makeData());
  assert.equal(result.valid, true, result.errors.join('; '));
});

test('detects T04 self-hatred and T34 ambiguous-routing misclassification', () => {
  const data = makeData();
  const t04 = data.day1.records.find((item) => item.topic_id === 'T04');
  t04.subtopic_id = 'T04-S01';
  t04.mechanism_focus = 'تفکیک خصومت نسبت به دیگری از خودبیزاری';
  const t34 = data.day1.records.find((item) => item.topic_id === 'T34');
  t34.subtopic_id = 'T34-S01';
  t34.learning_objective = 'مشخص کند مسئله روشن یا مبهم است.';
  const result = validateContentRedesign(data);
  assert.ok(result.errors.some((item) => item.includes('T04-S01 day-one content')));
  assert.ok(result.errors.some((item) => item.includes('T34-S01 day-one content')));
});

test('allows explicit exclusion of self-hatred from T04-S01 content', () => {
  const data = makeData();
  const t04 = data.day1.records.find((item) => item.topic_id === 'T04');
  t04.subtopic_id = 'T04-S01';
  t04.mechanism_focus = 'تمرکز بر نفرت نسبت به فرد یا گروه؛ خودبیزاری در این رکورد بررسی نمی‌شود.';
  const result = validateContentRedesign(data);
  assert.equal(result.valid, true, result.errors.join('; '));
});

test('enforces reviewed subtopic mappings for six audited drafts', () => {
  const data = makeData();
  data.day2.records.find((item) => item.content_id === 'DRAFT_T14_D02').subtopic_id = 'T14-S02';
  data.day3.records.find((item) => item.content_id === 'DRAFT_T23_D03').subtopic_id = 'T23-S03';
  const result = validateContentRedesign(data);
  assert.ok(result.errors.some((item) => item.includes('reviewed subtopic mapping mismatch DRAFT_T14_D02')));
  assert.ok(result.errors.some((item) => item.includes('reviewed subtopic mapping mismatch DRAFT_T23_D03')));
});

test('blocks premature activation and unverified evidence claims', () => {
  const data = makeData();
  data.day3.records[0].runtime_eligible = true;
  data.day3.records[0].evidence_ids = ['EVD_FAKE'];
  const result = validateContentRedesign(data);
  assert.ok(result.errors.some((item) => item.includes('draft not blocked')));
  assert.ok(result.errors.some((item) => item.includes('unverified evidence claimed')));
});

test('detects repeated exercises across consecutive days for the same topic', () => {
  const data = makeData();
  data.day2.records[0].exercise = data.day1.records[0].exercise;
  const result = validateContentRedesign(data);
  assert.ok(result.errors.some((item) => item.includes('repeats exercise across consecutive days')));
});

test('detects incorrect day phase and repeated subtopic progression', () => {
  const data = makeData();
  data.day3.records[1].phase = 'orientation_and_safe_observation';
  data.day3.records[2].subtopic_id = data.day2.records[2].subtopic_id;
  const result = validateContentRedesign(data);
  assert.ok(result.errors.some((item) => item.includes('phase/day progression mismatch')));
  assert.ok(result.errors.some((item) => item.includes('distinct subtopic each day')));
});


test('validates all 952 daily drafts, global exercise/action uniqueness and topic-specific objectives/measures', () => {
  const data = makeFullData();
  const result = validateContentRedesign(data);
  assert.equal(result.valid, true, result.errors.join('; '));
});

test('detects global repeated exercise and normalized cross-topic objective/progress templates', () => {
  const data = makeFullData();
  data.allDays[3].records[0].exercise = data.allDays[0].records[0].exercise;
  data.allDays[4].records[0].learning_objective = 'هدف برای موضوع 1';
  data.allDays[4].records[1].learning_objective = 'هدف برای موضوع 2';
  data.allDays[5].records[0].progress_measure = 'سنجه برای موضوع 1';
  data.allDays[5].records[1].progress_measure = 'سنجه برای موضوع 2';
  const result = validateContentRedesign(data);
  assert.ok(result.errors.some((item) => item.includes('global duplicate exercise across 952 drafts')));
  assert.ok(result.errors.some((item) => item.includes('normalized duplicate learning_objective')));
  assert.ok(result.errors.some((item) => item.includes('normalized duplicate progress_measure')));
});


test('accepts registered candidate evidence without treating it as verified evidence', () => {
  const data = makeFullData();
  data.evidenceRegistry = { sources: [{ evidence_id: 'EVID_CANDIDATE_1' }] };
  data.allDays[3].records[0].candidate_evidence_ids = ['EVID_CANDIDATE_1'];
  const result = validateContentRedesign(data);
  assert.equal(result.valid, true, result.errors.join('; '));
});

test('rejects candidate evidence identifiers absent from the registry', () => {
  const data = makeFullData();
  data.evidenceRegistry = { sources: [] };
  data.allDays[3].records[0].candidate_evidence_ids = ['EVID_NOT_REGISTERED'];
  const result = validateContentRedesign(data);
  assert.ok(result.errors.some((item) => item.includes('unknown candidate evidence reference EVID_NOT_REGISTERED')));
});
