import test from 'node:test';
import assert from 'node:assert/strict';

import { getLatestValidationRun } from '../scripts/assert-validation-run.mjs';

const successful = {
  id: 10,
  head_sha: 'abc123',
  head_branch: 'main',
  event: 'push',
  created_at: '2026-11-02T10:00:00Z',
  run_attempt: 1,
  status: 'completed',
  conclusion: 'success',
};

test('validation gate selects the latest run for the exact main commit', () => {
  const olderSuccess = { ...successful };
  const newerFailure = {
    ...successful,
    id: 11,
    created_at: '2026-11-02T11:00:00Z',
    status: 'completed',
    conclusion: 'failure',
  };

  assert.equal(
    getLatestValidationRun([newerFailure, olderSuccess], 'abc123').id,
    newerFailure.id,
  );
});

test('a successful older run cannot override a newer failed run', () => {
  const latest = getLatestValidationRun([
    successful,
    { ...successful, id: 12, created_at: '2026-11-02T11:00:00Z', conclusion: 'failure' },
  ], 'abc123');

  assert.equal(latest.conclusion, 'failure');
});

test('latest rerun attempt wins when timestamps are equal', () => {
  const latestAttempt = { ...successful, id: 13, run_attempt: 2, conclusion: 'failure' };
  assert.equal(
    getLatestValidationRun([successful, latestAttempt], 'abc123').id,
    latestAttempt.id,
  );
});

test('validation gate ignores other commits, branches and event types', () => {
  const unrelated = [
    { ...successful, head_sha: 'other' },
    { ...successful, head_branch: 'feature' },
    { ...successful, event: 'workflow_dispatch' },
  ];
  assert.equal(getLatestValidationRun(unrelated, 'abc123'), null);
});

test('no matching validation run fails closed', () => {
  assert.equal(getLatestValidationRun([], 'abc123'), null);
});

test('an in-progress latest validation remains ineligible', () => {
  const latest = getLatestValidationRun([
    successful,
    { ...successful, id: 14, created_at: '2026-11-02T11:00:00Z', status: 'in_progress', conclusion: null },
  ], 'abc123');
  assert.equal(latest.status, 'in_progress');
  assert.notEqual(latest.conclusion, 'success');
});
