import test from 'node:test';
import assert from 'node:assert/strict';
import { getSupportSeekingReviewDays } from '../scripts/lib/supportSeekingReviewQueue.js';

test('support-seeking audit queue selects only shared legacy days and the T02 message day', () => {
  assert.deepEqual(getSupportSeekingReviewDays('T01'), []);
  assert.deepEqual(getSupportSeekingReviewDays('T02'), [24]);
  assert.deepEqual(getSupportSeekingReviewDays('T03'), [12, 18]);
  assert.deepEqual(getSupportSeekingReviewDays('T17'), [12, 18]);
  assert.deepEqual(getSupportSeekingReviewDays('T31'), [12, 18]);
  assert.deepEqual(getSupportSeekingReviewDays('T34'), [12, 18]);
  assert.deepEqual(getSupportSeekingReviewDays('T35'), []);
  assert.deepEqual(getSupportSeekingReviewDays('unknown'), []);
});
