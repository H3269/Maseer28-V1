import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanPreparedAssistantTopicText } from '../src/features/assistant/teacherStylePreparedAnswer.js';

import { ANGER_DAILY_ASSISTANT_GUIDES, answerAngerDailyPreparedQuestion } from '../src/features/assistant/angerDailyAssistantPrompts.js';
import { ANXIETY_DAILY_ASSISTANT_GUIDES, answerAnxietyDailyPreparedQuestion } from '../src/features/assistant/anxietyDailyAssistantPrompts.js';
import { FEAR_DAILY_ASSISTANT_GUIDES, answerFearDailyPreparedQuestion } from '../src/features/assistant/fearDailyAssistantPrompts.js';
import { HATRED_DAILY_ASSISTANT_GUIDES, answerHatredDailyPreparedQuestion } from '../src/features/assistant/hatredDailyAssistantPrompts.js';
import { JEALOUSY_DAILY_ASSISTANT_GUIDES, answerJealousyDailyPreparedQuestion } from '../src/features/assistant/jealousyDailyAssistantPrompts.js';
import { GRIEF_DAILY_ASSISTANT_GUIDES, answerGriefDailyPreparedQuestion } from '../src/features/assistant/griefDailyAssistantPrompts.js';
import { GUILT_DAILY_ASSISTANT_GUIDES, answerGuiltDailyPreparedQuestion } from '../src/features/assistant/guiltDailyAssistantPrompts.js';
import { EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES, answerEmotionalDependencyDailyPreparedQuestion } from '../src/features/assistant/emotionalDependencyDailyAssistantPrompts.js';
import { T09_DAILY_ASSISTANT_GUIDES, answerT09DailyPreparedQuestion } from '../src/features/assistant/t09DailyAssistantPrompts.js';
import { T10_DAILY_ASSISTANT_GUIDES, answerT10DailyPreparedQuestion } from '../src/features/assistant/t10DailyAssistantPrompts.js';
import { T11_DAILY_ASSISTANT_GUIDES, answerT11DailyPreparedQuestion } from '../src/features/assistant/t11DailyAssistantPrompts.js';
import { T12_DAILY_ASSISTANT_GUIDES, answerT12DailyPreparedQuestion } from '../src/features/assistant/t12DailyAssistantPrompts.js';
import { T13_DAILY_ASSISTANT_GUIDES, answerT13DailyPreparedQuestion } from '../src/features/assistant/t13DailyAssistantPrompts.js';
import { T14_DAILY_ASSISTANT_GUIDES, answerT14DailyPreparedQuestion } from '../src/features/assistant/t14DailyAssistantPrompts.js';

const topics = [
  { id: 'T01', guides: ANGER_DAILY_ASSISTANT_GUIDES, answer: answerAngerDailyPreparedQuestion, topic: 'خشم' },
  { id: 'T02', guides: ANXIETY_DAILY_ASSISTANT_GUIDES, answer: answerAnxietyDailyPreparedQuestion, topic: 'اضطراب' },
  { id: 'T03', guides: FEAR_DAILY_ASSISTANT_GUIDES, answer: answerFearDailyPreparedQuestion, topic: 'ترس' },
  { id: 'T04', guides: HATRED_DAILY_ASSISTANT_GUIDES, answer: answerHatredDailyPreparedQuestion, topic: 'نفرت' },
  { id: 'T05', guides: JEALOUSY_DAILY_ASSISTANT_GUIDES, answer: answerJealousyDailyPreparedQuestion, topic: 'حسادت' },
  { id: 'T06', guides: GRIEF_DAILY_ASSISTANT_GUIDES, answer: answerGriefDailyPreparedQuestion, topic: 'غم و سوگ' },
  { id: 'T07', guides: GUILT_DAILY_ASSISTANT_GUIDES, answer: answerGuiltDailyPreparedQuestion, topic: 'احساس گناه' },
  { id: 'T08', guides: EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES, answer: answerEmotionalDependencyDailyPreparedQuestion, topic: 'وابستگی عاطفی' },
  { id: 'T09', guides: T09_DAILY_ASSISTANT_GUIDES, answer: answerT09DailyPreparedQuestion, topic: 'اهمال‌کاری' },
  { id: 'T10', guides: T10_DAILY_ASSISTANT_GUIDES, answer: answerT10DailyPreparedQuestion, topic: 'بی‌خوابی و مشکلات خواب' },
  { id: 'T11', guides: T11_DAILY_ASSISTANT_GUIDES, answer: answerT11DailyPreparedQuestion, topic: 'عادت‌های تکراری' },
  { id: 'T12', guides: T12_DAILY_ASSISTANT_GUIDES, answer: answerT12DailyPreparedQuestion, topic: 'مرزبندی و نه گفتن' },
  { id: 'T13', guides: T13_DAILY_ASSISTANT_GUIDES, answer: answerT13DailyPreparedQuestion, topic: 'تنهایی' },
  { id: 'T14', guides: T14_DAILY_ASSISTANT_GUIDES, answer: answerT14DailyPreparedQuestion, topic: 'کمبود انگیزه' },
];

function dailyContent(topic, guide) {
  const day = String(guide.day).padStart(2, '0');
  const base = {
    id: topic.topic + '-' + day,
    topic_id: topic.id,
    day: guide.day,
    title: guide.title,
    exercise: guide.exercise,
    sourceExercise: guide.exercise,
    action: guide.action,
    actionText: guide.action,
    sourceActionText: guide.action,
    lightExerciseText: guide.lightVersion,
    lightActionText: guide.lightActionVersion || guide.lightVersion,
    progressActionText: guide.progressActionVersion || guide.progressVersion,
    restExerciseText: guide.restVersion,
    restActionText: guide.restActionVersion || guide.restVersion,
  };
  if (topic.id === 'T09') base.id = 'اهمال‌کاری-' + day;
  if (topic.id === 'T10') base.id = 'بی‌خوابی و مشکلات خواب-' + day;
  if (topic.id === 'T11') base.id = 'عادت‌های تکراری-' + day;
  if (topic.id === 'T12') base.id = 'مرزبندی و نه گفتن-' + day;
  if (topic.id === 'T13') base.id = 'تنهایی-' + day;
  if (topic.id === 'T14') base.id = 'کمبود انگیزه-' + day;
  return base;
}

test('T01-T14: all 5,488 prepared answers use the same clear teacher-style daily frame', () => {
  let checked = 0;
  for (const topic of topics) {
    assert.equal(topic.guides.length, 28, topic.id + ' must contain 28 days');
    for (const guide of topic.guides) {
      assert.equal(guide.questions.length, 14, topic.id + ' day ' + guide.day + ' must contain 14 fixed questions');
      for (const question of guide.questions) {
        const args = { day: guide.day, message: question.value };
        if (Number(topic.id.slice(1)) >= 9) args.dailyContent = dailyContent(topic, guide);
        else if (topic.id === 'T05') args.dailyContent = { exercise: guide.exercise, actionText: guide.action };
        const answer = topic.answer(args);
        assert.equal(typeof answer, 'string', topic.id + ' day ' + guide.day + ' ' + question.kind + ' must resolve');
        assert.ok(answer.includes('**بیاییم قدم‌به‌قدم پیش برویم.**'), topic.id + ' day ' + guide.day + ' ' + question.kind + ' missing teacher-style frame');
        assert.ok(answer.includes('**هدف امروز:** ' + guide.objective), topic.id + ' day ' + guide.day + ' ' + question.kind + ' missing exact daily objective');
        assert.ok(answer.includes('مهارت «' + (guide.skill || guide.mechanism || guide.objective) + '»'), topic.id + ' day ' + guide.day + ' ' + question.kind + ' missing daily skill');
        const frameMarker = 'هدف این است که دستور امروز را بفهمی و تا جایی که امن و شدنی است اجرا کنی.';
        const frameIndex = answer.indexOf(frameMarker);
        assert.ok(frameIndex >= 0, topic.id + ' day ' + guide.day + ' ' + question.kind + ' missing the common response frame marker');
        assert.ok(answer.slice(frameIndex + frameMarker.length).trim().length > 20, topic.id + ' day ' + guide.day + ' ' + question.kind + ' must contain substantive day-specific guidance after the shared frame');
        if (question.kind === 'exercise_meaning') {
          assert.ok(answer.includes(cleanPreparedAssistantTopicText(guide.exercise, topic.topic)), topic.id + ' day ' + guide.day + ' exercise meaning must state the exact daily exercise');
        }
        if (question.kind === 'action_meaning') {
          const expectedAction = topic.id === 'T11'
            ? guide.action.replace(/^برای مسئله «عادت‌های تکراری»،\\s*/u, '')
            : guide.action;
          assert.ok(answer.includes(cleanPreparedAssistantTopicText(expectedAction, topic.topic)), topic.id + ' day ' + guide.day + ' action meaning must state the exact daily action');
        }
        if (question.kind === 'exercise_action_difference') {
          assert.ok(answer.includes(cleanPreparedAssistantTopicText(guide.exercise, topic.topic)), topic.id + ' day ' + guide.day + ' comparison must state the daily exercise');
          const expectedAction = topic.id === 'T11'
            ? guide.action.replace(/^برای مسئله «عادت‌های تکراری»،\\s*/u, '')
            : guide.action;
          assert.ok(answer.includes(cleanPreparedAssistantTopicText(expectedAction, topic.topic)), topic.id + ' day ' + guide.day + ' comparison must state the daily action');
        }
        if (question.kind === 'exercise_example') {
          if (guide.exerciseExample) assert.ok(answer.includes(cleanPreparedAssistantTopicText(guide.exerciseExample, topic.topic)), topic.id + ' day ' + guide.day + ' missing its own exercise example');
          else assert.ok(answer.includes(cleanPreparedAssistantTopicText(question.answer, topic.topic)), topic.id + ' day ' + guide.day + ' missing its prepared exercise example');
        }
        if (question.kind === 'action_example') {
          if (guide.actionExample) assert.ok(answer.includes(cleanPreparedAssistantTopicText(guide.actionExample, topic.topic)), topic.id + ' day ' + guide.day + ' missing its own action example');
          else assert.ok(answer.includes(cleanPreparedAssistantTopicText(question.answer, topic.topic)), topic.id + ' day ' + guide.day + ' missing its prepared action example');
        }
        checked += 1;
      }
    }
  }
  assert.equal(checked, 5488);
});
