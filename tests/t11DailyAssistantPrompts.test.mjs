import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import { splitDayContent } from '../src/features/journey/JourneyScreens.jsx';
import {
  answerT11DailyPreparedQuestion,
  getT11DailyAssistantPromptGroups,
  T11_DAILY_ASSISTANT_GUIDES,
} from '../src/features/assistant/t11DailyAssistantPrompts.js';

const EXPECTED_QUESTIONS = [
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

test('T11 assistant catalog contains exactly 28 days and 392 complete fixed-question answers', () => {
  assert.equal(T11_DAILY_ASSISTANT_GUIDES.length, 28);
  for (const [index, guide] of T11_DAILY_ASSISTANT_GUIDES.entries()) {
    assert.equal(guide.day, index + 1);
    assert.equal(guide.questions.length, 14);
    assert.equal(guide.reviewStatus, 'pending_owner_review');
    assert.equal(guide.evidenceGrade, 'not_assessed');
    assert.equal(guide.subtopicId, null);
    assert.deepEqual(guide.subtopicIds, []);
    assert.deepEqual(guide.questions.map((item) => item.label), EXPECTED_QUESTIONS);
    assert.ok(guide.questions.every((item) => typeof item.answer === 'string' && item.answer.trim()));
  }
});

test('T11 prepared answers require exact topic/day identity and exact fixed question', () => {
  const guide = T11_DAILY_ASSISTANT_GUIDES[0];
  const dailyContent = {
    id: 'عادت‌های تکراری-01',
    day: 1,
    topic_id: 'T11',
    exercise: guide.exercise,
    actionText: guide.action,
  };
  const answer = answerT11DailyPreparedQuestion({
    day: 1,
    message: EXPECTED_QUESTIONS[0],
    dailyContent,
  });
  assert.match(answer, /راهنمای روز 1 عادت‌های تکراری/u);
  assert.equal(answerT11DailyPreparedQuestion({ day: 2, message: EXPECTED_QUESTIONS[0], dailyContent }), null);
  assert.equal(answerT11DailyPreparedQuestion({ day: 1, message: EXPECTED_QUESTIONS[0], dailyContent: { ...dailyContent, id: 'عادت‌های تکراری-02' } }), null);
  assert.equal(answerT11DailyPreparedQuestion({ day: 1, message: 'یک سؤال آزاد', dailyContent }), null);
  assert.equal(answerT11DailyPreparedQuestion({ day: 1, message: EXPECTED_QUESTIONS[0], dailyContent: { ...dailyContent, topic_id: 'T10' } }), null);
  assert.equal(answerT11DailyPreparedQuestion({ day: 1, message: EXPECTED_QUESTIONS[0], dailyContent: { ...dailyContent, actionText: 'اقدام ناسازگار' } }), null);
});

test('T11 assistant exposes five groups and exactly fourteen questions for each day', () => {
  for (let day = 1; day <= 28; day += 1) {
    const groups = getT11DailyAssistantPromptGroups(day);
    assert.equal(groups.length, 5);
    assert.equal(groups.flatMap((group) => group.questions).length, 14);
    assert.deepEqual(groups.flatMap((group) => group.questions).sort((a, b) => a.id.localeCompare(b.id)).map((item) => item.value), EXPECTED_QUESTIONS);
  }
  assert.deepEqual(getT11DailyAssistantPromptGroups(0), []);
  assert.deepEqual(getT11DailyAssistantPromptGroups(29), []);
});

test('T11 q11 uses its own distress response and does not append shared-center boilerplate', () => {
  const guide = T11_DAILY_ASSISTANT_GUIDES[1];
  const dailyContent = {
    id: 'عادت‌های تکراری-02',
    day: 2,
    topic_id: 'T11',
    exercise: guide.exercise,
    actionText: guide.action,
  };
  const answer = answerT11DailyPreparedQuestion({
    day: 2,
    message: EXPECTED_QUESTIONS[10],
    dailyContent,
  });
  assert.ok(answer.endsWith(guide.questions[10].answer));
  assert.doesNotMatch(answer, /۰۹۱۹۰۸۸۹۰۶۲|هیپنوتراپی شفا|مرکز مشاوره/u);
});


test('T11 page assistant routes every exact day-specific question and rejects mismatched identity', () => {
  for (const guide of T11_DAILY_ASSISTANT_GUIDES) {
    const dailyContent = {
      id: 'عادت‌های تکراری-' + String(guide.day).padStart(2, '0'),
      day: guide.day,
      topic_id: 'T11',
      exercise: guide.exercise,
      actionText: guide.action,
    };
    const result = makePageAssistantTurn({
      screen: 'day',
      text: guide.questions[10].value,
      dailyContext: {
        day: guide.day,
        problem: 'عادت‌های تکراری',
        data: dailyContent,
        guidanceData: splitDayContent(dailyContent, 'عادت‌های تکراری', null, {}),
      },
    });
    assert.equal(result.status, 'daily_guidance_available', 'T11 day ' + guide.day);
    assert.match(result.message, new RegExp('راهنمای روز ' + guide.day));
    const wrongDay = makePageAssistantTurn({
      screen: 'day',
      text: guide.questions[0].value,
      dailyContext: {
        day: guide.day,
        problem: 'عادت‌های تکراری',
        data: { ...dailyContent, id: 'عادت‌های تکراری-28' },
        guidanceData: { ...dailyContent, id: 'عادت‌های تکراری-28' },
      },
    });
    if (guide.day !== 28) assert.equal(wrongDay.status, 'daily_guidance_unavailable');
  }
});

test('T11 is exposed as a non-recording owner review preview in the day UI', async () => {
  const ui = await readFile(new URL('../src/features/journey/JourneyScreens.jsx', import.meta.url), 'utf8');
  const launcher = await readFile(new URL('../src/features/assistant/GlobalAssistantLauncher.jsx', import.meta.url), 'utf8');
  assert.match(ui, /data-testid="t11-owner-review-preview"/);
  assert.match(ui, /!isT11ReviewPreview && !entryOpen/);
  assert.match(ui, /!isT11ReviewPreview && entryOpen/);
  assert.match(ui, /id="t11ReviewNextDayBtn"/);
  assert.match(launcher, /getT11DailyAssistantPromptGroups\(dailyContext\?\.day\)/);
  assert.match(launcher, /!isT11DailyPromptContext\s*&&\s*Boolean\(selectedDailyQuestion/);
});
