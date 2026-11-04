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

test('all T03 fear content remains blocked until qualified review and day-specific safety approval', async () => {
  for (const day of [
    { id: 'ترس-14' },
    { id: 'T03-D14' },
    { id: 'T03-D13', topic_id: 'T03', day: 13, risk_level: 'routine', review_status: 'approved' },
    { id: 'ترس-13' },
  ]) {
    assert.equal(getDailySafetyMode(day), 'blocked');
    const skipped = createHumanReviewSkipRecord(day, new Date('2026-11-04T12:00:00.000Z'));
    assert.equal(skipped.status, 'skipped_human_review');
    assert.equal('score' in skipped, false);
  }

  const content = JSON.parse(await readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8'));
  const fearDays = content.categories['ترس']?.days || [];
  assert.equal(fearDays.length, 28);
  for (const day of fearDays) {
    assert.equal(getDailySafetyMode(day), 'blocked', `${day.id} must remain withheld until qualified review`);
  }

  const reviewedFearDay = ({ day = 13, risk_level = 'routine', safety_rule_ids } = {}) => ({
    id: 'T03-D' + String(day).padStart(2, '0'),
    topic_id: 'T03',
    day,
    risk_level,
    review_status: 'approved',
    subtopic_ids: ['T03-S01'],
    duration_minutes: 10,
    stop_conditions: ['اگر ناراحتی شدید شد، تمرین را متوقف کن.'],
    contraindications: ['در وضعیت ناامن، تمرین مستقیم انجام نشود.'],
    source_ids: ['SRC-TEST-REVIEWED-FEAR'],
    evidence_grade: 'not_assessed',
    review_record_id: 'review-t03-day-' + day,
    reviewer_name: 'Qualified reviewer',
    reviewer_role: 'qualified_clinician',
    reviewed_at: '2026-11-04T12:00:00.000Z',
    learning_objective: 'هدف آموزشی روشن و محدود',
    target_skill: 'مهارت مشخص',
    teaching_point: 'نکته آموزشی روشن',
    exercise_type: 'reflection',
    instructions: 'دستورالعمل بازبینی‌شده',
    reflection_prompt: 'پرسش تأملی',
    success_criterion: 'معیار موفقیت قابل مشاهده',
    when_to_seek_human_support: 'در صورت خطر یا اختلال، کمک انسانی بگیر.',
    ...(safety_rule_ids ? { safety_rule_ids } : {}),
  });
  assert.equal(getDailySafetyMode(reviewedFearDay()), 'routine',
    'a fully reviewed non-day-14 exercise with one explicit subtype may be released');
  assert.equal(getDailySafetyMode(reviewedFearDay({ day: 14, risk_level: 'routine' })), 'blocked',
    'T03 day 14 requires a caution classification and explicit safety rule after redesign');
  assert.equal(getDailySafetyMode(reviewedFearDay({
    day: 14,
    risk_level: 'caution',
    safety_rule_ids: ['SR-T03-D14-SAFETY'],
  })), 'caution');
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

test('legacy T17 relationship content stays blocked until complete expert and safety review', async () => {
  const content = JSON.parse(await readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8'));
  const days = content.categories['مشکلات رابطه'].days;
  assert.equal(days.length, 28);
  for (const day of days) {
    assert.equal(getDailySafetyMode(day), 'blocked', `${day.id} must remain withheld until its relationship subtype is reviewed`);
  }
  const skipped = createHumanReviewSkipRecord(days[0], new Date('2026-11-04T18:00:00.000Z'));
  assert.equal(skipped.status, 'skipped_human_review');
  assert.equal('score' in skipped, false);

  const reviewed = (subtopic, extra = {}) => ({
    id: 'T17-D06',
    topic_id: 'T17',
    day: 6,
    risk_level: 'routine',
    review_status: 'approved',
    review_record_id: 'review-t17-day-06',
    subtopic_ids: [subtopic],
    duration_minutes: 10,
    stop_conditions: ['در صورت فشار یا ناامنی تمرین را متوقف کن.'],
    contraindications: ['در رابطه ناایمن گفت‌وگوی مستقیم انجام نشود.'],
    source_ids: ['SRC-TEST-T17-REVIEWED'],
    evidence_grade: 'not_assessed',
    reviewer_name: 'Synthetic test reviewer',
    reviewer_role: 'qualified_clinician',
    reviewed_at: '2026-11-04T12:00:00.000Z',
    learning_objective: 'هدف آموزشی محدود',
    target_skill: 'مهارت مشخص',
    teaching_point: 'نکته آموزشی',
    exercise_type: 'reflection',
    instructions: 'دستورالعمل بازبینی‌شده',
    reflection_prompt: 'پرسش تأملی',
    success_criterion: 'معیار قابل مشاهده',
    when_to_seek_human_support: 'در صورت نگرانی از ایمنی از متخصص واجد صلاحیت کمک بگیر.',
    ...extra,
  });

  assert.equal(getDailySafetyMode(reviewed('T17-S01')), 'routine');
  assert.equal(getDailySafetyMode(reviewed('T17-S02')), 'routine');
  assert.equal(getDailySafetyMode(reviewed('T17-S03')), 'blocked',
    'power/control/safety content needs explicit safety rules, caution classification, and a safety reviewer');
  assert.equal(getDailySafetyMode(reviewed('T17-S03', {
    risk_level: 'caution',
    safety_rule_ids: ['SR-T17-COERCIVE-CONTROL-SAFETY'],
    reviewer_role: 'relationship_safety_reviewer',
  })), 'caution');

  const incompleteCases = [
    { review_record_id: '' },
    { reviewer_name: '' },
    { reviewer_role: 'content_editor' },
    { reviewed_at: 'not-a-date' },
    { source_ids: [] },
    { stop_conditions: [] },
    { contraindications: [] },
    { subtopic_ids: ['T17-S01', 'T17-S02'] },
    { topic_id: 'T16' },
    { day: 0 },
    { instructions: '' },
  ];
  for (const extra of incompleteCases) {
    assert.equal(getDailySafetyMode(reviewed('T17-S01', extra)), 'blocked',
      'incomplete review metadata must fail closed: ' + JSON.stringify(extra));
  }

  assert.equal(getDailySafetyMode(reviewed('T17-S03', {
    risk_level: 'caution',
    safety_rule_ids: ['SR-T17-COERCIVE-CONTROL-SAFETY'],
    reviewer_role: 'qualified_clinician',
  })), 'blocked', 'T17-S03 requires an explicitly designated safety reviewer');
  assert.equal(getDailySafetyMode(reviewed('T17-S01', { id: 'T16-D06' })), 'blocked',
    'an approved record must not be transferable to a different topic/day identifier');
  assert.equal(getDailySafetyMode(reviewed('T17-S01', { day: 7 })), 'blocked',
    'canonical day number and identifier must agree');
});

test('legacy T16 repetitive negative thinking content stays blocked until safety-aware subtype review', async () => {
  const content = JSON.parse(await readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8'));
  const days = content.categories['افکار منفی و نشخوار فکری'].days;
  assert.equal(days.length, 28);
  for (const day of days) {
    assert.equal(getDailySafetyMode(day), 'blocked', `${day.id} must remain withheld until its RNT subtype and safety rules are reviewed`);
  }
  const skipped = createHumanReviewSkipRecord(days[0], new Date('2026-11-04T17:00:00.000Z'));
  assert.equal(skipped.status, 'skipped_human_review');
  assert.equal('score' in skipped, false);

  const reviewed = (subtopic, extra = {}) => ({
    id: 'T16-D06',
    topic_id: 'T16',
    risk_level: 'routine',
    review_status: 'approved',
    review_record_id: 'review-t16-day-06',
    subtopic_ids: [subtopic],
    safety_rule_ids: ['SR-T16-THOUGHT-SAFETY'],
    ...extra,
  });
  assert.equal(getDailySafetyMode(reviewed('T16-S01')), 'routine');
  assert.equal(getDailySafetyMode(reviewed('T16-S02')), 'routine');
  assert.equal(getDailySafetyMode(reviewed('T16-S03', { safety_rule_ids: [] })), 'blocked',
    'rumination content without an explicit safety rule must remain withheld');
  assert.equal(getDailySafetyMode(reviewed('T16-S03', {
    risk_level: 'caution',
    safety_rule_ids: ['SR-T16-RNT-ESCALATION'],
  })), 'caution');
});

test('legacy T32 low-energy content stays blocked until clinical subtype review', async () => {
  const content = JSON.parse(await readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8'));
  const days = content.categories['بی‌انگیزگی'].days;
  assert.equal(days.length, 28);
  for (const day of days) {
    assert.equal(getDailySafetyMode(day), 'blocked', `${day.id} must remain withheld until its low-energy subtype is reviewed`);
  }
  const skipped = createHumanReviewSkipRecord(days[0], new Date('2026-11-04T16:00:00.000Z'));
  assert.equal(skipped.status, 'skipped_human_review');
  assert.equal('score' in skipped, false);

  const reviewed = (subtopic, extra = {}) => ({
    id: 'T32-D06',
    topic_id: 'T32',
    risk_level: 'routine',
    review_status: 'approved',
    review_record_id: 'review-t32-day-06',
    subtopic_ids: [subtopic],
    ...extra,
  });
  assert.equal(getDailySafetyMode(reviewed('T32-S01')), 'routine');
  assert.equal(getDailySafetyMode(reviewed('T32-S02')), 'routine');
  assert.equal(getDailySafetyMode(reviewed('T32-S03')), 'blocked',
    'physical/sleep/mood-related content needs an explicit safety rule and caution classification');
  assert.equal(getDailySafetyMode(reviewed('T32-S03', {
    risk_level: 'caution',
    safety_rule_ids: ['SR-T32-CLINICAL-REVIEW'],
  })), 'caution');
});

test('T13 day 14 behavior-reduction exercise stays blocked until subtype-specific safety review', async () => {
  const content = JSON.parse(await readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8'));
  const day = content.categories['تنهایی'].days.find((item) => item.day === 14);
  assert.ok(day);
  assert.equal(day.id, 'تنهایی-14');
  assert.equal(getDailySafetyMode(day), 'blocked');
  const skipped = createHumanReviewSkipRecord(day, new Date('2026-11-04T15:00:00.000Z'));
  assert.equal(skipped.status, 'skipped_human_review');
  assert.equal('score' in skipped, false);

  const reviewed = (extra = {}) => ({
    id: 'T13-D14',
    topic_id: 'T13',
    day: 14,
    risk_level: 'caution',
    review_status: 'approved',
    review_record_id: 'review-t13-day-14',
    subtopic_ids: ['T13-S01'],
    safety_rule_ids: ['SR-T13-D14-SAFETY'],
    ...extra,
  });
  assert.equal(getDailySafetyMode(reviewed()), 'caution');
  assert.equal(getDailySafetyMode(reviewed({ safety_rule_ids: [] })), 'blocked');
  assert.equal(getDailySafetyMode(reviewed({ risk_level: 'routine' })), 'blocked');
  assert.equal(getDailySafetyMode(reviewed({ subtopic_ids: ['T13-S01', 'T13-S02'] })), 'blocked');
});

test('legacy T10 sleep content stays blocked until sleep-specialist review', async () => {
  const content = JSON.parse(await readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8'));
  const days = content.categories['بی‌خوابی و مشکلات خواب'].days;
  assert.equal(days.length, 28);
  for (const day of days) {
    assert.equal(getDailySafetyMode(day), 'blocked', `${day.id} must remain withheld until its sleep subtype is reviewed`);
  }
  const skipped = createHumanReviewSkipRecord(days[0], new Date('2026-11-04T14:00:00.000Z'));
  assert.equal(skipped.status, 'skipped_human_review');
  assert.equal('score' in skipped, false);
  const approvedSleep = (subtopic, extra = {}) => ({
    id: 'T10-D06',
    topic_id: 'T10',
    risk_level: 'routine',
    review_status: 'approved',
    review_record_id: 'review-t10-day-06',
    subtopic_ids: [subtopic],
    ...extra,
  });
  assert.equal(getDailySafetyMode(approvedSleep('T10-S01')), 'routine');
  assert.equal(getDailySafetyMode(approvedSleep('T10-S02')), 'routine');
  assert.equal(getDailySafetyMode(approvedSleep('T10-S03')), 'blocked',
    'medical/referral-related sleep content needs an explicit safety rule and caution classification');
  assert.equal(getDailySafetyMode(approvedSleep('T10-S03', {
    risk_level: 'caution',
    safety_rule_ids: ['SR-T10-SLEEP-REFERRAL'],
  })), 'caution');
});

test('legacy T12 boundary content stays blocked until expert and safety review', async () => {
  const content = JSON.parse(await readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8'));
  const days = content.categories['مرزبندی و نه گفتن'].days;
  assert.equal(days.length, 28);
  for (const day of days) {
    assert.equal(getDailySafetyMode(day), 'blocked', `${day.id} must remain withheld until its boundary subtype is reviewed`);
  }
  const skipped = createHumanReviewSkipRecord(days[0], new Date('2026-11-04T13:00:00.000Z'));
  assert.equal(skipped.status, 'skipped_human_review');
  assert.equal('score' in skipped, false);
  const approvedBoundary = (subtopic, extra = {}) => ({
    id: 'T12-D06',
    topic_id: 'T12',
    risk_level: 'routine',
    review_status: 'approved',
    review_record_id: 'review-t12-day-06',
    subtopic_ids: [subtopic],
    ...extra,
  });
  assert.equal(getDailySafetyMode(approvedBoundary('T12-S01')), 'routine');
  assert.equal(getDailySafetyMode(approvedBoundary('T12-S02')), 'routine');
  assert.equal(getDailySafetyMode(approvedBoundary('T12-S03')), 'blocked',
    'unsafe-relationship content needs an explicit safety rule and caution classification');
  assert.equal(getDailySafetyMode(approvedBoundary('T12-S03', {
    risk_level: 'caution',
    safety_rule_ids: ['SR-T12-RELATIONSHIP-SAFETY'],
  })), 'caution');
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
