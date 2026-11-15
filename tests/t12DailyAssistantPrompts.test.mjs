import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  answerT12DailyPreparedQuestion,
  getT12DailyAssistantPromptGroups,
  T12_DAILY_ASSISTANT_GUIDES,
} from '../src/features/assistant/t12DailyAssistantPrompts.js';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import { getInterpersonalPrivacyNotice, getRelationshipSafetyGate } from '../src/features/journey/relationshipSafetyGate.js';
import { getDailySafetyMode } from '../src/features/content/dailySafety.js';
import { mergeDailyTextOverrides } from '../src/features/content/dailyTextOverrides.js';

const readJson = async (relativePath) => JSON.parse(await readFile(new URL(relativePath, import.meta.url), 'utf8'));
const topicName = 'مرزبندی و نه گفتن';
const idFor = (day) => topicName + '-' + String(day).padStart(2, '0');

test('T12 assistant catalog covers 28 days and 392 complete fixed questions', () => {
  assert.equal(T12_DAILY_ASSISTANT_GUIDES.length, 28);
  for (const [index, guide] of T12_DAILY_ASSISTANT_GUIDES.entries()) {
    assert.equal(guide.day, index + 1);
    assert.equal(guide.topicId, 'T12');
    assert.equal(guide.topic, topicName);
    assert.equal(guide.questions.length, 14);
    assert.equal(new Set(guide.questions.map((q) => q.id)).size, 14);
    assert.ok(guide.questions.every((q) => q.value === q.label && q.answer?.trim()));
    assert.ok(guide.exercise?.trim());
    assert.ok(guide.action?.trim());
    assert.ok(guide.subtopicIds.length === 1);
    assert.ok(['T12-S01', 'T12-S02', 'T12-S03'].includes(guide.subtopicIds[0]));
    assert.equal(guide.reviewStatus, 'pending_owner_review');
    assert.equal(guide.evidenceGrade, 'not_assessed');
    assert.deepEqual(guide.sourceIds, []);
  }
  assert.equal(T12_DAILY_ASSISTANT_GUIDES.reduce((sum, guide) => sum + guide.questions.length, 0), 392);
});

test('T12 question groups preserve the shared five-group UI and exact 14-question coverage', () => {
  for (let day = 1; day <= 28; day += 1) {
    const groups = getT12DailyAssistantPromptGroups(day);
    assert.equal(groups.length, 5);
    assert.equal(groups.flatMap((group) => group.questions).length, 14);
    assert.equal(new Set(groups.flatMap((group) => group.questions.map((q) => q.value))).size, 14);
  }
  assert.deepEqual(getT12DailyAssistantPromptGroups(0), []);
  assert.deepEqual(getT12DailyAssistantPromptGroups(29), []);
});

test('T12 prepared answers require exact canonical topic/day and exact visible exercise/action', () => {
  for (const guide of T12_DAILY_ASSISTANT_GUIDES) {
    const dailyContent = {
      id: idFor(guide.day),
      day: guide.day,
      topic_id: 'T12',
      exercise: guide.exercise,
      actionText: guide.action,
    };
    for (const question of guide.questions) {
      const answer = answerT12DailyPreparedQuestion({ day: guide.day, message: question.value, dailyContent });
      assert.equal(typeof answer, 'string', 'day ' + guide.day + ' ' + question.id);
      assert.match(answer, new RegExp('راهنمای روز ' + guide.day));
    }
    assert.equal(answerT12DailyPreparedQuestion({
      day: guide.day,
      message: guide.questions[0].value,
      dailyContent: { ...dailyContent, id: idFor(guide.day === 28 ? 27 : guide.day + 1) },
    }), null);
    assert.equal(answerT12DailyPreparedQuestion({
      day: guide.day,
      message: guide.questions[0].value,
      dailyContent: { ...dailyContent, exercise: 'تمرین نامنطبق' },
    }), null);
  }
});

test('T12 page assistant routes all exact day-specific questions and rejects wrong identity', () => {
  for (const guide of T12_DAILY_ASSISTANT_GUIDES) {
    const id = idFor(guide.day);
    const source = { id, day: guide.day, topic_id: 'T12' };
    const guidanceData = {
      id,
      day: guide.day,
      topic_id: 'T12',
      exercise: guide.exercise,
      action: 'برای مسئله «مرزبندی و نه گفتن»، ' + guide.action,
    };
    for (const question of guide.questions) {
      const result = makePageAssistantTurn({
        screen: 'day',
        text: question.value,
        dailyContext: {
          day: guide.day,
          problem: topicName,
          data: source,
          guidanceData,
          relationshipSafetyConfirmed: [6, 11, 15, 24, 25].includes(guide.day),
        },
      });
      assert.equal(result.status, 'daily_guidance_available', 'day ' + guide.day + ' ' + question.id);
      assert.match(result.message, new RegExp('راهنمای روز ' + guide.day));
    }
  }
  const wrong = makePageAssistantTurn({
    screen: 'day',
    text: T12_DAILY_ASSISTANT_GUIDES[0].questions[0].value,
    dailyContext: {
      day: 1,
      problem: topicName,
      data: { id: idFor(2), day: 1, topic_id: 'T12' },
      guidanceData: { id: idFor(2), day: 1, topic_id: 'T12' },
    },
  });
  assert.equal(wrong.status, 'daily_guidance_unavailable');
});

test('T12 relationship gate covers the four communication days and the day-25 safety-planning day', () => {
  for (const day of [6, 11, 15, 24, 25]) {
    const record = { id: idFor(day), day, topic_id: 'T12' };
    assert.ok(getRelationshipSafetyGate(record), 'day ' + day);
    const blocked = makePageAssistantTurn({
      screen: 'day',
      text: T12_DAILY_ASSISTANT_GUIDES[day - 1].questions[0].value,
      dailyContext: { day, problem: topicName, data: record, guidanceData: record },
    });
    assert.equal(blocked.status, 'relationship_safety_confirmation_required');
  }
  const day25 = { id: idFor(25), day: 25, topic_id: 'T12' };
  assert.match(getInterpersonalPrivacyNotice(day25), /ذخیره|نظارت/u);
});

test('T12 safety answers use the topic-specific safety notice, not the generic clinic promotion', () => {
  for (const guide of T12_DAILY_ASSISTANT_GUIDES) {
    for (const id of ['q07', 'q11', 'q12']) {
      const question = guide.questions.find((q) => q.id === id);
      const answer = answerT12DailyPreparedQuestion({
        day: guide.day,
        message: question.value,
        dailyContent: {
          id: idFor(guide.day), day: guide.day, topic_id: 'T12',
          exercise: guide.exercise, actionText: guide.action,
        },
      });
      assert.match(answer, /ایمنی|حمایت/u);
      assert.doesNotMatch(answer, /مرکز هیپنوتراپی شفا/u);
    }
  }
});

test('T12 runtime overlay carries proposed metadata but remains blocked pending review', async () => {
  const [base, overrides, guide] = await Promise.all([
    readJson('../public/content/path-content.json'),
    readJson('../public/content/daily-text-overrides.v1.json'),
    readJson('../src/features/assistant/t12DailyAssistantGuide.v1.json'),
  ]);
  const merged = mergeDailyTextOverrides(base, overrides);
  const category = merged.categories[topicName];
  assert.equal(category.days.length, 28);
  for (const day of category.days) {
    const record = guide.records[day.day - 1];
    assert.equal(day.review_status, 'pending_owner_review');
    assert.deepEqual(day.subtopic_ids, [record.subtopicId]);
    assert.equal(day.evidence_grade, 'not_assessed');
    assert.deepEqual(day.source_ids, []);
    assert.equal(getDailySafetyMode(day), 'blocked');
    if (record.subtopicId === 'T12-S03') {
      assert.equal(day.risk_level, 'caution');
      assert.deepEqual(day.safety_rule_ids, ['SR-T12-RELATIONSHIP-SAFETY']);
    }
  }
});
