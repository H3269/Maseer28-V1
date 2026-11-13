import { DAILY_ASSISTANT_SAFETY_QUESTION_KINDS } from '../src/features/assistant/dailyAssistantSafetyReminder.js';
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
const expectedGuideKeys = Object.keys(ANGER_DAILY_ASSISTANT_GUIDES[0]);
const expectedQuestionKeys = Object.keys(ANGER_DAILY_ASSISTANT_GUIDES[0].questions[0]);

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

test('all T01-T09 prepared answers share the same structural heading and day objective/skill frame', () => {
  for (const [topicId, guides, , answerPrepared] of topics) {
    assert.equal(typeof answerPrepared, 'function', topicId + ' answer handler');
    for (const guide of guides) {
      const dailyContent = topicId === 'T09' ? {
        id: 'اهمال‌کاری-' + String(guide.day).padStart(2, '0'),
        topic_id: 'T09',
        day: guide.day,
        exercise: guide.exercise,
        actionText: guide.action,
      } : undefined;
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
        assert.ok(answer.includes(guide.title), topicId + ' day ' + guide.day + ' title context');
        if (question.kind === 'exercise_meaning') assert.ok(answer.includes(String(guide.exercise).trim().slice(0, 40)), topicId + ' day ' + guide.day + ' exercise context');
        if (question.kind === 'action_meaning') assert.ok(answer.includes(String(guide.action).trim().slice(0, 40)), topicId + ' day ' + guide.day + ' action context');
      }
    }
  }
});

test('q11 keeps a genuinely topic-specific answer body after the shared response frame', () => {
  const marker = 'هدف این است که دستور امروز را بفهمی و تا جایی که امن و شدنی است اجرا کنی.';
  for (let day = 1; day <= 28; day += 1) {
    const topicBodies = topics.map(([topicId, guides, , answerPrepared]) => {
      const guide = guides[day - 1];
      const question = guide.questions[10];
      const dailyContent = topicId === 'T09' ? {
        id: 'اهمال‌کاری-' + String(day).padStart(2, '0'),
        topic_id: 'T09',
        day,
        exercise: guide.exercise,
        actionText: guide.action,
      } : undefined;
      const answer = answerPrepared({ day, message: question.value, dailyContent });
      const markerIndex = answer?.indexOf(marker) ?? -1;
      assert.ok(markerIndex >= 0, topicId + ' day ' + day + ' shared frame marker');
      const body = answer.slice(markerIndex + marker.length).trim();
      assert.ok(body.length > 20, topicId + ' day ' + day + ' q11 needs a substantive topic-specific answer body');
      return body;
    });
    assert.equal(new Set(topicBodies).size, 9, 'q11 answer bodies must be distinct across all topics on day ' + day);
  }
});


test('T01-T09 prepared answer depth stays within a broad topic-balanced range for each shared question', () => {
  const marker = 'هدف این است که دستور امروز را بفهمی و تا جایی که امن و شدنی است اجرا کنی.';
  const median = values => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  const questionIds = topics[0][1][0].questions.map(question => question.id);
  for (const questionId of questionIds) {
    const topicMedians = topics.map(([topicId, guides, , answerPrepared]) => {
      const lengths = guides.map(guide => {
        const question = guide.questions.find(item => item.id === questionId);
        assert.ok(question, topicId + ' day ' + guide.day + ' missing ' + questionId);
        const dailyContent = topicId === 'T09' ? {
          id: 'اهمال‌کاری-' + String(guide.day).padStart(2, '0'),
          topic_id: 'T09',
          day: guide.day,
          exercise: guide.exercise,
          actionText: guide.action,
        } : undefined;
        const answer = answerPrepared({ day: guide.day, message: question.value, dailyContent });
        assert.equal(typeof answer, 'string', topicId + ' day ' + guide.day + ' ' + questionId);
        const markerIndex = answer.indexOf(marker);
        assert.ok(markerIndex >= 0, topicId + ' day ' + guide.day + ' shared response frame');
        return answer.slice(markerIndex + marker.length).trim().length;
      });
      return { topicId, length: median(lengths) };
    });
    const overallMedian = median(topicMedians.map(item => item.length));
    for (const item of topicMedians) {
      const ratio = item.length / Math.max(1, overallMedian);
      assert.ok(ratio >= 0.25 && ratio <= 4.0,
        questionId + ' answer-body median for ' + item.topicId + ' is outside the broad balance range: '
        + item.length + ' chars vs overall median ' + overallMedian + ' (ratio ' + ratio.toFixed(2) + ')');
    }
  }
});
