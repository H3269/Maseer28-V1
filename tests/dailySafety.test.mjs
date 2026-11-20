import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getDailySafetyMode, getControlContextForDay } from '../src/features/content/dailySafety.js';

test('daily availability does not depend on review or specialist approval metadata', () => {
  assert.equal(getDailySafetyMode({}), 'routine');
  assert.equal(getDailySafetyMode({ risk_level: 'routine', review_status: 'draft' }), 'routine');
  assert.equal(getDailySafetyMode({ risk_level: 'caution', review_status: 'pending_expert_review' }), 'caution');
  assert.equal(getDailySafetyMode({ risk_level: 'routine', review_status: null }), 'routine');
  assert.equal(getDailySafetyMode({ risk_level: 'urgent_support_required' }), 'blocked');
  assert.equal(getDailySafetyMode({ risk_level: 'high' }), 'blocked');
  assert.equal(getDailySafetyMode({ risk_level: 'moderate' }), 'blocked');
  assert.equal(getDailySafetyMode({ risk_level: 'unknown' }), 'caution');
  assert.equal(getDailySafetyMode(null), 'routine');
});

test('T03 day 14 retains its explicit caution and safety-rule requirements', () => {
  const base = { id: 'T03-D14', topic_id: 'T03', day: 14, subtopic_ids: ['T03-S01'] };
  assert.equal(getDailySafetyMode({ ...base, risk_level: 'routine' }), 'blocked');
  assert.equal(getDailySafetyMode({ ...base, risk_level: 'caution' }), 'blocked');
  assert.equal(getDailySafetyMode({ ...base, risk_level: 'caution', safety_rule_ids: ['SR-T03-D14'] }), 'caution');
  assert.equal(getDailySafetyMode({
    ...base, risk_level: 'caution', safety_rule_ids: ['SR-T03-D14'], review_status: 'draft',
  }), 'caution');
});

test('T10, T12, T17 and T32 keep explicit risk-specific safeguards without review gates', () => {
  assert.equal(getDailySafetyMode({
    id: 'T10-D03', topic_id: 'T10', day: 3, subtopic_ids: ['T10-S03'], risk_level: 'caution',
    safety_rule_ids: ['SR-T10-SLEEP'],
  }), 'caution');
  assert.equal(getDailySafetyMode({
    id: 'T10-D03', topic_id: 'T10', day: 3, subtopic_ids: ['T10-S03'], risk_level: 'caution',
    safety_rule_ids: ['SR-T10-SLEEP'], review_status: 'draft',
  }), 'caution');
  assert.equal(getDailySafetyMode({ id: 'T12-D06', topic_id: 'T12', day: 6, subtopic_ids: ['T12-S03'], risk_level: 'caution' }), 'caution');
  assert.equal(getDailySafetyMode({ id: 'T17-D06', topic_id: 'T17', day: 6, subtopic_ids: ['T17-S03'], risk_level: 'caution', safety_rule_ids: ['SR-T17'] }), 'caution');
  assert.equal(getDailySafetyMode({ id: 'T17-D06', topic_id: 'T17', day: 6, subtopic_ids: ['T17-S03'], risk_level: 'routine' }), 'blocked');
  assert.equal(getDailySafetyMode({ id: 'T32-D06', topic_id: 'T32', day: 6, subtopic_ids: ['T32-S03'], risk_level: 'caution', safety_rule_ids: ['SR-T32'] }), 'caution');
});

test('T31 keeps explicit subtype/context distinction independently of approval metadata', () => {
  const day = {
    id: 'T31-D06', topic_id: 'T31', day: 6, subtopic_ids: ['T31-S02'],
    control_context: 'interpersonal_coercive_control', risk_level: 'caution', review_status: 'draft',
  };
  assert.equal(getControlContextForDay(day), 'interpersonal_coercive_control');
  assert.equal(getDailySafetyMode(day), 'caution');
  assert.equal(getDailySafetyMode({ ...day, control_context: null }), 'blocked');
});

test('all 952 daily units remain addressable by safety classification without approval metadata', async () => {
  const content = JSON.parse(await readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8'));
  const categories = Object.values(content.categories || {});
  assert.equal(categories.length, 34);
  for (const category of categories) {
    assert.equal(category.days.length, 28);
    for (const day of category.days) {
      assert.equal(Object.hasOwn(day, 'review_status'), false, `${day.id} must not carry a specialist-review runtime gate`);
      assert.equal(Object.hasOwn(day, 'review_record_id'), false, `${day.id} must not carry a reviewer-record runtime dependency`);
      const mode = getDailySafetyMode(day);
      assert.ok(['routine', 'caution', 'blocked'].includes(mode), String(day.id));
    }
  }
});
