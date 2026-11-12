import assert from 'node:assert/strict';
import test from 'node:test';
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
