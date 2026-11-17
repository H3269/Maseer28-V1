import assert from 'node:assert/strict';
import test from 'node:test';
import { T12_DAILY_ASSISTANT_GUIDES, answerT12DailyPreparedQuestion } from '../src/features/assistant/t12DailyAssistantPrompts.js';
import { formatAssistantMessageText } from '../src/features/assistant/assistantMessageFormatting.js';
import { DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN } from '../src/features/assistant/dailyAssistantSafetyReminder.js';

test('all 392 T12 prepared answers use the shared T01-T11 display frame', () => {
  let checked = 0;
  for (const guide of T12_DAILY_ASSISTANT_GUIDES) {
    const dailyContent = {
      id: 'مرزبندی و نه گفتن-' + String(guide.day).padStart(2, '0'),
      topic_id: 'T12',
      day: guide.day,
      title: guide.title,
      sourceExercise: guide.exercise,
      sourceActionText: guide.action,
      exercise: guide.exercise,
      actionText: guide.action,
      lightExerciseText: guide.lightVersion,
      lightActionText: guide.lightActionVersion,
      progressActionText: guide.progressActionVersion,
      restExerciseText: guide.restVersion,
      restActionText: guide.restActionVersion,
    };
    for (const question of guide.questions) {
      const answer = answerT12DailyPreparedQuestion({
        day: guide.day,
        message: question.value,
        dailyContent,
      });
      assert.equal(typeof answer, 'string', 'day ' + guide.day + ' ' + question.kind);
      assert.ok(answer.startsWith('راهنمای روز ' + guide.day + ' مرزبندی و نه گفتن — ' + guide.title),
        'day heading must match T01-T11 daily answer convention');
      assert.match(answer, /بیاییم قدم‌به‌قدم پیش برویم/,
        'day ' + guide.day + ' ' + question.kind + ' must include the shared teacher-style introduction');
      assert.match(answer, /هدف امروز:/,
        'day ' + guide.day + ' ' + question.kind + ' must state the daily objective');
      assert.match(answer, /قرار نیست همه مسئله را یک‌باره حل کنی/,
        'day ' + guide.day + ' ' + question.kind + ' must include the shared supportive framing');
      assert.equal(answer.includes(String.fromCharCode(92) + 'n'), false, 'answer must contain real line breaks, not escaped newline tokens');
      const visible = formatAssistantMessageText(answer).flat().map((part) => part.text).join('\n');
      assert.equal(visible.includes('**'), false, 'raw Markdown markers must not reach visible text');
      assert.ok(visible.includes('هدف امروز:'), 'formatted answer must retain the shared objective');
      const requiresReminder = ['procrastination_increased', 'talk_other', 'success', 'stop'].includes(question.kind);
      assert.equal(answer.includes('یادآوری اختصاصی ایمنی و حریم خصوصی T12'), requiresReminder,
        'T12 safety-sensitive answers must use the topic-specific safety reminder');
      assert.doesNotMatch(answer, /مرکز هیپنوتراپی شفا|۰۹۱۹۰۸۸۹۰۶۲|09190889062/,
        'T12 prepared answers must not append promotional contact information');
      checked += 1;
    }
  }
  assert.equal(checked, 392);
});
