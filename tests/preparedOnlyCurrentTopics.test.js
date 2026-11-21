import test from 'node:test';
import assert from 'node:assert/strict';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import { getCanonicalDailyRecordId } from '../src/features/content/dailyContentSelector.js';
import { ANGER_DAILY_ASSISTANT_GUIDES, getAngerDailyAssistantPromptGroups } from '../src/features/assistant/angerDailyAssistantPrompts.js';
import { ANXIETY_DAILY_ASSISTANT_GUIDES, getAnxietyDailyAssistantPromptGroups } from '../src/features/assistant/anxietyDailyAssistantPrompts.js';
import { FEAR_DAILY_ASSISTANT_GUIDES, getFearDailyAssistantPromptGroups } from '../src/features/assistant/fearDailyAssistantPrompts.js';
import { HATRED_DAILY_ASSISTANT_GUIDES, getHatredDailyAssistantPromptGroups } from '../src/features/assistant/hatredDailyAssistantPrompts.js';
import { JEALOUSY_DAILY_ASSISTANT_GUIDES, getJealousyDailyAssistantPromptGroups } from '../src/features/assistant/jealousyDailyAssistantPrompts.js';
import { GRIEF_DAILY_ASSISTANT_GUIDES, getGriefDailyAssistantPromptGroups } from '../src/features/assistant/griefDailyAssistantPrompts.js';
import { GUILT_DAILY_ASSISTANT_GUIDES, getGuiltDailyAssistantPromptGroups } from '../src/features/assistant/guiltDailyAssistantPrompts.js';
import { EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES, getEmotionalDependencyDailyAssistantPromptGroups } from '../src/features/assistant/emotionalDependencyDailyAssistantPrompts.js';
import { T09_DAILY_ASSISTANT_GUIDES, getT09DailyAssistantPromptGroups } from '../src/features/assistant/t09DailyAssistantPrompts.js';
import { T10_DAILY_ASSISTANT_GUIDES, getT10DailyAssistantPromptGroups } from '../src/features/assistant/t10DailyAssistantPrompts.js';
import { T11_DAILY_ASSISTANT_GUIDES, getT11DailyAssistantPromptGroups } from '../src/features/assistant/t11DailyAssistantPrompts.js';
import { T12_DAILY_ASSISTANT_GUIDES, getT12DailyAssistantPromptGroups } from '../src/features/assistant/t12DailyAssistantPrompts.js';
import { T13_DAILY_ASSISTANT_GUIDES, getT13DailyAssistantPromptGroups } from '../src/features/assistant/t13DailyAssistantPrompts.js';
import { T14_DAILY_ASSISTANT_GUIDES, getT14DailyAssistantPromptGroups } from '../src/features/assistant/t14DailyAssistantPrompts.js';

const topics = [
  { name: 'خشم', id: 'T01', guides: ANGER_DAILY_ASSISTANT_GUIDES, groups: getAngerDailyAssistantPromptGroups },
  { name: 'اضطراب', id: 'T02', guides: ANXIETY_DAILY_ASSISTANT_GUIDES, groups: getAnxietyDailyAssistantPromptGroups },
  { name: 'ترس', id: 'T03', guides: FEAR_DAILY_ASSISTANT_GUIDES, groups: getFearDailyAssistantPromptGroups },
  { name: 'نفرت', id: 'T04', guides: HATRED_DAILY_ASSISTANT_GUIDES, groups: getHatredDailyAssistantPromptGroups },
  { name: 'حسادت', id: 'T05', guides: JEALOUSY_DAILY_ASSISTANT_GUIDES, groups: getJealousyDailyAssistantPromptGroups },
  { name: 'غم و سوگ', id: 'T06', guides: GRIEF_DAILY_ASSISTANT_GUIDES, groups: getGriefDailyAssistantPromptGroups },
  { name: 'احساس گناه', id: 'T07', guides: GUILT_DAILY_ASSISTANT_GUIDES, groups: getGuiltDailyAssistantPromptGroups },
  { name: 'وابستگی عاطفی', id: 'T08', guides: EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES, groups: getEmotionalDependencyDailyAssistantPromptGroups },
  { name: 'اهمال‌کاری', id: 'T09', guides: T09_DAILY_ASSISTANT_GUIDES, groups: getT09DailyAssistantPromptGroups },
  { name: 'بی‌خوابی و مشکلات خواب', id: 'T10', guides: T10_DAILY_ASSISTANT_GUIDES, groups: getT10DailyAssistantPromptGroups },
  { name: 'عادت‌های تکراری', id: 'T11', guides: T11_DAILY_ASSISTANT_GUIDES, groups: getT11DailyAssistantPromptGroups },
  { name: 'مرزبندی و نه گفتن', id: 'T12', guides: T12_DAILY_ASSISTANT_GUIDES, groups: getT12DailyAssistantPromptGroups },
  { name: 'تنهایی', id: 'T13', guides: T13_DAILY_ASSISTANT_GUIDES, groups: getT13DailyAssistantPromptGroups },
  { name: 'کمبود انگیزه', id: 'T14', guides: T14_DAILY_ASSISTANT_GUIDES, groups: getT14DailyAssistantPromptGroups },
];

function contextFor(topic) {
  const guide = topic.guides[0];
  return {
    day: 1,
    problem: topic.name,
    relationshipSafetyConfirmed: true,
    data: {
      id: getCanonicalDailyRecordId(topic.name, 1),
      ...(topic.id !== 'T13' ? { topic_id: topic.id } : {}),
      day: 1,
      title: guide.title,
      exercise: guide.exercise,
      actionText: guide.action,
    },
  };
}

for (const topic of topics) {
  test(`${topic.name}: prepared daily questions work and free-form questions are refused`, () => {
    const question = topic.groups(1).flatMap(group => group.questions)[0]?.value;
    assert.ok(question, 'day one must have at least one prepared question');
    const prepared = makePageAssistantTurn({
      screen: 'day',
      text: question,
      dailyContext: contextFor(topic),
    });
    if (topic.id === 'T10') {
      assert.equal(prepared.status, 'daily_guidance_unavailable');
      assert.match(prepared.message, /پیش‌نویس/u);
    } else {
      assert.equal(prepared.status, 'daily_guidance_available');
      assert.match(prepared.message, /راهنمای روز/);
    }

    const freeform = makePageAssistantTurn({
      screen: 'day',
      text: 'لطفاً درباره موضوع دیگری هم راهنمایی آزاد بده.',
      dailyContext: contextFor(topic),
    });
    assert.equal(freeform.status, 'prepared_question_required');
    assert.match(freeform.message, /گفت‌وگوی آزاد برای این موضوع فعال نیست/);
    assert.equal(freeform.conversationState, null);
  });
}


test('T10 draft-only package is not exposed through the live daily assistant on any day', () => {
  const topic = topics.find(item => item.id === 'T10');
  assert.ok(topic);
  for (const guide of topic.guides) {
    const dailyContext = contextFor(topic);
    dailyContext.day = guide.day;
    dailyContext.data.id = getCanonicalDailyRecordId(topic.name, guide.day);
    dailyContext.data.day = guide.day;
    dailyContext.data.title = guide.title;
    dailyContext.data.exercise = guide.exercise;
    dailyContext.data.actionText = guide.action;
    for (const question of topic.groups(guide.day).flatMap(group => group.questions)) {
      const result = makePageAssistantTurn({ screen: 'day', text: question.value, dailyContext });
      assert.equal(result.status, 'daily_guidance_unavailable', 'T10 day ' + guide.day + ' must remain draft-only');
      assert.match(result.message, /پیش‌نویس/u);
    }
  }
});

test('all exact prepared FAQs across 28 days keep their own answers when their wording contains broad safety cues', () => {
  assert.equal(topics.length, 14, 'the shared prepared-only contract covers T01 through T14');
  let checked = 0;
  for (const topic of topics) {
    for (const guide of topic.guides) {
      if (topic.id === 'T10' || (topic.id === 'T13' && guide.day === 14)) continue;
      const dailyContext = {
        day: guide.day,
        problem: topic.name,
        relationshipSafetyConfirmed: true,
        data: {
          id: getCanonicalDailyRecordId(topic.name, guide.day),
          ...(topic.id !== 'T13' ? { topic_id: topic.id } : {}),
          day: guide.day,
          title: guide.title,
          exercise: guide.exercise,
          actionText: guide.action,
        },
      };
      const questions = topic.groups(guide.day).flatMap(group => group.questions);
      for (const question of questions) {
        const result = makePageAssistantTurn({
          screen: 'day',
          text: question.value,
          dailyContext,
        });
        assert.equal(result.status, 'daily_guidance_available', `${topic.name} day ${guide.day}: ${question.value}`);
        assert.match(result.message, /راهنمای روز/u, `${topic.name} day ${guide.day} must return its prepared answer`);
        checked += 1;
      }
    }
  }
  assert.equal(checked, 14 * 28 * 14 - 14 - 392, 'every runtime-eligible prepared question is checked; draft-only T10 and separately risk-gated T13 day 14 are excluded');
});

test('T01-T14 daily titles, exercises, actions, and examples are complete and not exact duplicates', () => {
  const titles = [];
  const exercises = [];
  const actions = [];
  const exerciseExamples = [];
  const actionExamples = [];
  for (const topic of topics) {
    assert.equal(topic.guides.length, 28, topic.id + ' must contain 28 days');
    for (const guide of topic.guides) {
      for (const field of ['title', 'objective', 'skill', 'mechanism', 'exercise', 'action', 'lightVersion', 'successCriterion', 'stopCondition']) {
        assert.ok(String(guide[field] || '').trim(), topic.id + ' day ' + guide.day + ' missing ' + field);
      }
      const exerciseExample = guide.exerciseExample || guide.questions?.find(question => question.id === 'q02')?.answer;
      const actionExample = guide.actionExample || guide.questions?.find(question => question.id === 'q04')?.answer;
      assert.ok(String(exerciseExample || '').trim(), topic.id + ' day ' + guide.day + ' missing exercise example');
      assert.ok(String(actionExample || '').trim(), topic.id + ' day ' + guide.day + ' missing action example');
      exerciseExamples.push(exerciseExample);
      actionExamples.push(actionExample);
      assert.equal(guide.questions.length, 14, topic.id + ' day ' + guide.day + ' must retain 14 prepared questions');
      titles.push(guide.title);
      exercises.push(guide.exercise);
      actions.push(guide.action);
    }
  }
  for (const [name, values] of [['titles', titles], ['exercises', exercises], ['actions', actions], ['exercise examples', exerciseExamples], ['action examples', actionExamples]]) {
    assert.equal(new Set(values).size, 14 * 28, name + ' must not repeat across T01-T14');
  }
});

test('T13 day 14 remains available through its risk classification', () => {
  const guide = T13_DAILY_ASSISTANT_GUIDES[13];
  const dailyContext = {
    day: 14,
    problem: 'تنهایی',
    data: {
      id: getCanonicalDailyRecordId('تنهایی', 14),
      topic_id: 'T13',
      day: 14,
      title: guide.title,
      exercise: guide.exercise,
      actionText: guide.action,
      risk_level: 'caution',
      subtopic_ids: ['T13-S02', 'T13-S03'],
    },
  };
  const result = makePageAssistantTurn({
    screen: 'day',
    text: guide.questions[0].value,
    dailyContext,
  });
  assert.equal(result.status, 'daily_guidance_available');
  assert.match(result.message, /راهنمای روز 14 تنهایی/u);
});

test('a pending safety exchange still preempts even an exact prepared FAQ', () => {
  const topic = topics[0];
  const dailyContext = contextFor(topic);
  const pending = makePageAssistantTurn({
    screen: 'day',
    text: 'دیگه نمی‌کشم. همه‌چی تمومه.',
    dailyContext,
  });
  const preparedQuestion = topic.groups(1).flatMap(group => group.questions)[0].value;
  const result = makePageAssistantTurn({
    screen: 'day',
    text: preparedQuestion,
    dailyContext,
    conversationState: pending.conversationState,
  });
  assert.equal(result.status, 'safety_clarification_required');
  assert.match(result.message, /آیا همین الآن خطر فوری/u);
});

test('safety clarification and uncertain answers preempt prepared FAQs for all current topics', () => {
  for (const topic of topics) {
    const dailyContext = contextFor(topic);
    const first = makePageAssistantTurn({
      screen: 'day',
      text: 'دیگه نمی‌کشم. همه‌چی تمومه.',
      dailyContext,
    });
    assert.equal(first.status, 'safety_clarification_required', topic.name);
    assert.equal(first.conversationState.dailyState.safetyStatus, 'pending', topic.name);

    const second = makePageAssistantTurn({
      screen: 'day',
      text: 'شاید، مطمئن نیستم',
      conversationState: first.conversationState,
      dailyContext,
    });
    assert.equal(second.status, 'urgent_human_support_required', topic.name);
    assert.match(second.message, /کمک فوری انسانی/);
    assert.equal(second.conversationState.dailyState.safetyStatus, 'handoff');
  }
});

test('the explicit safety control starts clarification and uncertain answers reach human-support handoff', () => {
  const dailyContext = contextFor(topics[0]);
  const first = makePageAssistantTurn({
    screen: 'day',
    text: 'مطمئن نیستم الان امن هستم یا نه و برای بررسی وضعیت ایمنی‌ام به کمک انسانی نیاز دارم.',
    dailyContext,
  });
  assert.equal(first.status, 'safety_clarification_required');
  assert.match(first.message, /آیا همین الآن خطر فوری/);
  assert.equal(first.conversationState.dailyState.safetyStatus, 'pending');

  const second = makePageAssistantTurn({
    screen: 'day',
    text: 'بله یا مطمئن نیستم؛ ممکن است خطر وجود داشته باشد.',
    conversationState: first.conversationState,
    dailyContext,
  });
  assert.equal(second.status, 'urgent_human_support_required');
  assert.match(second.message, /خدمات اورژانسی محل زندگی|فرد امن/);
  assert.equal(second.conversationState.dailyState.safetyStatus, 'handoff');
});

test('explicit immediate-risk action skips clarification and goes straight to human-support handoff', () => {
  const result = makePageAssistantTurn({
    screen: 'day',
    text: 'قصد دارم همین الآن به خودم آسیب بزنم یا به شخص دیگری آسیب بزنم و به کمک فوری نیاز دارم.',
    dailyContext: contextFor(topics[0]),
  });
  assert.equal(result.status, 'urgent_human_support_required');
  assert.match(result.message, /خدمات اورژانسی محل زندگی|فرد امن/);
  assert.equal(result.conversationState.dailyState.safetyStatus, 'handoff');
});

test('a clear no-immediate-danger answer safely returns each topic to prepared guidance', () => {
  for (const topic of topics) {
    const dailyContext = contextFor(topic);
    const first = makePageAssistantTurn({
      screen: 'day',
      text: 'دیگه نمی‌کشم. همه‌چی تمومه.',
      dailyContext,
    });
    assert.equal(first.status, 'safety_clarification_required', topic.name);

    const cleared = makePageAssistantTurn({
      screen: 'day',
      text: 'نه، همین حالا خطر فوری ندارم و قصد یا برنامه عملی برای آسیب ندارم.',
      conversationState: first.conversationState,
      dailyContext,
    });
    assert.equal(cleared.status, 'daily_guidance_available', topic.name);
    assert.equal(cleared.conversationState.dailyState.safetyStatus, 'cleared', topic.name);

    const question = topic.groups(1).flatMap(group => group.questions)[0].value;
    const prepared = makePageAssistantTurn({
      screen: 'day',
      text: question,
      conversationState: cleared.conversationState,
      dailyContext,
    });
    if (topic.id === 'T10') {
      assert.equal(prepared.status, 'daily_guidance_unavailable', topic.name);
      assert.match(prepared.message, /پیش‌نویس/u);
    } else {
      assert.equal(prepared.status, 'daily_guidance_available', topic.name);
      assert.match(prepared.message, /راهنمای روز/);
    }
  }
});


test('T14 is wired into the visible prepared-question launcher and remains prepared-only', async () => {
  const { readFile } = await import('node:fs/promises');
  const launcher = await readFile(new URL('../src/features/assistant/GlobalAssistantLauncher.jsx', import.meta.url), 'utf8');
  assert.match(launcher, /getT14DailyAssistantPromptGroups/u);
  assert.ok(launcher.includes('isT14DailyPromptContext ? "کمبود انگیزه"'));
  assert.match(launcher, /t14-daily-prompt-trigger/u);
});
