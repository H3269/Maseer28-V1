import assert from 'node:assert/strict';
import test from 'node:test';
import { formatAssistantMessageText } from '../src/features/assistant/assistantMessageFormatting.js';
import { ANGER_DAILY_ASSISTANT_GUIDES, answerAngerDailyPreparedQuestion } from '../src/features/assistant/angerDailyAssistantPrompts.js';
import { ANXIETY_DAILY_ASSISTANT_GUIDES, answerAnxietyDailyPreparedQuestion } from '../src/features/assistant/anxietyDailyAssistantPrompts.js';
import { FEAR_DAILY_ASSISTANT_GUIDES, answerFearDailyPreparedQuestion } from '../src/features/assistant/fearDailyAssistantPrompts.js';
import { HATRED_DAILY_ASSISTANT_GUIDES, answerHatredDailyPreparedQuestion } from '../src/features/assistant/hatredDailyAssistantPrompts.js';

test('all 1,568 prepared answers across T01-T04 render without raw markdown or escaped newline tokens', () => {
  const topics = [
    { id: 'T01', guides: ANGER_DAILY_ASSISTANT_GUIDES, answer: (guide, question) =>
      answerAngerDailyPreparedQuestion({ day: guide.day, message: question.value }) },
    { id: 'T02', guides: ANXIETY_DAILY_ASSISTANT_GUIDES, answer: (guide, question) =>
      answerAnxietyDailyPreparedQuestion({ day: guide.day, message: question.value, dailyContent: { exercise: guide.exercise, actionText: guide.action } }) },
    { id: 'T03', guides: FEAR_DAILY_ASSISTANT_GUIDES, answer: (guide, question) =>
      answerFearDailyPreparedQuestion({ day: guide.day, message: question.value, dailyContent: { exercise: guide.exercise, actionText: guide.action } }) },
    { id: 'T04', guides: HATRED_DAILY_ASSISTANT_GUIDES, answer: (guide, question) =>
      answerHatredDailyPreparedQuestion({ day: guide.day, message: question.value, dailyContent: { exercise: guide.exercise, actionText: guide.action } }) },
  ];
  let checked = 0;
  for (const topic of topics) {
    assert.equal(topic.guides.length, 28, topic.id);
    for (const guide of topic.guides) {
      assert.equal(guide.questions.length, 14, topic.id + ' day ' + guide.day);
      for (const question of guide.questions) {
        const answer = topic.answer(guide, question);
        assert.equal(typeof answer, 'string', topic.id + ' day ' + guide.day + ' ' + question.kind);
        const lines = formatAssistantMessageText(answer);
        const visibleText = lines.flat().map((part) => part.text).join('\n');
        assert.equal(visibleText.includes('**'), false, topic.id + ' raw bold markers');
        assert.equal(visibleText.includes(String.fromCharCode(92) + 'n'), false, topic.id + ' escaped newline');
        assert.ok(lines.length > 1, topic.id + ' must preserve paragraph/line breaks');
        assert.ok(lines.flat().some((part) => part.type === 'strong'), topic.id + ' bold headings must become strong spans');
        checked += 1;
      }
    }
  }
  assert.equal(checked, 1568);
});
