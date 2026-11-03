import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getDailySafetyMode, createHumanReviewSkipRecord } from '../src/features/content/dailySafety.js';

test('daily safety mode distinguishes routine, caution, and human-review-only content', () => {
  assert.equal(getDailySafetyMode({ risk_level: 'routine' }), 'routine');
  assert.equal(getDailySafetyMode({ risk_level: 'caution' }), 'caution');
  assert.equal(getDailySafetyMode({ risk_level: 'human_review_required' }), 'blocked');
  assert.equal(getDailySafetyMode({ risk_level: 'unknown' }), 'blocked');
  assert.equal(getDailySafetyMode({ review_status: 'pending_expert_review' }), 'blocked');
  assert.equal(getDailySafetyMode({ topic_id: 'T01' }), 'blocked');
  assert.equal(getDailySafetyMode(null), 'routine');
});

test('only human-review-required content can produce a non-scored skip record', () => {
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
  assert.throws(() => createHumanReviewSkipRecord({ id: 'T01-D10', risk_level: 'caution' }));
  assert.throws(() => createHumanReviewSkipRecord({ id: 'T01-D27', risk_level: 'human_review_required' }, 'not-a-date'));
});

test('T01 day 27 is explicitly withheld for human review', async () => {
  const content = JSON.parse(await readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8'));
  const day = content.categories['خشم'].days.find((item) => item.day === 27);
  assert.equal(day.risk_level, 'human_review_required');
  assert.equal(day.review_status, 'pending_expert_review');
  assert.match(day.when_to_seek_human_support, /خطر فوری/);
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
