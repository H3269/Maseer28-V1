import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateSelfEvaluationPilot } from '../scripts/validate-self-evaluation-pilot.mjs';

const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const base = () => ({
  pilot: read('public/assistant/content-drafts/day04-08-self-evaluation-cluster-pilot.v1.json'),
  queue: read('public/assistant/content-drafts/952-day-redesign-queue.v1.json'),
  evidence: read('public/assistant/evidence/evidence-source-registry.v1.json')
});

test('validates 25 linked, topic-scoped, evidence-referenced, non-runtime drafts', () => {
  const result = validateSelfEvaluationPilot(base());
  assert.equal(result.valid, true, result.errors.join('; '));
  assert.equal(result.summary.drafts, 25);
  assert.equal(result.summary.runtime_eligible, 0);
});

test('rejects premature activation and broken queue mapping', () => {
  const data = base();
  data.pilot.records[0].runtime_eligible = true;
  data.queue.records.find((item) => item.topic_id === 'T15' && item.day_number === 4).draft_content_id = null;
  const result = validateSelfEvaluationPilot(data);
  assert.ok(result.errors.some((error) => error.includes('draft must remain blocked')));
  assert.ok(result.errors.some((error) => error.includes('queue mapping mismatch')));
});

test('rejects missing or fabricated evidence identifiers', () => {
  const data = base();
  data.pilot.records[0].evidence_ids = ['EVIDENCE_NOT_REGISTERED'];
  data.pilot.records[0].source_reference_ids = ['EVIDENCE_NOT_REGISTERED'];
  const result = validateSelfEvaluationPilot(data);
  assert.ok(result.errors.some((error) => error.includes('unknown evidence id')));
});

test('rejects a registered but out-of-scope source attached to a topic', () => {
  const data = base();
  data.pilot.records[0].evidence_ids = ['EVID_JANOFF_BULMAN_1979'];
  data.pilot.records[0].source_reference_ids = ['EVID_JANOFF_BULMAN_1979'];
  const result = validateSelfEvaluationPilot(data);
  assert.ok(result.errors.some((error) => error.includes('evidence not approved for T15')));
  assert.ok(result.errors.some((error) => error.includes('evidence scope mismatch for T15')));
});

test('rejects a depression guideline used as direct evidence for T23 self-worth exercises', () => {
  const data = base();
  const record = data.pilot.records.find((item) => item.topic_id === 'T23' && item.day_number === 4);
  record.evidence_ids.push('EVID_NICE_NG222');
  record.source_reference_ids.push('EVID_NICE_NG222');
  const result = validateSelfEvaluationPilot(data);
  assert.ok(result.errors.some((error) => error.includes('evidence not approved for T23: EVID_NICE_NG222')));
});

test('rejects a T19 day 6 subtopic that confuses behavior responsibility with global identity blame', () => {
  const data = base();
  const record = data.pilot.records.find((item) => item.topic_id === 'T19' && item.day_number === 6);
  record.subtopic_id = 'T19-S02';
  record.subtopic_name = 'سرزنش کلی هویت';
  const result = validateSelfEvaluationPilot(data);
  assert.ok(result.errors.some((error) => error.includes('T19 day 6 must map to behavior-specific responsibility T19-S01')));
});

test('rejects incomplete provenance and mismatched topic labels', () => {
  const data = base();
  data.pilot.records[0].source_reference_ids = [];
  data.pilot.records[1].topic_name = 'نام نادرست';
  const result = validateSelfEvaluationPilot(data);
  assert.ok(result.errors.some((error) => error.includes('source references must exactly match')));
  assert.ok(result.errors.some((error) => error.includes('topic name mismatch')));
});
