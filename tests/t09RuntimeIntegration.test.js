import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import {
  T09_DAILY_ASSISTANT_GUIDES,
  answerT09DailyPreparedQuestion,
  getT09DailyAssistantPromptGroups,
} from '../src/features/assistant/t09DailyAssistantPrompts.js';
import { getCanonicalDailyRecordId } from '../src/features/content/dailyContentSelector.js';

function contextFor(guide, overrides = {}) {
  return {
    day: guide.day,
    problem: 'اهمال‌کاری',
    data: {
      id: getCanonicalDailyRecordId('اهمال‌کاری', guide.day),
      topic_id: 'T09',
      day: guide.day,
      exercise: guide.exercise,
      actionText: guide.action,
    },
    ...overrides,
  };
}

test('T09 runtime guide exposes 28 days and exactly 14 prepared questions per day', () => {
  assert.equal(T09_DAILY_ASSISTANT_GUIDES.length, 28);
  for (let day = 1; day <= 28; day += 1) {
    const guide = T09_DAILY_ASSISTANT_GUIDES[day - 1];
    assert.equal(guide.day, day);
    assert.equal(guide.topicId, 'T09');
    assert.equal(guide.questions.length, 14);
    const groups = getT09DailyAssistantPromptGroups(day);
    assert.deepEqual(groups.map((group) => group.questions.length), [2, 2, 1, 5, 4]);
    assert.equal(groups.reduce((sum, group) => sum + group.questions.length, 0), 14);
    assert.equal(new Set(groups.flatMap((group) => group.questions.map((question) => question.value))).size, 14);
  }
  assert.deepEqual(getT09DailyAssistantPromptGroups(0), []);
  assert.deepEqual(getT09DailyAssistantPromptGroups(29), []);
});

test('all 392 exact T09 questions route through the real page assistant with matching day identity', () => {
  let checked = 0;
  for (const guide of T09_DAILY_ASSISTANT_GUIDES) {
    for (const question of guide.questions) {
      const result = makePageAssistantTurn({
        screen: 'day',
        text: question.value,
        dailyContext: contextFor(guide),
      });
      assert.equal(result.status, 'daily_guidance_available', `day ${guide.day}: ${question.id}`);
      assert.ok(result.message.includes(guide.title), `day ${guide.day}: answer retains title`);
      assert.ok(result.message.trim().length > 0);
      checked += 1;
    }
  }
  assert.equal(checked, 392);
});

test('T09 rejects wrong topic, wrong day, and free-form questions', () => {
  const guide = T09_DAILY_ASSISTANT_GUIDES[0];
  const question = guide.questions[0];
  const wrongTopic = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: {
      ...contextFor(guide),
      data: { ...contextFor(guide).data, topic_id: 'T08' },
    },
  });
  assert.equal(wrongTopic.status, 'daily_guidance_unavailable');

  const wrongDay = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: {
      ...contextFor(guide),
      day: 2,
      data: { ...contextFor(guide).data, id: getCanonicalDailyRecordId('اهمال‌کاری', 1), day: 1 },
    },
  });
  assert.equal(wrongDay.status, 'daily_guidance_unavailable');

  const freeForm = makePageAssistantTurn({
    screen: 'day',
    text: 'چرا همیشه کارهایم را عقب می‌اندازم؟',
    dailyContext: contextFor(guide),
  });
  assert.equal(freeForm.status, 'prepared_question_required');
  assert.match(freeForm.message, /گفت‌وگوی آزاد برای این موضوع فعال نیست/u);
});

test('explicit immediate-risk disclosures keep precedence over prepared T09 answers', () => {
  const guide = T09_DAILY_ASSISTANT_GUIDES[0];
  const urgent = makePageAssistantTurn({
    screen: 'day',
    text: 'قصد دارم همین الآن به خودم آسیب بزنم و به کمک فوری نیاز دارم.',
    dailyContext: contextFor(guide),
  });
  assert.equal(urgent.status, 'urgent_human_support_required');
});

test('T09 interpersonal FAQ answers stay task-focused and do not inherit relationship-dependency copy', () => {
  for (const guide of T09_DAILY_ASSISTANT_GUIDES) {
    const question = guide.questions.find((item) => item.kind === 'talk_other');
    const answer = answerT09DailyPreparedQuestion({
      day: guide.day,
      message: question.value,
      dailyContent: { id: getCanonicalDailyRecordId('اهمال‌کاری', guide.day), day: guide.day, topic_id: 'T09' },
    });
    assert.ok(answer.includes('گفت‌وگو شرط انجام تمرین نیست'), `day ${guide.day}`);
    assert.ok(answer.includes('اطلاعات، اجازه، دسترسی، هماهنگی یا تقسیم مسئولیتی'), `day ${guide.day}`);
    assert.doesNotMatch(answer, /وابستگی را فقط ثبت کن/u, `day ${guide.day}: no T08 copy`);
  }
});

test('T09 overlay and prompt UI are connected while the knowledge registry remains draft-only', async () => {
  const [overrides, registry, launcher] = await Promise.all([
    readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../public/assistant/knowledge/topics.v1.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../src/features/assistant/GlobalAssistantLauncher.jsx', import.meta.url), 'utf8'),
  ]);
  const days = overrides.categories['اهمال‌کاری']?.days;
  assert.equal(days?.length, 28);
  assert.ok(days.every((day) => Number.isInteger(day.day) && day.day >= 1 && day.day <= 28));
  const topic = registry.topics.find((item) => item.topic_id === 'T09');
  assert.equal(topic.review_status, 'draft');
  assert.deepEqual(topic.content_ids, [], 'T09 draft must not be represented as approved knowledge');
  assert.match(launcher, /getT09DailyAssistantPromptGroups/);
  assert.match(launcher, /isT09DailyPromptContext/);
  assert.match(launcher, /t09-daily-prompt-trigger/);
});

test('T09 answers are fully contextual, use visible daily content, and keep resistance distinct from stop guidance', () => {
  const guide = T09_DAILY_ASSISTANT_GUIDES[0];
  const exerciseQuestion = guide.questions.find((item) => item.id === 'q01');
  const actionQuestion = guide.questions.find((item) => item.id === 'q03');
  const resistanceQuestion = guide.questions.find((item) => item.id === 'q11');
  const stopQuestion = guide.questions.find((item) => item.id === 'q07');
  const visible = { id: getCanonicalDailyRecordId('اهمال‌کاری', 1), day: 1, topic_id: 'T09', exercise: 'تمرین نمایان و مخصوص آزمون', actionText: 'اقدام نمایان و مخصوص آزمون' };
  const exerciseAnswer = answerT09DailyPreparedQuestion({ day: 1, message: exerciseQuestion.value, dailyContent: visible });
  const actionAnswer = answerT09DailyPreparedQuestion({ day: 1, message: actionQuestion.value, dailyContent: visible });
  const resistanceAnswer = answerT09DailyPreparedQuestion({ day: 1, message: resistanceQuestion.value, dailyContent: visible });
  const stopAnswer = answerT09DailyPreparedQuestion({ day: 1, message: stopQuestion.value, dailyContent: visible });
  assert.ok(exerciseAnswer.includes('تمرین نمایان و مخصوص آزمون'));
  assert.ok(actionAnswer.includes('اقدام نمایان و مخصوص آزمون'));
  assert.ok(exerciseAnswer.includes('هدف امروز') && exerciseAnswer.includes(guide.objective));
  assert.ok(exerciseAnswer.includes('منطق آموزشی امروز') && exerciseAnswer.includes(guide.mechanism));
  assert.ok(resistanceAnswer.includes('افزایش مقاومت به‌تنهایی نشانه تنبلی'));
  assert.notEqual(resistanceAnswer, stopAnswer);
  assert.ok(resistanceAnswer.includes(guide.whenToSeekHumanSupport));
  assert.doesNotMatch(resistanceAnswer, /وابستگی را فقط ثبت کن/u);
});

test('T09 answer helper refuses mismatched canonical topic/day identities', () => {
  const guide = T09_DAILY_ASSISTANT_GUIDES[0];
  const question = guide.questions[0];
  assert.equal(answerT09DailyPreparedQuestion({
    day: 1,
    message: question.value,
    dailyContent: { id: getCanonicalDailyRecordId('اضطراب', 1), day: 1, topic_id: 'T02' },
  }), null);
  assert.equal(answerT09DailyPreparedQuestion({
    day: 2,
    message: question.value,
    dailyContent: { id: getCanonicalDailyRecordId('اهمال‌کاری', 1), day: 1, topic_id: 'T09' },
  }), null);
});
