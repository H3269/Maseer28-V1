import assert from 'node:assert/strict';
import test from 'node:test';
import { formatAssistantMessageText } from '../src/features/assistant/assistantMessageFormatting.js';
import { DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN } from '../src/features/assistant/dailyAssistantSafetyReminder.js';
import { ANGER_DAILY_ASSISTANT_GUIDES, answerAngerDailyPreparedQuestion } from '../src/features/assistant/angerDailyAssistantPrompts.js';
import { ANXIETY_DAILY_ASSISTANT_GUIDES, answerAnxietyDailyPreparedQuestion } from '../src/features/assistant/anxietyDailyAssistantPrompts.js';
import { FEAR_DAILY_ASSISTANT_GUIDES, answerFearDailyPreparedQuestion } from '../src/features/assistant/fearDailyAssistantPrompts.js';
import { HATRED_DAILY_ASSISTANT_GUIDES, answerHatredDailyPreparedQuestion } from '../src/features/assistant/hatredDailyAssistantPrompts.js';
import { JEALOUSY_DAILY_ASSISTANT_GUIDES, answerJealousyDailyPreparedQuestion } from '../src/features/assistant/jealousyDailyAssistantPrompts.js';
import { GRIEF_DAILY_ASSISTANT_GUIDES, answerGriefDailyPreparedQuestion } from '../src/features/assistant/griefDailyAssistantPrompts.js';

test('all 2,352 prepared answers across T01-T06 render without raw markdown or escaped newline tokens', () => {
  const topics = [
    { id: 'T01', guides: ANGER_DAILY_ASSISTANT_GUIDES, answer: (guide, question) =>
      answerAngerDailyPreparedQuestion({ day: guide.day, message: question.value }) },
    { id: 'T02', guides: ANXIETY_DAILY_ASSISTANT_GUIDES, answer: (guide, question) =>
      answerAnxietyDailyPreparedQuestion({ day: guide.day, message: question.value, dailyContent: { exercise: guide.exercise, actionText: guide.action } }) },
    { id: 'T03', guides: FEAR_DAILY_ASSISTANT_GUIDES, answer: (guide, question) =>
      answerFearDailyPreparedQuestion({ day: guide.day, message: question.value, dailyContent: { exercise: guide.exercise, actionText: guide.action } }) },
    { id: 'T04', guides: HATRED_DAILY_ASSISTANT_GUIDES, answer: (guide, question) =>
      answerHatredDailyPreparedQuestion({ day: guide.day, message: question.value, dailyContent: { exercise: guide.exercise, actionText: guide.action } }) },
    { id: 'T05', guides: JEALOUSY_DAILY_ASSISTANT_GUIDES, answer: (guide, question) =>
      answerJealousyDailyPreparedQuestion({ day: guide.day, message: question.value, dailyContent: { exercise: guide.exercise, actionText: guide.action } }) },
    { id: 'T06', guides: GRIEF_DAILY_ASSISTANT_GUIDES, answer: (guide, question) =>
      answerGriefDailyPreparedQuestion({ day: guide.day, message: question.value, dailyContent: { exercise: guide.exercise, actionText: guide.action } }) },
  ];
  const safetyKinds = new Set(['anger_increased', 'anxiety_increased', 'fear_increased', 'hostility_increased', 'grief_increased', 'talk_other', 'success', 'stop']);
  let checked = 0;
  for (const topic of topics) {
    assert.equal(topic.guides.length, 28, topic.id);
    for (const guide of topic.guides) {
      assert.equal(guide.questions.length, 14, topic.id + ' day ' + guide.day);
      for (const question of guide.questions) {
        const answer = topic.answer(guide, question);
        assert.equal(typeof answer, 'string', topic.id + ' day ' + guide.day + ' ' + question.kind);
        const shouldShowSafetyReminder = safetyKinds.has(question.kind);
        assert.equal(answer.endsWith(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN), shouldShowSafetyReminder,
          topic.id + ' day ' + guide.day + ' ' + question.kind + ' must show the shared reminder only for the four evaluation/safety questions');
        const lines = formatAssistantMessageText(answer);
        const visibleText = lines.flat().map((part) => part.text).join('\n');
        assert.equal(visibleText.includes('**'), false, topic.id + ' raw bold markers');
        assert.equal(visibleText.includes(String.fromCharCode(92) + 'n'), false, topic.id + ' escaped newline');
        assert.ok(lines.length > 1, topic.id + ' must preserve paragraph/line breaks');
        if (shouldShowSafetyReminder) {
          assert.match(visibleText, /مرکز هیپنوتراپی شفا با شماره تماس ۰۹۱۹۰۸۸۹۰۶۲ همیشه در کل مسیر همراه شماست/);
          assert.doesNotMatch(visibleText, /گفت‌وگوی آزاد/);
        } else {
          assert.doesNotMatch(visibleText, /یادآوری مهم درباره ایمنی شما|مرکز هیپنوتراپی شفا با شماره تماس ۰۹۱۹۰۸۸۹۰۶۲/);
        }
        assert.doesNotMatch(visibleText, /(?:^|[^A-Za-z0-9])T(?:0?[1-9]|[12][0-9]|3[0-4])(?:$|[^A-Za-z0-9])/,
          topic.id + ' must not expose internal topic identifiers');
        assert.doesNotMatch(visibleText, /(?:این|در این)\s+بسته|بسته\s*T(?:0?[1-9]|[12][0-9]|3[0-4])/,
          topic.id + ' must use the actual topic name, not package terminology');
        if (topic.id === 'T06') {
          assert.match(visibleText, /قدم‌به‌قدم پیش می‌رویم/,
            topic.id + ' prepared answers must use the teacher-style introduction');
        } else if (topic.id !== 'T04') {
          assert.match(visibleText, /بیاییم قدم‌به‌قدم پیش برویم/,
            topic.id + ' prepared answers must use the teacher-style introduction');
        }
        assert.ok(lines.flat().some((part) => part.type === 'strong'), topic.id + ' bold headings must become strong spans');
        checked += 1;
      }
    }
  }
  assert.equal(checked, 2352);
});
