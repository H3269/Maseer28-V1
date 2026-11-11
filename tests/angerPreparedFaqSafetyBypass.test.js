import assert from 'node:assert/strict';
import test from 'node:test';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import { ANGER_DAILY_ASSISTANT_GUIDES } from '../src/features/assistant/angerDailyAssistantPrompts.js';
import { getCanonicalDailyRecordId } from '../src/features/content/dailyContentSelector.js';

test('all exact prepared anger FAQs answer on all 28 days despite daily review and relationship gates', () => {
  let checked = 0;
  for (const guide of ANGER_DAILY_ASSISTANT_GUIDES) {
    assert.equal(guide.day >= 1 && guide.day <= 28, true);
    for (const question of guide.questions) {
      const result = makePageAssistantTurn({
        screen: 'day',
        text: question.value,
        dailyContext: {
          day: guide.day,
          problem: 'خشم',
          data: {
            id: getCanonicalDailyRecordId('خشم', guide.day),
            topic_id: 'T01',
            day: guide.day,
            review_status: 'pending_expert_review',
            risk_level: 'routine',
          },
          relationshipSafetyConfirmed: false,
        },
      });
      assert.equal(result.status, 'daily_guidance_available',
        `prepared FAQ must answer for day ${guide.day}: ${question.id}`);
      assert.ok(result.message && result.message.length > 0);
      assert.doesNotMatch(result.message, /نیاز به بازبینی ایمنی|بررسی ایمنی همین روز/u);
      checked += 1;
    }
  }
  assert.equal(ANGER_DAILY_ASSISTANT_GUIDES.length, 28);
  assert.equal(checked, 392);
});

test('prepared anger FAQ bypass does not accept a mismatched topic/day identity', () => {
  const question = ANGER_DAILY_ASSISTANT_GUIDES[0].questions[0];
  const wrongTopic = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: {
      day: 1,
      problem: 'خشم',
      data: { id: getCanonicalDailyRecordId('اضطراب', 1), topic_id: 'T02', day: 1, review_status: 'pending_expert_review', risk_level: 'routine' },
    },
  });
  assert.equal(wrongTopic.status, 'daily_guidance_unavailable');

  const wrongDay = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: {
      day: 1,
      problem: 'خشم',
      data: { id: getCanonicalDailyRecordId('خشم', 2), topic_id: 'T01', day: 2, review_status: 'pending_expert_review', risk_level: 'routine' },
    },
  });
  assert.equal(wrongDay.status, 'daily_guidance_unavailable');
});

test('out-of-list anger questions are refused even when daily review metadata is present', () => {
  const result = makePageAssistantTurn({
    screen: 'day',
    text: 'چرا از یک نفر متنفرم؟',
    dailyContext: {
      day: 1,
      problem: 'خشم',
      data: {
        id: getCanonicalDailyRecordId('خشم', 1),
        topic_id: 'T01',
        day: 1,
        review_status: 'pending_expert_review',
        risk_level: 'high',
      },
      relationshipSafetyConfirmed: false,
      guidanceData: {
        exercise: 'تمرین ساختاریافته روز اول',
        action: 'اقدام ساختاریافته روز اول',
      },
    },
  });
  assert.equal(result.status, 'prepared_question_required');
  assert.match(result.message, /گفت‌وگوی آزاد برای این موضوع فعال نیست/);
});

test('exact prepared anger FAQs are independent of daily safety and review gate states', () => {
  const question = ANGER_DAILY_ASSISTANT_GUIDES[0].questions[0];
  const states = [
    { review_status: 'pending_expert_review', risk_level: 'routine' },
    { review_status: 'pending_expert_review', risk_level: 'high' },
    { review_status: 'pending_expert_review', risk_level: 'caution' },
    { review_status: 'pending_expert_review', risk_level: 'unknown' },
    { review_status: 'pending_expert_review' },
    { review_status: 'blocked', risk_level: 'high' },
    { review_status: 'approved', risk_level: 'routine' },
  ];
  for (const state of states) {
    const result = makePageAssistantTurn({
      screen: 'day',
      text: question.value,
      dailyContext: {
        day: 1,
        problem: 'خشم',
        data: {
          id: getCanonicalDailyRecordId('خشم', 1),
          topic_id: 'T01',
          day: 1,
          ...state,
        },
        relationshipSafetyConfirmed: false,
      },
    });
    assert.equal(result.status, 'daily_guidance_available',
      `exact prepared FAQ must ignore daily gate state: ${JSON.stringify(state)}`);
    assert.ok(result.message && result.message.length > 0);
  }
});
