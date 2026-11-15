import test from 'node:test';
import assert from 'node:assert/strict';
import { T12_DAILY_ASSISTANT_GUIDES, answerT12DailyPreparedQuestion, getT12DailyAssistantPromptGroups } from '../src/features/assistant/t12DailyAssistantPrompts.js';
import { makeDailyExerciseGuidanceTurn } from '../src/features/assistant/dailyExerciseAssistantGuidance.js';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import { mergeDailyTextOverrides } from '../src/features/content/dailyTextOverrides.js';
import { readFile } from 'node:fs/promises';

const FIXED_LABELS = ["منظور از تمرین امروز چیست؟","برای تمرین امروز یک مثال می‌زنی؟","منظور از اقدام اختصاصی امروز چیست؟","برای اقدام امروز یک مثال می‌زنی؟","اگر انجام کاملش برایم سخت بود چه کنم؟","از کجا بفهمم درست انجامش داده‌ام؟","چه زمانی باید تمرین امروز را متوقف کنم؟","اگر امروز نمونه یا آمادگی انجام تمرین را نداشتم چه کنم؟","تمرین و اقدام امروز چه تفاوتی دارند؟","اگر تمرین را انجام ندادم یا فراموش کردم چه کنم؟","اگر هنگام تمرین فشار یا ناراحتی‌ام بیشتر شد چه کنم؟","آیا لازم است حتماً با فرد دیگری صحبت کنم؟","می‌توانم تمرین را تغییر بدهم یا به روش خودم انجام بدهم؟","این تمرین چقدر زمان می‌برد؟"];

test('T12 guide has exactly 28 days and 14 fixed questions per day', () => {
  assert.equal(T12_DAILY_ASSISTANT_GUIDES.length, 28);
  for (let day = 1; day <= 28; day += 1) {
    const guide = T12_DAILY_ASSISTANT_GUIDES.find((item) => item.day === day);
    assert.ok(guide, `missing day ${day}`);
    assert.deepEqual(guide.questions.map((q) => q.label), FIXED_LABELS);
    assert.equal(new Set(guide.questions.map((q) => q.id)).size, 14);
    assert.ok(guide.questions.every((q) => typeof q.answer === 'string' && q.answer.trim()));
    assert.equal(guide.topicId, 'T12');
    assert.ok(guide.subtopicIds.length > 0);
  }
});

test('daily exercises and actions are non-identical within T12', () => {
  assert.equal(new Set(T12_DAILY_ASSISTANT_GUIDES.map((g) => g.exercise.normalize('NFKC').replace(/\s+/g, ' ').trim())).size, 28);
  assert.equal(new Set(T12_DAILY_ASSISTANT_GUIDES.map((g) => g.action.normalize('NFKC').replace(/\s+/g, ' ').trim())).size, 28);
});

test('T12 content carries no specialist-review gate metadata', () => {
  for (const guide of T12_DAILY_ASSISTANT_GUIDES) {
    assert.notEqual(guide.reviewStatus, 'draft_pending_expert_review');
    assert.equal(guide.durationMinutes, null);
    assert.equal(guide.durationStatus, 'not_recorded');
    assert.equal(guide.evidenceGrade, 'not_assessed');
  }
});

test('all 392 prepared answers are individually addressable and non-identical', () => {
  const answers = T12_DAILY_ASSISTANT_GUIDES.flatMap((g) => g.questions.map((q) => q.answer));
  assert.equal(answers.length, 392);
  assert.equal(new Set(answers).size, 392);
});

test('safety wording avoids compulsory confrontation and preserves stop/support choices', () => {
  for (const guide of T12_DAILY_ASSISTANT_GUIDES) {
    assert.match(guide.whenToSeekHumanSupport, /تهدید|خشونت|تعقیب|نظارت|اجبار/);
    assert.ok(guide.contraindications.some((x) => /بیان مستقیم مرز/.test(x)));
    assert.ok(guide.questions.find((q) => q.id === 'q12').answer.includes('شرط انجام تمرین'));
    assert.match(guide.questions.find((q) => q.id === 'q07').answer, new RegExp(`^نکته ایمنی روز ${guide.day}:`));
    assert.doesNotMatch(guide.questions.find((q) => q.id === 'q07').answer, /متوقف کن اگر: اگر/);
  }
  const day14 = T12_DAILY_ASSISTANT_GUIDES.find((g) => g.day === 14);
  assert.doesNotMatch(day14.exercise, /کاهش.*رفتار محافظتی|کاهش.*فاصله‌گیری/);
});

test('runtime rejects mismatched topic/day and answers exact prepared questions', () => {
  assert.equal(answerT12DailyPreparedQuestion({ day: 1, message: FIXED_LABELS[0], dailyContent: { id: 'other-01', day: 1, topic_id: 'T12' } }), null);
  const guide = T12_DAILY_ASSISTANT_GUIDES[0];
  const wrongTitle = answerT12DailyPreparedQuestion({ day: 1, message: FIXED_LABELS[0], dailyContent: { id: 'مرزبندی و نه گفتن-01', day: 1, topic_id: 'T12', title: 'نقشه شروع · روز 1', exercise: guide.exercise, actionText: guide.action } });
  assert.equal(wrongTitle, null);
  const wrongExercise = answerT12DailyPreparedQuestion({ day: 1, message: FIXED_LABELS[0], dailyContent: { id: 'مرزبندی و نه گفتن-01', day: 1, topic_id: 'T12', title: guide.title, exercise: 'تمرین متعلق به نسخه قدیمی', actionText: guide.action } });
  assert.equal(wrongExercise, null);
  const missingTopicId = answerT12DailyPreparedQuestion({ day: 1, message: FIXED_LABELS[0], dailyContent: { id: 'مرزبندی و نه گفتن-01', day: 1, title: guide.title, exercise: guide.exercise, actionText: guide.action } });
  assert.equal(missingTopicId, null);
  const answer = answerT12DailyPreparedQuestion({ day: 1, message: FIXED_LABELS[0], dailyContent: { id: 'مرزبندی و نه گفتن-01', day: 1, topic_id: 'T12', title: guide.title, exercise: guide.exercise, actionText: guide.action } });
  assert.ok(answer && answer.includes(guide.title));
});

test('day 25 practices value-consistent behavior, not another boundary-identification exercise', () => {
  const day6 = T12_DAILY_ASSISTANT_GUIDES.find((g) => g.day === 6);
  const day25 = T12_DAILY_ASSISTANT_GUIDES.find((g) => g.day === 25);
  assert.match(day6.exercise, /حد/);
  assert.match(day25.exercise, /رفتار روزمره/);
  assert.doesNotMatch(day25.exercise, /کدام حد از آن محافظت می‌کند/);
  assert.match(day25.action, /فرصت کم‌خطر/);
});

test('T12 prepared assistant is connected to the active daily text override for all 28 days', async () => {
  const overrides = JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
  const days = overrides.categories['مرزبندی و نه گفتن'].days;
  assert.equal(days.length, 28);
  for (const guide of T12_DAILY_ASSISTANT_GUIDES) {
    const baseDay = days.find((item) => item.day === guide.day);
    const day = { ...baseDay, id: 'مرزبندی و نه گفتن-' + String(guide.day).padStart(2, '0'), sourceExercise: baseDay.exercise, sourceActionText: baseDay.actionText };
    assert.ok(day);
    assert.equal(day.topic_id, 'T12');
    assert.equal(day.title, guide.title);
    assert.equal(day.exercise, guide.exercise);
    assert.equal(day.actionText, guide.action);
    assert.ok(day.lightExerciseText && day.lightActionText && day.progressActionText && day.restExerciseText && day.restActionText);
    assert.equal(day.lightActionText, guide.lightActionVersion);
    assert.equal(day.progressActionText, guide.progressActionVersion);
    assert.equal(day.restActionText, guide.restActionVersion);
    const answer = answerT12DailyPreparedQuestion({ day: guide.day, message: guide.questions[0].value, dailyContent: day });
    assert.ok(answer && answer.includes(day.exercise), 'prepared answer must use visible exercise on day ' + guide.day);
  }
});

test('T12 prepared daily answers are routed from the exercise assistant and reject out-of-bank questions', () => {
  const guide = T12_DAILY_ASSISTANT_GUIDES[0];
  const day = { id: 'مرزبندی و نه گفتن-01', topic_id: 'T12', day: 1, title: guide.title, exercise: guide.exercise, actionText: guide.action };
  const valid = makeDailyExerciseGuidanceTurn({ message: guide.questions[0].value, dayData: day, problem: 'مرزبندی و نه گفتن', day: 1 });
  assert.ok(valid.response.includes(guide.title));
  const outside = makeDailyExerciseGuidanceTurn({ message: 'یک پرسش آزاد خارج از راهنمای آماده', dayData: day, problem: 'مرزبندی و نه گفتن', day: 1 });
  assert.match(outside.response, /فهرست راهنمای آماده همین روز/);
  const mismatch = makeDailyExerciseGuidanceTurn({ message: guide.questions[0].value, dayData: { ...day, topic_id: 'T11' }, problem: 'مرزبندی و نه گفتن', day: 1 });
  assert.match(mismatch.response, /شناسه موضوع/);
});

test('page assistant answers the T12 day guide and preserves the interpersonal safety check', () => {
  const guide = T12_DAILY_ASSISTANT_GUIDES[0];
  const data = { id: 'مرزبندی و نه گفتن-01', topic_id: 'T12', day: 1, title: guide.title, exercise: guide.exercise, actionText: guide.action };
  const answer = makePageAssistantTurn({ screen: 'day', text: guide.questions[0].value, dailyContext: { day: 1, problem: 'مرزبندی و نه گفتن', data } });
  assert.equal(answer.status, 'daily_guidance_available');
  assert.ok(answer.message.includes(guide.title));
  const visibleExercise = 'نسخه تطبیقی تمرین روز اول';
  const visibleAction = 'نسخه تطبیقی اقدام روز اول';
  const adaptedAnswer = makePageAssistantTurn({
    screen: 'day',
    text: guide.questions[0].value,
    dailyContext: {
      day: 1, problem: 'مرزبندی و نه گفتن', data,
      guidanceData: { title: guide.title, exercise: visibleExercise, action: visibleAction, adaptation: 'نسخه تطبیقی' },
    },
  });
  assert.equal(adaptedAnswer.status, 'daily_guidance_available');
  assert.ok(adaptedAnswer.message.includes(visibleExercise));
  const adaptedActionAnswer = makePageAssistantTurn({
    screen: 'day',
    text: guide.questions[2].value,
    dailyContext: {
      day: 1, problem: 'مرزبندی و نه گفتن', data,
      guidanceData: { title: guide.title, exercise: visibleExercise, action: visibleAction, adaptation: 'نسخه تطبیقی' },
    },
  });
  assert.ok(adaptedActionAnswer.message.includes(visibleAction));
  const gatedGuide = T12_DAILY_ASSISTANT_GUIDES.find((item) => item.day === 6);
  const gatedData = { id: 'مرزبندی و نه گفتن-06', topic_id: 'T12', day: 6, title: gatedGuide.title, exercise: gatedGuide.exercise, actionText: gatedGuide.action };
  const gated = makePageAssistantTurn({ screen: 'day', text: gatedGuide.questions[0].value, dailyContext: { day: 6, problem: 'مرزبندی و نه گفتن', data: gatedData } });
  assert.equal(gated.status, 'relationship_safety_confirmation_required');
});

test('T12 overlay merges visible text and runtime safety metadata into the canonical record', async () => {
  const overrides = JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
  const guide = T12_DAILY_ASSISTANT_GUIDES[0];
  const canonical = { categories: { 'مرزبندی و نه گفتن': { days: [{ id: 'مرزبندی و نه گفتن-01', day: 1 }] } } };
  const merged = mergeDailyTextOverrides(canonical, overrides);
  const day = merged.categories['مرزبندی و نه گفتن'].days[0];
  assert.equal(day.topic_id, 'T12');
  assert.equal(day.title, guide.title);
  assert.equal(day.exercise, guide.exercise);
  assert.equal(day.actionText, guide.action);
  assert.ok(day.when_to_seek_human_support);
  assert.ok(day.stop_conditions.length);
  assert.equal(day.risk_level, 'routine');
});

test('T12 daily exercise and action texts have no exact duplicates against other topic overlays', async () => {
  const overrides = JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
  const days = overrides.categories['مرزبندی و نه گفتن'].days;
  const normalize = (value) => String(value || '').normalize('NFKC').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\s،؛.!؟,:]/g, '').toLowerCase();
  for (const [topic, category] of Object.entries(overrides.categories)) {
    if (topic === 'مرزبندی و نه گفتن') continue;
    for (const other of category.days || []) for (const day of days) {
      assert.notEqual(normalize(day.exercise), normalize(other.exercise), 'exercise duplicate with ' + topic + ' day ' + other.day);
      assert.notEqual(normalize(day.actionText), normalize(other.actionText), 'action duplicate with ' + topic + ' day ' + other.day);
    }
  }
});

test('T12 prompt groups expose all fourteen daily questions in five clear sections', () => {
  for (let day = 1; day <= 28; day += 1) {
    const groups = getT12DailyAssistantPromptGroups(day);
    assert.equal(groups.length, 5);
    assert.deepEqual(groups.map(group => group.questions.length), [2, 2, 1, 5, 4]);
    assert.equal(groups.flatMap(group => group.questions).length, 14);
  }
  assert.deepEqual(getT12DailyAssistantPromptGroups(29), []);
});

test('T12 prepared answers accept the visible adaptive version while checking the canonical source', () => {
  const guide = T12_DAILY_ASSISTANT_GUIDES[0];
  const visibleExercise = 'نسخه سبک تمرین روز اول برای نمایش تطبیقی';
  const visibleAction = 'نسخه سبک اقدام روز اول برای نمایش تطبیقی';
  const day = {
    id: 'مرزبندی و نه گفتن-01', topic_id: 'T12', day: 1, title: guide.title,
    sourceExercise: guide.exercise, sourceActionText: guide.action,
    exercise: visibleExercise, actionText: visibleAction,
  };
  const answer = answerT12DailyPreparedQuestion({ day: 1, message: guide.questions[8].value, dailyContent: day });
  assert.ok(answer.includes(visibleExercise));
  assert.ok(answer.includes(visibleAction));
  assert.equal(answerT12DailyPreparedQuestion({ day: 1, message: guide.questions[0].value, dailyContent: { ...day, sourceExercise: 'متن منبع ناسازگار' } }), null);
});

test('T12 semantic text stays distinct from other topic overlays', async () => {
  const overrides = JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
  const days = overrides.categories['مرزبندی و نه گفتن'].days;
  const normalize = value => String(value || '').normalize('NFKC')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const stop = new Set(['نسخه','سبک','تمرین','اقدام','فقط','یک','و','یا','را','از','به','در','که','اگر','برای','با','بدون','امروز','فعلا','کن','کنید','بنویس','بنویسی','بنویسید','ثبت','انتخاب','نام','ببر','مشخص','بررسی','انجام','بده','بگیر','دارد','هست','است','میشود','شود','تا','خودت','خود','او','این','آن','همان','هر','هیچ','همه']);
  const tokens = value => new Set(normalize(value).split(' ').filter(token => token.length > 2 && !stop.has(token)));
  const fields = ['title','exercise','actionText','lightExerciseText','lightActionText','progressActionText','restExerciseText','restActionText'];
  for (const [topic, category] of Object.entries(overrides.categories)) {
    if (topic === 'مرزبندی و نه گفتن') continue;
    for (const other of category.days || []) for (const day of days) for (const field of fields) {
      const left = tokens(day[field]), right = tokens(other[field]);
      const union = new Set([...left, ...right]);
      let intersection = 0;
      for (const token of left) if (right.has(token)) intersection += 1;
      const similarity = union.size ? intersection / union.size : 0;
      assert.ok(similarity < 0.30, 'T12 day ' + day.day + ' ' + field + ' is too close to ' + topic + ' day ' + other.day + ': ' + similarity);
    }
  }
  for (const field of fields) assert.equal(new Set(days.map(day => normalize(day[field]))).size, 28, 'T12 ' + field + ' must be unique within the topic');
});
