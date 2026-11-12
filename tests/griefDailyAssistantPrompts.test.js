import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  GRIEF_DAILY_ASSISTANT_GUIDES,
  answerGriefDailyPreparedQuestion,
  getGriefDailyAssistantPromptGroups,
} from '../src/features/assistant/griefDailyAssistantPrompts.js';
import { getGriefDaySpecificAnswerGuidance } from '../src/features/assistant/griefDailyAssistantDaySpecificGuidance.js';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import { getCanonicalDailyRecordId } from '../src/features/content/dailyContentSelector.js';

test('T06 contains 28 complete days and 14 unchanged prepared questions per day', () => {
  assert.equal(GRIEF_DAILY_ASSISTANT_GUIDES.length, 28);
  const expectedQuestions = GRIEF_DAILY_ASSISTANT_GUIDES[0].questions.map((q) => q.value);
  for (const guide of GRIEF_DAILY_ASSISTANT_GUIDES) {
    assert.ok(guide.title && guide.objective && guide.skill && guide.mechanism);
    assert.ok(guide.exercise && guide.action && guide.exerciseExample && guide.actionExample);
    assert.ok(guide.lightActionVersion && guide.progressActionVersion && guide.restActionVersion, 'missing action-specific adaptation on day ' + guide.day);
    assert.notEqual(guide.lightActionVersion, guide.lightVersion, 'light action must not reuse the light exercise on day ' + guide.day);
    assert.notEqual(guide.progressActionVersion, guide.progressVersion, 'progress action must not reuse the progress exercise on day ' + guide.day);
    assert.notEqual(guide.restActionVersion, guide.restVersion, 'rest action must not reuse the rest exercise on day ' + guide.day);
    assert.notEqual(guide.exerciseExample, guide.actionExample, 'exercise/action examples must teach distinct tasks on day ' + guide.day);
    assert.equal(guide.questions.length, 14);
    assert.equal(new Set(guide.questions.map((q) => q.value)).size, 14);
    assert.deepEqual(guide.questions.map((q) => q.value), expectedQuestions);
    assert.ok(String(guide.subtopic).split('|').every((id) => /^T06-S0[1-3]$/.test(id)), 'invalid T06 subtopic on day ' + guide.day);
  }
});

test('T06 prompt groups preserve the shared five-section structure for all 28 days', () => {
  for (let day = 1; day <= 28; day += 1) {
    const groups = getGriefDailyAssistantPromptGroups(day);
    assert.deepEqual(groups.map((group) => group.questions.length), [2, 2, 1, 5, 4]);
    assert.deepEqual(groups.map((group) => group.label), [
      'فهم تمرین روز ' + day,
      'فهم اقدام اختصاصی روز ' + day,
      'تفاوت تمرین و اقدام',
      'اجرا و موانع',
      'ارزیابی و ایمنی',
    ]);
  }
  assert.deepEqual(getGriefDailyAssistantPromptGroups(29), []);
  assert.deepEqual(getGriefDailyAssistantPromptGroups(0), []);
});

test('all 392 T06 prepared questions return substantive and meaningfully varied answers', () => {
  let count = 0;
  const answers = new Set();
  for (const guide of GRIEF_DAILY_ASSISTANT_GUIDES) {
    for (const question of guide.questions) {
      const answer = answerGriefDailyPreparedQuestion({
        day: guide.day,
        message: question.value,
        dailyContent: { exercise: guide.exercise, actionText: guide.action },
      });
      assert.ok(answer && answer.length >= 450, 'missing/short answer day ' + guide.day + ' ' + question.kind);
      assert.match(answer, /راهنمای روز/);
      assert.ok(answer.includes(guide.title), 'answer must identify the exact day title');
      assert.notEqual(answer.trim(), guide.exercise, 'answer must teach beyond repeating the exercise');
      assert.notEqual(answer.trim(), guide.action, 'answer must teach beyond repeating the action');
      switch (question.kind) {
        case 'exercise_meaning':
          assert.ok(answer.includes(guide.exercise) && answer.includes(guide.objective) && answer.includes(guide.mechanism) && answer.includes(guide.skill));
          break;
        case 'exercise_example':
          assert.ok(answer.includes(guide.exerciseExample) && answer.includes(guide.exercise) && answer.includes(guide.successCriterion));
          break;
        case 'action_meaning':
          assert.ok(answer.includes(guide.action) && answer.includes(guide.objective) && answer.includes(guide.skill) && answer.includes('تمرین کمک می‌کند'));
          break;
        case 'action_example':
          assert.ok(answer.includes(guide.actionExample) && answer.includes(guide.action));
          break;
        case 'light_version':
          assert.ok(answer.includes(guide.lightVersion) && answer.includes(guide.progressVersion) && answer.includes(guide.restVersion));
          assert.ok(answer.includes(guide.lightActionVersion) && answer.includes(guide.progressActionVersion) && answer.includes(guide.restActionVersion));
          break;
        case 'success':
          assert.ok(answer.includes(guide.successCriterion) && answer.includes(guide.reflectionQuestion) && answer.includes(guide.exercise) && answer.includes(guide.action));
          break;
        case 'stop':
          assert.ok(answer.includes(guide.stopCondition) && answer.includes('خدمات اضطراری') && answer.includes(guide.exercise) && answer.includes(guide.action));
          break;
        case 'no_event':
          assert.ok(answer.includes(guide.lightVersion) && answer.includes(guide.lightActionVersion) && answer.includes('جبران') && answer.includes(guide.exercise) && answer.includes(guide.action));
          break;
        case 'not_done':
          assert.ok(answer.includes(guide.lightVersion) && answer.includes(guide.lightActionVersion) && answer.includes('جبران') && answer.includes(guide.exercise) && answer.includes(guide.action));
          break;
        case 'exercise_action_difference':
          assert.ok(answer.includes(guide.exercise) && answer.includes(guide.action));
          break;
        case 'grief_increased':
          assert.ok(answer.includes(guide.stopCondition) && answer.includes('خدمات اضطراری') && answer.includes(guide.exercise) && answer.includes(guide.action));
          break;
        case 'talk_other':
          assert.ok(answer.includes('فرد امن') && answer.includes('مجبور') && answer.includes(guide.action));
          break;
        case 'can_change':
          assert.ok(answer.includes(guide.lightVersion) && answer.includes('چه چیزی را تغییر ندهی') && answer.includes(guide.exercise) && answer.includes(guide.action));
          break;
        case 'duration':
          assert.ok(answer.includes('زمان ثابت') && answer.includes(guide.successCriterion) && answer.includes(guide.exercise) && answer.includes(guide.action));
          break;
        default:
          assert.fail('unexpected question kind: ' + question.kind);
      }
      answers.add(answer);
      count += 1;
    }
  }
  assert.equal(count, 392);
  assert.equal(answers.size, 392, 'every day/question pair must return its own distinct answer text');
  assert.equal(answerGriefDailyPreparedQuestion({ day: 1, message: 'سؤال آزاد خارج از فهرست' }), null);
  assert.equal(answerGriefDailyPreparedQuestion({ day: 29, message: GRIEF_DAILY_ASSISTANT_GUIDES[0].questions[0].value }), null);
});

test('all 392 T06 answers include day-specific execution, separate success checks, and a day-specific boundary', () => {
  let count = 0;
  for (const guide of GRIEF_DAILY_ASSISTANT_GUIDES) {
    const specific = getGriefDaySpecificAnswerGuidance(guide.day);
    assert.ok(specific, 'missing day-specific guidance on day ' + guide.day);
    for (const field of ['exerciseHow', 'actionHow', 'exerciseSuccess', 'actionSuccess', 'avoid']) {
      assert.ok(typeof specific[field] === 'string' && specific[field].length >= 35,
        'missing substantive ' + field + ' on day ' + guide.day);
    }
    for (const question of guide.questions) {
      const answer = answerGriefDailyPreparedQuestion({
        day: guide.day,
        message: question.value,
        dailyContent: { exercise: guide.exercise, actionText: guide.action },
      });
      const fieldsByQuestion = {
        exercise_meaning: ['exerciseHow', 'exerciseSuccess'],
        exercise_example: ['exerciseHow'],
        action_meaning: ['actionHow', 'actionSuccess'],
        action_example: ['actionHow'],
        light_version: ['exerciseHow', 'actionHow', 'exerciseSuccess', 'actionSuccess', 'avoid'],
        success: ['exerciseSuccess', 'actionSuccess'],
        stop: ['avoid'],
        no_event: ['exerciseHow', 'actionHow', 'avoid'],
        exercise_action_difference: ['exerciseHow', 'actionHow'],
        not_done: ['exerciseHow', 'actionHow'],
        grief_increased: ['avoid'],
        talk_other: ['actionHow', 'actionSuccess'],
        can_change: ['exerciseHow', 'actionHow', 'avoid'],
        duration: ['exerciseHow', 'actionHow'],
      };
      const expectedFields = fieldsByQuestion[question.kind];
      assert.ok(!answer.includes('راهنمای اختصاصی روز ' + guide.day + ' — ' + guide.title),
        'repeated day-heading block must not be appended');
      for (const field of expectedFields) {
        assert.ok(answer.includes(specific[field]), 'missing relevant ' + field + ' for ' + question.kind + ' on day ' + guide.day);
      }
      for (const field of ['exerciseHow', 'actionHow', 'exerciseSuccess', 'actionSuccess', 'avoid']) {
        if (!expectedFields.includes(field)) {
          assert.ok(!answer.includes(specific[field]),
            'irrelevant ' + field + ' leaked into ' + question.kind + ' on day ' + guide.day);
        }
      }
      count += 1;
    }
  }
  assert.equal(count, 392);
  assert.equal(getGriefDaySpecificAnswerGuidance(0), null);
  assert.equal(getGriefDaySpecificAnswerGuidance(29), null);
});

test('T06 day 8 screens behavioral safety while day 15 separately formulates a support request', () => {
  const day8 = GRIEF_DAILY_ASSISTANT_GUIDES.find((item) => item.day === 8);
  const day15 = GRIEF_DAILY_ASSISTANT_GUIDES.find((item) => item.day === 15);
  assert.ok(day8.action.includes('رفتارهای قابل مشاهده'));
  assert.ok(day8.action.includes('تماس یا درخواست لازم نیست'));
  assert.ok(!day8.action.includes('درخواست کوتاه'));
  assert.ok(day15.action.includes('درخواست مشخص'));
  assert.ok(day15.exercise.includes('شنیده‌شدن'));
  const day8Answer = answerGriefDailyPreparedQuestion({
    day: 8,
    message: day8.questions.find((q) => q.kind === 'action_meaning').value,
    dailyContent: { exercise: day8.exercise, actionText: day8.action },
  });
  const day15Answer = answerGriefDailyPreparedQuestion({
    day: 15,
    message: day15.questions.find((q) => q.kind === 'action_meaning').value,
    dailyContent: { exercise: day15.exercise, actionText: day15.action },
  });
  assert.match(day8Answer, /تماس یا درخواست لازم نیست/);
  assert.match(day15Answer, /درخواست مشخص/);
  assert.notEqual(day8Answer, day15Answer);
});

test('T06 day 12 prepares for a grief wave rather than a generic crisis or stress plan', () => {
  const guide = GRIEF_DAILY_ASSISTANT_GUIDES.find((item) => item.day === 12);
  const specific = getGriefDaySpecificAnswerGuidance(12);
  assert.ok(guide.exercise.includes('موج دلتنگی'));
  assert.ok(guide.exercise.includes('یادآور فقدان'));
  assert.ok(guide.action.includes('موج سوگ'));
  assert.ok(specific.exerciseHow.includes('موج یا یادآور مرتبط با فقدان'));
  assert.ok(specific.exerciseHow.includes('نه نقشه بحران عمومی'));
  assert.ok(specific.avoid.includes('همه بحران‌ها'));
  assert.ok(!guide.action.includes('برنامه روز دشوار'));
});

test('the 28-day T06 design draft stays synchronized with runtime guidance', async () => {
  const draft = await readFile(new URL('../docs/T06_GRIEF_AND_LOSS_28DAY_REDESIGN_DRAFT_B2_CX_FA.md', import.meta.url), 'utf8');
  const sections = [...draft.matchAll(/^### روز (\d+) — (.+)$/gm)].map((match, index, all) => ({
    day: Number(match[1]),
    title: match[2],
    start: match.index,
    end: index + 1 < all.length ? all[index + 1].index : draft.indexOf('\n## وضعیت ممیزی', match.index),
  }));
  assert.equal(sections.length, 28);
  const fields = {
    objective: 'هدف',
    skill: 'مهارت',
    mechanism: 'سازوکار',
    exercise: 'تمرین',
    action: 'اقدام',
    lightVersion: 'نسخه سبک تمرین',
    progressVersion: 'نسخه پیشرفت تمرین',
    restVersion: 'نسخه استراحت تمرین',
    successCriterion: 'معیار موفقیت',
    reflectionQuestion: 'پرسش بازتاب',
    lightActionVersion: 'نسخه سبک اقدام',
    progressActionVersion: 'نسخه پیشرفت اقدام',
    restActionVersion: 'نسخه استراحت اقدام',
    stopCondition: 'شرط توقف/احتیاط',
  };
  for (const guide of GRIEF_DAILY_ASSISTANT_GUIDES) {
    const section = sections.find((item) => item.day === guide.day);
    assert.ok(section, 'missing draft section for T06 day ' + guide.day);
    assert.equal(section.title, guide.title, 'draft title mismatch on T06 day ' + guide.day);
    const body = draft.slice(section.start, section.end);
    for (const [field, label] of Object.entries(fields)) {
      assert.ok(body.includes('- **' + label + ':** ' + guide[field]),
        'draft/runtime mismatch for ' + field + ' on T06 day ' + guide.day);
    }
  }
});

test('T06 support-request day requires explicit relationship safety confirmation', () => {
  assert.equal(getCanonicalDailyRecordId('سوگ و فقدان', 15), getCanonicalDailyRecordId('غم و سوگ', 15));
  const guide = GRIEF_DAILY_ASSISTANT_GUIDES.find((item) => item.day === 15);
  const question = guide.questions.find((item) => item.kind === 'action_meaning');
  const data = {
    id: getCanonicalDailyRecordId('غم و سوگ', 15),
    topic_id: 'T06',
    day: 15,
    exercise: guide.exercise,
    actionText: guide.action,
  };
  const base = {
    screen: 'day',
    text: question.value,
    dailyContext: { day: 15, problem: 'غم و سوگ', data },
  };
  const pending = makePageAssistantTurn(base);
  assert.equal(pending.status, 'relationship_safety_confirmation_required');
  assert.match(pending.message, /هر دو نفر می‌توانند آزادانه گفت‌وگو را رد یا متوقف کنند/);

  const unsafe = makePageAssistantTurn({
    ...base,
    dailyContext: { ...base.dailyContext, relationshipSafetyResponse: 'unsafe' },
  });
  assert.equal(unsafe.status, 'relationship_safety_blocked');
  assert.match(unsafe.message, /وارد گفت‌وگوی مستقیم/);

  const safe = makePageAssistantTurn({
    ...base,
    dailyContext: { ...base.dailyContext, relationshipSafetyConfirmed: true, relationshipSafetyResponse: 'safe' },
  });
  assert.equal(safe.status, 'daily_guidance_available');
  assert.match(safe.message, /اقدام اختصاصی امروز/);
});

test('T06 non-interpersonal day-one prepared guidance does not receive an unrelated relationship gate', () => {
  const guide = GRIEF_DAILY_ASSISTANT_GUIDES[0];
  const question = guide.questions[0];
  const result = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: {
      day: 1,
      problem: 'غم و سوگ',
      data: {
        id: getCanonicalDailyRecordId('غم و سوگ', 1),
        topic_id: 'T06',
        day: 1,
        exercise: guide.exercise,
        actionText: guide.action,
      },
    },
  });
  assert.equal(result.status, 'daily_guidance_available');
  assert.match(result.message, /راهنمای روز/);
});

test('T06 28-day exercises/actions match the runtime overlay and contain no exact cross-topic duplicates', async () => {
  const overlay = JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
  const categories = overlay.categories || {};
  const griefDays = categories['غم و سوگ']?.days || [];
  assert.equal(griefDays.length, 28);
  const normalize = (value) => String(value || '').normalize('NFKC')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u200c\u200f\u200e]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();
  const griefTexts = [];
  for (const guide of GRIEF_DAILY_ASSISTANT_GUIDES) {
    const day = griefDays.find((item) => Number(item.day) === guide.day);
    assert.ok(day, 'missing T06 overlay day ' + guide.day);
    assert.equal(day.title, guide.title, 'title mismatch on T06 day ' + guide.day);
    assert.equal(day.intro, 'هدف: ' + guide.objective + '\n\nمهارت: ' + guide.skill + '\n\nچرایی تمرین: ' + guide.mechanism, 'intro mismatch on T06 day ' + guide.day);
    assert.equal(day.exercise, guide.exercise, 'exercise mismatch on T06 day ' + guide.day);
    assert.equal(day.actionText, guide.action, 'action mismatch on T06 day ' + guide.day);
    assert.equal(day.closing, 'معیار موفقیت: ' + guide.successCriterion + '\n\nپرسش بازتاب: ' + guide.reflectionQuestion + '\n\nشرط توقف/احتیاط: ' + guide.stopCondition, 'closing mismatch on T06 day ' + guide.day);
    assert.equal(day.lightExerciseText, guide.lightVersion, 'light exercise mismatch on T06 day ' + guide.day);
    assert.equal(day.lightActionText, guide.lightActionVersion, 'light action mismatch on T06 day ' + guide.day);
    assert.equal(day.progressActionText, guide.progressActionVersion, 'progress action mismatch on T06 day ' + guide.day);
    assert.equal(day.restExerciseText, guide.restVersion, 'rest exercise mismatch on T06 day ' + guide.day);
    assert.equal(day.restActionText, guide.restActionVersion, 'rest action mismatch on T06 day ' + guide.day);
    griefTexts.push({ day: guide.day, field: 'exercise', text: normalize(day.exercise) });
    griefTexts.push({ day: guide.day, field: 'action', text: normalize(day.actionText) });
  }
  const seen = new Map();
  for (const item of griefTexts) {
    assert.ok(item.text.length > 20, 'T06 daily text must be substantive');
    assert.equal(seen.has(item.text), false, 'T06 exact duplicate: ' + JSON.stringify(item));
    seen.set(item.text, item);
  }
  for (const [topic, category] of Object.entries(categories)) {
    if (topic === 'غم و سوگ') continue;
    for (const day of category.days || []) {
      for (const [field, value] of [['exercise', day.exercise], ['action', day.actionText]]) {
        const text = normalize(value);
        if (text.length <= 20) continue;
        assert.equal(seen.has(text), false,
          'T06 exact cross-topic duplicate against ' + topic + ' day ' + day.day + ' ' + field);
      }
    }
  }
});

test('T06 assistant uses separate runtime light/progress/rest actions while preserving the visible exercise and action', () => {
  const guide = GRIEF_DAILY_ASSISTANT_GUIDES[0];
  const question = guide.questions.find((item) => item.kind === 'light_version');
  const custom = {
    lightExerciseText: 'نسخه سبک تمرین اختصاصی آزمون: فقط نام فقدان را در ذهن مشخص کن.',
    lightActionText: 'نسخه سبک اقدام اختصاصی آزمون: فقط تصمیم بگیر نام فقدان خصوصی بماند.',
    progressActionText: 'نسخه پیشرفت اقدام اختصاصی آزمون: اگر مایل هستی یک جمله برای خودت بنویس.',
    restExerciseText: 'نسخه استراحت تمرین اختصاصی آزمون: امروز نام‌گذاری را کنار بگذار.',
    restActionText: 'نسخه استراحت اقدام اختصاصی آزمون: امروز درباره افشا تصمیم نگیر.',
  };
  const result = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: {
      day: 1,
      problem: 'غم و سوگ',
      data: {
        id: getCanonicalDailyRecordId('غم و سوگ', 1),
        topic_id: 'T06',
        day: 1,
        exercise: guide.exercise,
        actionText: guide.action,
        ...custom,
      },
      guidanceData: { exercise: guide.exercise, action: guide.action },
    },
  });
  assert.equal(result.status, 'daily_guidance_available');
  for (const value of Object.values(custom)) assert.ok(result.message.includes(value), 'missing runtime adaptation: ' + value);
  assert.ok(result.message.includes(guide.successCriterion));
});

test('T06 day 11 support-seeking action also requires the relationship safety check', () => {
  const guide = GRIEF_DAILY_ASSISTANT_GUIDES.find((item) => item.day === 11);
  const question = guide.questions.find((item) => item.kind === 'action_meaning');
  const result = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: {
      day: 11,
      problem: 'غم و سوگ',
      data: {
        id: getCanonicalDailyRecordId('غم و سوگ', 11),
        topic_id: 'T06',
        day: 11,
        exercise: guide.exercise,
        actionText: guide.action,
      },
    },
  });
  assert.equal(result.status, 'relationship_safety_confirmation_required');
  assert.match(result.message, /هر دو نفر می‌توانند آزادانه گفت‌وگو را رد یا متوقف کنند/);
});
