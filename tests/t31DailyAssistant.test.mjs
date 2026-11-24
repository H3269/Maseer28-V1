import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mergeDailyTextOverrides } from '../src/features/content/dailyTextOverrides.js';
import { getControlContextForDay, getDailySafetyMode } from '../src/features/content/dailySafety.js';
import {
  buildSharedDailyAssistantAnswerFromDailyContent,
  getSharedDailyAssistantPromptGroups,
} from '../src/features/assistant/sharedDailyAssistantEngine.js';

const TOPIC_ID = 'T31';
const TOPIC_NAME = 'کنترل‌گری';
const canonicalContent = JSON.parse(await readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8'));
const overrides = JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
const mergedContent = mergeDailyTextOverrides(canonicalContent, overrides);
const categoryEntry = Object.entries(mergedContent.categories || {}).find(([name, category]) =>
  name === TOPIC_NAME || category.days?.some((day) => day.topic_id === TOPIC_ID || /^کنترل‌گری-[0-9]{1,2}$/u.test(String(day.id || ''))),
);
assert.ok(categoryEntry, 'canonical content must contain the T31 category');
const t31Days = categoryEntry[1].days;

test('T31 has 28 canonical daily records with usable exercise/action source content', () => {
  assert.equal(t31Days.length, 28);
  for (const [index, day] of t31Days.entries()) {
    assert.equal(Number(day.day), index + 1, 'T31 day sequence must be complete and ordered');
    assert.ok(typeof day.id === 'string' && day.id.trim(), 'T31 day ' + (index + 1) + ' must have a stable source id');
    assert.ok(!day.topic_id || day.topic_id === TOPIC_ID, 'T31 day ' + (index + 1) + ' must not carry another topic identity');
    assert.ok(String(day.exercise || day.instructions || '').trim(), 'T31 day ' + (index + 1) + ' must have its own exercise');
    assert.ok(String(day.actionText || day.action || '').trim(), 'T31 day ' + (index + 1) + ' must have its own action');
  }
});

test('T31 exposes 392 day-grounded prepared answers; only urgent records are blocked', () => {
  let answerCount = 0;
  const metadataCoverage = {
    risk_level: 0,
    safety_rule_ids: 0,
    stop_conditions: 0,
    contraindications: 0,
    human_support: 0,
    rest_option: 0,
    complete_context: 0,
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
        assert.match(answer, /جایگزین کم‌خطر فعلی/u);
      }
    } else if (!getControlContextForDay(day)) {
      assert.ok(answers.every((answer) => answer.includes('یادداشت صحت محتوا')),
        'an incomplete control context must be reported while the daily guide remains available');
    }
  }

  assert.ok(answerCount >= 14, 'non-urgent T31 days must expose prepared answers');
  process.stdout.write('T31 safety metadata coverage: ' + JSON.stringify(metadataCoverage) + '; generated answers: ' + answerCount + '\\n');
});
