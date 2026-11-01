import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDryRunReport, validateDryRunReport } from '../scripts/validate-topic-migration-dry-run.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stored = JSON.parse(fs.readFileSync(path.join(root, 'docs/reports/TOPIC_MIGRATION_DRY_RUN_952_V1.json'), 'utf8'));
test('dry-run report matches current source files and all 952 queue records', () => { const fresh = buildDryRunReport(); assert.equal(fresh.source_summary.legacy_days, 952); assert.equal(fresh.source_summary.queue_actual_records, 952); assert.deepEqual(validateDryRunReport(stored, fresh), []); });
test('dry-run classifies all records as candidates, not approved migrations', () => { const fresh = buildDryRunReport(); assert.deepEqual(fresh.mapping_summary.classification_counts, { candidate_mapped: 952 }); assert.equal(fresh.safety.execution_allowed, false); assert.equal(fresh.mapping_summary.runtime_eligible_records, 0); });
test('dry-run exposes 850 missing drafts and missing queue subtopic IDs', () => { const fresh = buildDryRunReport(); assert.equal(fresh.source_summary.draft_records, 102); assert.equal(fresh.mapping_summary.drafts_in_queue, 102); assert.equal(fresh.mapping_summary.drafts_not_in_queue, 0); assert.equal(fresh.mapping_summary.queue_has_subtopic_id, false); assert.equal(fresh.mapping_summary.classification_counts.candidate_mapped, 952); assert.equal(Object.values(fresh.day_distribution_without_draft).reduce((a,b)=>a+b,0), 850); });
test('validator detects stale source fingerprints and tampered results', () => { const altered = structuredClone(stored); altered.record_results[0].topic_id = 'T99'; assert.ok(validateDryRunReport(altered).some(e => e.includes('per-record'))); });
test('book references remain fully represented in the source snapshot', () => { const fresh = buildDryRunReport(); assert.equal(fresh.source_summary.legacy_days_with_book_reference, 442); assert.deepEqual(fresh.source_summary.book_reference_counts, { '1':34, '2':34, '3':102, '4':170, '5':102 }); });

test('dry-run identifies all draft records affected by proposed subtopic remappings', () => { const fresh = buildDryRunReport(); const impact = fresh.subtopic_mapping_impact; assert.equal(impact.length, 3); assert.deepEqual(impact.map(x => [x.source_subtopic_id, x.affected_draft_count]), [['T04-S02', 1], ['T15-S03', 1], ['T18-S03', 1]]); assert.equal(impact.find(x => x.source_subtopic_id === 'T18-S03').decision_status, 'blocked_pending_safety_review'); });

test('legacy content has 952 unique day IDs and an exact one-to-one join to the review queue', () => {
  const legacy = JSON.parse(fs.readFileSync(path.join(root, 'public/content/path-content.json'), 'utf8'));
  const queue = JSON.parse(fs.readFileSync(path.join(root, 'public/assistant/content-drafts/952-day-redesign-queue.v1.json'), 'utf8'));
  const sourceDays = Object.entries(legacy.categories).flatMap(([category, data]) => data.days.map(day => ({ category, day })));
  const sourceIds = sourceDays.map(x => x.day.id);
  const queueIds = queue.records.map(x => x.source_content_id);
  assert.equal(sourceDays.length, 952);
  assert.equal(new Set(sourceIds).size, 952);
  assert.equal(new Set(queueIds).size, 952);
  assert.deepEqual([...queueIds].sort(), [...sourceIds].sort());
  assert.ok(queue.records.every(r => { const source = sourceDays.find(x => x.day.id === r.source_content_id); return source && source.category === r.topic_name && source.day.day === r.day_number; }));
});

test('all queue records remain pending, unscored, without subtopic IDs, and runtime-disabled', () => {
  const queue = JSON.parse(fs.readFileSync(path.join(root, 'public/assistant/content-drafts/952-day-redesign-queue.v1.json'), 'utf8'));
  assert.equal(queue.records.length, 952);
  assert.ok(queue.records.every(r => r.review_status === 'pending_review'));
  assert.ok(queue.records.every(r => r.runtime_eligible === false));
  assert.ok(queue.records.every(r => !Object.hasOwn(r, 'subtopic_id')));
  assert.ok(queue.records.every(r => Object.values(r.scores).every(v => v === null)));
  assert.ok(queue.records.every(r => r.reviewer_id === null && r.reviewer_qualification === null && r.reviewed_at === null));
});

test('legacy scientific family is not differentiated across the 952-day corpus', () => {
  const legacy = JSON.parse(fs.readFileSync(path.join(root, 'public/content/path-content.json'), 'utf8'));
  const days = Object.values(legacy.categories).flatMap(category => category.days);
  assert.equal(days.length, 952);
  assert.ok(days.every(day => day.scientific_family === 'general'));
});
