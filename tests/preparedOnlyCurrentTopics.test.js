import test from 'node:test';
import assert from 'node:assert/strict';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import { getCanonicalDailyRecordId } from '../src/features/content/dailyContentSelector.js';
import { ANGER_DAILY_ASSISTANT_GUIDES, getAngerDailyAssistantPromptGroups } from '../src/features/assistant/angerDailyAssistantPrompts.js';
import { ANXIETY_DAILY_ASSISTANT_GUIDES, getAnxietyDailyAssistantPromptGroups } from '../src/features/assistant/anxietyDailyAssistantPrompts.js';
import { FEAR_DAILY_ASSISTANT_GUIDES, getFearDailyAssistantPromptGroups } from '../src/features/assistant/fearDailyAssistantPrompts.js';
import { HATRED_DAILY_ASSISTANT_GUIDES, getHatredDailyAssistantPromptGroups } from '../src/features/assistant/hatredDailyAssistantPrompts.js';

const topics = [
  { name: 'خشم', id: 'T01', guides: ANGER_DAILY_ASSISTANT_GUIDES, groups: getAngerDailyAssistantPromptGroups },
  { name: 'اضطراب', id: 'T02', guides: ANXIETY_DAILY_ASSISTANT_GUIDES, groups: getAnxietyDailyAssistantPromptGroups },
  { name: 'ترس', id: 'T03', guides: FEAR_DAILY_ASSISTANT_GUIDES, groups: getFearDailyAssistantPromptGroups },
  { name: 'نفرت', id: 'T04', guides: HATRED_DAILY_ASSISTANT_GUIDES, groups: getHatredDailyAssistantPromptGroups },
];

function contextFor(topic) {
  const guide = topic.guides[0];
  return {
    day: 1,
    problem: topic.name,
    data: {
      id: getCanonicalDailyRecordId(topic.name, 1),
      topic_id: topic.id,
      day: 1,
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
    assert.equal(prepared.status, 'daily_guidance_available');
    assert.match(prepared.message, /راهنمای روز/);

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
