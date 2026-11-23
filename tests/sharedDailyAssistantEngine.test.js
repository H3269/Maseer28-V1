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
  ['T15', 'اعتمادبه‌نفس پایین'],
  ['T16', 'افکار منفی و نشخوار فکری'],
  ['T17', 'مشکلات رابطه'],
  ['T18', 'نفرت از خود'],
  ['T19', 'خودسرزنشی'],
  ['T20', 'کمال‌گرایی'],
  ['T21', 'اجتناب'],
  ['T22', 'استرس'],
  ['T23', 'احساس بی‌ارزشی'],
  ['T24', 'مشکل در کنترل هیجان'],
  ['T25', 'رنجش و کینه'],
  ['T26', 'شرم'],
  ['T27', 'ترس از قضاوت'],
  ['T28', 'ترس از شکست'],
  ['T29', 'ترس از طرد شدن'],
  ['T30', 'شک و تردید'],
  ['T31', 'کنترل‌گری'],
  ['T32', 'بی‌انگیزگی'],
  ['T33', 'خودانتقادی'],
  ['T34', 'مشکل دیگر'],
]);

const mergedContentPromise = Promise.all([
  readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8').then(JSON.parse),
]).then(([base, overrides]) => mergeDailyTextOverrides(base, overrides));

async function loadMergedContent() {
  return mergedContentPromise;
}

test('one shared prompt catalogue exposes the same fourteen questions and five groups for T01-T34', () => {
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
  assert.equal(getSharedDailyAssistantPromptGroups(1, 'T15').length, 5);
  assert.deepEqual(getSharedDailyAssistantPromptGroups(1, 'T35'), []);
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

test('T02-T34 produce fourteen day-bound answers from canonical content for all 28 days', async () => {
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
  assert.equal(checked, 33 * 28 * 14);
});

test('T15-T34 route all 7,840 fixed question slots through the real daily assistant with safety gates intact', async () => {
  const merged = await loadMergedContent();
  let available = 0;
  let safelyBlocked = 0;
  for (const [topicId, topicName] of TOPICS.filter(([id]) => Number(id.slice(1)) >= 15)) {
    const days = merged.categories[topicName]?.days || [];
    assert.equal(days.length, 28, topicId + ' must retain all 28 canonical days');
    for (let day = 1; day <= 28; day += 1) {
      const dailyContent = days.find((item) => Number(item.day) === day);
      assert.ok(dailyContent?.exercise && dailyContent?.actionText, topicId + ' day ' + day + ' source content');
      const questions = getSharedDailyAssistantPromptGroups(day, topicId).flatMap((group) => group.questions);
      assert.equal(questions.length, 14, topicId + ' day ' + day + ' must expose fourteen fixed questions');
      for (const question of questions) {
        const result = makePageAssistantTurn({
          screen: 'day',
          text: question.value,
          dailyContext: {
            day,
            problem: topicName,
            data: dailyContent,
            relationshipSafetyConfirmed: true,
          },
        });
        if (getDailySafetyMode(dailyContent) === 'blocked') {
          assert.equal(result.status, 'daily_guidance_unavailable',
            topicId + ' day ' + day + ' blocked day must not expose prepared guidance');
          safelyBlocked += 1;
        } else {
          assert.equal(result.status, 'daily_guidance_available',
            topicId + ' day ' + day + ' ' + question.kind);
          assert.ok(result.message.trim().length > 0, topicId + ' day ' + day + ' ' + question.kind + ' answer text');
          available += 1;
        }
      }
    }
  }
  assert.equal(available + safelyBlocked, 20 * 28 * 14, 'all 7,840 T15-T34 question slots must be checked');
});

test('T15-T34 safety and assessment answers are bound to the exact topic, day, exercise and action', async () => {
  const merged = await loadMergedContent();
  const targetIds = new Set(['q06', 'q07', 'q11', 'q12']);
  let checked = 0;
  const distressFocus = new Set();
  for (const [topicId, topicName] of TOPICS.filter(([id]) => Number(id.slice(1)) >= 15)) {
    const days = merged.categories[topicName]?.days || [];
    assert.equal(days.length, 28, topicId + ' day coverage');
    for (let day = 1; day <= 28; day += 1) {
      const daily = days.find((item) => Number(item.day) === day);
      const questions = getSharedDailyAssistantPromptGroups(day, topicId)
        .flatMap((group) => group.questions)
        .filter((question) => targetIds.has(question.id));
      assert.equal(questions.length, 4, topicId + ' day ' + day + ' four safety/assessment questions');
      for (const question of questions) {
        const answer = buildSharedDailyAssistantAnswerFromDailyContent({
          topicId, topicName, day, message: question.value, dailyContent: daily,
        });
        assert.ok(answer.includes(topicName), topicId + ' day ' + day + ' ' + question.id + ' names the exact topic');
        assert.ok(answer.includes(String(day)), topicId + ' day ' + day + ' ' + question.id + ' names the exact day');
        if (question.id === 'q06') {
          assert.ok(answer.includes(daily.exercise),
            topicId + ' day ' + day + ' assessment must use the exact daily exercise');
        }
        if (question.id === 'q07' || question.id === 'q11') {
          assert.ok(answer.includes(daily.exercise),
            topicId + ' day ' + day + ' safety guidance must reference the exact daily exercise');
        }
        if (question.id === 'q11') {
          assert.match(answer, /خدمات اضطراری/u);
          const focus = answer.match(/نشانه‌هایی که در این موضوع باید جدی بگیری: (.*)/u)?.[1] || '';
          assert.ok(focus, topicId + ' day ' + day + ' must name its safety focus');
          distressFocus.add(focus);
        }
        if (question.id === 'q12') {
          assert.ok(answer.includes(daily.exercise),
            topicId + ' day ' + day + ' interpersonal guidance must preserve the exact daily exercise');
          assert.ok(answer.includes(daily.actionText),
            topicId + ' day ' + day + ' interpersonal guidance must use the exact daily action');
        }
        checked += 1;
      }
    }
  }
  assert.equal(checked, 20 * 28 * 4);
  assert.equal(distressFocus.size, 20, 'each of the 20 extended topics must retain its distinct safety focus');
});

test('T15-T34 render 560 source-matched, day-specific exercise and action examples', async () => {
  const merged = await loadMergedContent();
  const catalog = (await import('../src/features/assistant/sharedDailyAssistantExamples.v1.json', { with: { type: 'json' } })).default;
  const topicRecords = catalog.records.filter((record) => Number(record.topicId.slice(1)) >= 15);
  assert.equal(topicRecords.length, 20 * 28, 'T15-T34 must have one example record per topic/day');
  assert.equal(new Set(topicRecords.map((record) => record.exerciseExample)).size, 20 * 28,
    'T15-T34 exercise examples must not repeat across topics or days');
  assert.equal(new Set(topicRecords.map((record) => record.actionExample)).size, 20 * 28,
    'T15-T34 action examples must not repeat across topics or days');

  for (const [topicId, topicName] of TOPICS.filter(([id]) => Number(id.slice(1)) >= 15)) {
    const days = merged.categories[topicName]?.days || [];
    const records = topicRecords.filter((record) => record.topicId === topicId);
    assert.equal(days.length, 28, topicId + ' canonical day count');
    assert.equal(records.length, 28, topicId + ' example record count');
    assert.equal(new Set(records.map((record) => record.exerciseExample)).size, 28,
      topicId + ' exercise examples must be distinct');
    assert.equal(new Set(records.map((record) => record.actionExample)).size, 28,
      topicId + ' action examples must be distinct');

    for (const record of records) {
      const day = days.find((item) => Number(item.day) === record.day);
      assert.ok(day, topicId + ' day ' + record.day + ' canonical source');
      assert.equal(record.exerciseSource, day.exercise,
        topicId + ' day ' + record.day + ' exercise source identity');
      assert.equal(record.actionSource, day.actionText,
        topicId + ' day ' + record.day + ' action source identity');

      const questions = getSharedDailyAssistantPromptGroups(record.day, topicId)
        .flatMap((group) => group.questions);
      const exerciseQuestion = questions.find((question) => question.kind === 'exercise_example');
      const actionQuestion = questions.find((question) => question.kind === 'action_example');
      const sourceOnlyDay = { ...day, exerciseExample: '', actionExample: '' };
      const exerciseAnswer = buildSharedDailyAssistantAnswerFromDailyContent({
        topicId, topicName, day: record.day, message: exerciseQuestion.value, dailyContent: sourceOnlyDay,
      });
      const actionAnswer = buildSharedDailyAssistantAnswerFromDailyContent({
        topicId, topicName, day: record.day, message: actionQuestion.value, dailyContent: sourceOnlyDay,
      });
      assert.ok(exerciseAnswer.includes(record.exerciseExample),
        topicId + ' day ' + record.day + ' exercise example must render from the shared catalogue');
      assert.ok(actionAnswer.includes(record.actionExample),
        topicId + ' day ' + record.day + ' action example must render from the shared catalogue');
    }
  }
});

test('T11-T18 authored examples are migrated into the shared renderer for all 28 canonical days', async () => {
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

test('T02-T34 route through the same prepared-answer engine using the selected canonical day', async () => {
  const merged = await loadMergedContent();
  for (const [topicId, topicName] of TOPICS) {
    const dailyContent = merged.categories[topicName].days[0];
    if (getDailySafetyMode(dailyContent) === 'blocked') continue;
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
  const migratedCatalog = (await import('../src/features/assistant/sharedDailyAssistantExamples.v1.json', { with: { type: 'json' } })).default;
  let checked = 0;
  for (const [topicId, topicName] of TOPICS.filter(([id]) => Number(id.slice(1)) <= 18)) {
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

test('T15-T34 render canonical migrated exercise and action examples through the real runtime router', async () => {
  const merged = await loadMergedContent();
  const migratedCatalog = (await import('../src/features/assistant/sharedDailyAssistantExamples.v1.json', { with: { type: 'json' } })).default;
  let checked = 0;
  let safelyBlocked = 0;
  for (const [topicId, topicName] of TOPICS.filter(([id]) => Number(id.slice(1)) >= 15)) {
    const days = merged.categories[topicName]?.days || [];
    assert.equal(days.length, 28, topicId + ' canonical days');
    const topicRecords = migratedCatalog.records.filter((item) => item.topicId === topicId);
    assert.equal(topicRecords.length, 28, topicId + ' migrated examples for every day');
    assert.equal(new Set(topicRecords.map((item) => item.exerciseExample)).size, 28,
      topicId + ' exercise examples must be distinct across days');
    assert.equal(new Set(topicRecords.map((item) => item.actionExample)).size, 28,
      topicId + ' action examples must be distinct across days');
    for (let day = 1; day <= 28; day += 1) {
      const dailyContent = days.find((item) => Number(item.day) === day);
      assert.ok(dailyContent?.exercise && dailyContent?.actionText, topicId + ' day ' + day + ' source content');
      const migratedRecord = topicRecords.find((item) => item.day === day);
      assert.ok(migratedRecord, topicId + ' day ' + day + ' catalog record');
      assert.equal(migratedRecord.exerciseSource, dailyContent.exercise,
        topicId + ' day ' + day + ' exercise source provenance');
      assert.equal(migratedRecord.actionSource, dailyContent.actionText,
        topicId + ' day ' + day + ' action source provenance');
      if (getDailySafetyMode(dailyContent) === 'blocked') {
        safelyBlocked += 2;
        continue;
      }
      for (const [kind, field] of [
        ['exercise_example', 'exerciseExample'],
        ['action_example', 'actionExample'],
      ]) {
        const question = getSharedDailyAssistantPromptGroups(day, topicId)
          .flatMap((group) => group.questions)
          .find((item) => item.kind === kind);
        assert.ok(question, topicId + ' day ' + day + ' ' + kind);
        const sourceExample = migratedRecord[field];
        assert.ok(sourceExample?.trim(), topicId + ' day ' + day + ' must have a canonical source example');
        const result = makePageAssistantTurn({
          screen: 'day',
          text: question.value,
          dailyContext: {
            day,
            problem: topicName,
            data: dailyContent,
            guidanceData: {
              id: dailyContent.id,
              topic_id: dailyContent.topic_id ?? null,
              day: dailyContent.day,
              exercise: dailyContent.exercise + ' [متن سازگارشده برای نمایش]',
              action: dailyContent.actionText + ' [متن سازگارشده برای نمایش]',
            },
            relationshipSafetyConfirmed: true,
          },
        });
        assert.equal(result.status, 'daily_guidance_available',
          topicId + ' day ' + day + ' ' + kind + ' must pass the real runtime router');
        const normalizedExample = sourceExample.replace(/^(?:نمونه فرضی:\\s*){2,}/u, 'نمونه فرضی: ');
        const visibleExample = cleanPreparedAssistantTopicText(normalizedExample, topicName);
        assert.ok(result.message.includes(visibleExample),
          topicId + ' day ' + day + ' ' + kind + ' must render its canonical example after display cleanup');
        assert.doesNotMatch(result.message, /مثال فرضی جداگانه‌ای در محتوای ثبت‌شده وجود ندارد/u,
          topicId + ' day ' + day + ' ' + kind + ' must not fall back');
        checked += 1;
      }
    }
  }
  assert.equal(checked + safelyBlocked, 20 * 28 * 2,
    'all T15-T34 exercise/action example slots must be either rendered or safety-blocked');
});


test('near-identical exercise/action pairs preserve separate planning and implementation roles', async () => {
  const catalog = (await import('../src/features/assistant/sharedDailyAssistantExamples.v1.json', { with: { type: 'json' } })).default;
  const expected = [
    ['T16', 9, 'هنوز تمرین را اجرا نمی‌کند', 'زمان‌سنج ده‌دقیقه‌ای'],
    ['T20', 24, 'فهرست سه‌موردی', 'بازبینی سلیقه‌ای چهارم اضافه نمی‌کند'],
    ['T19', 14, 'یک نشانه آغاز تعیین می‌کند', 'در تقویم گوشی یک یادآور'],
    ['T20', 7, 'معیار موفقیت را مشخص می‌کند', '۲۰ دقیقه برای نوشتن پیش‌نویس'],
    ['T20', 12, 'سه عبارت مطلق', 'در گزارش فعلی عبارت'],
    ['T15', 27, 'هنوز زمان اجرا را تعیین نمی‌کند', 'در تقویم ثبت می‌کند'],
    ['T18', 15, 'هنوز دعوت را ارسال نمی‌کند', 'به خواهر مورد اعتمادش پیام می‌دهد'],
  ];
  for (const [topicId, day, exerciseMarker, actionMarker] of expected) {
    const record = catalog.records.find((item) => item.topicId === topicId && item.day === day);
    assert.ok(record, topicId + ' day ' + day + ' catalog record');
    assert.ok(record.exerciseExample.includes(exerciseMarker),
      topicId + ' day ' + day + ' exercise must retain its planning/definition role');
    assert.ok(record.actionExample.includes(actionMarker),
      topicId + ' day ' + day + ' action must describe a distinct implementation step');
    assert.notEqual(record.exerciseExample, record.actionExample,
      topicId + ' day ' + day + ' exercise and action examples must not be identical');
  }
});


test('T18 day 22 immediate safety response and day 28 warning-level review remain distinct', async () => {
  const catalog = (await import('../src/features/assistant/sharedDailyAssistantExamples.v1.json', { with: { type: 'json' } })).default;
  const day22 = catalog.records.find((item) => item.topicId === 'T18' && item.day === 22);
  const day28 = catalog.records.find((item) => item.topicId === 'T18' && item.day === 28);
  assert.ok(day22.exerciseExample.includes('نیاز فوری'));
  assert.ok(day28.exerciseExample.includes('دو سطح را در کارت شخصی جدا می‌کند'));
  assert.ok(day28.exerciseExample.includes('هشدار زودهنگام'));
  assert.notEqual(day22.exerciseExample, day28.exerciseExample);
});


test('T32 day 15 recovery action and T33 day 16 specific feedback action remain distinct', async () => {
  const catalog = (await import('../src/features/assistant/sharedDailyAssistantExamples.v1.json', { with: { type: 'json' } })).default;
  const t32Day8 = catalog.records.find((item) => item.topicId === 'T32' && item.day === 8);
  const t32Day15 = catalog.records.find((item) => item.topicId === 'T32' && item.day === 15);
  const t33Day14 = catalog.records.find((item) => item.topicId === 'T33' && item.day === 14);
  const t33Day16 = catalog.records.find((item) => item.topicId === 'T33' && item.day === 16);
  assert.ok(t32Day15.actionExample.includes('خستگی چشم'));
  assert.ok(t32Day15.actionExample.includes('به نقطه‌ای دور نگاه می‌کند'));
  assert.doesNotMatch(t32Day15.actionExample, /وعده غذایی/u);
  assert.notEqual(t32Day8.actionExample, t32Day15.actionExample);
  assert.ok(t33Day16.actionExample.includes('کدام‌یک از این دو تیتر بهتر است'));
  assert.ok(t33Day16.actionExample.includes('پاسخ مربوط به همان تیتر'));
  assert.notEqual(t33Day14.actionExample, t33Day16.actionExample);
});


test('T15 T20 and T26 flagged examples retain distinct daily learning targets', async () => {
  const catalog = (await import('../src/features/assistant/sharedDailyAssistantExamples.v1.json', { with: { type: 'json' } })).default;
  const t15Day10 = catalog.records.find((item) => item.topicId === 'T15' && item.day === 10);
  const t15Day20 = catalog.records.find((item) => item.topicId === 'T15' && item.day === 20);
  const t20Day19 = catalog.records.find((item) => item.topicId === 'T20' && item.day === 19);
  const t20Day22 = catalog.records.find((item) => item.topicId === 'T20' && item.day === 22);
  const t26Day7 = catalog.records.find((item) => item.topicId === 'T26' && item.day === 7);
  const t26Day22 = catalog.records.find((item) => item.topicId === 'T26' && item.day === 22);
  assert.ok(t15Day10.exerciseExample.includes('پیش از جلسه'));
  assert.ok(t15Day10.actionExample.includes('پرسش را مطرح کرده است'));
  assert.ok(t15Day20.exerciseExample.includes('۴ از ۱۰'));
  assert.notEqual(t15Day10.exerciseExample, t15Day20.exerciseExample);
  assert.ok(t20Day22.exerciseExample.includes('مرتب‌کردن میز'));
  assert.ok(t20Day22.actionExample.includes('پنج دقیقه'));
  assert.ok(t20Day19.exerciseExample.includes('گزارش کم‌خطر'));
  assert.notEqual(t20Day19.exerciseExample, t20Day22.exerciseExample);
  assert.ok(t26Day22.actionExample.includes('راه برگشت مستقل'));
  assert.ok(t26Day22.actionExample.includes('دیدار را پایان می‌دهد'));
  assert.ok(t26Day7.actionExample.includes('این موضوع برای من خصوصی است'));
  assert.notEqual(t26Day7.actionExample, t26Day22.actionExample);
});


test('T15-T34 fixed answers q05-q14 remain anchored to their own daily source fields', async () => {
  const merged = await loadMergedContent();
  for (const [topicId, topicName] of TOPICS.filter(([id]) => Number(id.slice(1)) >= 15)) {
    const days = merged.categories[topicName]?.days || [];
    for (let day = 1; day <= 28; day += 1) {
      const dailyContent = days.find((item) => Number(item.day) === day);
      assert.ok(dailyContent, topicId + ' day ' + day + ' source');
      const questions = getSharedDailyAssistantPromptGroups(day, topicId)
        .flatMap((group) => group.questions);
      const answerFor = (id) => {
        const question = questions.find((item) => item.id === id);
        assert.ok(question, topicId + ' day ' + day + ' ' + id + ' question');
        const answer = buildSharedDailyAssistantAnswerFromDailyContent({
          topicId, topicName, day, message: question.value, dailyContent,
        });
        assert.ok(typeof answer === 'string' && answer.trim(), topicId + ' day ' + day + ' ' + id + ' answer');
        return answer;
      };

      const lightAnswer = answerFor('q05');
      if (typeof dailyContent.lightVersion === 'string' && dailyContent.lightVersion.trim()) {
        assert.ok(lightAnswer.includes(dailyContent.lightVersion.trim()), topicId + ' day ' + day + ' q05 lightVersion');
      } else {
        for (const field of ['lightExerciseText', 'lightActionVersion', 'lightActionText']) {
          if (typeof dailyContent[field] === 'string' && dailyContent[field].trim()) {
            assert.ok(lightAnswer.includes(dailyContent[field].trim()),
              topicId + ' day ' + day + ' q05 must use ' + field);
          }
        }
      }

      const successAnswer = answerFor('q06');
      const closingCriterionLine = String(dailyContent.closing || '').split(/\r?\n/u)
        .map((line) => line.trim())
        .find((line) => /^(?:معیار موفقیت|معیار امروز)\s*[:：]/u.test(line));
      const successCriterion = dailyContent.success_criterion || dailyContent.successCriterion
        || (closingCriterionLine ? closingCriterionLine.replace(/^(?:معیار موفقیت|معیار امروز)\s*[:：]\s*/u, '') : '');
      if (typeof successCriterion === 'string' && successCriterion.trim()) {
        assert.ok(successAnswer.includes(successCriterion.trim()), topicId + ' day ' + day + ' q06 criterion');
      } else {
        assert.match(successAnswer, /معیار موفقیت جداگانه‌ای ثبت نشده/u,
          topicId + ' day ' + day + ' q06 must not invent a criterion');
      }

      const stopAnswer = answerFor('q07');
      assert.doesNotMatch(stopAnswer, /موضوع:\s/u,
        topicId + ' day ' + day + ' q07 must not reintroduce a retired topic heading');
      const stopConditions = dailyContent.stop_conditions || dailyContent.stopConditions;
      if (Array.isArray(stopConditions) && stopConditions.length) {
        for (const condition of stopConditions.filter((item) => typeof item === 'string' && item.trim())) {
          assert.ok(stopAnswer.includes(condition.trim()), topicId + ' day ' + day + ' q07 stop condition');
        }
      } else if (typeof (dailyContent.stopCondition || dailyContent.stop_condition_text) === 'string'
        && (dailyContent.stopCondition || dailyContent.stop_condition_text).trim()) {
        assert.ok(stopAnswer.includes((dailyContent.stopCondition || dailyContent.stop_condition_text).trim()),
          topicId + ' day ' + day + ' q07 stop text');
      }

      const noEventAnswer = answerFor('q08');
      if (typeof dailyContent.restVersion === 'string' && dailyContent.restVersion.trim()) {
        assert.ok(noEventAnswer.includes(dailyContent.restVersion.trim()), topicId + ' day ' + day + ' q08 restVersion');
      } else {
        for (const field of ['restExerciseText', 'restActionVersion', 'restActionText']) {
          if (typeof dailyContent[field] === 'string' && dailyContent[field].trim()) {
            assert.ok(noEventAnswer.includes(dailyContent[field].trim()),
              topicId + ' day ' + day + ' q08 must use ' + field);
          }
        }
      }

      const differenceAnswer = answerFor('q09');
      assert.ok(differenceAnswer.includes(dailyContent.exercise), topicId + ' day ' + day + ' q09 exercise source');
      assert.ok(differenceAnswer.includes(dailyContent.actionText), topicId + ' day ' + day + ' q09 action source');

      const notDoneAnswer = answerFor('q10');
      for (const field of ['lightVersion', 'restVersion']) {
        if (typeof dailyContent[field] === 'string' && dailyContent[field].trim()) {
          assert.ok(notDoneAnswer.includes(dailyContent[field].trim()),
            topicId + ' day ' + day + ' q10 must use ' + field);
        }
      }

      const distressAnswer = answerFor('q11');
      assert.match(distressAnswer, /تمرین را کنار بگذار/u, topicId + ' day ' + day + ' q11 stop safeguard');
      assert.match(distressAnswer, /خدمات اضطراری/u, topicId + ' day ' + day + ' q11 urgent support');

      const talkAnswer = answerFor('q12');
      assert.ok(talkAnswer.includes(dailyContent.exercise), topicId + ' day ' + day + ' q12 must refer to the actual exercise');

      const adaptAnswer = answerFor('q13');
      const objective = dailyContent.learning_objective || dailyContent.objective;
      if (typeof objective === 'string' && objective.trim()) {
        assert.ok(adaptAnswer.includes(objective.trim()), topicId + ' day ' + day + ' q13 must preserve the daily objective');
      }

      const durationAnswer = answerFor('q14');
      const duration = dailyContent.duration_minutes ?? dailyContent.durationMinutes;
      if (Number.isFinite(Number(duration)) && Number(duration) > 0) {
        assert.ok(durationAnswer.includes(String(Number(duration))),
          topicId + ' day ' + day + ' q14 must use the recorded duration');
      } else {
        assert.match(durationAnswer, /زمان مشخصی برای این تمرین ثبت نشده/u,
          topicId + ' day ' + day + ' q14 must not invent a duration');
      }
    }
  }
});


test('T15-T34 shared explanations do not invent universal exercise rules or override source success criteria', async () => {
  const merged = await loadMergedContent();
  for (const [topicId, topicName] of TOPICS.filter(([id]) => Number(id.slice(1)) >= 15)) {
    const days = merged.categories[topicName]?.days || [];
    for (let day = 1; day <= 28; day += 1) {
      const dailyContent = days.find((item) => Number(item.day) === day);
      const questions = getSharedDailyAssistantPromptGroups(day, topicId).flatMap((group) => group.questions);
      const answerFor = (id) => {
        const question = questions.find((item) => item.id === id);
        return buildSharedDailyAssistantAnswerFromDailyContent({
          topicId, topicName, day, message: question.value, dailyContent,
        });
      };

      const exerciseMeaning = answerFor('q01');
      assert.match(exerciseMeaning, /اگر تعداد، زمان یا قالب مشخصی تعیین شده/u, topicId + ' day ' + day + ' q01 conditional instructions');
      assert.doesNotMatch(exerciseMeaning, /تعداد نمونه‌ها را هم بیشتر یا کمتر نکن/u,
        topicId + ' day ' + day + ' q01 must not invent a universal count');

      const successAnswer = answerFor('q06');
      const criterion = dailyContent.success_criterion || dailyContent.successCriterion;
      if (typeof criterion === 'string' && criterion.trim()) {
        assert.match(successAnswer, /همان معیار ثبت‌شده را مبنا قرار بده/u,
          topicId + ' day ' + day + ' q06 must defer to the recorded criterion');
      }
      assert.doesNotMatch(successAnswer, /اگر توانستی بخش اصلی/u,
        topicId + ' day ' + day + ' q06 must not add a competing success test');

      const differenceAnswer = answerFor('q09');
      assert.match(differenceAnswer, /تمرین، کاری است که متن امروز برای یادگیری یا تمرین مشخص کرده/u,
        topicId + ' day ' + day + ' q09 must describe exercise by its source role');
      assert.doesNotMatch(differenceAnswer, /شناخت و مشاهده مهارت/u,
        topicId + ' day ' + day + ' q09 must not reduce every exercise to observation');

      const talkAnswer = answerFor('q12');
      assert.match(talkAnswer, /اگر دستور امروز نوشتن، مرور یا مشاهده شخصی است/u,
        topicId + ' day ' + day + ' q12 must preserve solo exercise cases');
      assert.match(talkAnswer, /اگر متن امروز صریحاً تعامل با فرد دیگری می‌خواهد/u,
        topicId + ' day ' + day + ' q12 must preserve genuinely interpersonal exercise cases');
    }
  }
});
