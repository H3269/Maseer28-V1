import assert from 'node:assert/strict';
import test from 'node:test';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import { getDailySafetyMode } from '../src/features/content/dailySafety.js';

const QUESTION = 'منظور از تمرین امروز چیست؟';

function makeDailyRecord({ topicId, topic, day = 1, riskLevel, subtopicIds = [], safetyRuleIds = [] }) {
  return {
    id: topic + '-' + String(day).padStart(2, '0'),
    topic_id: topicId,
    day,
    title: 'تمرین روز ' + day,
    exercise: 'یک مشاهده مشخص و محدود را درباره موضوع امروز ثبت کن.',
    actionText: 'در فرصت مناسب یک اقدام کوچک و امن را انتخاب کن.',
    risk_level: riskLevel,
    subtopic_ids: subtopicIds,
    safety_rule_ids: safetyRuleIds,
  };
}

const BLOCKED_CASES = [
  {
    topicId: 'T01', topic: 'خشم', day: 1, riskLevel: 'urgent_support_required',
    reason: 'generic urgent risk must block older topics too',
  },
  {
    topicId: 'T02', topic: 'اضطراب', day: 1, riskLevel: 'high',
    reason: 'generic high risk must block older topics too',
  },
  {
    topicId: 'T03', topic: 'ترس', day: 14, riskLevel: 'routine', subtopicIds: ['T03-S01'],
    reason: 'T03 day 14 requires explicit caution and safety rules',
  },
  {
    topicId: 'T10', topic: 'بی‌خوابی و مشکلات خواب', day: 3,
    riskLevel: 'caution', subtopicIds: ['T10-S03'],
    reason: 'T10 sleep-safety subtype requires caution plus safety rules',
  },
  {
    topicId: 'T12', topic: 'مرزبندی و نه گفتن', day: 6,
    riskLevel: 'routine', subtopicIds: ['T12-S03'],
    reason: 'T12 safety-focused boundary subtype must not fall through',
  },
];

test('a blocked daily safety classification prevents prepared answers for every topic family', () => {
  for (const scenario of BLOCKED_CASES) {
    const data = makeDailyRecord(scenario);
    assert.equal(getDailySafetyMode(data), 'blocked', scenario.reason);
    const result = makePageAssistantTurn({
      screen: 'day',
      text: QUESTION,
      dailyContext: {
        day: scenario.day,
        problem: scenario.topic,
        data,
        relationshipSafetyConfirmed: true,
      },
    });
    assert.equal(result.status, 'daily_guidance_unavailable', scenario.reason);
    assert.match(result.message, /سطح خطر ثبت‌شده/u, scenario.reason);
  }
});

test('a caution day with its required safety metadata remains available when no separate gate is pending', () => {
  const data = makeDailyRecord({
    topicId: 'T10',
    topic: 'بی‌خوابی و مشکلات خواب',
    day: 3,
    riskLevel: 'caution',
    subtopicIds: ['T10-S03'],
    safetyRuleIds: ['SR-T10-SLEEP'],
  });
  assert.equal(getDailySafetyMode(data), 'caution');
  const result = makePageAssistantTurn({
    screen: 'day',
    text: QUESTION,
    dailyContext: {
      day: 3,
      problem: 'بی‌خوابی و مشکلات خواب',
      data,
      relationshipSafetyConfirmed: true,
    },
  });
  assert.equal(result.status, 'daily_guidance_available');
  assert.ok(result.message.includes(data.exercise));
});
