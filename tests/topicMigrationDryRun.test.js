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
