import assert from 'node:assert/strict';
import { assessmentTopicRuleRegistry as registry } from '../src/features/assistant/assessmentTopicRuleRegistry.v1.js';

const expectedIds = Array.from({ length: 33 }, (_, index) => 'T' + String(index + 1).padStart(2, '0'));
const normalize = (value) => String(value).normalize('NFKC')
  .replace(/[\u064A\u0649]/g, 'ی').replace(/\u0643/g, 'ک')
  .replace(/[\u064B-\u065F\u0670]/g, '')
  .replace(/[\u200c\u200f\u200e]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

assert.equal(registry.schema_version, '1.0.0');
assert.equal(registry.status, 'experimental_unreviewed');
assert.equal(registry.matching_method, 'normalized_substring');
assert.equal(registry.runtime_authorization, false);
assert.equal(registry.runtime_eligible, false);
assert.equal(registry.clarification_fallback_topic_id, 'T34');
assert.deepEqual(registry.rules.map((rule) => rule.topic_id), expectedIds);

for (const rule of registry.rules) {
  assert.ok(Array.isArray(rule.phrases) && rule.phrases.length > 0, rule.topic_id + ': phrases required');
  assert.equal(rule.review_status, 'pending_independent_expert_review');
  assert.equal(rule.runtime_eligible, false);
  const normalized = rule.phrases.map(normalize);
  assert.ok(normalized.every(Boolean), rule.topic_id + ': empty phrase');
  assert.equal(new Set(normalized).size, normalized.length, rule.topic_id + ': duplicate normalized phrase');
}
console.log('Assessment rule registry valid: 33 experimental topic hints; T34 remains clarification-only.');
