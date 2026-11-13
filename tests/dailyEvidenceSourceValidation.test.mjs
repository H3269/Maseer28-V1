import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDailyEvidenceSourceIds } from '../src/features/content/dailyEvidenceSourceValidation.js';

const registry = new Set(['SRC-VALID-001']);

test('draft and not-assessed content may keep an explicit empty source_ids array', () => {
  const result = validateDailyEvidenceSourceIds({
    review_status: 'draft',
    evidence_grade: 'not_assessed',
    source_ids: [],
  }, registry);
  assert.deepEqual(result, { valid: true, reason: 'draft_or_unassessed_without_claim_links' });
});

test('pending expert review may remain unassessed until claim-level source mapping is complete', () => {
  const result = validateDailyEvidenceSourceIds({
    review_status: 'pending_expert_review',
    evidence_grade: 'not_assessed',
    source_ids: [],
  }, registry);
  assert.equal(result.valid, true);
});

test('approved content cannot omit claim-level evidence sources', () => {
  const result = validateDailyEvidenceSourceIds({
    review_status: 'approved',
    evidence_grade: 'not_assessed',
    source_ids: [],
  }, registry);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'source_ids_required_for_assessed_or_approved_content');
});


test('approved content cannot retain an unassessed evidence grade even if an ID is present', () => {
  const result = validateDailyEvidenceSourceIds({
    review_status: 'approved',
    evidence_grade: 'not_assessed',
    source_ids: ['SRC-VALID-001'],
  }, registry);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'approved_content_cannot_be_not_assessed');
});

test('assessed content cannot omit its evidence source links even while still draft', () => {
  const result = validateDailyEvidenceSourceIds({
    review_status: 'draft',
    evidence_grade: 'low',
    source_ids: [],
  }, registry);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'source_ids_required_for_assessed_or_approved_content');
});

test('source IDs must exist in the evidence registry when provided', () => {
  assert.equal(validateDailyEvidenceSourceIds({
    review_status: 'draft',
    evidence_grade: 'not_assessed',
    source_ids: ['SRC-VALID-001'],
  }, registry).valid, true);
  const invalid = validateDailyEvidenceSourceIds({
    review_status: 'draft',
    evidence_grade: 'not_assessed',
    source_ids: ['SRC-MISSING-001'],
  }, registry);
  assert.equal(invalid.valid, false);
  assert.equal(invalid.reason, 'source_ids_not_in_registry');
});

test('source_ids must be an explicit array even for draft records', () => {
  const result = validateDailyEvidenceSourceIds({
    review_status: 'draft',
    evidence_grade: 'not_assessed',
  }, registry);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'source_ids_must_be_an_array');
});
