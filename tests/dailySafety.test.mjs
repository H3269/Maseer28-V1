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

test('legacy T11 repetitive behavior content stays blocked until specialist subtype review', async () => {
  const content = JSON.parse(await readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8'));
  const days = content.categories['عادت‌های تکراری'].days;
  assert.equal(days.length, 28);
  for (const day of days) {
    assert.equal(getDailySafetyMode(day), 'blocked', `${day.id} must remain withheld until its behavior class is reviewed`);
  }
  const skipped = createHumanReviewSkipRecord(days[0], new Date('2026-11-04T12:00:00.000Z'));
  assert.equal(skipped.status, 'skipped_human_review');
  assert.equal('score' in skipped, false);
  assert.equal(getDailySafetyMode({
    id: 'T11-D06',
    topic_id: 'T11',
    risk_level: 'routine',
    review_status: 'approved',
    review_record_id: 'review-t11-day-06',
  }), 'blocked', 'expert approval without exactly one reviewed subtype must not release content');
  assert.equal(getDailySafetyMode({
    id: 'T11-D06',
    topic_id: 'T11',
    risk_level: 'routine',
    review_status: 'approved',
    review_record_id: 'review-t11-day-06',
    subtopic_ids: ['T11-S01', 'T11-S02'],
  }), 'blocked', 'ambiguous multi-subtopic assignment must remain blocked');
  assert.equal(getDailySafetyMode({
    id: 'T11-D06',
    topic_id: 'T11',
    risk_level: 'routine',
    review_status: 'approved',
    review_record_id: 'review-t11-day-06',
    subtopic_ids: ['T11-S01'],
  }), 'routine', 'a reviewed simple habit with one explicit subtype and review record may be released');
  for (const subtopic of ['T11-S02', 'T11-S03']) {
    assert.equal(getDailySafetyMode({
      id: 'T11-D06',
      topic_id: 'T11',
      risk_level: 'routine',
      review_status: 'approved',
      review_record_id: 'review-t11-day-06',
      subtopic_ids: [subtopic],
    }), 'blocked', `${subtopic} must remain withheld until its specialist-specific taxonomy and intervention are separated`);
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
  }), 'blocked', 'approval alone must not release an unclassified control exercise');
  assert.equal(getDailySafetyMode({
    id: 'T31-D06',
    topic_id: 'T31',
    risk_level: 'routine',
    review_status: 'approved',
    subtopic_ids: ['T31-S01'],
    control_context: 'self_control_need',
  }), 'routine', 'a reviewed day with one explicit subtype and matching context may be released');
  assert.equal(getDailySafetyMode({
    id: 'T31-D06',
    topic_id: 'T31',
    risk_level: 'routine',
    review_status: 'approved',
    subtopic_ids: ['T31-S01', 'T31-S02'],
    control_context: 'self_control_need',
  }), 'blocked', 'a day assigned to multiple control subtypes must remain blocked');
  assert.equal(getDailySafetyMode({
    id: 'T31-D06',
    topic_id: 'T31',
    risk_level: 'routine',
    review_status: 'approved',
    subtopic_ids: ['T31-S01'],
    control_context: 'interpersonal_coercive_control',
  }), 'blocked', 'control context must match the explicitly assigned subtype');
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
  assert.match(app, /getDailySafetyMode\(activeDay\) === 'blocked'/, 'completion must enforce the safety gate independently of UI rendering');
  const completeDayStart = app.indexOf('async function completeDay');
  const completeDayEnd = app.indexOf('function openCurrentDay', completeDayStart);
  const completionHandler = app.slice(completeDayStart, completeDayEnd);
  assert.match(completionHandler, /if \(!activeDay \|\| getDailySafetyMode\(activeDay\) === 'blocked'\)/,
    'missing active content and blocked content must both fail closed at completion');
  assert.ok(completionHandler.indexOf('getDailySafetyMode(activeDay)') < completionHandler.indexOf('const record ='),
    'safety must be checked before any scored record is created');
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
