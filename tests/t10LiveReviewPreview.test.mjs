import test from 'node:test';
import assert from 'node:assert/strict';
import { getDailySafetyMode } from '../src/features/content/dailySafety.js';

test('T10 draft is available for owner live review while retaining risk classification', () => {
  const base = {
    id: 'T10-D01', topic_id: 'T10', day: 1,
    review_status: 'draft', risk_level: 'caution',
    subtopic_ids: ['T10-S01'],
  };
  assert.equal(getDailySafetyMode(base), 'caution');
  assert.equal(getDailySafetyMode({ ...base, risk_level: 'routine' }), 'routine');
  assert.equal(getDailySafetyMode({ ...base, risk_level: 'unknown' }), 'blocked');
  assert.equal(getDailySafetyMode({ ...base, risk_level: undefined }), 'blocked');
  assert.equal(getDailySafetyMode({ ...base, subtopic_ids: ['T10-S03'], risk_level: 'caution' }), 'blocked');
  assert.equal(getDailySafetyMode({ ...base, subtopic_ids: ['T10-S03'], risk_level: 'caution', safety_rule_ids: ['SR-T10-SLEEP-REFERRAL'] }), 'caution');
});

test('unapproved T10 does not get a blanket routine pass', () => {
  assert.equal(getDailySafetyMode({
    id: 'T10-D01', topic_id: 'T10', day: 1,
    review_status: 'draft', risk_level: 'caution',
    subtopic_ids: ['T10-S01'],
  }), 'caution');
});
