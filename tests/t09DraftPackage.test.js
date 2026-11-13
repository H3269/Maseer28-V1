// T09 draft-only regression suite: validates content alignment without activating runtime data.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const guide = JSON.parse(await readFile(new URL('../docs/T06-T34-PACKAGES/T09/T09_ASSISTANT_GUIDE_DRAFT_FULL_20261113.json', import.meta.url), 'utf8'));
const canonical = JSON.parse(await readFile(new URL('../docs/T06-T34-PACKAGES/T09/T09_CANONICAL_CONTENT_DRAFT_V2_20261113.json', import.meta.url), 'utf8'));

const answer = (record, id) => record.questions.find((question) => question.id === id)?.answer || '';

test('T09 draft contains exactly 28 canonical days and 14 prepared questions per day', () => {
  assert.equal(guide.topicId, 'T09');
  assert.equal(canonical.records.length, 28);
  assert.equal(guide.records.length, 28);
  for (let index = 0; index < 28; index += 1) {
    assert.equal(guide.records[index].day, index + 1);
    assert.equal(canonical.records[index].day, index + 1);
    assert.equal(guide.records[index].questions.length, 14);
    assert.equal(new Set(guide.records[index].questions.map((item) => item.id)).size, 14);
  }
  assert.equal(guide.records.reduce((sum, record) => sum + record.questions.length, 0), 392);
});

test('T09 assistant guide and canonical content stay aligned across all daily fields', () => {
  const fields = [
    ['title', 'title'],
    ['objective', 'learning_objective'],
    ['skill', 'target_skill'],
    ['mechanism', 'teaching_point'],
    ['exercise', 'instructions'],
    ['action', 'action'],
    ['lightVersion', 'light_version'],
    ['progressVersion', 'progress_version'],
    ['restVersion', 'rest_version'],
    ['durationMinutes', 'duration_minutes'],
    ['successCriterion', 'success_criterion'],
    ['stopCondition', 'stop_condition_text'],
  ];
  for (let index = 0; index < 28; index += 1) {
    const guideDay = guide.records[index];
    const canonicalDay = canonical.records[index];
    for (const [guideField, canonicalField] of fields) {
      assert.equal(guideDay[guideField], canonicalDay[canonicalField], `day ${index + 1}: ${guideField}`);
    }
    assert.deepEqual(guideDay.stopConditions, canonicalDay.stop_conditions, `day ${index + 1}: stopConditions`);
    assert.equal(canonicalDay.review_status, 'draft');
    assert.equal(canonicalDay.evidence_grade, 'not_assessed');
    assert.deepEqual(canonicalDay.source_ids, []);
  }
});

test('all 392 answers are nonblank and exact-text unique', () => {
  const answers = guide.records.flatMap((record) => record.questions.map((question) => question.answer));
  assert.equal(answers.length, 392);
  assert.ok(answers.every((item) => typeof item === 'string' && item.trim().length > 0));
  assert.equal(new Set(answers).size, 392);
});

test('each FAQ answer is anchored to its corresponding daily content and safety fields', () => {
  for (const record of guide.records) {
    assert.ok(answer(record, 'q01').includes(record.exercise), `day ${record.day}: q01 exercise`);
    assert.ok(answer(record, 'q03').includes(record.action), `day ${record.day}: q03 action`);
    assert.equal(answer(record, 'q05'), record.lightVersion, `day ${record.day}: q05 is the exact light version`);
    assert.equal(answer(record, 'q06'), record.successCriterion, `day ${record.day}: q06 success criterion`);
    assert.ok(answer(record, 'q07').includes(record.stopCondition), `day ${record.day}: q07 stop condition`);
    assert.ok(record.stopConditions.every((condition) => answer(record, 'q07').includes(condition)), `day ${record.day}: q07 all safety conditions`);
    assert.ok(answer(record, 'q07').includes(record.restVersion), `day ${record.day}: q07 rest version`);
    assert.ok(answer(record, 'q09').includes(record.exercise), `day ${record.day}: q09 exercise`);
    assert.ok(answer(record, 'q09').includes(record.action), `day ${record.day}: q09 action`);
    assert.ok(answer(record, 'q10').includes(record.restVersion), `day ${record.day}: q10 rest version`);
    assert.ok(answer(record, 'q10').includes(record.lightVersion), `day ${record.day}: q10 light version`);
    assert.ok(answer(record, 'q11').includes(record.stopCondition), `day ${record.day}: q11 stop condition`);
    assert.ok(record.stopConditions.every((condition) => answer(record, 'q11').includes(condition)), `day ${record.day}: q11 all safety conditions`);
    assert.ok(answer(record, 'q11').includes(record.restVersion), `day ${record.day}: q11 rest version`);
    assert.ok(answer(record, 'q14').includes('این زمان فقط برای خودِ مشاهده، نوشتن یا برنامه‌ریزیِ تمرین است'), `day ${record.day}: q14 scope`);
    assert.ok(answer(record, 'q14').includes(String(record.durationMinutes)), `day ${record.day}: q14 duration`);
  }
});

test('q09 and q11 avoid repeated generic endings and openings', () => {
  const q09 = guide.records.map((record) => answer(record, 'q09'));
  const q11 = guide.records.map((record) => answer(record, 'q11'));
  assert.equal(new Set(q09).size, 28);
  assert.equal(new Set(q11).size, 28);
  assert.ok(q09.every((item) => !item.includes('اگر فقط فرصت یکی را داری، با نسخه سبک تمرین شروع کن')));
  assert.ok(q11.every((item) => !item.startsWith('اگر فشار یا مقاومت بالا رفت، لازم نیست ادامه بدهی')));
});

test('q02 has one distinct concrete example per day and q08 has day-specific no-event guidance', () => {
  const examples = guide.records.map((record) => answer(record, 'q02'));
  const noEvent = guide.records.map((record) => answer(record, 'q08'));
  assert.equal(new Set(examples).size, 28);
  assert.equal(new Set(noEvent).size, 28);
  assert.ok(examples.every((item) => (item.match(/مثلاً/g) || []).length <= 1));
});

test('T09 keeps all durations provisional and all content withheld from production approval', () => {
  assert.ok(canonical.records.every((record) => [5, 10, 15].includes(record.duration_minutes)));
  assert.ok(new Set(canonical.records.map((record) => record.duration_minutes)).size > 1);
  assert.equal(new Set(guide.records.map((record) => answer(record, 'q14'))).size, 28);
  assert.ok(guide.records.every((record) => answer(record, 'q14').includes('این زمان فقط برای خودِ مشاهده، نوشتن یا برنامه‌ریزیِ تمرین است')));
  assert.ok(canonical.records.every((record) => record.duration_status === 'provisional_estimate'));
  assert.ok(canonical.records.every((record) => record.review_status === 'draft'));
  assert.ok(canonical.records.every((record) => record.evidence_grade === 'not_assessed'));
  assert.ok(canonical.records.every((record) => record.source_ids.length === 0));
});

test('days 6, 7, 11, 15, 16 and 25 keep stop and rest guidance aligned with their daily task', () => {
  const byDay = (day) => guide.records.find((record) => record.day === day);
  assert.doesNotMatch(byDay(6).stopCondition, /نشانه شروع/u);
  assert.match(byDay(6).restVersion, /تحلیل نیاز را متوقف کن/u);
  assert.doesNotMatch(byDay(7).stopCondition, /مرور هفتگی/u);
  assert.match(byDay(7).stopCondition, /هدف/u);
  assert.doesNotMatch(byDay(7).restVersion, /مرور هفتگی/u);
  assert.doesNotMatch(byDay(11).restVersion, /فهرست اولویت را کوچک نکن/u);
  assert.doesNotMatch(byDay(15).stopCondition, /پاداش/u);
  assert.match(byDay(15).stopCondition, /قول قطعی/u);
  assert.doesNotMatch(byDay(16).stopCondition, /بیماری، فرسودگی/u);
  assert.match(byDay(16).stopCondition, /تغییر محیط/u);
  assert.doesNotMatch(byDay(25).stopCondition, /ارزش انتخابی/u);
  assert.match(byDay(25).stopCondition, /موعد واقعی/u);
});

test('T09 actions remain specific at the six cross-topic near-overlap points', () => {
  const expected = new Map([
    [7, /حرکت آغازِ قابل مشاهده/u],
    [10, /نخستین بخش کار را آغاز کن/u],
    [12, /پرسش روشن درباره خروجی، دسترسی یا تقسیم مسئولیت/u],
    [21, /مانع ساختاری/u],
    [22, /بخش ضروریِ متناسب با ظرفیت امروز/u],
    [23, /رویداد طبیعی/u],
  ]);
  for (const [day, pattern] of expected) {
    const record = guide.records.find((item) => item.day === day);
    assert.match(record.action, pattern, `day ${day}: action specificity`);
    assert.ok(answer(record, 'q03').includes(record.action), `day ${day}: q03 action`);
  }
});

test('T09 day 1 action is task-and-delay specific rather than a generic observation prompt', () => {
  const record = guide.records.find((item) => item.day === 1);
  assert.match(record.action, /زمان قصد شروع و پیامد واقعی تأخیر/u);
  assert.doesNotMatch(record.action, /برای مشاهده هفت‌روزه انتخاب کن/u);
  assert.equal(answer(record, 'q03'), `اقدام اختصاصی روز 1: ${record.action}`);
});

test('day 14 does not turn healthy rest into avoidance or prescribe accountability partners', () => {
  const record = guide.records.find((item) => item.day === 14);
  assert.ok(record.exercise.includes('استراحت برنامه‌ریزی‌شده'));
  assert.ok(record.action.includes('استراحت لازم را حذف نکن'));
  assert.ok(record.restVersion.includes('استراحت واقعی'));
  assert.doesNotMatch(JSON.stringify(record), /همراه پاسخگو/u);
});

test('day 19 strategy testing is distinct from day 23 habit cueing', () => {
  const day19 = guide.records.find((item) => item.day === 19);
  const day23 = guide.records.find((item) => item.day === 23);
  assert.match(day19.title, /کار کم‌پیامد/u);
  assert.match(day19.exercise, /راهبرد مشخص/u);
  assert.match(day19.action, /کمک کرد\/نکرد/u);
  assert.match(day23.exercise, /نشانه ثابت/u);
  assert.notEqual(answer(day19, 'q09'), answer(day23, 'q09'));
});

test('day 20 tracking remains optional and task-specific, not diagnostic or self-worth scoring', () => {
  const record = guide.records.find((item) => item.day === 20);
  assert.match(record.exercise, /زمان برنامه‌ریزی‌شده شروع/u);
  assert.match(record.exercise, /زمان واقعی شروع/u);
  assert.match(record.successCriterion, /تشخیص بالینی/u);
  assert.match(record.stopCondition, /شرم، وسواس یا فشار/u);
});

test('day 24 delegation requires agreement, authority and competence', () => {
  const record = guide.records.find((item) => item.day === 24);
  assert.match(record.progressVersion, /توافق را پیش از واگذاری بگیر/u);
  assert.match(record.restVersion, /یک‌طرفه منتقل نکن/u);
  assert.match(record.stopCondition, /توافق، اختیار یا صلاحیت/u);
});

test('day 26 no longer contains stale value-based contraindication language', () => {
  const record = canonical.records.find((item) => item.day === 26);
  assert.match(record.contraindications.join(' '), /وابستگی یا زمان تحویل/u);
  assert.doesNotMatch(record.contraindications.join(' '), /ارزش‌محوری/u);
});
