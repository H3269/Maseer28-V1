import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeJourneyState, validPathDuration } from '../src/features/journey/journeyStore.js';

test('path duration requires an explicit year and month selection', () => {
  assert.equal(validPathDuration('', ''), false);
  assert.equal(validPathDuration(undefined, 0), false);
  assert.equal(validPathDuration(0, ''), false);
  assert.equal(validPathDuration(0, 0), true);
  assert.equal(validPathDuration('۰', '۰'), true);
  assert.equal(validPathDuration(100, 11), true);
  assert.equal(validPathDuration(101, 0), false);
  assert.equal(validPathDuration(1, 12), false);
});

test('legacy path duration values without explicit confirmation remain unconfirmed', () => {
  const state = sanitizeJourneyState({
    schema: 7,
    profile: true,
    profileData: { problem: 'خشم', durationYears: 0, durationMonths: 0, goal: 'هدف' },
  });
  assert.equal(state.profileData.durationConfirmed, false);
  assert.equal(state.profileData.durationYears, '');
  assert.equal(state.profileData.durationMonths, '');
});

test('confirmed zero-year zero-month duration remains a valid explicit choice', () => {
  const state = sanitizeJourneyState({
    schema: 7,
    profile: true,
    profileData: { problem: 'خشم', durationYears: 0, durationMonths: 0, durationConfirmed: true, goal: 'هدف' },
  });
  assert.equal(state.profileData.durationConfirmed, true);
  assert.equal(state.profileData.durationYears, 0);
  assert.equal(state.profileData.durationMonths, 0);
});
