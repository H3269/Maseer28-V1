import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = JSON.parse(fs.readFileSync(path.join(root,
  'public/assistant/content-drafts/topic-T01-anger-complete-draft.v1.json'), 'utf8'));
const SUPPORT_FIELDS = [
  'lightExerciseText',
  'lightActionText',
  'progressActionText',
  'restExerciseText',
  'restActionText',
];
const normalize = (value) => String(value ?? '').normalize('NFKC')
  .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
  .replace(/[\u064B-\u065F\u0670]/g, '')
  .replace(/[\u200c\u200f\u200e]/g, '')
  .replace(/[،؛.!؟?,]/g, ' ')
  .replace(/\s+/g, ' ').trim().toLowerCase();

test('T01 anger package covers exactly 28 unique canonical days', () => {
  assert.equal(pack.topic_id, 'T01');
  assert.equal(pack.records.length, 28);
  assert.deepEqual(pack.records.map((record) => record.day_number).sort((a, b) => a - b),
    Array.from({ length: 28 }, (_, index) => index + 1));
  assert.equal(new Set(pack.records.map((record) => record.content_id)).size, 28);
  assert.equal(new Set(pack.records.map((record) => record.source_content_id)).size, 28);
});

test('every T01 day has complete main content, traceability, and five support variants', () => {
  for (const record of pack.records) {
    for (const field of [
      'title', 'learning_objective', 'target_skill', 'mechanism_focus',
      'exercise', 'action', 'progress_measure', 'reflection_prompt',
      'success_criterion', 'safety_and_limits', 'when_to_seek_human_support',
    ]) {
      assert.equal(typeof record[field], 'string', record.day_number + ':' + field);
      assert.ok(record[field].trim(), record.day_number + ':' + field);
    }
    assert.ok(Array.isArray(record.subtopic_ids) && record.subtopic_ids.length > 0);
    assert.ok(record.subtopic_ids.every((id) => /^T01-S0[123]$/.test(id)));
    assert.ok(record.source_content_id);
    assert.ok(record.source_runtime_exercise);
    assert.ok(record.source_runtime_action);
    assert.ok(Array.isArray(record.source_ids) && record.source_ids.length > 0);
    for (const field of SUPPORT_FIELDS) {
      assert.equal(typeof record.support_variants?.[field], 'string', record.day_number + ':' + field);
      assert.ok(record.support_variants[field].trim(), record.day_number + ':' + field);
    }
  }
});

test('main and support text fields have no exact duplicates across the 28-day T01 sequence', () => {
  const fields = [
    'title', 'exercise', 'action', 'progress_measure',
    ...SUPPORT_FIELDS.map((field) => 'support_variants.' + field),
  ];
  for (const field of fields) {
    const seen = new Set();
    for (const record of pack.records) {
      const value = field.startsWith('support_variants.')
        ? record.support_variants[field.split('.')[1]]
        : record[field];
      const key = normalize(value);
      assert.ok(key, record.day_number + ':' + field);
      assert.ok(!seen.has(key), 'duplicate ' + field + ' on day ' + record.day_number);
      seen.add(key);
    }
  }
});

test('all T01 drafts remain non-approved and non-runtime; high-risk day 27 is human-review gated', () => {
  assert.equal(pack.status, 'draft_pending_expert_review');
  for (const record of pack.records) {
    assert.equal(record.review_status, 'draft_pending_expert_review');
    assert.equal(record.runtime_eligible, false);
    assert.equal(record.reviewer, null);
    assert.equal(record.reviewed_at, null);
    assert.equal(record.evidence_grade, 'not_assessed');
    assert.deepEqual(record.evidence_ids, []);
  }
  assert.equal(pack.records.find((record) => record.day_number === 27).risk_level,
    'human_review_required');
});

test('T01 phase metadata follows the shared 28-day progression contract', () => {
  const expected = [
    'orientation_and_safe_observation',
    'pattern_discrimination_and_context',
    'functional_context_and_impact',
  ];
  for (let day = 1; day <= 3; day += 1) {
    assert.equal(pack.records[day - 1].phase, expected[day - 1]);
    const file = path.join(root, 'public/assistant/content-drafts/day'
      + String(day).padStart(2, '0') + '-34-topic-drafts.v1.json');
    const batch = JSON.parse(fs.readFileSync(file, 'utf8'));
    const record = batch.records.find((item) => item.topic_id === 'T01');
    assert.equal(record.phase, expected[day - 1]);
  }
});

test('all 28 shared day drafts and the first 17 support proposal files point to the canonical T01 package', () => {
  for (let day = 1; day <= 28; day += 1) {
    const file = path.join(root, 'public/assistant/content-drafts/day'
      + String(day).padStart(2, '0') + '-34-topic-drafts.v1.json');
    const batch = JSON.parse(fs.readFileSync(file, 'utf8'));
    const record = batch.records.find((item) => item.topic_id === 'T01');
    const canonical = pack.records[day - 1];
    assert.ok(record, 'missing T01 day ' + day);
    for (const field of [
      'title', 'learning_objective', 'target_skill', 'mechanism_focus',
      'exercise', 'action', 'progress_measure', 'reflection_prompt',
      'safety_and_limits',
    ]) {
      assert.equal(record[field], canonical[field], 'day ' + day + ':' + field);
    }
    assert.equal(record.canonical_package_id, pack.package_id);
  }

  for (let day = 1; day <= 17; day += 1) {
    const file = path.join(root, 'public/assistant/content-drafts/day'
      + String(day).padStart(2, '0') + '-support-copy-proposals-34-topics.v1.json');
    const batch = JSON.parse(fs.readFileSync(file, 'utf8'));
    const record = batch.records.find((item) => item.topic_id === 'T01');
    const canonical = pack.records[day - 1];
    assert.ok(record, 'missing T01 support day ' + day);
    for (const field of SUPPORT_FIELDS) {
      assert.equal(record[field], canonical.support_variants[field],
        'support day ' + day + ':' + field);
    }
    assert.equal(record.canonical_package_id, pack.package_id);
    assert.equal(record.runtime_eligible, false);
  }
});

test('T01 source references resolve and day 8 does not repeat the T02 breathing exercise', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(root,
    'public/assistant/evidence/sources.v1.json'), 'utf8'));
  const sourceIds = new Set(registry.sources.map((source) => source.source_id));
  for (const record of pack.records) {
    assert.ok(record.source_ids.length > 0, 'missing source IDs on day ' + record.day_number);
    for (const sourceId of record.source_ids) {
      assert.ok(sourceIds.has(sourceId), 'unknown source ' + sourceId + ' on day ' + record.day_number);
    }
  }
  const day8 = pack.records.find((record) => record.day_number === 8);
  assert.match(day8.exercise, /تخلیه|برانگیختگی/);
  assert.doesNotMatch(day8.exercise, /تنفس|نفس/);
  assert.ok(day8.source_ids.includes('SRC-ANGER-KJAERVIK-2024-001'));
});

test('each T01 day has a scoped provisional claim-to-source map without claiming evidence approval', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(root,
    'public/assistant/evidence/sources.v1.json'), 'utf8'));
  const sourceIds = new Set(registry.sources.map((source) => source.source_id));
  for (const record of pack.records) {
    assert.ok(Array.isArray(record.candidate_source_ids) && record.candidate_source_ids.length > 0);
    assert.deepEqual(record.claim_evidence_map.source_ids, record.candidate_source_ids);
    assert.ok(record.claim_evidence_map.claim.trim());
    assert.ok(record.claim_evidence_map.limitations.trim());
    assert.equal(record.claim_evidence_map.status, 'provisional_pending_expert_and_evidence_review');
    for (const sourceId of record.candidate_source_ids) {
      assert.ok(sourceIds.has(sourceId), 'unregistered candidate source ' + sourceId);
    }
    assert.deepEqual(record.evidence_ids, []);
    assert.equal(record.evidence_grade, 'not_assessed');
  }
});
