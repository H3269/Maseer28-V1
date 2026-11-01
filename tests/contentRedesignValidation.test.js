import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContentRedesign } from '../scripts/validate-content-redesign.mjs';

function makeData() {
  const topics = Array.from({ length: 34 }, (_, i) => ({
    topic_id: 'T' + String(i + 1).padStart(2, '0'),
    name: 'موضوع ' + (i + 1),
  }));
  const subtopics = topics.flatMap((topic) =>
    [1, 2, 3].map((day) => ({
      subtopic_id: topic.topic_id + '-S0' + day,
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
    subtopic_id: topic.topic_id + '-S0' + day,
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
