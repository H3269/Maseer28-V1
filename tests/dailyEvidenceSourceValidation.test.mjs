import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDailyEvidenceSource } from '../src/features/content/dailyEvidenceSourceValidation.js';

const registry = { sources: [{ source_id: 'SRC-1' }] };

test('unassessed daily content does not require reviewer metadata or evidence attribution', () => {
  assert.deepEqual(validateDailyEvidenceSource({ evidence_grade: 'not_assessed' }, registry), { valid: true, reason: null });
});

test('assessed evidence requires at least one registered source', () => {
  assert.equal(validateDailyEvidenceSource({ evidence_grade: 'moderate', source_ids: [] }, registry).reason, 'source_ids_required_for_assessed_evidence');
  assert.deepEqual(validateDailyEvidenceSource({ evidence_grade: 'moderate', source_ids: ['SRC-1'] }, registry), { valid: true, reason: null });
});

test('unknown source identifiers are rejected', () => {
  assert.equal(validateDailyEvidenceSource({ evidence_grade: 'not_assessed', source_ids: ['SRC-MISSING'] }, registry).reason, 'source_ids_must_exist_in_evidence_registry');
});

test('invalid daily records are rejected', () => {
  assert.equal(validateDailyEvidenceSource(null, registry).reason, 'invalid_daily_record');
});
