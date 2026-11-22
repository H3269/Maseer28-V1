import { DAILY_ASSISTANT_SAFETY_QUESTION_KINDS, DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN } from '../src/features/assistant/dailyAssistantSafetyReminder.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanPreparedAssistantTopicText } from '../src/features/assistant/teacherStylePreparedAnswer.js';
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
import { T10_DAILY_ASSISTANT_GUIDES, answerT10DailyPreparedQuestion, getT10DailyAssistantPromptGroups } from '../src/features/assistant/t10DailyAssistantPrompts.js';
import { T11_DAILY_ASSISTANT_GUIDES, answerT11DailyPreparedQuestion, getT11DailyAssistantPromptGroups } from '../src/features/assistant/t11DailyAssistantPrompts.js';
import { T12_DAILY_ASSISTANT_GUIDES, answerT12DailyPreparedQuestion, getT12DailyAssistantPromptGroups } from '../src/features/assistant/t12DailyAssistantPrompts.js';
import { T13_DAILY_ASSISTANT_GUIDES, answerT13DailyPreparedQuestion, getT13DailyAssistantPromptGroups } from '../src/features/assistant/t13DailyAssistantPrompts.js';
import { T14_DAILY_ASSISTANT_GUIDES, answerT14DailyPreparedQuestion, getT14DailyAssistantPromptGroups } from '../src/features/assistant/t14DailyAssistantPrompts.js';

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
const expectedKinds = ['exercise_meaning', 'exercise_example', 'action_meaning', 'action_example', 'light_version', 'success', 'stop', 'no_event', 'exercise_action_difference', 'not_done', null, 'talk_other', 'can_change', 'duration'];
const expectedGuideKeys = Object.keys(ANGER_DAILY_ASSISTANT_GUIDES[0]);
const expectedQuestionKeys = Object.keys(ANGER_DAILY_ASSISTANT_GUIDES[0].questions[0]);


const allTopicContracts = [
  ...topics,
  ['T10', T10_DAILY_ASSISTANT_GUIDES, getT10DailyAssistantPromptGroups, answerT10DailyPreparedQuestion],
  ['T11', T11_DAILY_ASSISTANT_GUIDES, getT11DailyAssistantPromptGroups, answerT11DailyPreparedQuestion],
  ['T12', T12_DAILY_ASSISTANT_GUIDES, getT12DailyAssistantPromptGroups, answerT12DailyPreparedQuestion],
  ['T13', T13_DAILY_ASSISTANT_GUIDES, getT13DailyAssistantPromptGroups, answerT13DailyPreparedQuestion],
  ['T14', T14_DAILY_ASSISTANT_GUIDES, getT14DailyAssistantPromptGroups, answerT14DailyPreparedQuestion],
];
test('all T01-T14 runtime answers include the exact day-specific exercise and action examples', () => {
  const contentNames = {
    T01: 'خشم', T02: 'اضطراب', T03: 'ترس', T04: 'نفرت',
    T05: 'حسادت', T06: 'غم و سوگ', T07: 'احساس گناه', T08: 'وابستگی عاطفی',
    T09: 'اهمال‌کاری',
    T10: 'بی‌خوابی و مشکلات خواب',
    T11: 'عادت‌های تکراری',
    T12: 'مرزبندی و نه گفتن',
    T13: 'تنهایی',
    T14: 'کمبود انگیزه',
  };

  let checked = 0;
  for (const [topicId, guides, , answerPrepared] of allTopicContracts) {
    for (const guide of guides) {
      const name = contentNames[topicId];
      const dailyContent = name ? {
        id: name + '-' + String(guide.day).padStart(2, '0'),
        topic_id: topicId,
        day: guide.day,
        title: guide.title,
        exercise: guide.exercise,
        actionText: guide.action,
        sourceExercise: guide.exercise,
        sourceActionText: guide.action,
      } : undefined;
      const exerciseQuestion = guide.questions.find(question => question.kind === 'exercise_example');
      const actionQuestion = guide.questions.find(question => question.kind === 'action_example');
      assert.ok(exerciseQuestion, topicId + ' day ' + guide.day + ' exercise example question');
      assert.ok(actionQuestion, topicId + ' day ' + guide.day + ' action example question');

      const expectedExerciseExample = cleanPreparedAssistantTopicText(String(guide.exerciseExample || exerciseQuestion.answer || '').trim());
      const expectedActionExample = cleanPreparedAssistantTopicText(String(guide.actionExample || actionQuestion.answer || '').trim());
      assert.ok(expectedExerciseExample, topicId + ' day ' + guide.day + ' authored exercise example');
      assert.ok(expectedActionExample, topicId + ' day ' + guide.day + ' authored action example');

      const exerciseAnswer = answerPrepared({ day: guide.day, message: exerciseQuestion.value, dailyContent });
      const actionAnswer = answerPrepared({ day: guide.day, message: actionQuestion.value, dailyContent });
      assert.equal(typeof exerciseAnswer, 'string', topicId + ' day ' + guide.day + ' exercise example runtime answer');
      assert.equal(typeof actionAnswer, 'string', topicId + ' day ' + guide.day + ' action example runtime answer');
      assert.ok(exerciseAnswer.includes(expectedExerciseExample), topicId + ' day ' + guide.day + ' runtime must include its exact exercise example');
      assert.ok(actionAnswer.includes(expectedActionExample), topicId + ' day ' + guide.day + ' runtime must include its exact action example');
      assert.ok(exerciseAnswer.includes(cleanPreparedAssistantTopicText(guide.title)), topicId + ' day ' + guide.day + ' exercise answer title');
      assert.ok(actionAnswer.includes(cleanPreparedAssistantTopicText(guide.title)), topicId + ' day ' + guide.day + ' action answer title');
      checked += 2;
    }
  }
  assert.equal(checked, 14 * 28 * 2, 'all 784 example answers must be checked');
});

const topicSafetyKinds = {
  T01: 'anger_increased', T02: 'anxiety_increased', T03: 'fear_increased',
  T04: 'hostility_increased', T05: 'jealousy_increased', T06: 'grief_increased',
  T07: 'guilt_increased', T08: 'dependency_increased', T09: 'procrastination_increased',
  T10: 'sleep_distress', T11: 't11_distress', T12: 'boundary_distress',
  T13: 'loneliness_increased', T14: 'motivation_distress',
};

test('T01-T14 share the same 28-day, 14-question contract and four safety/evaluation questions', () => {
  for (const [topicId, guides, getGroups, answerPrepared] of allTopicContracts) {
    assert.equal(guides.length, 28, topicId + ' must contain 28 days');
    assert.equal(typeof answerPrepared, 'function', topicId + ' prepared answer handler');
    for (const guide of guides) {
      assert.equal(guide.questions.length, 14, topicId + ' day ' + guide.day + ' question count');
      assert.deepEqual(guide.questions.map(q => q.id), expectedIds, topicId + ' day ' + guide.day + ' question IDs');
      guide.questions.forEach((question, index) => {
        assert.equal(question.label, question.value, topicId + ' day ' + guide.day + ' ' + question.id + ' label/value alignment');
        if (index !== 7 && index !== 10) assert.equal(question.value, expectedValues[index], topicId + ' day ' + guide.day + ' fixed question wording ' + question.id);
      });
      assert.ok(guide.questions.every(q => Object.hasOwn(q, 'answer')), topicId + ' day ' + guide.day + ' answer field must exist');
      if (Number(topicId.slice(1)) >= 9) assert.ok(guide.questions.every(q => typeof q.answer === 'string' && q.answer.trim()), topicId + ' day ' + guide.day + ' prepared answer text must exist');
      const safetyQuestions = guide.questions.filter(q => DAILY_ASSISTANT_SAFETY_QUESTION_KINDS.has(q.kind));
      assert.equal(safetyQuestions.length, 4, topicId + ' day ' + guide.day + ' exactly four safety/evaluation questions');
      assert.deepEqual(new Set(safetyQuestions.map(q => q.kind)), new Set([topicSafetyKinds[topicId], 'talk_other', 'success', 'stop']), topicId + ' day ' + guide.day + ' safety question kinds');
      assert.ok(DAILY_ASSISTANT_SAFETY_QUESTION_KINDS.has(guide.questions[10].kind), topicId + ' day ' + guide.day + ' q11 must be in shared safety gate');
      const groups = getGroups(guide.day);
      assert.equal(groups.length, 5, topicId + ' day ' + guide.day + ' group count');
      assert.deepEqual(groups.map(group => group.questions.length), [2, 2, 1, 5, 4], topicId + ' day ' + guide.day + ' group distribution');
      assert.deepEqual(groups.flatMap(group => group.questions).map(q => q.id).sort(), expectedIds.slice().sort(), topicId + ' day ' + guide.day + ' group coverage');
    }
    assert.deepEqual(getGroups(0), [], topicId + ' invalid day lower bound');
    assert.deepEqual(getGroups(29), [], topicId + ' invalid day upper bound');
  }
});

test('T01-T09 share the exact same 14 prepared question IDs, wording, and order on all 28 days', () => {
  for (const [topicId, guides] of topics) {
    assert.equal(guides.length, 28, topicId + ' day coverage');
    for (const guide of guides) {
      assert.equal(guide.day >= 1 && guide.day <= 28, true, topicId + ' day range');
      assert.deepEqual(Object.keys(guide), expectedGuideKeys, topicId + ' day ' + guide.day + ' shared guide schema');
      assert.ok(Array.isArray(guide.metadataGaps), topicId + ' day ' + guide.day + ' explicit metadata gaps');
      assert.deepEqual(Object.keys(guide.questions[0]), expectedQuestionKeys, topicId + ' day ' + guide.day + ' shared question schema');
      assert.ok(guide.questions.every(question => Object.hasOwn(question, 'answer')), topicId + ' day ' + guide.day + ' answer field');
      assert.equal(guide.questions.length, 14, topicId + ' day ' + guide.day);
      assert.deepEqual(guide.questions.map(q => q.id), expectedIds, topicId + ' question IDs day ' + guide.day);
      assert.deepEqual(guide.questions.map(q => q.value), expectedValues, topicId + ' question wording day ' + guide.day);
      assert.deepEqual(guide.questions.map(q => q.label), expectedValues, topicId + ' question labels day ' + guide.day);
      guide.questions.forEach((question, index) => {
        if (index !== 10) assert.equal(question.kind, expectedKinds[index], topicId + ' question kind ' + question.id + ' day ' + guide.day);
      });
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
      assert.deepEqual(groups.map(group => group.label.replace(/[۰-۹0-9]+/g, '{day}')), ['فهم تمرین روز {day}', 'فهم اقدام اختصاصی روز {day}', 'تفاوت تمرین و اقدام', 'اجرا و موانع', 'ارزیابی و ایمنی'], topicId + ' day ' + day + ' shared group labels');
      const groupedQuestions = groups.flatMap(group => group.questions).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
      assert.deepEqual(groupedQuestions.map(q => q.id), expectedIds, topicId + ' day ' + day + ' grouped question coverage');
      assert.deepEqual(groupedQuestions.map(q => q.value), expectedValues, topicId + ' day ' + day + ' grouped question order');
    }
    assert.deepEqual(getGroups(0), [], topicId + ' invalid day lower bound');
    assert.deepEqual(getGroups(29), [], topicId + ' invalid day upper bound');
  }
});


test('every topic-specific q11 handler is included in the same shared safety gate used by the launcher and answer footer', () => {
  for (const [topicId, guides] of topics) {
    const q11Kind = guides[0].questions[10].kind;
    assert.ok(DAILY_ASSISTANT_SAFETY_QUESTION_KINDS.has(q11Kind), topicId + ' q11 safety kind ' + q11Kind);
    for (const guide of guides) {
      assert.equal(guide.questions[10].kind, q11Kind, topicId + ' q11 handler remains stable across days');
    }
  }
  for (const kind of ['talk_other', 'success', 'stop']) {
    assert.ok(DAILY_ASSISTANT_SAFETY_QUESTION_KINDS.has(kind), kind + ' shared safety/evaluation kind');
  }
});

test('T09 shared question contract is documented in its canonical guide metadata', async () => {
  const guide = JSON.parse(await readFile(new URL('../src/features/assistant/t09DailyAssistantGuide.v1.json', import.meta.url), 'utf8'));
  assert.match(guide.questionPolicy, /identical question IDs, labels, values, and positions across all topics/);
});

test('all T01-T09 daily guides carry the same core day-specific teaching and safety fields', () => {
  const requiredFields = ['objective', 'skill', 'mechanism', 'exercise', 'action', 'lightVersion', 'progressVersion', 'restVersion', 'successCriterion', 'reflectionQuestion', 'stopCondition'];
  for (const [topicId, guides] of topics) {
    for (const guide of guides) {
      for (const field of requiredFields) {
        assert.ok(String(guide[field] || '').trim(), topicId + ' day ' + guide.day + ' missing core field ' + field);
      }
    }
  }
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

test('T02-T09 prepared answers retain topic/day context and substantive guidance without a repeated global frame', () => {
  for (const [topicId, guides, , answerPrepared] of topics.slice(1)) {
    assert.equal(typeof answerPrepared, 'function', topicId + ' answer handler');
    for (const guide of guides) {
      const topicContentIds = {
        T09: 'اهمال‌کاری',
        T10: 'بی‌خوابی و مشکلات خواب',
        T11: 'عادت‌های تکراری',
        T12: 'مرزبندی و نه گفتن',
        T13: 'تنهایی',
        T14: 'کمبود انگیزه',
      };
      const dailyContent = topicContentIds[topicId] ? {
        id: topicContentIds[topicId] + '-' + String(guide.day).padStart(2, '0'),
        topic_id: topicId,
        day: guide.day,
        title: guide.title,
        exercise: guide.exercise,
        actionText: guide.action,
        sourceExercise: guide.exercise,
        sourceActionText: guide.action,
      } : undefined;
      for (const question of guide.questions) {
        const answer = answerPrepared({
          day: guide.day,
          message: question.value,
          dailyContent,
        });
        assert.equal(typeof answer, 'string', topicId + ' day ' + guide.day + ' ' + question.id + ' answer');
        assert.ok(answer.includes(cleanPreparedAssistantTopicText(guide.title)), topicId + ' day ' + guide.day + ' title context');
        assert.ok(answer.trim().length > 20, topicId + ' day ' + guide.day + ' ' + question.id + ' non-empty response');
        assert.doesNotMatch(answer, /قرار نیست همه مسئله را یک‌باره حل کنی/u, topicId + ' must not receive a repeated global supportive sentence');
        if (question.kind === 'exercise_meaning') assert.ok(answer.includes(String(guide.exercise).trim().slice(0, 40)), topicId + ' day ' + guide.day + ' exercise context');
        if (question.kind === 'action_meaning') assert.ok(answer.includes(String(guide.action).trim().slice(0, 40)), topicId + ' day ' + guide.day + ' action context');
      }
    }
  }
});

test('T03-T05 q12 answers retain the topic-specific daily action', () => {
  const cases = [
    ['T03', FEAR_DAILY_ASSISTANT_GUIDES, answerFearDailyPreparedQuestion],
    ['T04', HATRED_DAILY_ASSISTANT_GUIDES, answerHatredDailyPreparedQuestion],
    ['T05', JEALOUSY_DAILY_ASSISTANT_GUIDES, answerJealousyDailyPreparedQuestion],
  ];
  for (const [topicId, guides, answerPrepared] of cases) {
    const guide = guides[0];
    const question = guide.questions[11];
    const answer = answerPrepared({ day: guide.day, message: question.value });
    assert.ok(answer.includes(guide.action), topicId + ' q12 must connect the general support answer to today\'s specific action');
  }
});

test('T01 q10 is day-bound and avoids blaming or shaming the user', () => {
  const guide = ANGER_DAILY_ASSISTANT_GUIDES[0];
  const answer = answerAngerDailyPreparedQuestion({ day: 1, message: expectedValues[9] });
  assert.ok(answer.includes('روز 1'), 'T01 q10 must remain bound to the selected day');
  assert.doesNotMatch(answer, /موضوع: خشم|دستیار هوشمند مسیر ۲۸|جمع‌بندی امروز/u);
  assert.doesNotMatch(answer, /تو\s+(?:تنبلی|بی‌ارادگی)|(?:مقصر|ضعیف)\s+هستی|بهانه‌گیر/u, 'T01 q10 must not attribute a negative trait to the user');
  assert.ok(guide.questions.some(question => question.id === 'q10'));
});

test('T01-T14 q11 safety answers remain day- and topic-specific and include the shared safety footer', () => {
  for (const [topicId, guides, , answerPrepared] of allTopicContracts) {
    for (const guide of guides) {
      const question = guide.questions[10];
      const topicContentIds = {
        T09: 'اهمال‌کاری',
        T10: 'بی‌خوابی و مشکلات خواب',
        T11: 'عادت‌های تکراری',
        T12: 'مرزبندی و نه گفتن',
        T13: 'تنهایی',
        T14: 'کمبود انگیزه',
      };
      const dailyContent = topicContentIds[topicId] ? {
        id: topicContentIds[topicId] + '-' + String(guide.day).padStart(2, '0'),
        topic_id: topicId,
        day: guide.day,
        title: guide.title,
        exercise: guide.exercise,
        actionText: guide.action,
        sourceExercise: guide.exercise,
        sourceActionText: guide.action,
      } : undefined;
      const answer = answerPrepared({ day: guide.day, message: question.value, dailyContent });
      assert.equal(typeof answer, 'string', topicId + ' day ' + guide.day + ' q11 answer');
      if (topicId === 'T01') {
        assert.ok(answer.includes(guide.stopCondition), 'T01 day ' + guide.day + ' q11 must retain its day-specific stop guidance');
        assert.doesNotMatch(answer, /یادآوری مهم درباره ایمنی شما|۰۹۱۹۰۸۸۹۰۶۲/u);
      } else {
        assert.ok(answer.includes(cleanPreparedAssistantTopicText(guide.title)), topicId + ' day ' + guide.day + ' q11 title context');
        assert.ok(answer.endsWith(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN), topicId + ' day ' + guide.day + ' q11 shared safety footer');
      }
      assert.ok(answer.length > 150, topicId + ' day ' + guide.day + ' q11 substantive safety guidance');
      assert.doesNotMatch(answer, /هدف این است که دستور امروز را بفهمی و تا جایی که امن و شدنی است اجرا کنی/u,
        topicId + ' q11 must not depend on retired global response frame');
    }
  }
});

test('all T01-T09 prepared answers contain substantial day-specific guidance without relying on a shared frame', () => {
  for (const [topicId, guides, , answerPrepared] of topics) {
    for (const guide of guides) {
      const dailyContent = topicId === 'T09' ? {
        id: 'اهمال‌کاری-' + String(guide.day).padStart(2, '0'),
        topic_id: 'T09',
        day: guide.day,
        exercise: guide.exercise,
        actionText: guide.action,
      } : undefined;
      for (const question of guide.questions) {
        const answer = answerPrepared({ day: guide.day, message: question.value, dailyContent });
        assert.equal(typeof answer, 'string', topicId + ' day ' + guide.day + ' ' + question.id);
        if (topicId !== 'T01') {
          assert.ok(answer.includes(cleanPreparedAssistantTopicText(guide.title)), topicId + ' day ' + guide.day + ' title context');
        } else {
          assert.doesNotMatch(answer, /دستیار هوشمند مسیر ۲۸|موضوع: خشم|جمع‌بندی امروز|توضیح و راهنمای امروز/u);
        }
        assert.ok(answer.trim().length > 100, topicId + ' day ' + guide.day + ' ' + question.id + ' substantial guidance');
        assert.doesNotMatch(answer, /هدف این است که دستور امروز را بفهمی و تا جایی که امن و شدنی است اجرا کنی/u,
          topicId + ' must not receive a retired repeated global sentence');
      }
    }
  }
});

test('audited examples distinguish exercise understanding from the next action in T01, T05, and T11', () => {
  const angerDay22 = ANGER_DAILY_ASSISTANT_GUIDES.find(guide => guide.day === 22);
  assert.match(angerDay22.exerciseExample, /تقسیم هزینه‌ها/u);
  assert.doesNotMatch(angerDay22.exerciseExample, /پیش از مذاکره بررسی می‌کنی/u);

  const jealousyDay28 = JEALOUSY_DAILY_ASSISTANT_GUIDES.find(guide => guide.day === 28);
  assert.match(jealousyDay28.exerciseExample, /پاسخ با تأخیر رسید/u);
  assert.match(jealousyDay28.actionExample, /نیازم هماهنگی روشن است/u);
  assert.notEqual(jealousyDay28.exerciseExample, jealousyDay28.actionExample);

  const t11Day12 = T11_DAILY_ASSISTANT_GUIDES.find(guide => guide.day === 12);
  const t11Day18 = T11_DAILY_ASSISTANT_GUIDES.find(guide => guide.day === 18);
  const day12Example = t11Day12.questions.find(question => question.kind === 'exercise_example').answer;
  const day18Example = t11Day18.questions.find(question => question.kind === 'exercise_example').answer;
  assert.match(day18Example, /زخم، درد یا قطع مکرر کارهای روزانه/u);
  assert.notEqual(day12Example, day18Example);
});

test('T05 day 23 and T09 day 26 examples demonstrate distinct, concrete next actions', () => {
  const jealousyDay23 = JEALOUSY_DAILY_ASSISTANT_GUIDES.find(guide => guide.day === 23);
  assert.match(jealousyDay23.actionExample, /کلاس نقاشی/u);
  assert.match(jealousyDay23.actionExample, /برای اثبات چیزی/u);

  const procrastinationDay26 = T09_DAILY_ASSISTANT_GUIDES.find(guide => guide.day === 26);
  const actionExample = procrastinationDay26.questions.find(question => question.kind === 'action_example').answer;
  assert.match(actionExample, /پیام کوتاه برای مسئول پروژه/u);
  assert.match(actionExample, /تاریخ پیگیری/u);
});

test('T09 day 27 and T11 day 18 titles remain distinct and synchronized with visible daily content', async () => {
  const t09Day17 = T09_DAILY_ASSISTANT_GUIDES.find(guide => guide.day === 17);
  const t09Day27 = T09_DAILY_ASSISTANT_GUIDES.find(guide => guide.day === 27);
  const t11Day2 = T11_DAILY_ASSISTANT_GUIDES.find(guide => guide.day === 2);
  const t11Day18 = T11_DAILY_ASSISTANT_GUIDES.find(guide => guide.day === 18);
  assert.notEqual(t09Day17.title, t09Day27.title);
  assert.match(t09Day27.title, /پیشگیری از چرخه/u);
  assert.notEqual(t11Day2.title, t11Day18.title);
  assert.match(t11Day18.title, /حوزه‌های روزمره/u);

  const overlay = JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
  assert.equal(overlay.categories['اهمال‌کاری'].days.find(day => day.day === 27).title, t09Day27.title);
  assert.equal(overlay.categories['عادت‌های تکراری'].days.find(day => day.day === 18).title, t11Day18.title);
});

const visibleAssistantTextKeys = new Set([
  'topic', 'title', 'objective', 'skill', 'mechanism', 'exercise', 'action',
  'lightVersion', 'lightActionVersion', 'progressVersion', 'progressActionVersion',
  'restVersion', 'restActionVersion', 'successCriterion', 'reflectionPrompt',
  'reflectionQuestion', 'stopCondition', 'exerciseExample', 'actionExample',
  'label', 'value', 'answer', 'text', 'heading', 'body', 'whenToSeekHumanSupport',
  'contraindications', 'safetyNote', 'riskNote',
]);

function collectVisibleAssistantStrings(value, key = '', inheritedVisible = false, output = []) {
  const visible = inheritedVisible || visibleAssistantTextKeys.has(key);
  if (Array.isArray(value)) {
    for (const item of value) collectVisibleAssistantStrings(item, key, visible, output);
  } else if (value && typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) {
      collectVisibleAssistantStrings(childValue, childKey, visible, output);
    }
  } else if (typeof value === 'string' && visible && value.trim()) {
    output.push(value);
  }
  return output;
}

test('T01-T14 assistant-visible daily guides and prepared answers contain no leaked Latin identifiers', () => {
  const contentNames = {
    T01: 'خشم', T02: 'اضطراب', T03: 'ترس', T04: 'نفرت',
    T05: 'حسادت', T06: 'غم و سوگ', T07: 'احساس گناه', T08: 'وابستگی عاطفی',
    T09: 'اهمال‌کاری', T10: 'بی‌خوابی و مشکلات خواب',
    T11: 'عادت‌های تکراری', T12: 'مرزبندی و نه گفتن',
    T13: 'تنهایی', T14: 'کمبود انگیزه',
  };
  const latin = /\p{Script=Latin}/u;
  const findings = [];
  let daysChecked = 0;
  let runtimeAnswersChecked = 0;

  for (const [topicId, guides, getGroups, answerPrepared] of allTopicContracts) {
    assert.equal(guides.length, 28, topicId + ' must cover all 28 days');
    for (const guide of guides) {
      daysChecked += 1;
      const dayLabel = topicId + ' روز ' + guide.day;
      for (const value of collectVisibleAssistantStrings(guide)) {
        const visibleValue = cleanPreparedAssistantTopicText(value, contentNames[topicId]);
        if (latin.test(visibleValue)) findings.push(dayLabel + ' متن منبعِ پس از پاک‌سازی نمایشی: ' + visibleValue.slice(0, 180));
      }

      const name = contentNames[topicId];
      const dailyContent = name ? {
        id: name + '-' + String(guide.day).padStart(2, '0'),
        topic_id: topicId,
        day: guide.day,
        title: guide.title,
        exercise: guide.exercise,
        actionText: guide.action,
        sourceExercise: guide.exercise,
        sourceActionText: guide.action,
      } : undefined;

      for (const group of getGroups(guide.day)) {
        if (latin.test(group.label)) findings.push(dayLabel + ' عنوان گروه: ' + group.label);
        for (const question of group.questions) {
          for (const [field, value] of [['عنوان پرسش', question.label], ['متن پرسش', question.value]]) {
            if (typeof value === 'string' && latin.test(value)) findings.push(dayLabel + ' ' + field + ': ' + value);
          }
          const answer = answerPrepared({ day: guide.day, message: question.value, dailyContent });
          if (typeof answer === 'string' && answer.trim()) {
            runtimeAnswersChecked += 1;
            if (latin.test(answer)) findings.push(dayLabel + ' پاسخ آماده ' + question.id + ': ' + answer.match(/[^\\n]*\p{Script=Latin}[^\\n]*/u)?.[0]?.slice(0, 220));
          }
        }
      }
    }
  }

  assert.equal(daysChecked, 14 * 28, 'all 392 topic/day records must be audited');
  assert.ok(runtimeAnswersChecked > 0, 'the audit must inspect actual prepared runtime answers');
  assert.deepEqual(findings, [], 'no Latin letters, internal IDs, code fragments, or placeholders may leak into visible assistant copy');
});



test('assistant visible text normalizes known Latin identifiers and clinical acronyms', () => {
  assert.equal(cleanPreparedAssistantTopicText('پرسش q06 درباره T01'), 'پرسش پرسش درباره خشم');
  assert.equal(cleanPreparedAssistantTopicText('نشانه PGD و PTSD'), 'نشانه اختلال سوگ طولانی‌مدت و اختلال استرس پس از سانحه');
});


const PERSIAN_VISIBLE_GUIDE_FIELDS = new Set([
  'topic', 'title', 'objective', 'skill', 'mechanism', 'exercise', 'action',
  'lightVersion', 'lightActionVersion', 'progressVersion', 'progressActionVersion',
  'restVersion', 'restActionVersion', 'successCriterion', 'reflectionQuestion',
  'reflectionPrompt', 'stopCondition', 'stopConditions', 'contraindications',
  'whenToSeekHumanSupport', 'exerciseExample', 'actionExample',
  'label', 'value', 'answer', 'questions',
]);

function collectPersianVisibleStrings(value, key = '', output = []) {
  if (typeof value === 'string' && PERSIAN_VISIBLE_GUIDE_FIELDS.has(key) && key !== 'questions') output.push(value);
  else if (Array.isArray(value)) value.forEach(item => collectPersianVisibleStrings(item, key, output));
  else if (value && typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) {
      if (PERSIAN_VISIBLE_GUIDE_FIELDS.has(childKey)) collectPersianVisibleStrings(childValue, childKey, output);
    }
  }
  return output;
}

test('Persian-only runtime output: all 14 questions × 28 days × 14 topics contain no Latin leakage', () => {
  const contentNames = {
    T01: 'خشم', T02: 'اضطراب', T03: 'ترس', T04: 'نفرت',
    T05: 'حسادت', T06: 'غم و سوگ', T07: 'احساس گناه', T08: 'وابستگی عاطفی',
    T09: 'اهمال‌کاری', T10: 'بی‌خوابی و مشکلات خواب', T11: 'عادت‌های تکراری',
    T12: 'مرزبندی و نه گفتن', T13: 'تنهایی', T14: 'کمبود انگیزه',
  };
  const latin = /\p{Script=Latin}/u;
  let checkedDays = 0;
  let checkedAnswers = 0;
  const findings = [];

  for (const [topicId, guides, getGroups, answerPrepared] of allTopicContracts) {
    assert.equal(guides.length, 28, topicId + ' must cover all 28 days');
    for (const guide of guides) {
      const visibleSource = collectPersianVisibleStrings(guide);
      const groups = getGroups(guide.day);
      for (const group of groups) {
        visibleSource.push(group.label);
        for (const question of group.questions) visibleSource.push(question.label, question.value);
      }
      for (const value of visibleSource) {
        const normalized = cleanPreparedAssistantTopicText(value, contentNames[topicId]);
        if (latin.test(normalized)) findings.push(topicId + ' day ' + guide.day + ' source: ' + normalized.slice(0, 160));
      }

      const name = contentNames[topicId];
      const dailyContent = {
        id: name + '-' + String(guide.day).padStart(2, '0'),
        topic_id: topicId,
        day: guide.day,
        title: guide.title,
        exercise: guide.exercise,
        actionText: guide.action,
        sourceExercise: guide.exercise,
        sourceActionText: guide.action,
      };
      for (const question of guide.questions) {
        const answer = answerPrepared({ day: guide.day, message: question.value, dailyContent });
        if (typeof answer !== 'string' || !answer.trim()) {
          findings.push(topicId + ' day ' + guide.day + ' missing answer for ' + question.value);
          continue;
        }
        checkedAnswers += 1;
        if (latin.test(answer)) {
          const match = answer.match(/.{0,45}\p{Script=Latin}.{0,45}/u);
          findings.push(topicId + ' day ' + guide.day + ' runtime: ' + (match?.[0] || 'Latin character'));
        }
      }
      checkedDays += 1;
    }
  }

  assert.equal(checkedDays, 392, 'all 392 topic/day guides must be inspected');
  assert.equal(checkedAnswers, 14 * 28 * 14, 'all 5,488 prepared question answers must be inspected');
  assert.deepEqual(findings, [], 'assistant-visible text must be Persian and free of Latin identifiers or code');
});
