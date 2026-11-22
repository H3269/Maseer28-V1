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
import { buildPreparedDailyAssistantAnswer } from '../src/features/assistant/preparedDailyAssistantAnswer.js';
import { answerAngerDailyPreparedQuestion } from '../src/features/assistant/angerDailyAssistantPrompts.js';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import { getDailySafetyMode } from '../src/features/content/dailySafety.js';
import { cleanPreparedAssistantTopicText } from '../src/features/assistant/teacherStylePreparedAnswer.js';

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
      assert.equal(questions.find((question) => question.id === 'q11')?.kind, SHARED_DAILY_ASSISTANT_DISTRESS_KINDS[topicId]);
      assert.equal(questions[0].value, 'منظور از تمرین امروز چیست؟');
      assert.equal(questions.find((question) => question.id === 'q14')?.value, 'این تمرین چقدر زمان می‌برد؟');
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
          title: guide.title,
          objective: guide.objective,
          skill: guide.skill,
          mechanism: guide.mechanism,
          exercise: guide.exercise,
          actionText: guide.action,
          exerciseExample: guide.exerciseExample,
          actionExample: guide.actionExample,
          lightVersion: guide.lightVersion,
          lightActionVersion: guide.lightActionVersion,
          progressVersion: guide.progressVersion,
          progressActionText: guide.progressActionVersion,
          restVersion: guide.restVersion,
          restActionText: guide.restActionVersion,
          successCriterion: guide.successCriterion,
          stopCondition: guide.stopCondition,
          reflectionQuestion: guide.reflectionQuestion,
          whenToSeekHumanSupport: guide.whenToSeekHumanSupport,
          durationMinutes: guide.durationMinutes,
        },
        plainSteps: ANGER_DAILY_PLAIN_LANGUAGE_STEPS[guide.day] || {},
      });
      assert.equal(typeof shared, 'string', 'T01 day ' + guide.day + ' ' + question.kind);
      assert.ok(shared.length > 0);
      // The approved T01 content and plain-language steps must render through the same engine.
      assert.equal(direct, shared, 'T01 shared renderer parity day ' + guide.day + ' ' + question.kind);
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
  const migratedCatalog = (await import('../src/features/assistant/sharedDailyAssistantExamples.v1.json', { with: { type: 'json' } })).default;
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

test('T11-T14 authored examples are migrated into the shared renderer for all 28 canonical days', async () => {
  const merged = await loadMergedContent();
  const catalog = (await import('../src/features/assistant/sharedDailyAssistantExamples.v1.json', { with: { type: 'json' } })).default;
  for (const [topicId, topicName] of TOPICS.filter(([id]) => ['T11', 'T12', 'T13', 'T14'].includes(id))) {
    const days = merged.categories[topicName].days;
    const records = catalog.records.filter((record) => record.topicId === topicId);
    assert.equal(records.length, 28, topicId + ' migrated example count');
    assert.equal(new Set(records.map((record) => record.exerciseExample)).size, 28, topicId + ' exercise examples must be distinct');
    assert.equal(new Set(records.map((record) => record.actionExample)).size, 28, topicId + ' action examples must be distinct');
    for (const record of records) {
      const day = days.find((item) => Number(item.day) === record.day);
      assert.ok(day, topicId + ' day ' + record.day + ' canonical source');
      assert.equal(record.exerciseSource, day.exercise, topicId + ' day ' + record.day + ' exercise source identity');
      assert.equal(record.actionSource, day.actionText, topicId + ' day ' + record.day + ' action source identity');
      const questions = getSharedDailyAssistantPromptGroups(record.day, topicId).flatMap((group) => group.questions);
      const exerciseQuestion = questions.find((question) => question.kind === 'exercise_example');
      const actionQuestion = questions.find((question) => question.kind === 'action_example');
      const exerciseAnswer = buildSharedDailyAssistantAnswerFromDailyContent({
        topicId, topicName, day: record.day, message: exerciseQuestion.value, dailyContent: day,
      });
      const actionAnswer = buildSharedDailyAssistantAnswerFromDailyContent({
        topicId, topicName, day: record.day, message: actionQuestion.value, dailyContent: day,
      });
      assert.ok(exerciseAnswer.includes(record.exerciseExample), topicId + ' day ' + record.day + ' exercise example is rendered');
      assert.ok(actionAnswer.includes(record.actionExample), topicId + ' day ' + record.day + ' action example is rendered');
      assert.doesNotMatch(exerciseAnswer + actionAnswer, /مثال فرضی جداگانه‌ای در محتوای ثبت‌شده وجود ندارد/u);
    }
  }
});

test('reviewStatus metadata never gates the fourteen prepared answers in live test mode', async () => {
  const merged = await loadMergedContent();
  const topicId = 'T02';
  const topicName = 'اضطراب';
  const canonical = merged.categories[topicName].days[0];
  const questions = getSharedDailyAssistantPromptGroups(1, topicId).flatMap((group) => group.questions);
  for (const reviewStatus of ['not_recorded', 'pending', 'approved']) {
    const dailyContent = { ...canonical, reviewStatus };
    for (const question of questions) {
      const result = makePageAssistantTurn({
        screen: 'day',
        text: question.value,
        dailyContext: {
          day: 1,
          problem: topicName,
          data: dailyContent,
          relationshipSafetyConfirmed: true,
        },
      });
      assert.equal(result.status, 'daily_guidance_available',
        'reviewStatus=' + reviewStatus + ' must not gate ' + question.id);
      assert.ok(result.message.trim().length > 0,
        'reviewStatus=' + reviewStatus + ' must return a complete answer for ' + question.id);
    }
  }
});

test('generic base fallback text is not mislabeled as topic-specific for T04, T05, T09, T10, and T13', async () => {
  const merged = await loadMergedContent();
  for (const [topicId, topicName] of TOPICS.filter(([id]) => ['T04', 'T05', 'T09', 'T10', 'T13'].includes(id))) {
    const day = merged.categories[topicName].days[0];
    const questions = getSharedDailyAssistantPromptGroups(1, topicId).flatMap((group) => group.questions);
    const lightQuestion = questions.find((question) => question.kind === 'light_version');
    const lightAnswer = buildSharedDailyAssistantAnswerFromDailyContent({
      topicId, topicName, day: 1, message: lightQuestion.value, dailyContent: day,
    });
    assert.match(lightAnswer, /نسخه سبک جداگانه‌ای در محتوای ثبت‌شده وجود ندارد/u, topicId);
    if (day.lightExerciseText) assert.ok(!lightAnswer.includes(day.lightExerciseText), topicId + ' generic light exercise must not be presented as specific');
    if (day.lightActionText) assert.ok(!lightAnswer.includes(day.lightActionText), topicId + ' generic light action must not be presented as specific');
  }
});

test('T02-T14 route through the same prepared-answer engine using the selected canonical day', async () => {
  const merged = await loadMergedContent();
  for (const [topicId, topicName] of TOPICS) {
    const dailyContent = merged.categories[topicName].days[0];
    if (['T13', 'T14'].includes(topicId) && getDailySafetyMode(dailyContent) === 'blocked') continue;
    const question = getSharedDailyAssistantPromptGroups(1, topicId)[0].questions[0];
    const result = makePageAssistantTurn({
      screen: 'day',
      text: question.value,
      dailyContext: {
        day: 1,
        problem: topicName,
        data: dailyContent,
        relationshipSafetyConfirmed: true,
      },
    });
    assert.equal(result.status, 'daily_guidance_available', topicId);
    assert.ok(result.message.includes(dailyContent.exercise), topicId);
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


test('one prepared-answer entry point routes T01-T14 while preserving the shared renderer', async () => {
  const angerGuide = ANGER_DAILY_ASSISTANT_GUIDES[0];
  const angerContent = {
    id: 'خشم-01',
    topic_id: 'T01',
    day: 1,
    title: angerGuide.title,
    exercise: angerGuide.exercise,
    actionText: angerGuide.action,
    exerciseExample: angerGuide.exerciseExample,
    actionExample: angerGuide.actionExample,
    lightExerciseText: angerGuide.lightVersion,
    lightActionText: angerGuide.lightActionVersion,
    progressActionText: angerGuide.progressActionVersion,
    restActionText: angerGuide.restActionVersion,
  };
  for (const question of getSharedDailyAssistantPromptGroups(1, 'T01').flatMap((group) => group.questions)) {
    assert.equal(
      buildPreparedDailyAssistantAnswer({
        topicId: 'T01',
        topicName: 'خشم',
        day: 1,
        message: question.value,
        dailyContent: angerContent,
      }),
      answerAngerDailyPreparedQuestion({ day: 1, message: question.value, dailyContent: angerContent }),
      'T01 central entry point preserves approved answer ' + question.kind,
    );
  }

  const anxietyContent = {
    id: 'اضطراب-01',
    topic_id: 'T02',
    day: 1,
    title: 'ثبت نشانه‌های اضطراب',
    exercise: 'یک موقعیت روزمره را انتخاب کن و نشانه‌های بدنی و فکری اضطراب را جداگانه ثبت کن.',
    actionText: 'در یک موقعیت کم‌فشار، پیش از واکنش یک مکث کوتاه انجام بده.',
    exerciseExample: 'پیش از یک تماس معمولی، ضربان قلب و فکر نگران‌کننده را جداگانه یادداشت کن.',
    actionExample: 'پیش از پاسخ دادن به یک پیام، سه نفس آرام بکش.',
  };
  for (const question of getSharedDailyAssistantPromptGroups(1, 'T02').flatMap((group) => group.questions)) {
    assert.equal(
      buildPreparedDailyAssistantAnswer({
        topicId: 'T02',
        topicName: 'اضطراب',
        day: 1,
        message: question.value,
        dailyContent: anxietyContent,
      }),
      buildSharedDailyAssistantAnswerFromDailyContent({
        topicId: 'T02',
        topicName: 'اضطراب',
        day: 1,
        message: question.value,
        dailyContent: anxietyContent,
      }),
      'T02 central entry point uses the same shared renderer ' + question.kind,
    );
  }
});


test('runtime examples survive adapted visible wording and stay bound to the canonical topic/day for T02-T14', async () => {
  const merged = await loadMergedContent();
  let checked = 0;
  for (const [topicId, topicName] of TOPICS) {
    const days = merged.categories[topicName]?.days || [];
    assert.equal(days.length, 28, topicId + ' canonical days');
    for (let day = 1; day <= 28; day += 1) {
      const record = days.find((item) => Number(item.day) === day);
      assert.ok(record, topicId + ' day ' + day);
      if (['T13', 'T14'].includes(topicId) && getDailySafetyMode(record) === 'blocked') continue;
      for (const [kind, field] of [
        ['exercise_example', 'exerciseExample'],
        ['action_example', 'actionExample'],
      ]) {
        const question = getSharedDailyAssistantPromptGroups(day, topicId)
          .flatMap((group) => group.questions)
          .find((item) => item.kind === kind);
        assert.ok(question, topicId + ' day ' + day + ' ' + kind);
        const migratedRecord = migratedCatalog.records.find((item) => item.topicId === topicId && item.day === day);
        const sourceExample = record[field] || migratedRecord?.[field];
        assert.ok(sourceExample?.trim(), topicId + ' day ' + day + ' must have a source example');
        const result = makePageAssistantTurn({
          screen: 'day',
          text: question.value,
          dailyContext: {
            day,
            problem: topicName,
            data: record,
            guidanceData: {
              id: record.id,
              topic_id: record.topic_id ?? null,
              day: record.day,
              exercise: record.exercise + ' [متن سازگارشده برای نمایش]',
              action: record.actionText + ' [متن سازگارشده برای نمایش]',
            },
            relationshipSafetyConfirmed: true,
          },
        });
        assert.equal(result.status, 'daily_guidance_available',
          topicId + ' day ' + day + ' ' + kind + ' must pass the real runtime router');
        const normalizedExample = sourceExample.replace(/^(?:نمونه فرضی:\s*){2,}/u, 'نمونه فرضی: ');
        const visibleExample = cleanPreparedAssistantTopicText(normalizedExample, topicName);
        assert.ok(result.message.includes(visibleExample),
          topicId + ' day ' + day + ' ' + kind + ' must render its canonical example after normal display cleanup. Expected: '
            + visibleExample + ' | Actual: ' + result.message + ' | Status: ' + result.status);
        assert.doesNotMatch(result.message, /مثال فرضی جداگانه‌ای در محتوای ثبت‌شده وجود ندارد/u,
          topicId + ' day ' + day + ' ' + kind + ' must not fall back');
        checked += 1;
      }
    }
  }
  assert.ok(checked >= 650, 'expected broad runtime coverage across all 14 topics and 28 days; checked=' + checked);
});
