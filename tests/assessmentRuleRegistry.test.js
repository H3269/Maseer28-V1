import test from 'node:test';
import assert from 'node:assert/strict';
import { assessmentTopicRuleRegistry } from '../src/features/assistant/assessmentTopicRuleRegistry.v1.js';
import { assessmentEngineMetadata, assessmentEngineTopicRuleIds } from '../src/features/assistant/assessmentEngine.js';

test('assessment engine consumes the versioned experimental registry without runtime authorization', () => {
  assert.equal(assessmentEngineMetadata.topic_rule_registry_version, assessmentTopicRuleRegistry.registry_version);
  assert.deepEqual(assessmentEngineTopicRuleIds, assessmentTopicRuleRegistry.rules.map((rule) => rule.topic_id));
  assert.equal(assessmentTopicRuleRegistry.runtime_authorization, false);
  assert.ok(assessmentTopicRuleRegistry.rules.every((rule) => rule.runtime_eligible === false));
  assert.equal(assessmentTopicRuleRegistry.clarification_fallback_topic_id, 'T34');
});
