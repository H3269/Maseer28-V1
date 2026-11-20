import test from 'node:test';
import assert from 'node:assert/strict';
import T12_CONTENT from '../content/drafts/t12-boundaries-28day-redesign.v1.json' with { type: 'json' };

test('T12 content draft has 28 ordered daily records', () => {
  assert.equal(T12_CONTENT.records.length, 28);
  for (let day = 1; day <= 28; day += 1) {
    const record = T12_CONTENT.records[day - 1];
    assert.equal(record.day, day);
    assert.equal(record.id, `مرزبندی و نه گفتن-${String(day).padStart(2, '0')}`);
    assert.equal(record.topic_id, 'T12');
    assert.ok(record.title && record.objective && record.exercise && record.actionText);
    assert.ok(record.successCriterion && record.stopCondition);
    assert.ok(record.subtopic_ids.length > 0);
  }
});

test('T12 exercises and actions are unique and source gaps remain explicit', () => {
  const normalize = (value) => value.normalize('NFKC').replace(/\s+/g, ' ').trim();
  assert.equal(new Set(T12_CONTENT.records.map((r) => normalize(r.exercise))).size, 28);
  assert.equal(new Set(T12_CONTENT.records.map((r) => normalize(r.actionText))).size, 28);
  for (const record of T12_CONTENT.records) {
    assert.equal(record.mechanism, null);
    assert.equal(record.durationMinutes, null);
    assert.equal(record.evidenceGrade, 'not_assessed');
    assert.equal(record.reviewStatus, undefined);
  }
});
