import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { mergeDailyTextOverrides } from '../src/features/content/dailyTextOverrides.js';
import {
  buildSharedDailyAssistantAnswerFromDailyContent,
  getSharedDailyAssistantPromptGroups,
  SHARED_DAILY_ASSISTANT_DISTRESS_KINDS,
} from '../src/features/assistant/sharedDailyAssistantEngine.js';
import {
  ANGER_DAILY_ASSISTANT_GUIDES,
  ANGER_DAILY_PLAIN_LANGUAGE_STEPS,
  answerAngerDailyPreparedQuestion,
} from '../src/features/assistant/angerDailyAssistantPrompts.js';
import { buildAngerDailyRebuiltAnswer } from '../src/features/assistant/angerDailyRebuiltAnswerBank.js';
import { DAILY_ASSISTANT_SAFETY_QUESTION_KINDS } from '../src/features/assistant/dailyAssistantSafetyReminder.js';

const TOPICS = Object.freeze([
  ['T01', 'خشم'], ['T02', 'اضطراب'], ['T03', 'ترس'], ['T04', 'نفرت'],
  ['T05', 'حسادت'], ['T06', 'غم و سوگ'], ['T07', 'احساس گناه'],
  ['T08', 'وابستگی عاطفی'], ['T09', 'اهمال‌کاری'],
  ['T10', 'بی‌خوابی و مشکلات خواب'], ['T11', 'عادت‌های تکراری'],
  ['T12', 'مرزبندی و نه گفتن'], ['T13', 'تنهایی'], ['T14', 'کمبود انگیزه'],
]);

const mergedContentPromise = Promise.all([
  readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8').then(JSON.parse),
]).then(([base, overrides]) => mergeDailyTextOverrides(base, overrides));

test('all fourteen topics share one fixed 14-question catalogue and five groups for every day', () => {
  for (const [topicId] of TOPICS) {
    for (let day = 1; day <= 28; day += 1) {
      const groups = getSharedDailyAssistantPromptGroups(day, topicId);
      assert.deepEqual(groups.map(group => group.questions.length), [2, 2, 1, 5, 4], topicId + ' day ' + day);
      const questions = groups.flatMap(group => group.questions);
      assert.equal(questions.length, 14);
      assert.equal(new Set(questions.map(question => question.value)).size, 14);
      assert.equal(questions.find((question) => question.id === 'q11')?.kind, SHARED_DAILY_ASSISTANT_DISTRESS_KINDS[topicId]);
      assert.ok(DAILY_ASSISTANT_SAFETY_QUESTION_KINDS.has(questions[10].kind));
      assert.equal(questions[0].value, 'منظور از تمرین امروز چیست؟');
      assert.equal(questions[13].value, 'این تمرین چقدر زمان می‌برد؟');
    }
  }
  assert.deepEqual(getSharedDailyAssistantPromptGroups(0, 'T01'), []);
  assert.deepEqual(getSharedDailyAssistantPromptGroups(29, 'T14'), []);
});

test('the T01 approved entry point delegates every prepared question to the shared renderer', () => {
  assert.equal(ANGER_DAILY_ASSISTANT_GUIDES.length, 28);
  for (const guide of ANGER_DAILY_ASSISTANT_GUIDES) {
    const questions = getSharedDailyAssistantPromptGroups(guide.day, 'T01').flatMap(group => group.questions);
    assert.equal(questions.length, 14);
    for (const question of questions) {
      const args = { day: guide.day, message: question.value };
      const expected = buildAngerDailyRebuiltAnswer({
        guide, question, plainSteps: ANGER_DAILY_PLAIN_LANGUAGE_STEPS[guide.day] || {},
      });
      assert.equal(answerAngerDailyPreparedQuestion(args), expected, 'T01 day ' + guide.day + ' ' + question.id);
      assert.ok(expected && expected.length > 0);
    }
  }
});

test('the shared renderer produces grounded day-specific answers for all 5,488 topic/day/question combinations', async () => {
  const merged = await mergedContentPromise;
  let checked = 0;
  for (const [topicId, topicName] of TOPICS) {
    const days = merged.categories[topicName]?.days || [];
    assert.equal(days.length, 28, topicId + ' canonical day count');
    for (let day = 1; day <= 28; day += 1) {
      const dailyContent = days.find(item => Number(item.day) === day);
      assert.ok(dailyContent?.exercise, topicId + ' day ' + day + ' exercise');
      assert.ok(dailyContent?.actionText, topicId + ' day ' + day + ' action');
      const questions = getSharedDailyAssistantPromptGroups(day, topicId).flatMap(group => group.questions);
      for (const question of questions) {
        const answer = buildSharedDailyAssistantAnswerFromDailyContent({
          topicId, topicName, day, message: question.value, dailyContent,
        });
        assert.equal(typeof answer, 'string', topicId + ' day ' + day + ' ' + question.id);
        assert.ok(answer.trim().length > 0);
        if (question.kind === 'exercise_meaning') assert.ok(answer.includes(dailyContent.exercise));
        if (question.kind === 'action_meaning') assert.ok(answer.includes(dailyContent.actionText));
        if (question.kind === 'exercise_example' && !dailyContent.exerciseExample) {
          assert.match(answer, /مثال فرضی جداگانه‌ای در محتوای ثبت‌شده وجود ندارد/u);
        }
        if (question.kind === 'action_example' && !dailyContent.actionExample) {
          assert.match(answer, /مثال فرضی جداگانه‌ای در محتوای ثبت‌شده وجود ندارد/u);
        }
        if (question.kind === SHARED_DAILY_ASSISTANT_DISTRESS_KINDS[topicId]) {
          assert.match(answer, /تمرین را کنار بگذار/u);
          assert.match(answer, /خدمات اضطراری/u);
        }
        checked += 1;
      }
    }
  }
  assert.equal(checked, 14 * 28 * 14);
});

test('runtime entry points do not import retired T02-T14 assistant banks', async () => {
  const paths = [
    '../src/features/assistant/pageAssistantTurn.js',
    '../src/features/assistant/dailyExerciseAssistantGuidance.js',
    '../src/features/assistant/GlobalAssistantLauncher.jsx',
  ];
  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(
      source,
      /(?:anxiety|fear|hatred|jealousy|grief|guilt|emotionalDependency|t09|t10|t11|t12|t13|t14)DailyAssistant(?:Prompts|Guides)/u,
      path,
    );
  }
});
