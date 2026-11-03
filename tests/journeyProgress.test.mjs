import test from 'node:test';
import assert from 'node:assert/strict';
import { getJourneyProgressCounts } from '../src/features/journey/progress.js';

test('recorded safety skips advance the path but do not count as completed exercises', () => {
  const counts = getJourneyProgressCounts({
    completed: [1, 2, 3, 4, 5],
    daily: {
      1: { score: 4, feedback: 'same' },
      2: { status: 'skipped_safety_gate' },
      3: { score: 6, feedback: 'better' },
      4: { status: 'skipped_human_review' },
      5: { score: 5, feedback: 'same' },
    },
  });
  assert.deepEqual(counts, { recordedDays: 5, skippedDays: 2, completedExercises: 3 });
});

test('progress counting ignores duplicate and invalid day numbers', () => {
  assert.deepEqual(
    getJourneyProgressCounts({ completed: [1, 1, 29, 0, '2'], daily: { 2: { status: 'skipped_safety_gate' } } }),
    { recordedDays: 2, skippedDays: 1, completedExercises: 1 }
  );
});

test('legacy journeys without skip statuses keep their recorded days as completed exercises', () => {
  assert.deepEqual(
    getJourneyProgressCounts({ completed: [1, 2, 3], daily: { 1: { score: 3 }, 2: { score: 4 }, 3: { score: 2 } } }),
    { recordedDays: 3, skippedDays: 0, completedExercises: 3 }
  );
});
