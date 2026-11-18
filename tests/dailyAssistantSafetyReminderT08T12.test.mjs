import assert from 'node:assert/strict';
import test from 'node:test';
import { DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN } from '../src/features/assistant/dailyAssistantSafetyReminder.js';
import {
  EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES,
  answerEmotionalDependencyDailyPreparedQuestion,
} from '../src/features/assistant/emotionalDependencyDailyAssistantPrompts.js';
import { T09_DAILY_ASSISTANT_GUIDES, answerT09DailyPreparedQuestion } from '../src/features/assistant/t09DailyAssistantPrompts.js';
import { T10_DAILY_ASSISTANT_GUIDES, answerT10DailyPreparedQuestion } from '../src/features/assistant/t10DailyAssistantPrompts.js';
import { T11_DAILY_ASSISTANT_GUIDES, answerT11DailyPreparedQuestion } from '../src/features/assistant/t11DailyAssistantPrompts.js';
import { T12_DAILY_ASSISTANT_GUIDES, answerT12DailyPreparedQuestion } from '../src/features/assistant/t12DailyAssistantPrompts.js';

const packages = [
  {
    id: 'T08', guides: EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES,
    answer: answerEmotionalDependencyDailyPreparedQuestion,
    safetyKinds: new Set(['dependency_increased', 'talk_other', 'success', 'stop']),
    content: (guide) => undefined,
  },
  {
    id: 'T09', guides: T09_DAILY_ASSISTANT_GUIDES,
    answer: answerT09DailyPreparedQuestion,
    safetyKinds: new Set(['procrastination_increased', 'talk_other', 'success', 'stop']),
    content: (guide) => ({
      id: 'اهمال‌کاری-' + String(guide.day).padStart(2, '0'),
      day: guide.day, topic_id: 'T09', exercise: guide.exercise, actionText: guide.action,
    }),
  },
  {
    id: 'T10', guides: T10_DAILY_ASSISTANT_GUIDES,
    answer: answerT10DailyPreparedQuestion,
    safetyKinds: new Set(['sleep_distress', 'talk_other', 'success', 'stop']),
    content: (guide) => ({
      id: 'بی‌خوابی و مشکلات خواب-' + String(guide.day).padStart(2, '0'),
      day: guide.day, topic_id: 'T10', exercise: guide.exercise, actionText: guide.action,
    }),
  },
  {
    id: 'T11', guides: T11_DAILY_ASSISTANT_GUIDES,
    answer: answerT11DailyPreparedQuestion,
    safetyKinds: new Set(['t11_distress', 'talk_other', 'success', 'stop']),
    content: (guide) => ({
      id: 'عادت‌های تکراری-' + String(guide.day).padStart(2, '0'),
      day: guide.day, topic_id: 'T11', exercise: guide.exercise, actionText: guide.action,
    }),
  },
  {
    id: 'T12', guides: T12_DAILY_ASSISTANT_GUIDES,
    answer: answerT12DailyPreparedQuestion,
    safetyKinds: new Set(['procrastination_increased', 'talk_other', 'success', 'stop']),
    content: (guide) => ({
      id: 'مرزبندی و نه گفتن-' + String(guide.day).padStart(2, '0'),
      day: guide.day, topic_id: 'T12', title: guide.title,
      sourceExercise: guide.exercise, sourceActionText: guide.action,
      exercise: guide.exercise, actionText: guide.action,
      lightExerciseText: guide.lightVersion, lightActionText: guide.lightActionVersion,
      progressActionText: guide.progressActionVersion, restExerciseText: guide.restVersion,
      restActionText: guide.restActionVersion,
    }),
  },
];

test('T08-T12 append the exact shared safety reminder once to exactly four answers on every day', () => {
  for (const topic of packages) {
    assert.equal(topic.guides.length, 28, topic.id + ' must retain all 28 days');
    for (const guide of topic.guides) {
      assert.equal(guide.questions.length, 14, topic.id + ' day ' + guide.day + ' must retain all 14 questions');
      assert.equal(guide.questions.filter((q) => topic.safetyKinds.has(q.kind)).length, 4,
        topic.id + ' day ' + guide.day + ' must have exactly four safety/evaluation questions');
      for (const question of guide.questions) {
        const answer = topic.answer({
          day: guide.day,
          message: question.value,
          dailyContent: topic.content(guide),
        });
        assert.equal(typeof answer, 'string', topic.id + ' day ' + guide.day + ' ' + question.kind + ' must resolve');
        const expected = topic.safetyKinds.has(question.kind);
        const count = answer.split(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN).length - 1;
        assert.equal(count, expected ? 1 : 0,
          topic.id + ' day ' + guide.day + ' ' + question.kind + ' shared reminder count');
        assert.equal(answer.endsWith(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN), expected,
          topic.id + ' day ' + guide.day + ' ' + question.kind + ' shared reminder placement');
        if (topic.id === 'T12' && expected) {
          assert.match(answer, /یادآوری اختصاصی ایمنی و حریم خصوصی T12/u,
            'T12 must retain its additional privacy-specific guidance');
        }
      }
    }
  }
});


test('T08 talk answers retain the exact day action beside the support and consent guidance',()=>{const topic=packages.find(x=>x.id==='T08');for(const guide of topic.guides){const q=guide.questions.find(x=>x.kind==='talk_other');const answer=topic.answer({day:guide.day,message:q.value,dailyContent:topic.content(guide)});assert.ok(answer.includes(guide.action),'day '+guide.day+' action');}});

test('T08-T12 adaptation answers name the exact day exercise and action',()=>{for(const topic of packages){for(const guide of topic.guides){const q=guide.questions.find(x=>x.kind==='can_change');const answer=topic.answer({day:guide.day,message:q.value,dailyContent:topic.content(guide)});assert.ok(answer.includes(guide.exercise),topic.id+' day '+guide.day+' exercise');const expectedAction=topic.id==='T11'?guide.action.replace(/^برای مسئله «عادت‌های تکراری»،\s*/u,''):guide.action;assert.ok(answer.includes(expectedAction),topic.id+' day '+guide.day+' action');}}});

test('T08-T12 talk answers retain the exact daily action',()=>{for(const topic of packages){for(const guide of topic.guides){const q=guide.questions.find(x=>x.kind==='talk_other');const answer=topic.answer({day:guide.day,message:q.value,dailyContent:topic.content(guide)});const expectedAction=topic.id==='T11'?guide.action.replace(/^برای مسئله «عادت‌های تکراری»،\s*/u,''):guide.action;assert.ok(answer.includes(expectedAction),topic.id+' day '+guide.day);}}});

test('T08-T12 duration answers name the exact day exercise and action',()=>{for(const topic of packages){for(const guide of topic.guides){const q=guide.questions.find(x=>x.kind==='duration');const answer=topic.answer({day:guide.day,message:q.value,dailyContent:topic.content(guide)});assert.ok(answer.includes(guide.exercise),topic.id+' day '+guide.day+' exercise');const expectedAction=topic.id==='T11'?guide.action.replace(/^برای مسئله «عادت‌های تکراری»،\s*/u,''):guide.action;assert.ok(answer.includes(expectedAction),topic.id+' day '+guide.day+' action');}}});