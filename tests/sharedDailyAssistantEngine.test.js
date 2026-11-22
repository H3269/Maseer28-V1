import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { mergeDailyTextOverrides } from '../src/features/content/dailyTextOverrides.js';
import {
  buildSharedDailyAssistantAnswerFromDailyContent,
  getSharedDailyAssistantPromptGroups,
  getSharedDailyAssistantQuestion,
  SHARED_DAILY_ASSISTANT_DISTRESS_KINDS,
} from '../src/features/assistant/sharedDailyAssistantEngine.js';
import {
  ANGER_DAILY_ASSISTANT_GUIDES,
  ANGER_DAILY_PLAIN_LANGUAGE_STEPS,
} from '../src/features/assistant/angerDailyAssistantPrompts.js';
import { buildAngerDailyRebuiltAnswer } from '../src/features/assistant/angerDailyRebuiltAnswerBank.js';

const TOPICS = Object.freeze([
  ['T02', 'اضطراب'],
  ['T03', 'ترس'],
  ['T04', 'نفرت'],
  ['T05', 'حسادت'],
  ['T06', 'غم و سوگ'],
  ['T07', 'احساس گناه'],
  ['T08', 'وابستگی عاطفی'],
  ['T09', 'اهمال‌کاری'],
  ['T10', 'بی‌خوابی و مشکلات خواب'],
  ['T11', 'عادت‌های تکراری'],
  ['T12', 'مرزبندی و نه گفتن'],
  ['T13', 'تنهایی'],
  ['T14', 'کمبود انگیزه'],
]);

const mergedContentPromise = Promise.all([
  readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8').then(JSON.parse),
]).then(([base, overrides]) => mergeDailyTextOverrides(base, overrides));

async function loadMergedContent() {
  return mergedContentPromise;
}

test('one shared prompt catalogue exposes the same fourteen questions and five groups for T01-T14', () => {
  for (const topicId of ['T01', ...TOPICS.map(([id]) => id)]) {
    for (let day = 1; day <= 28; day += 1) {
      const groups = getSharedDailyAssistantPromptGroups(day, topicId);
      assert.equal(groups.length, 5, topicId + ' day ' + day);
      assert.deepEqual(groups.map((group) => group.questions.length), [2, 2, 1, 5, 4]);
      const questions = groups.flatMap((group) => group.questions);
      assert.equal(questions.length, 14);
      assert.equal(new Set(questions.map((question) => question.value)).size, 14);
      assert.equal(questions[10].kind, SHARED_DAILY_ASSISTANT_DISTRESS_KINDS[topicId]);
      assert.equal(questions[0].value, 'منظور از تمرین امروز چیست؟');
      assert.equal(questions[13].value, 'این تمرین چقدر زمان می‌برد؟');
    }
  }
  assert.deepEqual(getSharedDailyAssistantPromptGroups(29, 'T02'), []);
  assert.deepEqual(getSharedDailyAssistantPromptGroups(1, 'T15'), []);
});

test('the T01 approved answer-bank entry point delegates to the same shared builder', () => {
  for (const guide of ANGER_DAILY_ASSISTANT_GUIDES) {
    const questions = getSharedDailyAssistantPromptGroups(guide.day, 'T01').flatMap((group) => group.questions);
    assert.equal(questions.length, 14);
    for (const question of questions) {
      const shared = buildAngerDailyRebuiltAnswer({
        guide,
        question,
        plainSteps: ANGER_DAILY_PLAIN_LANGUAGE_STEPS[guide.day] || {},
      });
      const direct = buildSharedDailyAssistantAnswerFromDailyContent({
        topicId: 'T01',
        topicName: 'خشم',
        day: guide.day,
        message: question.value,
        dailyContent: {
          id: 'خشم-' + String(guide.day).padStart(2, '0'),
          topic_id: 'T01',
          day: guide.day,
          exercise: guide.exercise,
          actionText: guide.action,
        },
      });
      assert.equal(typeof shared, 'string', 'T01 day ' + guide.day + ' ' + question.kind);
      assert.ok(shared.length > 0);
      // The old T01 entry point and the new shared entry point must use one renderer.
      assert.equal(buildAngerDailyRebuiltAnswer({
        guide,
        question,
        plainSteps: ANGER_DAILY_PLAIN_LANGUAGE_STEPS[guide.day] || {},
      }), shared);
    }
  }
});

test('T02-T14 produce fourteen day-bound answers from canonical content for all 28 days', async () => {
  const merged = await loadMergedContent();
  let checked = 0;
  for (const [topicId, topicName] of TOPICS) {
    const days = merged.categories[topicName]?.days || [];
    assert.equal(days.length, 28, topicId + ' must have 28 canonical days');
    for (let day = 1; day <= 28; day += 1) {
      const dailyContent = days.find((item) => item.day === day);
      assert.ok(dailyContent?.exercise, topicId + ' day ' + day + ' exercise');
      assert.ok(dailyContent?.actionText, topicId + ' day ' + day + ' action');
      const questions = getSharedDailyAssistantPromptGroups(day, topicId).flatMap((group) => group.questions);
      assert.equal(questions.length, 14);
      for (const question of questions) {
        const answer = buildSharedDailyAssistantAnswerFromDailyContent({
          topicId,
          topicName,
          day,
          message: question.value,
          dailyContent,
        });
        assert.equal(typeof answer, 'string', topicId + ' day ' + day + ' ' + question.kind);
        assert.ok(answer.trim().length > 0);
        assert.doesNotMatch(answer, /(?:^|[^A-Za-z0-9])T(?:0?[1-9]|1[0-4])(?:$|[^A-Za-z0-9])/u);
        if (question.kind === 'exercise_meaning') assert.ok(answer.includes(dailyContent.exercise));
        if (question.kind === 'action_meaning') assert.ok(answer.includes(dailyContent.actionText));
        if (question.kind === 'exercise_example' && dailyContent.exerciseExample) {
          assert.ok(answer.includes(dailyContent.exerciseExample.replace(/^(?:نمونه فرضی:\s*){2,}/u, 'نمونه فرضی: ')));
        }
        if (question.kind === 'action_example' && dailyContent.actionExample) {
          assert.ok(answer.includes(dailyContent.actionExample.replace(/^(?:نمونه فرضی:\s*){2,}/u, 'نمونه فرضی: ')));
        }
        if (question.kind === 'distress_increased' || SHARED_DAILY_ASSISTANT_DISTRESS_KINDS[topicId] === question.kind) {
          assert.match(answer, /تمرین را کنار بگذار/u);
          assert.match(answer, /خدمات اضطراری/u);
        }
        checked += 1;
      }
    }
  }
  assert.equal(checked, 13 * 28 * 14);
});

test('missing examples are disclosed instead of being invented for T11-T14', async () => {
  const merged = await loadMergedContent();
  for (const [topicId, topicName] of TOPICS.filter(([id]) => ['T11', 'T12', 'T13', 'T14'].includes(id))) {
    const day = merged.categories[topicName].days[0];
    const questions = getSharedDailyAssistantPromptGroups(1, topicId).flatMap((group) => group.questions);
    const exerciseQuestion = questions.find((question) => question.kind === 'exercise_example');
    const actionQuestion = questions.find((question) => question.kind === 'action_example');
    assert.equal(day.exerciseExample, undefined, topicId + ' exercise example must not be sourced from legacy assistant code');
    assert.equal(day.actionExample, undefined, topicId + ' action example must not be sourced from legacy assistant code');
    const exerciseAnswer = buildSharedDailyAssistantAnswerFromDailyContent({
      topicId, topicName, day: 1, message: exerciseQuestion.value, dailyContent: day,
    });
    const actionAnswer = buildSharedDailyAssistantAnswerFromDailyContent({
      topicId, topicName, day: 1, message: actionQuestion.value, dailyContent: day,
    });
    assert.match(exerciseAnswer, /مثال فرضی جداگانه‌ای در محتوای ثبت‌شده وجود ندارد/u);
    assert.match(actionAnswer, /مثال فرضی جداگانه‌ای در محتوای ثبت‌شده وجود ندارد/u);
    assert.ok(exerciseAnswer.includes(day.exercise));
    assert.ok(actionAnswer.includes(day.actionText));
  }
});

test('the shared builder rejects mismatched topic, day, identity, and unregistered questions', async () => {
  const merged = await loadMergedContent();
  const dailyContent = merged.categories['اضطراب'].days[0];
  const question = getSharedDailyAssistantQuestion('T02', 'منظور از تمرین امروز چیست؟');
  assert.ok(question);
  assert.equal(buildSharedDailyAssistantAnswerFromDailyContent({
    topicId: 'T03', topicName: 'ترس', day: 1, message: question.value, dailyContent,
  }), null);
  assert.equal(buildSharedDailyAssistantAnswerFromDailyContent({
    topicId: 'T02', topicName: 'اضطراب', day: 2, message: question.value, dailyContent,
  }), null);
  assert.equal(buildSharedDailyAssistantAnswerFromDailyContent({
    topicId: 'T02', topicName: 'اضطراب', day: 1, message: question.value,
    dailyContent: { ...dailyContent, id: 'ترس-01' },
  }), null);
  assert.equal(buildSharedDailyAssistantAnswerFromDailyContent({
    topicId: 'T02', topicName: 'اضطراب', day: 1, message: 'سؤال ثبت‌نشده', dailyContent,
  }), null);
  assert.equal(buildSharedDailyAssistantAnswerFromDailyContent({
    topicId: 'T02', topicName: 'اضطراب', day: 1, message: question.value,
    dailyContent: { ...dailyContent, exercise: '', instructions: '' },
  }), null);
});

test('runtime assistant entry points no longer import T02-T14 answer banks or prompt banks', async () => {
  const paths = [
    '../src/features/assistant/pageAssistantTurn.js',
    '../src/features/assistant/dailyExerciseAssistantGuidance.js',
    '../src/features/assistant/GlobalAssistantLauncher.jsx',
  ];
  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /(?:anxiety|fear|hatred|jealousy|grief|guilt|emotionalDependency|t09|t10|t11|t12|t13|t14)DailyAssistant(?:Prompts|Guides)/u, path);
  }
});
