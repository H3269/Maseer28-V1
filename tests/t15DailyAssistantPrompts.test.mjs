import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import {
  T15_DAILY_ASSISTANT_GUIDES,
  answerT15DailyPreparedQuestion,
  getT15DailyAssistantPromptGroups,
} from '../src/features/assistant/t15DailyAssistantPrompts.js';
import { DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN } from '../src/features/assistant/dailyAssistantSafetyReminder.js';

const expectedQuestions = [
  'منظور از تمرین امروز چیست؟',
  'برای تمرین امروز یک مثال می‌زنی؟',
  'منظور از اقدام اختصاصی امروز چیست؟',
  'برای اقدام امروز یک مثال می‌زنی؟',
  'اگر انجام کاملش برایم سخت بود چه کنم؟',
  'از کجا بفهمم درست انجامش داده‌ام؟',
  'چه زمانی باید تمرین امروز را متوقف کنم؟',
  'اگر امروز نمونه یا آمادگی انجام تمرین را نداشتم چه کنم؟',
  'تمرین و اقدام امروز چه تفاوتی دارند؟',
  'اگر تمرین را انجام ندادم یا فراموش کردم چه کنم؟',
  'اگر هنگام تمرین فشار یا ناراحتی‌ام بیشتر شد چه کنم؟',
  'آیا لازم است حتماً با فرد دیگری صحبت کنم؟',
  'می‌توانم تمرین را تغییر بدهم یا به روش خودم انجام بدهم؟',
  'این تمرین چقدر زمان می‌برد؟',
];
const daily = (guide) => ({
  id: 'اعتمادبه‌نفس پایین-' + String(guide.day).padStart(2, '0'),
  day: guide.day,
  topic_id: 'T15',
  title: guide.title,
  sourceExercise: guide.exercise,
  sourceActionText: guide.action,
  exercise: guide.exercise,
  actionText: guide.action,
});

test('T15 contains 28 days and 392 complete unique prepared answers', () => {
  assert.equal(T15_DAILY_ASSISTANT_GUIDES.length, 28);
  const answers = [];
  for (const [index, guide] of T15_DAILY_ASSISTANT_GUIDES.entries()) {
    assert.equal(guide.day, index + 1);
    assert.equal(guide.topicId, 'T15');
    assert.equal(guide.questions.length, 14);
    assert.deepEqual(guide.questions.map((question) => question.label), expectedQuestions);
    assert.ok(guide.questions.every((question) => question.answer?.trim()));
    assert.equal(guide.evidenceGrade, 'not_assessed');
    assert.equal(guide.reviewStatus, 'pending_owner_review');
    answers.push(...guide.questions.map((question) => question.answer));
  }
  assert.equal(answers.length, 392);
  assert.equal(new Set(answers).size, 392);
});

test('T15 overlay matches all daily guide fields used by the assistant and UI', async () => {
  const overlay = JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
  const days = overlay.categories['اعتمادبه‌نفس پایین'].days;
  assert.equal(days.length, 28);
  for (const guide of T15_DAILY_ASSISTANT_GUIDES) {
    const item = days.find((day) => day.day === guide.day);
    assert.ok(item, 'missing T15 overlay day ' + guide.day);
    assert.equal(item.title, guide.title);
    assert.equal(item.exercise, guide.exercise);
    assert.equal(item.actionText, guide.action);
    assert.equal(item.lightExerciseText, guide.lightVersion);
    assert.equal(item.lightActionText, guide.lightActionVersion);
    assert.equal(item.progressActionText, guide.progressActionVersion);
    assert.equal(item.restExerciseText, guide.restVersion);
    assert.equal(item.restActionText, guide.restActionVersion);
    assert.equal(item.intro, 'هدف امروز: ' + guide.objective + '\nمهارت امروز: ' + guide.skill);
    assert.equal(item.closing, 'معیار موفقیت: ' + guide.successCriterion + '\nپرسش بازتاب: ' + guide.reflectionPrompt + '\nشرط توقف: ' + guide.stopCondition);
  }
});

test('T15 exposes five prompt groups and fourteen questions per day', () => {
  for (let day = 1; day <= 28; day += 1) {
    const groups = getT15DailyAssistantPromptGroups(day);
    assert.equal(groups.length, 5);
    assert.equal(groups.flatMap((group) => group.questions).length, 14);
  }
  assert.deepEqual(getT15DailyAssistantPromptGroups(29), []);
});

test('T15 answers require exact canonical day, ID, topic, title and source texts', () => {
  const guide = T15_DAILY_ASSISTANT_GUIDES[0];
  const question = guide.questions[0];
  assert.ok(answerT15DailyPreparedQuestion({ day: 1, message: question.value, dailyContent: daily(guide) }));
  assert.equal(answerT15DailyPreparedQuestion({ day: 1, message: question.value, dailyContent: { ...daily(guide), id: 'اعتمادبه‌نفس پایین-02' } }), null);
  assert.equal(answerT15DailyPreparedQuestion({ day: 1, message: question.value, dailyContent: { ...daily(guide), topic_id: 'T23' } }), null);
  assert.equal(answerT15DailyPreparedQuestion({ day: 1, message: question.value, dailyContent: { ...daily(guide), title: 'عنوان روز دیگر' } }), null);
  assert.equal(answerT15DailyPreparedQuestion({ day: 1, message: question.value, dailyContent: { ...daily(guide), sourceExercise: 'متن تمرین نامنطبق' } }), null);
  assert.equal(answerT15DailyPreparedQuestion({ day: 1, message: 'سؤال آزاد خارج از فهرست', dailyContent: daily(guide) }), null);
  assert.equal(answerT15DailyPreparedQuestion({ day: 29, message: question.value, dailyContent: daily(guide) }), null);
});

test('all 392 T15 prepared questions resolve to their own day-specific answer', () => {
  for (const guide of T15_DAILY_ASSISTANT_GUIDES) {
    for (const question of guide.questions) {
      const answer = answerT15DailyPreparedQuestion({ day: guide.day, message: question.value, dailyContent: daily(guide) });
      assert.ok(answer, 'missing answer for day ' + guide.day + ': ' + question.value);
      assert.ok(answer.includes('راهنمای روز ' + guide.day + ' اعتمادبه‌نفس پایین'));
      assert.ok(answer.includes(guide.title));
    }
  }
});

test('T15 safety-sensitive answers append topic and shared safety reminders', () => {
  const guide = T15_DAILY_ASSISTANT_GUIDES[0];
  for (const kind of ['success', 'stop', 'self_confidence_distress', 'talk_other']) {
    const question = guide.questions.find((item) => item.kind === kind);
    const answer = answerT15DailyPreparedQuestion({ day: guide.day, message: question.value, dailyContent: daily(guide) });
    assert.ok(answer.includes('یادآوری اختصاصی ایمنی T15'));
    assert.ok(answer.includes(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN));
  }
});

test('T15 keeps global self-worth as differential routing and support as a referral gate', () => {
  for (const day of [4, 24]) {
    const guide = T15_DAILY_ASSISTANT_GUIDES[day - 1];
    assert.deepEqual(guide.subtopicIds, []);
    assert.equal(guide.subtopicMappingStatus, 'differential_routing_review_required');
  }
  const supportDay = T15_DAILY_ASSISTANT_GUIDES[24];
  assert.deepEqual(supportDay.subtopicIds, []);
  assert.equal(supportDay.subtopicMappingStatus, 'support_routing_review_required');
  assert.deepEqual(T15_DAILY_ASSISTANT_GUIDES[11].subtopicIds, ['T15-S02']);
  assert.deepEqual(T15_DAILY_ASSISTANT_GUIDES[25].subtopicIds, ['T15-S02']);
});

test('T15 prepared guide is served through the page assistant for every canonical day', () => {
  for (const guide of T15_DAILY_ASSISTANT_GUIDES) {
    const data = daily(guide);
    const result = makePageAssistantTurn({
      screen: 'day',
      text: guide.questions[0].value,
      dailyContext: { day: guide.day, problem: 'اعتمادبه‌نفس پایین', data, guidanceData: data },
    });
    assert.equal(result.status, 'daily_guidance_available', 'day ' + guide.day);
    assert.ok(result.message.includes('راهنمای روز ' + guide.day + ' اعتمادبه‌نفس پایین'));
  }
});


test('T15 semantic text is distinct from all other topics and across its own 28 days', async () => {
  const overlay = JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
  const days = overlay.categories['اعتمادبه‌نفس پایین'].days;
  const normalize = (value) => String(value || '').normalize('NFKC')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const stop = new Set(['نسخه','سبک','تمرین','اقدام','فقط','یک','و','یا','را','از','به','در','که','اگر','برای','با','بدون','امروز','فعلا','کن','کنید','بنویس','بنویسی','بنویسید','ثبت','انتخاب','نام','ببر','مشخص','بررسی','انجام','بده','بگیر','دارد','هست','است','میشود','شود','تا','خودت','خود','او','این','آن','همان','هر','هیچ','همه']);
  const tokens = (value) => new Set(normalize(value).split(' ').filter((token) => token.length > 2 && !stop.has(token)));
  const fields = ['title','exercise','actionText','lightExerciseText','lightActionText','progressActionText','restExerciseText','restActionText'];
  for (const field of fields) {
    for (const [topic, category] of Object.entries(overlay.categories)) {
      if (topic === 'اعتمادبه‌نفس پایین') continue;
      for (const other of category.days || []) for (const day of days) {
        const left = tokens(day[field]), right = tokens(other[field]), union = new Set([...left, ...right]);
        let intersection = 0;
        for (const token of left) if (right.has(token)) intersection += 1;
        const similarity = union.size ? intersection / union.size : 0;
        assert.ok(similarity < 0.30,
          'T15 day ' + day.day + ' ' + field + ' is too close to ' + topic + ' day ' + other.day + ': ' + similarity);
      }
    }
    for (let leftIndex = 0; leftIndex < days.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < days.length; rightIndex += 1) {
        const left = tokens(days[leftIndex][field]), right = tokens(days[rightIndex][field]);
        const union = new Set([...left, ...right]);
        let intersection = 0;
        for (const token of left) if (right.has(token)) intersection += 1;
        const similarity = union.size ? intersection / union.size : 0;
        assert.ok(similarity < 0.30,
          'T15 day ' + days[leftIndex].day + ' and day ' + days[rightIndex].day
          + ' are too similar for ' + field + ': ' + similarity);
      }
    }
    assert.equal(new Set(days.map((day) => normalize(day[field]))).size, 28,
      'T15 ' + field + ' must be unique within the topic');
  }
});

test('T15 exercise and action texts have no exact cross-topic duplicates in the 952-day override set', async () => {
  const overlay = JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
  for (const day of overlay.categories['اعتمادبه‌نفس پایین'].days) {
    for (const field of ['exercise', 'actionText']) {
      const duplicates = Object.entries(overlay.categories).flatMap(([topic, category]) =>
        (category.days || []).flatMap((other) =>
          ['exercise', 'actionText']
            .filter((otherField) => other[otherField] === day[field]
              && !(topic === 'اعتمادبه‌نفس پایین' && other.day === day.day && otherField === field))
            .map((otherField) => ({ topic, day: other.day, field: otherField })),
        ),
      );
      assert.deepEqual(duplicates, [], 'duplicate T15 day ' + day.day + ' ' + field);
    }
  }
});


test('T15 keeps external feedback optional and separates task confidence from disclosure or environmental barriers', () => {
  const feedback = T15_DAILY_ASSISTANT_GUIDES[11];
  assert.match(feedback.exercise, /درخواست بازخورد لازم نیست/);
  assert.match(feedback.successCriterion, /دریافت بازخورد شرط موفقیت نیست/);
  assert.match(feedback.questions.find((item) => item.kind === 'talk_other').answer, /گفت‌وگو یا دریافت بازخورد در روز 12 لازم نیست/);
  const participation = T15_DAILY_ASSISTANT_GUIDES[14];
  assert.equal(participation.title, 'به‌کارگیری مهارت در مشارکت کوچک');
  const environment = T15_DAILY_ASSISTANT_GUIDES[16];
  assert.equal(environment.subtopicIds.length, 0);
  assert.match(environment.objective, /شرط محیطی/);
  assert.doesNotMatch(environment.exercise + environment.action, /خودافشایی|به اشتراک بگذارید|به اشتراک بگذار/);
  assert.match(environment.questions.find((item) => item.kind === 'talk_other').answer, /لازم نیست چیزی شخصی را به اشتراک بگذاری/);
});

test('T15 prepared answer formatting has no duplicated rest-action label', () => {
  for (const guide of T15_DAILY_ASSISTANT_GUIDES) {
    const lightAnswer = guide.questions.find((item) => item.kind === 'light_version').answer;
    assert.doesNotMatch(lightAnswer, /نسخه استراحت اقدام:\s*نسخه استراحت اقدام:/);
  }
});


test('T15 feedback progress remains self-directed', () => {
  assert.match(T15_DAILY_ASSISTANT_GUIDES[11].progressVersion, /درخواست بازخورد دوم لازم نیست/);
  assert.match(T15_DAILY_ASSISTANT_GUIDES[14].progressVersion, /ثبت رفتار خودت به‌تنهایی کافی است/);
});


test('T15 day 12 light adaptation uses its own behavioral-evidence focus', () => {
  assert.match(T15_DAILY_ASSISTANT_GUIDES[11].lightVersion, /کنش قابل مشاهده/);
  assert.match(T15_DAILY_ASSISTANT_GUIDES[11].progressVersion, /درخواست بازخورد دوم لازم نیست/);
});
