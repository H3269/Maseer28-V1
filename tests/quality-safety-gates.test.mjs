import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateQualitySafetyGates } from '../scripts/validate-quality-safety-gates.mjs';

const read = (file) => JSON.parse(fs.readFileSync(new URL(file, import.meta.url), 'utf8'));
const fixtures = {
  policy: read('../public/assistant/quality/content-quality-safety-gates.v1.json'),
  queue: read('../public/assistant/content-drafts/952-day-redesign-queue.v1.json'),
  pilot: read('../public/assistant/content-drafts/day04-08-self-evaluation-cluster-pilot.v1.json'),
  evidence: read('../public/assistant/evidence/evidence-source-registry.v1.json')
};

test('quality and safety policy validates current draft-only pilot and 952-day queue', () => {
  const result = validateQualitySafetyGates(fixtures);
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.equal(result.summary.policy_dimensions, 8);
  assert.equal(result.summary.queue_records, 952);
  assert.equal(result.summary.pilot_records, 25);
  assert.equal(result.summary.runtime_eligible_pilot_records, 0);
});

test('validator rejects any pilot draft activated in runtime', () => {
  const pilot = structuredClone(fixtures.pilot);
  pilot.records[0].runtime_eligible = true;
  const result = validateQualitySafetyGates({ ...fixtures, pilot });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('must remain unreviewed and runtime-blocked')));
});

test('validator rejects a queue score entered before review', () => {
  const queue = structuredClone(fixtures.queue);
  queue.records[0].scores.safety_and_cautions = 4;
  const result = validateQualitySafetyGates({ ...fixtures, queue });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('scores must all remain null')));
});

test('validator rejects a runtime policy that permits expert-reviewed without approval', () => {
  const policy = structuredClone(fixtures.policy);
  policy.runtime_policy.eligible_statuses = ['expert_reviewed', 'approved'];
  const result = validateQualitySafetyGates({ ...fixtures, policy });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('runtime policy must fail closed')));
});
