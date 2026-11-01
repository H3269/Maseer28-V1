import test from 'node:test';
import assert from 'node:assert/strict';

import {
  burdenScoreFromAnswers,
  defaultJourneyState,
  nextRequiredDay,
  sanitizeJourneyState,
  validName,
  validPhone,
  validScore,
} from '../src/features/journey/journeyStore.js';

test('validScore accepts integer scores from 0 through 10, including Persian digits', () => {
  assert.equal(validScore(0), true);
  assert.equal(validScore('۱۰'), true);
  assert.equal(validScore(' 7 '), true);
  assert.equal(validScore(10), true);
  for (const value of [null, undefined, '', '   ', 'abc', '1.5', '-1', '11', '1e1']) {
    assert.equal(validScore(value), false, `expected ${String(value)} to be rejected`);
  }
});

test('profile validators accept expected Persian values and reject malformed input', () => {
  assert.equal(validName('حسن عبادی'), true);
  assert.equal(validName('A Hassan'), false);
  assert.equal(validPhone('۰۹۱۲۳۴۵۶۷۸۹'), true);
  assert.equal(validPhone('0912345678'), false);
  assert.equal(validPhone(''), false);
});

test('burden score uses only the first four burden questions', () => {
  assert.equal(burdenScoreFromAnswers([4, 4, 4, 4, 0]), 10);
  assert.equal(burdenScoreFromAnswers([0, 0, 0, 0, 4]), 0);
  assert.equal(burdenScoreFromAnswers([1, 1, 1, 1]), 3);
  assert.equal(burdenScoreFromAnswers([1, 1, 1]), null);
});

test('nextRequiredDay returns the first incomplete sequential day', () => {
  assert.equal(nextRequiredDay(defaultJourneyState()), 1);
  assert.equal(nextRequiredDay({ completed: [1, 2, 3] }), 4);
  assert.equal(nextRequiredDay({ completed: Array.from({ length: 28 }, (_, i) => i + 1) }), 29);
});

test('sanitizeJourneyState keeps completed days contiguous and unique', () => {
  const state = sanitizeJourneyState({ completed: [1, 2, 4, 3, 3, 29, 0] });
  assert.deepEqual(state.completed, [1, 2, 3, 4]);

  const gap = sanitizeJourneyState({ completed: [1, 2, 4] });
  assert.deepEqual(gap.completed, [1, 2]);
});

test('sanitizeJourneyState drops invalid answer keys and truncates free text', () => {
  const longText = 'الف'.repeat(3100);
  const state = sanitizeJourneyState({
    answers: { 1: longText, 29: 'خارج از محدوده', bad: 'نامعتبر' },
  });
  assert.equal(state.answers[1].length, 3000);
  assert.equal(state.answers[29], undefined);
  assert.equal(state.answers.bad, undefined);
});

test('sanitizeJourneyState does not invent a zero score when score is missing', () => {
  const state = sanitizeJourneyState({
    daily: { 1: { feedback: 'better' }, 2: { score: '' } },
    assessment: true,
    assessmentData: {},
    final: { completedAt: '2026-01-01T00:00:00.000Z' },
  });

  assert.equal(state.daily[1].score, undefined);
  assert.equal(state.daily[2], undefined);
  assert.equal(state.assessmentData, null);
  assert.equal(state.assessment, false);
  assert.equal(state.final, null);
});

test('sanitizeJourneyState normalizes valid five-item assessment answers', () => {
  const state = sanitizeJourneyState({
    assessmentData: { answers: [0, 1, 2, 3, 4] },
  });
  assert.equal(state.assessmentData.total, 6);
  assert.equal(state.assessmentData.score, 4);
  assert.equal(state.assessmentData.motivation, 4);
  assert.equal(state.assessment, true);
});

test('sanitizeJourneyState limits archive retention to twenty entries', () => {
  const archive = Array.from({ length: 25 }, (_, index) => ({ pathId: String(index) }));
  const state = sanitizeJourneyState({ archive });
  assert.equal(state.archive.length, 20);
});
