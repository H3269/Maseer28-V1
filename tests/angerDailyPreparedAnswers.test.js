import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANGER_DAILY_ASSISTANT_GUIDES,
  answerAngerDailyPreparedQuestion,
} from '../src/features/assistant/angerDailyAssistantPrompts.js';
import { ANGER_DAILY_PREPARED_ANSWERS } from '../src/features/assistant/angerDailyPreparedAnswers.js';
import { DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN } from '../src/features/assistant/dailyAssistantSafetyReminder.js';

const SAFETY_KINDS = new Set(['success', 'stop', 'anger_increased', 'talk_other']);

function normalizeSentence(value) {
  return String(value)
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[«»“”"'\x60]/g, '')
    .replace(/[،؛:!?؟.,()[\]{}\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

test('T01 contains 28 days and 392 individually authored prepared answers', () => {
  assert.equal(ANGER_DAILY_ASSISTANT_GUIDES.length, 28);
  assert.equal(Object.keys(ANGER_DAILY_PREPARED_ANSWERS).length, 28);

  let count = 0;
  for (const guide of ANGER_DAILY_ASSISTANT_GUIDES) {
    const dayAnswers = ANGER_DAILY_PREPARED_ANSWERS[guide.day];
    assert.ok(dayAnswers, `missing prepared bank for day ${guide.day}`);
    assert.equal(guide.questions.length, 14);
    assert.equal(Object.keys(dayAnswers).length, 14);

    for (const question of guide.questions) {
      const prepared = dayAnswers[question.id];
      assert.equal(typeof prepared, 'string', `missing ${guide.day}:${question.id}`);
      assert.ok(prepared.trim().length > 0, `empty ${guide.day}:${question.id}`);

      const answer = answerAngerDailyPreparedQuestion({ day: guide.day, message: question.value });
      assert.equal(typeof answer, 'string', `runtime answer missing for ${guide.day}:${question.id}`);
      assert.ok(answer.includes(prepared), `runtime did not use prepared answer for ${guide.day}:${question.id}`);

      const shouldHaveSafety = SAFETY_KINDS.has(question.kind);
      const reminderCount = answer.split(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN).length - 1;
      assert.equal(reminderCount, shouldHaveSafety ? 1 : 0, `safety count mismatch at ${guide.day}:${question.id}`);
      assert.equal(answer.endsWith(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN), shouldHaveSafety,
        `safety placement mismatch at ${guide.day}:${question.id}`);

      assert.doesNotMatch(answer, /(?:این|در این)\s+بسته|بسته\s*T(?:0?[1-9]|[12][0-9]|3[0-4])/);
      assert.doesNotMatch(answer, /(?:^|[^A-Za-z0-9])T(?:0?[1-9]|[12][0-9]|3[0-4])(?:$|[^A-Za-z0-9])/);

      if (question.id === 'q05') assert.ok(answer.includes(guide.lightActionVersion));
      if (question.id === 'q08') assert.ok(answer.includes(guide.restActionVersion));
      if (question.id === 'q13') assert.ok(answer.includes(guide.progressActionVersion));
      count += 1;
    }

    assert.ok(guide.lightActionVersion);
    assert.ok(guide.progressActionVersion);
    assert.ok(guide.restActionVersion);
    assert.equal(guide.metadataGaps.includes('lightActionVersion'), false);
    assert.equal(guide.metadataGaps.includes('progressActionVersion'), false);
    assert.equal(guide.metadataGaps.includes('restActionVersion'), false);

    assert.doesNotMatch(dayAnswers.q14, /تأییدشده|تأیید شده|\d+\s*(?:دقیقه|ساعت)/,
      `duration answer must not imply an approved or invented time on day ${guide.day}`);
  }
  assert.equal(count, 392);
});

test('T01 prepared answers contain no repeated non-safety sentence of 35+ normalized characters', () => {
  const occurrences = new Map();
  // This single repeated sentence is an intentional safety caveat: do not enact an example when it is unsafe or unlike the user's circumstances.
  const approvedSafetyExceptions = new Set([
    normalizeSentence('اگر شرایط زندگی تو شبیه این نمونه نیست یا گفتن و انجام‌دادن آن امن نیست، این نمونه را اجرا نکن'),
  ]);

  for (const guide of ANGER_DAILY_ASSISTANT_GUIDES) {
    for (const question of guide.questions) {
      const answer = answerAngerDailyPreparedQuestion({ day: guide.day, message: question.value })
        .replace(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN, '')
        .replace(/^راهنمای روز \d+ خشم — [^\n]+\n?/u, '');
      const sentences = answer.split(/[.!؟?؛\n]+/).map(normalizeSentence).filter((item) => item.length >= 35);
      for (const sentence of sentences) {
        if (approvedSafetyExceptions.has(sentence)) continue;
        if (!occurrences.has(sentence)) occurrences.set(sentence, []);
        occurrences.get(sentence).push(`${guide.day}:${question.id}`);
      }
    }
  }

  const duplicates = [...occurrences.entries()]
    .filter(([, locations]) => new Set(locations).size > 1);
  assert.deepEqual(duplicates, []);
});
