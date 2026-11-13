import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { ANGER_DAILY_ASSISTANT_GUIDES, answerAngerDailyPreparedQuestion, getAngerDailyAssistantPromptGroups } from '../src/features/assistant/angerDailyAssistantPrompts.js';
import { ANXIETY_DAILY_ASSISTANT_GUIDES, answerAnxietyDailyPreparedQuestion, getAnxietyDailyAssistantPromptGroups } from '../src/features/assistant/anxietyDailyAssistantPrompts.js';
import { FEAR_DAILY_ASSISTANT_GUIDES, answerFearDailyPreparedQuestion, getFearDailyAssistantPromptGroups } from '../src/features/assistant/fearDailyAssistantPrompts.js';
import { HATRED_DAILY_ASSISTANT_GUIDES, answerHatredDailyPreparedQuestion, getHatredDailyAssistantPromptGroups } from '../src/features/assistant/hatredDailyAssistantPrompts.js';
import { JEALOUSY_DAILY_ASSISTANT_GUIDES, answerJealousyDailyPreparedQuestion, getJealousyDailyAssistantPromptGroups } from '../src/features/assistant/jealousyDailyAssistantPrompts.js';
import { GRIEF_DAILY_ASSISTANT_GUIDES, answerGriefDailyPreparedQuestion, getGriefDailyAssistantPromptGroups } from '../src/features/assistant/griefDailyAssistantPrompts.js';
import { GUILT_DAILY_ASSISTANT_GUIDES, answerGuiltDailyPreparedQuestion, getGuiltDailyAssistantPromptGroups } from '../src/features/assistant/guiltDailyAssistantPrompts.js';
import { EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES, answerEmotionalDependencyDailyPreparedQuestion, getEmotionalDependencyDailyAssistantPromptGroups } from '../src/features/assistant/emotionalDependencyDailyAssistantPrompts.js';
import { T09_DAILY_ASSISTANT_GUIDES, answerT09DailyPreparedQuestion, getT09DailyAssistantPromptGroups } from '../src/features/assistant/t09DailyAssistantPrompts.js';

const topics = [
  ['T01', ANGER_DAILY_ASSISTANT_GUIDES, getAngerDailyAssistantPromptGroups, answerAngerDailyPreparedQuestion],
  ['T02', ANXIETY_DAILY_ASSISTANT_GUIDES, getAnxietyDailyAssistantPromptGroups, answerAnxietyDailyPreparedQuestion],
  ['T03', FEAR_DAILY_ASSISTANT_GUIDES, getFearDailyAssistantPromptGroups, answerFearDailyPreparedQuestion],
  ['T04', HATRED_DAILY_ASSISTANT_GUIDES, getHatredDailyAssistantPromptGroups, answerHatredDailyPreparedQuestion],
  ['T05', JEALOUSY_DAILY_ASSISTANT_GUIDES, getJealousyDailyAssistantPromptGroups, answerJealousyDailyPreparedQuestion],
  ['T06', GRIEF_DAILY_ASSISTANT_GUIDES, getGriefDailyAssistantPromptGroups, answerGriefDailyPreparedQuestion],
  ['T07', GUILT_DAILY_ASSISTANT_GUIDES, getGuiltDailyAssistantPromptGroups, answerGuiltDailyPreparedQuestion],
  ['T08', EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES, getEmotionalDependencyDailyAssistantPromptGroups, answerEmotionalDependencyDailyPreparedQuestion],
  ['T09', T09_DAILY_ASSISTANT_GUIDES, getT09DailyAssistantPromptGroups, answerT09DailyPreparedQuestion],
];
const expectedIds = Array.from({ length: 14 }, (_, i) => 'q' + String(i + 1).padStart(2, '0'));
const expectedValues = [
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

test('T01-T09 share the exact same 14 prepared question IDs, wording, and order on all 28 days', () => {
  for (const [topicId, guides] of topics) {
    assert.equal(guides.length, 28, topicId + ' day coverage');
    for (const guide of guides) {
      assert.equal(guide.day >= 1 && guide.day <= 28, true, topicId + ' day range');
      assert.equal(guide.questions.length, 14, topicId + ' day ' + guide.day);
      assert.deepEqual(guide.questions.map(q => q.id), expectedIds, topicId + ' question IDs day ' + guide.day);
      assert.deepEqual(guide.questions.map(q => q.value), expectedValues, topicId + ' question wording day ' + guide.day);
      assert.deepEqual(guide.questions.map(q => q.label), expectedValues, topicId + ' question labels day ' + guide.day);
      assert.ok(String(guide.questions[10].kind || '').trim(), topicId + ' q11 must retain its topic-specific safety handler day ' + guide.day);
    }
  }
});

test('T01-T09 use the same five prompt groups and question distribution on every day', () => {
  for (const [topicId, guides, getGroups] of topics) {
    for (let day = 1; day <= 28; day += 1) {
      const groups = getGroups(day);
      assert.equal(groups.length, 5, topicId + ' day ' + day + ' group count');
      assert.deepEqual(groups.map(group => group.questions.length), [2, 2, 1, 5, 4], topicId + ' day ' + day + ' group distribution');
      const groupedQuestions = groups.flatMap(group => group.questions).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
      assert.deepEqual(groupedQuestions.map(q => q.id), expectedIds, topicId + ' day ' + day + ' grouped question coverage');
      assert.deepEqual(groupedQuestions.map(q => q.value), expectedValues, topicId + ' day ' + day + ' grouped question order');
    }
    assert.deepEqual(getGroups(0), [], topicId + ' invalid day lower bound');
    assert.deepEqual(getGroups(29), [], topicId + ' invalid day upper bound');
  }
});

test('T09 shared question contract is documented in its canonical guide metadata', async () => {
  const guide = JSON.parse(await readFile(new URL('../src/features/assistant/t09DailyAssistantGuide.v1.json', import.meta.url), 'utf8'));
  assert.match(guide.questionPolicy, /identical question IDs, labels, values, and positions across all topics/);
});

test('T01 and T02 assistant guides retain the full skill/mechanism and three exercise versions from their canonical drafts', () => {
  for (const [topicId, guides] of topics.slice(0, 2)) {
    for (const guide of guides) {
      for (const field of ['skill', 'mechanism', 'lightVersion', 'progressVersion', 'restVersion', 'successCriterion', 'reflectionQuestion', 'stopCondition']) {
        assert.ok(String(guide[field] || '').trim(), topicId + ' day ' + guide.day + ' missing ' + field);
      }
    }
  }
});

test('all T01-T09 prepared answers share the same structural heading and day objective/skill frame', () => {
  for (const [topicId, guides, , answerPrepared] of topics) {
    assert.equal(typeof answerPrepared, 'function', topicId + ' answer handler');
    for (const guide of guides) {
      const dailyContent = {
        id: topicId === 'T09' ? 'اهمال‌کاری-' + String(guide.day).padStart(2, '0') : topicId + '-D' + String(guide.day).padStart(2, '0'),
        topic_id: topicId,
        day: guide.day,
        exercise: guide.exercise,
        actionText: guide.action,
      };
      for (const question of guide.questions) {
        const answer = answerPrepared({
          day: guide.day,
          message: question.value,
          dailyContent,
        });
        assert.equal(typeof answer, 'string', topicId + ' day ' + guide.day + ' ' + question.id + ' answer');
        assert.ok(answer.includes('**بیاییم قدم‌به‌قدم پیش برویم.**'), topicId + ' day ' + guide.day + ' common frame');
        assert.ok(answer.includes('**هدف امروز:** ' + guide.objective), topicId + ' day ' + guide.day + ' objective frame');
        assert.ok(answer.includes('مهارت «' + guide.skill + '»'), topicId + ' day ' + guide.day + ' skill frame');
      }
    }
  }
});

