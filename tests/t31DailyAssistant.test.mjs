import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mergeDailyTextOverrides } from '../src/features/content/dailyTextOverrides.js';
import { getControlContextForDay, getDailySafetyMode } from '../src/features/content/dailySafety.js';
import {
  buildSharedDailyAssistantAnswerFromDailyContent,
  getSharedDailyAssistantPromptGroups,
} from '../src/features/assistant/sharedDailyAssistantEngine.js';
import { makeDailyAssistantTurn } from '../src/features/assistant/dailyAssistantTurn.js';
import { getRelationshipSafetyGate } from '../src/features/journey/relationshipSafetyGate.js';

const TOPIC_ID = 'T31';
const TOPIC_NAME = 'کنترل‌گری';
const canonicalContent = JSON.parse(await readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8'));
const overrides = JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
const mergedContent = mergeDailyTextOverrides(canonicalContent, overrides);
const topicRegistry = JSON.parse(await readFile(new URL('../public/assistant/knowledge/topics.v1.json', import.meta.url), 'utf8'));
const subtopicRegistry = JSON.parse(await readFile(new URL('../public/assistant/knowledge/subtopics.v1.json', import.meta.url), 'utf8'));
const t31TopicRegistry = topicRegistry.topics.find((topic) => topic.topic_id === TOPIC_ID);
const t31SubtopicRegistry = new Map(subtopicRegistry.subtopics.filter((item) => item.topic_id === TOPIC_ID).map((item) => [item.subtopic_id, item]));
const categoryEntry = Object.entries(mergedContent.categories || {}).find(([name, category]) =>
  name === TOPIC_NAME || category.days?.some((day) => day.topic_id === TOPIC_ID || /^کنترل‌گری-[0-9]{1,2}$/u.test(String(day.id || ''))),
);
assert.ok(categoryEntry, 'canonical content must contain the T31 category');
const t31Days = categoryEntry[1].days;

test('T31 has 28 canonical daily records with usable exercise/action source content', () => {
  assert.equal(t31Days.length, 28);
  assert.equal(new Set(t31Days.map((day) => day.title)).size, 28, 'T31 must have 28 distinct daily titles');
  assert.equal(new Set(t31Days.map((day) => day.exercise)).size, 28, 'T31 must have 28 distinct daily exercises');
  assert.equal(new Set(t31Days.map((day) => day.actionText)).size, 28, 'T31 must have 28 distinct daily actions');
  for (const [index, day] of t31Days.entries()) {
    assert.equal(Number(day.day), index + 1, 'T31 day sequence must be complete and ordered');
    assert.ok(typeof day.id === 'string' && day.id.trim(), 'T31 day ' + (index + 1) + ' must have a stable source id');
    assert.ok(!day.topic_id || day.topic_id === TOPIC_ID, 'T31 day ' + (index + 1) + ' must not carry another topic identity');
    assert.ok(String(day.exercise || day.instructions || '').trim(), 'T31 day ' + (index + 1) + ' must have its own exercise');
    assert.ok(String(day.actionText || day.action || '').trim(), 'T31 day ' + (index + 1) + ' must have its own action');
  }
});


test('T31 elevated-risk records return safe alternatives without exposing unsafe source instructions', () => {
  const dailyContent = {
    id: 'کنترل‌گری-25',
    topic_id: 'T31',
    day: 25,
    title: 'انتخاب امن · روز 25',
    exercise: 'UNSAFE_SOURCE_EXERCISE_SENTINEL',
    actionText: 'UNSAFE_SOURCE_ACTION_SENTINEL',
    restVersion: 'امروز فقط استراحت کن و وارد تعامل نشو.',
    risk_level: 'moderate',
    subtopic_ids: ['T31-S03'],
    control_context: 'relationship_power_safety',
    safety_rule_ids: ['SR-T31-D25'],
    stop_conditions: ['در صورت تهدید یا احتمال تلافی، تعامل را متوقف کن.'],
    contraindications: ['مواجهه مستقیم در وضعیت ناامن ممنوع است.'],
    when_to_seek_human_support: 'در صورت تهدید یا خشونت، از حمایت مستقل و امن کمک بگیر.',
  };
  assert.equal(getDailySafetyMode(dailyContent), 'caution');
  const questions = getSharedDailyAssistantPromptGroups(25, TOPIC_ID).flatMap((group) => group.questions);
  const answers = questions.map((question) => buildSharedDailyAssistantAnswerFromDailyContent({
    topicId: TOPIC_ID, topicName: TOPIC_NAME, day: 25, message: question.value, dailyContent,
  }));
  assert.equal(answers.length, 14);
  for (const answer of answers) {
    assert.ok(typeof answer === 'string' && answer.length > 80);
    assert.ok(answer.includes('گزینه استراحت ثبت‌شده'));
    assert.ok(answer.includes('عنوان محتوای همین روز: انتخاب امن · روز 25'));
    assert.ok(answer.includes('مسئول اصلاح رفتار او نیستی'));
    assert.ok(answer.includes('مطالبه نکن'));
    assert.ok(answer.includes('شرط توقف ثبت‌شده'));
    assert.ok(answer.includes('زمان دریافت حمایت انسانی'));
    assert.equal(answer.includes('UNSAFE_SOURCE_EXERCISE_SENTINEL'), false);
    assert.equal(answer.includes('UNSAFE_SOURCE_ACTION_SENTINEL'), false);
  }
});


test('T31 relationship-sensitive days preserve all fourteen answers and gate only the flagged direct action', () => {
  const gatedDays = [6, 11, 15, 24];
  let checked = 0;
  for (const dayNumber of gatedDays) {
    const dailyContent = t31Days.find((day) => Number(day.day) === dayNumber);
    assert.ok(dailyContent, 'T31 relationship-sensitive day ' + dayNumber + ' must exist');
    assert.equal(Boolean(getRelationshipSafetyGate(dailyContent)), dayNumber === 11,
      'only T31 day 11 requires relationship confirmation before a direct interaction');
    const questions = getSharedDailyAssistantPromptGroups(dayNumber, TOPIC_ID).flatMap((group) => group.questions);
    assert.equal(questions.length, 14);
    for (const question of questions) {
      const turn = makeDailyAssistantTurn({
        message: question.value,
        dailyContext: {
          problem: TOPIC_NAME,
          day: dayNumber,
          data: dailyContent,
          relationshipSafetyConfirmed: false,
        },
        conversationState: null,
        inputProbe: { status: 'normal', intake: {} },
      });
      assert.equal(turn.status, 'daily_guidance_available',
        'T31 day ' + dayNumber + ' ' + question.id + ' must not be suppressed by the relationship gate');
      assert.ok(turn.message.length > 80, 'T31 day ' + dayNumber + ' ' + question.id + ' must return substantive guidance');
      const requiresDirectActionConfirmation = dailyContent.relationship_safety_action_requires_confirmation === true;
      assert.equal(requiresDirectActionConfirmation, dayNumber === 11);
      if (requiresDirectActionConfirmation) {
        assert.match(turn.message, /ایمنی تعامل مستقیم/u,
          'T31 day 11 must explain the pending interaction-safety boundary');
      }
      if (requiresDirectActionConfirmation && ['exercise_meaning', 'exercise_example', 'action_meaning', 'action_example', 'light_version', 'talk_other', 'can_change'].includes(question.kind)) {
        assert.equal(turn.message.includes(dailyContent.actionText), false,
          'T31 day 11 direct-interaction answers must use a safe alternative until safety is confirmed');
        assert.match(turn.message, /گزینه استراحت ثبت‌شده|جایگزین کم‌خطر فعلی/u);
      }
      if (!requiresDirectActionConfirmation && ['action_meaning', 'action_example'].includes(question.kind)) {
        assert.ok(turn.message.includes(dailyContent.actionText),
          'T31 day ' + dayNumber + ' safe actions must remain source-grounded rather than being over-restricted');
      }
      checked += 1;
    }
  }
  assert.equal(checked, 56, 'four gated T31 days must retain all 56 prepared answers');

  const day11 = t31Days.find((day) => Number(day.day) === 11);
  const actionQuestion = getSharedDailyAssistantPromptGroups(11, TOPIC_ID)
    .flatMap((group) => group.questions).find((question) => question.kind === 'action_meaning');
  const confirmedSafe = makeDailyAssistantTurn({
    message: actionQuestion.value,
    dailyContext: {
      problem: TOPIC_NAME, day: 11, data: day11,
      relationshipSafetyConfirmed: true, relationshipSafetyResponse: 'safe',
    },
    conversationState: null,
    inputProbe: { status: 'normal', intake: {} },
  });
  assert.equal(confirmedSafe.status, 'daily_guidance_available');
  assert.ok(confirmedSafe.message.includes(day11.actionText),
    'after affirmative safety confirmation, the source-grounded action may be explained with its safety boundaries');

  const talkQuestion = getSharedDailyAssistantPromptGroups(11, TOPIC_ID)
    .flatMap((group) => group.questions).find((question) => question.kind === 'talk_other');
  const unsafeResponse = makeDailyAssistantTurn({
    message: talkQuestion.value,
    dailyContext: {
      problem: TOPIC_NAME, day: 11, data: day11,
      relationshipSafetyConfirmed: false, relationshipSafetyResponse: 'unsafe',
    },
    conversationState: null,
    inputProbe: { status: 'normal', intake: {} },
  });
  assert.equal(unsafeResponse.status, 'daily_guidance_available',
    'an unsafe relationship response must not suppress the whole T31 guide');
  assert.match(unsafeResponse.message, /ایمنی تعامل مستقیم/u);
  assert.equal(unsafeResponse.message.includes(day11.actionText), false,
    'an unsafe relationship response must never expose a direct-interaction action');
});

test('T31 exposes 392 day-grounded prepared answers; only urgent records are blocked', () => {
  let answerCount = 0;
  let urgentDayCount = 0;
  const metadataCoverage = {
    risk_level: 0,
    safety_rule_ids: 0,
    stop_conditions: 0,
    contraindications: 0,
    human_support: 0,
    rest_option: 0,
    complete_context: 0,
    direct_action_gate: 0,
  };

  for (const day of t31Days) {
    const dayNumber = Number(day.day);
    const mode = getDailySafetyMode(day);
    assert.ok(['routine', 'caution', 'blocked'].includes(mode), 'T31 day ' + dayNumber + ' must have a recognized safety mode');
    if (day.risk_level) metadataCoverage.risk_level += 1;
    if (Array.isArray(day.safety_rule_ids) && day.safety_rule_ids.length) metadataCoverage.safety_rule_ids += 1;
    if ((Array.isArray(day.stop_conditions) && day.stop_conditions.length)
      || String(day.stopCondition || day.stop_condition_text || '').trim()) metadataCoverage.stop_conditions += 1;
    if ((Array.isArray(day.contraindications) && day.contraindications.length)
      || String(day.contraindications || '').trim()) metadataCoverage.contraindications += 1;
    if (String(day.when_to_seek_human_support || day.whenToSeekHumanSupport || '').trim()) metadataCoverage.human_support += 1;
    if (String(day.restExerciseText || day.restVersion || day.lightExerciseText || '').trim()) metadataCoverage.rest_option += 1;
    if (getControlContextForDay(day)) metadataCoverage.complete_context += 1;
    if (day.relationship_safety_action_requires_confirmation === true) metadataCoverage.direct_action_gate += 1;

    if (mode === 'blocked') {
      assert.equal(day.risk_level, 'urgent_support_required',
        'T31 day ' + dayNumber + ' may be blocked only for explicitly urgent support');
      continue;
    }

    const questions = getSharedDailyAssistantPromptGroups(dayNumber, TOPIC_ID).flatMap((group) => group.questions);
    assert.equal(questions.length, 14, 'T31 day ' + dayNumber + ' must expose fourteen prepared questions');
    const answers = questions.map((question) => buildSharedDailyAssistantAnswerFromDailyContent({
      topicId: TOPIC_ID,
      topicName: TOPIC_NAME,
      day: dayNumber,
      message: question.value,
      dailyContent: day,
    }));
    for (const [index, answer] of answers.entries()) {
      assert.ok(typeof answer === 'string' && answer.trim().length > 80,
        'T31 day ' + dayNumber + ' question ' + (index + 1) + ' must return substantive guidance');
      assert.ok(answer.includes('روز ' + dayNumber),
        'T31 day ' + dayNumber + ' question ' + (index + 1) + ' must remain grounded in the selected day');
      answerCount += 1;
    }
    assert.equal(new Set(answers).size, 14, 'T31 day ' + dayNumber + ' must not substitute one repeated answer for all questions');

    if (['high', 'moderate'].includes(day.risk_level)) {
      for (const answer of answers) {
        assert.doesNotMatch(answer, new RegExp(String(day.exercise || day.instructions || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
          'elevated-risk T31 answers must not reproduce the original exercise as an instruction');
        assert.match(answer, /گزینه استراحت ثبت‌شده|جایگزین کم‌خطر فعلی/u);
      }
      if (day.control_context === 'relationship_power_safety') {
        assert.ok(answers.every((answer) => answer.includes('مسئول اصلاح رفتار او نیستی')),
          'relationship-safety alternatives must protect people affected by coercive control');
        assert.ok(answers.every((answer) => answer.includes('مطالبه نکن')),
          'relationship-safety alternatives must not burden the affected person with reassurance');
      }
    } else if (!getControlContextForDay(day)) {
      assert.ok(answers.every((answer) => answer.includes('یادداشت صحت محتوا')),
        'an incomplete control context must be reported while the daily guide remains available');
    }
  }

  assert.equal(answerCount, (28 - urgentDayCount) * 14, 'every non-urgent T31 day must expose all fourteen prepared answers');
  assert.equal(metadataCoverage.risk_level, 28, 'all T31 days must carry an explicit risk level');
  assert.equal(metadataCoverage.safety_rule_ids, 28, 'all T31 days must link an explicit safety rule');
  assert.equal(metadataCoverage.stop_conditions, 28, 'all T31 days must define stop conditions');
  assert.equal(metadataCoverage.contraindications, 28, 'all T31 days must define contraindications');
  assert.equal(metadataCoverage.human_support, 28, 'all T31 days must define when to seek human support');
  assert.equal(metadataCoverage.rest_option, 28, 'all T31 days must retain a rest or low-demand alternative');
  assert.equal(metadataCoverage.complete_context, 28, 'all T31 days must map to exactly one validated control context');
  assert.equal(metadataCoverage.direct_action_gate, 1, 'only T31 day 11 may require confirmation before a direct interpersonal action');
  assert.equal(t31Days.find((day) => Number(day.day) === 11).relationship_safety_action_requires_confirmation, true);
  assert.ok(t31Days.filter((day) => Number(day.day) !== 11).every((day) => day.relationship_safety_action_requires_confirmation !== true));
  assert.ok(t31TopicRegistry, 'T31 must exist in the topic registry');
  assert.equal(t31SubtopicRegistry.size, 3, 'T31 must retain its three distinct safety contexts');
  assert.match(t31TopicRegistry.review_flags.join(' '), /سه زیرموضوع مجزا/u);
  assert.equal(t31TopicRegistry.safety_rule_ids.length, 28, 'T31 topic registry must link all 28 daily safety rules');
  assert.equal(new Set(t31TopicRegistry.safety_rule_ids).size, 28, 'T31 daily safety rule identifiers must be unique');
  for (const day of t31Days) {
    const ruleId = day.safety_rule_ids[0];
    const subtopic = t31SubtopicRegistry.get(day.subtopic_ids[0]);
    assert.ok(t31TopicRegistry.safety_rule_ids.includes(ruleId), 'T31 day ' + day.day + ' safety rule must be linked to its topic');
    assert.ok(subtopic?.safety_rule_ids.includes(ruleId), 'T31 day ' + day.day + ' safety rule must be linked to its exact subtopic');
  }
  process.stdout.write('T31 safety metadata coverage: ' + JSON.stringify(metadataCoverage) + '; generated answers: ' + answerCount + '\\n');
  process.stdout.write('T31 DAILY CONTENT AUDIT: ' + JSON.stringify(t31Days.map((day) => ({
    day: day.day,
    id: day.id,
    title: day.title,
    exercise: day.exercise || day.instructions || '',
    action: day.actionText || day.action || '',
    rest: day.restExerciseText || day.restVersion || '',
    restAction: day.restActionText || day.restActionVersion || '',
  }))) + '\\n');
});
