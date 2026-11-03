import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getDailySafetyMode, createHumanReviewSkipRecord } from '../src/features/content/dailySafety.js';

test('daily safety mode distinguishes routine, caution, and human-review-only content', () => {
  assert.equal(getDailySafetyMode({}), 'routine');
  assert.equal(getDailySafetyMode({ risk_level: 'routine' }), 'blocked');
  assert.equal(getDailySafetyMode({ risk_level: 'caution' }), 'blocked');
  assert.equal(getDailySafetyMode({ risk_level: 'routine', review_status: 'approved' }), 'routine');
  assert.equal(getDailySafetyMode({ risk_level: 'caution', review_status: 'approved' }), 'caution');
  assert.equal(getDailySafetyMode({ risk_level: 'human_review_required', review_status: 'approved' }), 'blocked');
  assert.equal(getDailySafetyMode({ risk_level: 'unknown', review_status: 'approved' }), 'blocked');
  assert.equal(getDailySafetyMode({ review_status: 'pending_expert_review' }), 'blocked');
  assert.equal(getDailySafetyMode({ risk_level: 'routine', review_status: 'pending_expert_review' }), 'blocked');
  assert.equal(getDailySafetyMode({ risk_level: 'caution', review_status: 'draft' }), 'blocked');
  assert.equal(getDailySafetyMode({ risk_level: 'routine', review_status: null }), 'blocked');
  assert.equal(getDailySafetyMode({ topic_id: 'T01' }), 'blocked');
  assert.equal(getDailySafetyMode(null), 'routine');
});

test('only blocked daily content can produce a non-scored skip record', () => {
  const day = { id: 'T01-D27', risk_level: 'human_review_required' };
  const record = createHumanReviewSkipRecord(day, new Date('2026-11-03T12:00:00.000Z'));
  assert.deepEqual(record, {
    status: 'skipped_human_review',
    feedbackText: 'این تمرین به دلیل نیاز به بازبینی انسانی اجرا نشد. هیچ امتیازی ثبت نشده و این ثبت به معنی بهبود یا بدترشدن نیست.',
    exerciseId: 'T01-D27',
    updatedAt: '2026-11-03T12:00:00.000Z',
  });
  assert.equal('score' in record, false);
  assert.equal('feedback' in record, false);
  assert.throws(() => createHumanReviewSkipRecord({ id: 'T01-D10', risk_level: 'caution', review_status: 'approved' }));
  assert.throws(() => createHumanReviewSkipRecord({ id: 'T01-D27', risk_level: 'human_review_required' }, 'not-a-date'));
});

test('unapproved review metadata cannot be overridden by a routine risk label', () => {
  const day = { id: 'T01-D12', risk_level: 'routine', review_status: 'pending_expert_review' };
  const record = createHumanReviewSkipRecord(day, new Date('2026-11-03T12:00:00.000Z'));
  assert.equal(record.status, 'skipped_human_review');
  assert.equal('score' in record, false);
  assert.equal('feedback' in record, false);
});

test('T01 draft days remain blocked at runtime until their review is approved', async () => {
  const [content, topics] = await Promise.all([
    readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../public/assistant/knowledge/topics.v1.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  const days = content.categories['خشم'].days;
  const topic = topics.topics.find((item) => item.topic_id === 'T01');
  const dayTen = days.find((item) => item.day === 10);
  assert.ok(topic);
  assert.notEqual(dayTen.review_status, 'approved');
  assert.equal(getDailySafetyMode(dayTen), 'blocked');
  for (const day of days) {
    if (day.review_status !== 'approved') {
      assert.ok(topic.draft_content_ids.includes(day.id), `${day.id} must remain in draft links`);
      assert.equal(getDailySafetyMode(day), 'blocked', `${day.id} must not run before expert approval`);
    } else {
      assert.ok(topic.content_ids.includes(day.id), `${day.id} must be linked as approved content`);
    }
  }
});

test('ambiguous control topic stays blocked until its subtypes receive expert review', async () => {
  const content = JSON.parse(await readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8'));
  const days = content.categories['کنترل‌گری'].days;
  assert.equal(days.length, 28);
  for (const day of days) {
    assert.equal(getDailySafetyMode(day), 'blocked', `${day.id} must remain withheld while personal over-control and coercive control are not separated`);
  }
  assert.equal(getDailySafetyMode({ id: 'کنترل‌گری-01' }), 'blocked');
  assert.equal(getDailySafetyMode({ id: 'T31-D06', topic_id: 'T31' }), 'blocked');
  assert.equal(getDailySafetyMode({
    id: 'T31-D06',
    topic_id: 'T31',
    risk_level: 'routine',
    review_status: 'approved',
  }), 'routine', 'an explicitly approved and risk-classified day may be released');
  const skipped = createHumanReviewSkipRecord(days[0], new Date('2026-11-03T12:00:00.000Z'));
  assert.equal(skipped.status, 'skipped_human_review');
  assert.equal('score' in skipped, false);
});

test('T01 day 27 is explicitly withheld for human review', async () => {
  const content = JSON.parse(await readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8'));
  const day = content.categories['خشم'].days.find((item) => item.day === 27);
  assert.equal(day.risk_level, 'human_review_required');
  assert.equal(day.review_status, 'pending_expert_review');
  assert.match(day.when_to_seek_human_support, /فوراً از خدمات اضطراری/);
});

test('day screen wires human-review blocking and caution metadata into the interface', async () => {
  const ui = await readFile(new URL('../src/features/journey/JourneyScreens.jsx', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const archiveExport = await readFile(new URL('../src/features/journey/archiveExport.js', import.meta.url), 'utf8');
  assert.match(ui, /getDailySafetyMode\(data\) === 'blocked'/);
  assert.match(ui, /if \(requiresHumanReview\) return/);
  assert.match(ui, /onClick=\{onSkip\}/);
  assert.match(ui, /data\.stop_conditions/);
  assert.match(ui, /data\.contraindications/);
  assert.match(app, /onSkip=\{skipDayForHumanReview\}/);
  assert.match(app, /createHumanReviewSkipRecord\(activeDay/);
  assert.match(app, /onSkipRelationshipSafety=\{skipDayForRelationshipSafety\}/);
  assert.match(archiveExport, /skipped_human_review/);
  assert.match(archiveExport, /skipped_safety_gate/);
  assert.match(archiveExport, /هیچ امتیازی ثبت نشده است/);
});
