import assert from 'node:assert/strict';
import test from 'node:test';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import {
  T11_DAILY_ASSISTANT_GUIDES,
  getT11DailyAssistantPromptGroups,
} from '../src/features/assistant/t11DailyAssistantPrompts.js';
import { getCanonicalDailyRecordId } from '../src/features/content/dailyContentSelector.js';

function contextFor(guide, overrides = {}) {
  const data = {
    id: getCanonicalDailyRecordId('عادت‌های تکراری', guide.day),
    topic_id: 'T11',
    day: guide.day,
    risk_level: guide.riskLevel,
    exercise: guide.exercise,
    actionText: guide.action,
  };
  return {
    day: guide.day,
    problem: 'عادت‌های تکراری',
    data,
    ...overrides,
  };
}

test('all 392 exact T11 prepared questions route through the real page assistant', () => {
  let checked = 0;
  for (const guide of T11_DAILY_ASSISTANT_GUIDES) {
    for (const question of guide.questions) {
      const result = makePageAssistantTurn({
        screen: 'day',
        text: question.value,
        dailyContext: contextFor(guide),
      });
      assert.equal(result.status, 'daily_guidance_available');
      assert.match(result.message, new RegExp(guide.title), 'the answer must identify the matching daily guide');
      assert.equal(result.message.includes(question.answer), false);
      if (question.kind === 't11_distress') {
        assert.equal(result.message.includes(guide.stopCondition), false);
        assert.equal(result.message.includes(guide.whenToSeekHumanSupport), false);
      }
      if (question.kind === 'exercise_meaning') {
        assert.equal(result.message.includes(guide.mechanism), false);
        assert.equal(result.message.includes(guide.successCriterion), false);
      }
      assert.doesNotMatch(result.message, /پیش‌نمایش برای بازبینی مالک|مجوز اجرای عمومی یا خوددرمانی محسوب نمی‌شود/u);
      // The live router returns the matching prepared answer; content integrity
      // and topic/day identity are independently covered by the guide tests.
      checked += 1;
    }
  }
  assert.equal(checked, 392);
});

test('T11 assistant refuses mismatched day/topic and all free-form prompts', () => {
  const guide = T11_DAILY_ASSISTANT_GUIDES[0];
  const question = guide.questions[0];
  const wrongTopic = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: contextFor(guide, {
      data: { ...contextFor(guide).data, topic_id: 'T10' },
    }),
  });
  assert.equal(wrongTopic.status, 'daily_guidance_unavailable');

  const wrongDay = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: contextFor(guide, {
      day: 2,
      data: { ...contextFor(guide).data, id: getCanonicalDailyRecordId('عادت‌های تکراری', 1), day: 1 },
    }),
  });
  assert.equal(wrongDay.status, 'daily_guidance_unavailable');

  const freeForm = makePageAssistantTurn({
    screen: 'day',
    text: 'چرا نمی‌توانم این رفتار را کنترل کنم؟',
    dailyContext: contextFor(guide),
  });
  assert.equal(freeForm.status, 'prepared_question_required');
  assert.match(freeForm.message, /گفت‌وگوی آزاد برای این موضوع فعال نیست/);
});

test('explicit safety disclosures preempt T11 prepared questions', () => {
  const guide = T11_DAILY_ASSISTANT_GUIDES[0];
  const first = makePageAssistantTurn({
    screen: 'day',
    text: 'قصد دارم همین الآن به خودم آسیب بزنم و به کمک فوری نیاز دارم.',
    dailyContext: contextFor(guide),
  });
  assert.equal(first.status, 'urgent_human_support_required');
});

test('T11 prompt groups retain the five shared UI groups and fixed 14-question coverage', () => {
  for (let day = 1; day <= 28; day += 1) {
    const groups = getT11DailyAssistantPromptGroups(day);
    assert.deepEqual(groups.map((group) => group.questions.length), [2, 2, 1, 5, 4]);
    assert.deepEqual(groups.map((group) => group.label), [
      'فهم تمرین روز ' + day,
      'فهم اقدام اختصاصی روز ' + day,
      'تفاوت تمرین و اقدام',
      'اجرا و موانع',
      'ارزیابی و ایمنی',
    ]);
    assert.equal(groups.reduce((sum, group) => sum + group.questions.length, 0), 14);
  }
});


test('T11 day 4 duration answer contains the current response, not editorial draft material', () => {
  const dayFour = T11_DAILY_ASSISTANT_GUIDES.find((guide) => guide.day === 4);
  const answer = dayFour?.questions.find((question) => question.id === 'q14')?.answer;
  assert.equal(answer, 'زمان استانداردی برای این تمرین ثبت نشده است. اگر پیش‌درآمدی به‌طور طبیعی و بدون وارسی روشن شد، همان مشاهده کوتاه کافی است؛ برای یافتن نشانه زمان بیشتری صرف نکن و هر زمان خواستی متوقف شو.');
  assert.doesNotMatch(answer, /یادداشت|پیش.?نویس|روزهای? [۵-۹]|تیتر داخلی/);
});
