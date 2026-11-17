import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { T13_DAILY_ASSISTANT_GUIDES, answerT13DailyPreparedQuestion, getT13DailyAssistantPromptGroups } from '../src/features/assistant/t13DailyAssistantPrompts.js';
import { T12_DAILY_ASSISTANT_GUIDES } from '../src/features/assistant/t12DailyAssistantPrompts.js';
import { DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN, DAILY_ASSISTANT_SAFETY_QUESTION_KINDS } from '../src/features/assistant/dailyAssistantSafetyReminder.js';
import { formatAssistantMessageText } from '../src/features/assistant/assistantMessageFormatting.js';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import { getDailySafetyMode } from '../src/features/content/dailySafety.js';

const EXPECTED_QUESTIONS = [
  "منظور از تمرین امروز چیست؟",
  "برای تمرین امروز یک مثال می‌زنی؟",
  "منظور از اقدام اختصاصی امروز چیست؟",
  "برای اقدام امروز یک مثال می‌زنی؟",
  "اگر انجام کاملش برایم سخت بود چه کنم؟",
  "از کجا بفهمم درست انجامش داده‌ام؟",
  "چه زمانی باید تمرین امروز را متوقف کنم؟",
  "اگر امروز نمونه یا آمادگی انجام تمرین را نداشتم چه کنم؟",
  "تمرین و اقدام امروز چه تفاوتی دارند؟",
  "اگر تمرین را انجام ندادم یا فراموش کردم چه کنم؟",
  "اگر هنگام تمرین فشار یا ناراحتی‌ام بیشتر شد چه کنم؟",
  "آیا لازم است حتماً با فرد دیگری صحبت کنم؟",
  "می‌توانم تمرین را تغییر بدهم یا به روش خودم انجام بدهم؟",
  "این تمرین چقدر زمان می‌برد؟"
];
function dailyContent(guide) {
  return { id: 'تنهایی-' + String(guide.day).padStart(2, '0'), topic_id: 'T13', day: guide.day,
    title: guide.title, sourceExercise: guide.exercise, sourceActionText: guide.action,
    exercise: guide.exercise, actionText: guide.action, lightExerciseText: guide.lightVersion,
    progressVersion: guide.progressVersion, restExerciseText: guide.restVersion };
}

test('T13 guide has exactly 28 days and 392 complete answers under the fixed 14-question contract', () => {
  assert.equal(T13_DAILY_ASSISTANT_GUIDES.length, 28);
  for (const [index, guide] of T13_DAILY_ASSISTANT_GUIDES.entries()) {
    assert.equal(guide.day, index + 1); assert.equal(guide.topicId, 'T13'); assert.equal(guide.topic, 'تنهایی');
    assert.equal(guide.questions.length, 14); assert.equal(guide.reviewStatus, 'pending_owner_review');
    assert.equal(guide.evidenceGrade, 'not_assessed'); assert.equal(guide.subtopicMappingStatus, 'proposed_not_registered');
    assert.deepEqual(guide.questions.map((q) => q.label), EXPECTED_QUESTIONS);
    assert.ok(guide.questions.every((q) => typeof q.answer === 'string' && q.answer.trim()));
  }
});

test('T13 content overlay has 28 days and exactly matches assistant exercise/action source', async () => {
  const overlay = JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
  const days = overlay.categories['تنهایی']?.days || []; assert.equal(days.length, 28);
  for (const guide of T13_DAILY_ASSISTANT_GUIDES) {
    const day = days.find((item) => item.day === guide.day); assert.ok(day, 'missing day ' + guide.day);
    assert.equal(day.title, guide.title, 'title mismatch on day ' + guide.day);
    assert.equal(day.exercise, guide.exercise, 'exercise mismatch on day ' + guide.day);
    assert.equal(day.actionText, guide.action, 'action mismatch on day ' + guide.day);
  }
});

test('T13 exposes five prompt groups and exactly fourteen questions for every day', () => {
  for (let day = 1; day <= 28; day += 1) {
    const groups = getT13DailyAssistantPromptGroups(day); assert.equal(groups.length, 5);
    assert.deepEqual(groups.map((g) => g.label), ['فهم تمرین روز ' + day,'فهم اقدام اختصاصی روز ' + day,'تفاوت تمرین و اقدام','اجرا و موانع','ارزیابی و ایمنی']);
    assert.equal(groups.flatMap((g) => g.questions).length, 14);
  }
  assert.deepEqual(getT13DailyAssistantPromptGroups(0), []); assert.deepEqual(getT13DailyAssistantPromptGroups(29), []);
});

test('all 392 T13 answers are day-bound, teacher-framed and append the shared reminder to exactly four safety answers', () => {
  let checked = 0; const safetyKinds = new Set(['success','stop','loneliness_increased','talk_other']);
  for (const guide of T13_DAILY_ASSISTANT_GUIDES) for (const question of guide.questions) {
    const answer = answerT13DailyPreparedQuestion({day:guide.day,message:question.value,dailyContent:dailyContent(guide)});
    assert.equal(typeof answer,'string','day '+guide.day+' '+question.kind);
    assert.match(answer,new RegExp('راهنمای روز '+guide.day+' تنهایی')); assert.match(answer,/بیاییم قدم‌به‌قدم پیش برویم/u);
    assert.match(answer,/هدف امروز:/u); assert.equal(answer.includes(String.fromCharCode(92)+'n'),false);
    const visible=formatAssistantMessageText(answer).flat().map(part=>part.text).join('\n'); assert.equal(visible.includes('**'),false);
    const expected=safetyKinds.has(question.kind); assert.equal(DAILY_ASSISTANT_SAFETY_QUESTION_KINDS.has(question.kind),expected);
    const count=answer.split(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN).length-1;
    assert.equal(count,expected?1:0,'shared reminder count day '+guide.day+' '+question.kind);
    assert.equal(answer.endsWith(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN),expected);
    const topicReminderCount=answer.split('یادآوری اختصاصی ایمنی T13').length-1;
    assert.equal(topicReminderCount,expected?1:0,'topic reminder count day '+guide.day+' '+question.kind);
    checked++;
  }
  assert.equal(checked,392);
});

test('T13 answers are unique and do not copy any exact T12 prepared answer', () => {
  const answers = T13_DAILY_ASSISTANT_GUIDES.flatMap((guide) => guide.questions.map((q) => q.answer));
  const t12Answers = new Set(T12_DAILY_ASSISTANT_GUIDES.flatMap((guide) => guide.questions.map((q) => q.answer)));
  assert.equal(answers.length, 392);
  assert.equal(new Set(answers).size, 392, 'each T13 answer must be textually unique');
  assert.ok(answers.every((answer) => !t12Answers.has(answer)), 'T13 answers must not copy T12 answers verbatim');
});

test('T13 exercises and actions have no exact cross-topic duplicate in the 952-day override set', async () => {
  const overlay = JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
  const all = Object.entries(overlay.categories).flatMap(([topic, category]) => (category.days || []).flatMap((day) => [
    { topic, day: day.day, field: 'exercise', text: day.exercise },
    { topic, day: day.day, field: 'actionText', text: day.actionText },
  ]));
  for (const day of overlay.categories['تنهایی'].days) for (const field of ['exercise', 'actionText']) {
    const duplicates = all.filter((item) => item.text === day[field]
      && !(item.topic === 'تنهایی' && item.day === day.day && item.field === field));
    assert.deepEqual(duplicates, [], 'exact duplicate for T13 day ' + day.day + ' ' + field);
  }
});

test('T13 prepared answers reject mismatched identity, content and free-text questions', () => {
  const guide=T13_DAILY_ASSISTANT_GUIDES[0], content=dailyContent(guide);
  assert.equal(answerT13DailyPreparedQuestion({day:2,message:guide.questions[0].value,dailyContent:content}),null);
  assert.equal(answerT13DailyPreparedQuestion({day:1,message:guide.questions[0].value,dailyContent:{...content,id:'تنهایی-02'}}),null);
  assert.equal(answerT13DailyPreparedQuestion({day:1,message:guide.questions[0].value,dailyContent:{...content,topic_id:'T12'}}),null);
  assert.equal(answerT13DailyPreparedQuestion({day:1,message:guide.questions[0].value,dailyContent:{...content,sourceActionText:'اقدام ناسازگار'}}),null);
  assert.equal(answerT13DailyPreparedQuestion({day:1,message:'یک سؤال آزاد',dailyContent:content}),null);
});

test('T13 launcher exposes only safe-day prompts and labels the topic correctly', async () => {
  const launcher = await readFile(new URL('../src/features/assistant/GlobalAssistantLauncher.jsx', import.meta.url), 'utf8');
  assert.match(launcher, /isT13DailyPromptContext/u);
  assert.match(launcher, /getDailySafetyMode\(dailyContext\?\.data\) === 'blocked' \? \[\] : getT13DailyAssistantPromptGroups/u);
  assert.match(launcher, /t13-daily-prompt-trigger/u);
  assert.match(launcher, /isT13DailyPromptContext \? "تنهایی"/u);
});

test('T13 page assistant serves ordinary prepared days but does not bypass the day-14 safety block', () => {
  const guide=T13_DAILY_ASSISTANT_GUIDES[0], content=dailyContent(guide);
  const legacyContent={...content}; delete legacyContent.topic_id;
  const result=makePageAssistantTurn({screen:'day',text:guide.questions[0].value,dailyContext:{day:1,problem:'تنهایی',data:legacyContent,guidanceData:legacyContent}});
  assert.equal(result.status,'daily_guidance_available'); assert.match(result.message,/راهنمای روز 1 تنهایی/u);
  const safetyGuide=T13_DAILY_ASSISTANT_GUIDES[13];
  const safetyDay={...dailyContent(safetyGuide),review_status:'pending_expert_review',risk_level:'caution',subtopic_ids:['T13-S01']};
  assert.equal(getDailySafetyMode(safetyDay),'blocked');
  const blocked=makePageAssistantTurn({screen:'day',text:safetyGuide.questions[0].value,dailyContext:{day:14,problem:'تنهایی',data:safetyDay,guidanceData:safetyDay}});
  assert.equal(blocked.status,'daily_guidance_unavailable'); assert.match(blocked.message,/بازبینی ایمنی تخصصی/u);
  const emergency=makePageAssistantTurn({screen:'day',text:'دیگه نمی‌کشم. همه‌چی تمومه.',dailyContext:{day:14,problem:'تنهایی',data:safetyDay,guidanceData:safetyDay}});
  assert.equal(emergency.status,'safety_clarification_required',
    'blocked daily content must never suppress the independent emergency safety route');
});
