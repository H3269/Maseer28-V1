import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES,
  answerEmotionalDependencyDailyPreparedQuestion,
  getEmotionalDependencyDailyAssistantPromptGroups,
} from '../src/features/assistant/emotionalDependencyDailyAssistantPrompts.js';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import { getCanonicalDailyRecordId } from '../src/features/content/dailyContentSelector.js';

function contextFor(guide, overrides = {}) {
  const data = {
    id: getCanonicalDailyRecordId('وابستگی عاطفی', guide.day),
    topic_id: 'T08',
    day: guide.day,
    exercise: guide.exercise,
    actionText: guide.action,
  };
  return {
    day: guide.day,
    problem: 'وابستگی عاطفی',
    data,
    ...overrides,
  };
}

test('T08 contains 28 complete day guides with 14 unchanged prepared questions per day', () => {
  assert.equal(EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES.length, 28);
  for (const guide of EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES) {
    assert.ok(guide.title && guide.objective && guide.skill && guide.mechanism);
    assert.ok(guide.exercise && guide.action && guide.lightVersion && guide.progressVersion && guide.restVersion);
    assert.ok(guide.successCriterion && guide.reflectionQuestion && guide.stopCondition);
    assert.ok(Number.isInteger(guide.durationMinutes) && guide.durationMinutes >= 1 && guide.durationMinutes <= 60);
    assert.equal(guide.durationStatus, 'provisional_estimate');
    assert.ok(guide.exerciseType && guide.whenToSeekHumanSupport && guide.contraindications?.length);
    assert.ok(['routine', 'caution'].includes(guide.riskLevel));
    assert.ok(guide.exerciseExample && guide.actionExample);
    assert.match(guide.subtopic, /^T08-S0[123]$/u);
    assert.equal(guide.questions.length, 14);
    assert.equal(new Set(guide.questions.map((q) => q.value)).size, 14);
  }
});

test('T08 keeps the shared five-section, fourteen-question layout for all 28 days', () => {
  for (let day = 1; day <= 28; day += 1) {
    const groups = getEmotionalDependencyDailyAssistantPromptGroups(day);
    assert.deepEqual(groups.map((g) => g.questions.length), [2, 2, 1, 5, 4]);
    assert.equal(groups.reduce((n, g) => n + g.questions.length, 0), 14);
    assert.deepEqual(groups.map((g) => g.label), [
      'فهم تمرین روز ' + String(day).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]),
      'فهم اقدام اختصاصی روز ' + String(day).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]),
      'تفاوت تمرین و اقدام',
      'اجرا و موانع',
      'ارزیابی و ایمنی',
    ]);
  }
  assert.deepEqual(getEmotionalDependencyDailyAssistantPromptGroups(29), []);
});

test('all 392 T08 prepared answers are substantive, day-scoped and meaningfully varied', () => {
  let count = 0;
  const answers = new Set();
  for (const guide of EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES) {
    for (const question of guide.questions) {
      const answer = answerEmotionalDependencyDailyPreparedQuestion({
        day: guide.day,
        message: question.value,
        dailyContent: { exercise: guide.exercise, actionText: guide.action },
      });
      assert.ok(answer && answer.length >= 450, 'short/missing answer: day ' + guide.day + ' ' + question.kind);
      assert.ok(answer.includes(guide.title), 'answer must retain the selected day title');
      assert.ok(answer.includes(guide.objective) || answer.includes(guide.exercise) || answer.includes(guide.action),
        'answer must use day-specific content');
      answers.add(answer);
      count += 1;
    }
  }
  assert.equal(count, 392);
  assert.ok(answers.size > 300, 'answers must be meaningfully varied');
  assert.equal(answerEmotionalDependencyDailyPreparedQuestion({ day: 1, message: 'سؤال آزاد خارج از فهرست' }), null);
});

test('T08 canonical content, adaptive runtime fields and draft taxonomy stay aligned', async () => {
  const [pathContent, overrides, topics, subtopics] = await Promise.all([
    readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../public/assistant/knowledge/topics.v1.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../public/assistant/knowledge/subtopics.v1.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  const canonical = pathContent.categories['وابستگی عاطفی'].days;
  const runtime = overrides.categories['وابستگی عاطفی'].days;
  const topic = topics.topics.find((item) => item.topic_id === 'T08');
  const mappedSubtopics = subtopics.subtopics.filter((item) => item.topic_id === 'T08');
  const fields = ['exercise', 'actionText', 'lightExerciseText', 'lightActionText', 'progressActionText', 'restExerciseText', 'restActionText'];
  assert.equal(canonical.length, 28);
  assert.equal(runtime.length, 28);
  assert.equal(topic.draft_content_ids.length, 28);
  assert.deepEqual(topic.content_ids, [], 'draft content must not become runtime-approved content');
  assert.equal(mappedSubtopics.length, 3);
  assert.equal(mappedSubtopics.reduce((n, item) => n + item.draft_content_ids.length, 0), 28);
  for (let index = 0; index < 28; index += 1) {
    const day = canonical[index];
    assert.equal(day.topic_id, 'T08');
    assert.equal(day.review_status, 'draft');
    assert.equal(day.evidence_grade, 'not_assessed');
    assert.equal(day.metadata_version, 2);
    assert.equal(day.subtopic_ids.length, 1);
    for (const field of fields) assert.equal(day[field], runtime[index][field], 'day ' + (index + 1) + ' ' + field + ' must match overlay');
  }
  for (const field of fields) {
    assert.equal(new Set(canonical.map((day) => day[field])).size, 28, field + ' must be unique across T08 days');
  }
});

test('T08 prepared questions route only for matching canonical topic and day', () => {
  const guide = EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES[0];
  const question = guide.questions[0];
  const ok = makePageAssistantTurn({ screen: 'day', text: question.value, dailyContext: contextFor(guide) });
  assert.equal(ok.status, 'daily_guidance_available');
  assert.match(ok.message, /راهنمای روز/u);

  const wrongTopic = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: { ...contextFor(guide), data: { ...contextFor(guide).data, topic_id: 'T07' } },
  });
  assert.equal(wrongTopic.status, 'daily_guidance_unavailable');

  const wrongDay = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: { ...contextFor(guide), day: 2, data: { ...contextFor(guide).data, id: getCanonicalDailyRecordId('وابستگی عاطفی', 1), day: 1 } },
  });
  assert.equal(wrongDay.status, 'daily_guidance_unavailable');
});

test('T08 relationship communication days fail closed until the user confirms free choice', () => {
  const guide = EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES[5];
  const question = guide.questions.find((q) => q.kind === 'action_meaning');
  const pending = makePageAssistantTurn({ screen: 'day', text: question.value, dailyContext: contextFor(guide) });
  assert.equal(pending.status, 'relationship_safety_confirmation_required');
  assert.match(pending.message, /هر دو نفر می‌توانند آزادانه گفت‌وگو را رد یا متوقف کنند/u);

  const unsafe = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: contextFor(guide, { relationshipSafetyResponse: 'unsafe' }),
  });
  assert.equal(unsafe.status, 'relationship_safety_blocked');

  const safe = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: contextFor(guide, { relationshipSafetyConfirmed: true, relationshipSafetyResponse: 'safe' }),
  });
  assert.equal(safe.status, 'daily_guidance_available');
});

test('T08 urgent safety handoff takes precedence and free-form daily questions remain disabled', () => {
  const guide = EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES[0];
  const urgent = makePageAssistantTurn({
    screen: 'day',
    text: 'امشب قصد دارم به خودم آسیب بزنم.',
    dailyContext: contextFor(guide),
  });
  assert.equal(urgent.status, 'urgent_human_support_required');

  const free = makePageAssistantTurn({
    screen: 'day',
    text: 'چرا این‌قدر به او وابسته‌ام؟',
    dailyContext: contextFor(guide),
  });
  assert.equal(free.status, 'prepared_question_required');
  assert.match(free.message, /گفت‌وگوی آزاد برای این موضوع فعال نیست/u);
});


test('T08 targeted semantic rewrites retain relationship-specific operational detail', () => {
  const byDay = new Map(EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES.map((guide) => [guide.day, guide]));
  assert.match(byDay.get(1).action, /پاسخی که منتظرش بودی/u);
  assert.match(byDay.get(3).exercise, /پیش‌بینی تو درباره طرد/u);
  assert.match(byDay.get(3).exercise, /آرامش کوتاه‌مدت/u);
  assert.match(byDay.get(17).action, /جمله بازگشت/u);
  assert.match(byDay.get(22).exercise, /نیاز واقعی پشت دلتنگی/u);
  assert.match(byDay.get(23).action, /فعالیت شخصی معنادار/u);
  assert.match(byDay.get(23).action, /ارتباط داوطلبانه و دوسویه/u);
  assert.match(byDay.get(28).action, /سه ستون بنویس/u);
  assert.match(byDay.get(28).action, /محدودیت‌هایی که به حمایت یا برنامه ایمنی نیاز دارند/u);
});


test('T08 reassurance, autonomy and boundary actions remain topic-specific', () => {
  const byDay = new Map(EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES.map((guide) => [guide.day, guide]));
  assert.match(byDay.get(7).action, /تأیید چندباره/u);
  assert.match(byDay.get(9).action, /انتظار پاسخ/u);
  assert.match(byDay.get(10).action, /منتظر تأیید فرد دیگری/u);
  assert.match(byDay.get(11).action, /بدون کنترل تلفن/u);
  assert.match(byDay.get(13).action, /حتماً طرد شدم/u);
  assert.match(byDay.get(14).action, /میل به پرسیدن دوباره/u);
  assert.match(byDay.get(15).action, /امکان نه‌گفتن طرف مقابل/u);
  assert.match(byDay.get(16).action, /به‌خاطر انتظار پاسخ کنار گذاشته‌ای/u);
  assert.match(byDay.get(18).action, /بدون تأیید فرد موردنظر/u);
  assert.match(byDay.get(21).action, /محدودیت حقوقی/u);
  assert.match(byDay.get(27).action, /پیگیری مکرر برای گرفتن تضمین/u);
});


test('T08 day 1 uses fourteen independently authored prepared answers', () => {
  const guide = EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES.find((item) => item.day === 1);
  assert.equal(Object.keys(guide.preparedAnswers || {}).length, 14);
  for (const question of guide.questions) {
    const authored = guide.preparedAnswers[question.kind];
    assert.ok(authored && authored.length >= 250, 'missing authored answer for ' + question.kind);
    const answer = answerEmotionalDependencyDailyPreparedQuestion({
      day: 1,
      message: question.value,
      dailyContent: { exercise: guide.exercise, actionText: guide.action },
    });
    assert.ok(answer.includes(authored), 'prepared answer must use the authored day-specific text');
  }
});


test('T08 days 1-5 have seventy independently authored prepared answers', () => {
  for (const day of [1, 2, 3, 4, 5]) {
    const guide = EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES.find((item) => item.day === day);
    assert.equal(Object.keys(guide.preparedAnswers || {}).length, 14);
    for (const question of guide.questions) {
      const authored = guide.preparedAnswers[question.kind];
      assert.ok(authored && authored.length >= 250, 'missing authored answer: day ' + day + ' ' + question.kind);
      const answer = answerEmotionalDependencyDailyPreparedQuestion({
        day,
        message: question.value,
        dailyContent: { exercise: guide.exercise, actionText: guide.action },
      });
      assert.ok(answer.includes(authored), 'answer must use authored text: day ' + day + ' ' + question.kind);
    }
  }
});
