import test from 'node:test';
import assert from 'node:assert/strict';
import { getDailySafetyMode } from '../src/features/content/dailySafety.js';

test('T10 daily availability follows risk classification, not review status', () => {
  const base = {
    id: 'بی‌خوابی و مشکلات خواب-01', topic_id: 'T10', day: 1,
    review_status: 'draft', risk_level: 'caution',
    subtopic_ids: ['T10-S01'],
  };
  assert.equal(getDailySafetyMode(base), 'caution');
  assert.equal(getDailySafetyMode({ ...base, risk_level: 'routine' }), 'routine');
  assert.equal(getDailySafetyMode({ ...base, risk_level: 'unknown' }), 'caution');
  assert.equal(getDailySafetyMode({ ...base, risk_level: undefined }), 'routine');
  assert.equal(getDailySafetyMode({ ...base, subtopic_ids: ['T10-S03'], risk_level: 'caution' }), 'blocked');
  assert.equal(getDailySafetyMode({
    ...base, subtopic_ids: ['T10-S03'], risk_level: 'caution', safety_rule_ids: ['SR-T10-SLEEP-REFERRAL'],
  }), 'caution');
});

test('T10 review metadata does not alter an otherwise routine or caution day', () => {
  const base = { id: 'T10-D01', topic_id: 'T10', day: 1, risk_level: 'caution', subtopic_ids: ['T10-S01'] };
  assert.equal(getDailySafetyMode({ ...base, review_status: 'draft' }), 'caution');
  assert.equal(getDailySafetyMode({ ...base, review_status: 'approved' }), 'caution');
  assert.equal(getDailySafetyMode(base), 'caution');
});
