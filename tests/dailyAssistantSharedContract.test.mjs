import assert from 'node:assert/strict';
import test from 'node:test';
import { getCanonicalDailyRecordId } from '../src/features/content/dailyContentSelector.js';
import { ANGER_DAILY_ASSISTANT_GUIDES, answerAngerDailyPreparedQuestion, getAngerDailyAssistantPromptGroups } from '../src/features/assistant/angerDailyAssistantPrompts.js';
import { ANXIETY_DAILY_ASSISTANT_GUIDES, answerAnxietyDailyPreparedQuestion, getAnxietyDailyAssistantPromptGroups } from '../src/features/assistant/anxietyDailyAssistantPrompts.js';
import { FEAR_DAILY_ASSISTANT_GUIDES, answerFearDailyPreparedQuestion, getFearDailyAssistantPromptGroups } from '../src/features/assistant/fearDailyAssistantPrompts.js';
import { HATRED_DAILY_ASSISTANT_GUIDES, answerHatredDailyPreparedQuestion, getHatredDailyAssistantPromptGroups } from '../src/features/assistant/hatredDailyAssistantPrompts.js';
import { JEALOUSY_DAILY_ASSISTANT_GUIDES, answerJealousyDailyPreparedQuestion, getJealousyDailyAssistantPromptGroups } from '../src/features/assistant/jealousyDailyAssistantPrompts.js';
import { GRIEF_DAILY_ASSISTANT_GUIDES, answerGriefDailyPreparedQuestion, getGriefDailyAssistantPromptGroups } from '../src/features/assistant/griefDailyAssistantPrompts.js';
import { GUILT_DAILY_ASSISTANT_GUIDES, answerGuiltDailyPreparedQuestion, getGuiltDailyAssistantPromptGroups } from '../src/features/assistant/guiltDailyAssistantPrompts.js';
import { EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES, answerEmotionalDependencyDailyPreparedQuestion, getEmotionalDependencyDailyAssistantPromptGroups } from '../src/features/assistant/emotionalDependencyDailyAssistantPrompts.js';
import { T09_DAILY_ASSISTANT_GUIDES, answerT09DailyPreparedQuestion, getT09DailyAssistantPromptGroups } from '../src/features/assistant/t09DailyAssistantPrompts.js';

const QUESTION_TEXTS = [
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
  'اگر هنگام شروع، انجام یا ادامه تمرین و اقدام، فشار یا دشواری بیشتری احساس کردم چه کنم؟',
  'آیا لازم است حتماً با فرد دیگری صحبت کنم؟',
  'می‌توانم تمرین را تغییر بدهم یا به روش خودم انجام بدهم؟',
  'این تمرین چقدر زمان می‌برد؟',
];
const QUESTION_IDS = Array.from({ length: 14 }, (_, index) => 'q' + String(index + 1).padStart(2, '0'));
const GROUP_SIZES = [2, 2, 1, 5, 4];

const TOPICS = [
  { id: 'T01', guides: ANGER_DAILY_ASSISTANT_GUIDES, answer: answerAngerDailyPreparedQuestion, groups: getAngerDailyAssistantPromptGroups, topic: 'خشم' },
  { id: 'T02', guides: ANXIETY_DAILY_ASSISTANT_GUIDES, answer: answerAnxietyDailyPreparedQuestion, groups: getAnxietyDailyAssistantPromptGroups, topic: 'اضطراب' },
  { id: 'T03', guides: FEAR_DAILY_ASSISTANT_GUIDES, answer: answerFearDailyPreparedQuestion, groups: getFearDailyAssistantPromptGroups, topic: 'ترس' },
  { id: 'T04', guides: HATRED_DAILY_ASSISTANT_GUIDES, answer: answerHatredDailyPreparedQuestion, groups: getHatredDailyAssistantPromptGroups, topic: 'نفرت' },
  { id: 'T05', guides: JEALOUSY_DAILY_ASSISTANT_GUIDES, answer: answerJealousyDailyPreparedQuestion, groups: getJealousyDailyAssistantPromptGroups, topic: 'حسادت' },
  { id: 'T06', guides: GRIEF_DAILY_ASSISTANT_GUIDES, answer: answerGriefDailyPreparedQuestion, groups: getGriefDailyAssistantPromptGroups, topic: 'غم و سوگ' },
  { id: 'T07', guides: GUILT_DAILY_ASSISTANT_GUIDES, answer: answerGuiltDailyPreparedQuestion, groups: getGuiltDailyAssistantPromptGroups, topic: 'احساس گناه' },
  { id: 'T08', guides: EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES, answer: answerEmotionalDependencyDailyPreparedQuestion, groups: getEmotionalDependencyDailyAssistantPromptGroups, topic: 'وابستگی عاطفی' },
  { id: 'T09', guides: T09_DAILY_ASSISTANT_GUIDES, answer: answerT09DailyPreparedQuestion, groups: getT09DailyAssistantPromptGroups, topic: 'اهمال‌کاری' },
];

function answerTopicQuestion(topic, guide, question) {
  const dailyContent = {
    id: getCanonicalDailyRecordId(topic.topic, guide.day),
    topic_id: topic.id,
    day: guide.day,
    exercise: guide.exercise,
    actionText: guide.action,
    lightExerciseText: guide.lightVersion,
    lightActionText: guide.lightActionVersion || guide.lightVersion,
    progressActionText: guide.progressActionVersion || guide.progressVersion,
    restActionText: guide.restActionVersion || guide.restVersion,
  };
  return topic.answer({ day: guide.day, message: question.value, dailyContent });
}

test('T01-T09 share the exact same 14 prepared question IDs, order and visible text across all 28 days', () => {
  for (const topic of TOPICS) {
    assert.equal(topic.guides.length, 28, topic.id);
    assert.deepEqual(topic.guides.map((guide) => guide.day), Array.from({ length: 28 }, (_, index) => index + 1), topic.id);
    for (const guide of topic.guides) {
      assert.equal(guide.topicId, topic.id, topic.id + ' day ' + guide.day);
      assert.deepEqual(guide.questions.map((question) => question.id), QUESTION_IDS, topic.id + ' day ' + guide.day + ' IDs');
      assert.deepEqual(guide.questions.map((question) => question.value), QUESTION_TEXTS, topic.id + ' day ' + guide.day + ' text');
      assert.deepEqual(guide.questions.map((question) => question.label), QUESTION_TEXTS, topic.id + ' day ' + guide.day + ' labels');
      assert.equal(new Set(guide.questions.map((question) => question.value)).size, 14, topic.id + ' day ' + guide.day);
    }
  }
});

test('T01-T09 expose the same five prompt groups and the same 2/2/1/5/4 question distribution', () => {
  for (const topic of TOPICS) {
    for (let day = 1; day <= 28; day += 1) {
      const groups = topic.groups(day);
      assert.equal(groups.length, 5, topic.id + ' day ' + day);
      assert.deepEqual(groups.map((group) => group.questions.length), GROUP_SIZES, topic.id + ' day ' + day);
      assert.deepEqual(groups.flatMap((group) => group.questions).map((question) => question.id), QUESTION_IDS, topic.id + ' day ' + day);
    }
    assert.deepEqual(topic.groups(29), [], topic.id + ' invalid day');
  }
});

test('all nine topic assistants use the same response frame while retaining their own day-specific content', () => {
  for (const topic of TOPICS) {
    const guide = topic.guides[0];
    const answers = guide.questions.map((question) => answerTopicQuestion(topic, guide, question));
    assert.ok(answers.every((answer) => typeof answer === 'string' && answer.trim()), topic.id + ' must answer all 14 prepared questions');
    for (const [index, answer] of answers.entries()) {
      assert.ok(answer.includes('بیاییم قدم‌به‌قدم پیش برویم'), topic.id + ' q' + (index + 1) + ' shared response frame');
    }
    assert.ok(answers[0].includes(guide.exercise), topic.id + ' exercise answer must use the selected day');
    assert.ok(answers[2].includes(guide.action), topic.id + ' action answer must use the selected day');
  }
  const resistanceAnswers = TOPICS.map((topic) => answerTopicQuestion(topic, topic.guides[0], topic.guides[0].questions[10]));
  assert.ok(new Set(resistanceAnswers).size >= 8, 'the shared question must still receive topic-specific answers');
});
