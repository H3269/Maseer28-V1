import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  validateAssessmentKnowledgeConsistency,
} from '../scripts/validate-assessment-knowledge-consistency.mjs';

const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const fixture = () => ({
  topicsRegistry: read('public/assistant/knowledge/topics.v1.json'),
  subtopicsRegistry: read('public/assistant/knowledge/subtopics.v1.json'),
  relationsRegistry: read('public/assistant/knowledge/relations.v1.json'),
  topicDefinitions: read('public/assistant/knowledge/topic-definitions-draft.v1.json'),
  contentDrafts: [
    read('public/assistant/content-drafts/day01-34-topic-drafts.v1.json'),
    read('public/assistant/content-drafts/day02-34-topic-drafts.v1.json'),
    read('public/assistant/content-drafts/day03-34-topic-drafts.v1.json'),
    read('public/assistant/content-drafts/day04-08-self-evaluation-cluster-pilot.v1.json'),
  ],
});

test('assessment lexical topic rules remain aligned with the canonical 34-topic registry', () => {
  const result = validateAssessmentKnowledgeConsistency(fixture());
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.equal(result.summary.canonicalTopics, 34);
  assert.equal(result.summary.engineLexicalRuleTopics, 33);
  assert.equal(result.summary.explicitFallback, 'T34');
  assert.equal(result.summary.relationsRuntimeEligible, 0);
});

test('unknown engine rule ids are rejected', () => {
  const data = fixture();
  const result = validateAssessmentKnowledgeConsistency({
    ...data,
    engineRuleIds: [...Array.from({ length: 33 }, (_, i) => `T${String(i + 1).padStart(2, '0')}`), 'T99'],
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('unknown canonical topic: T99')));
});

test('candidate relation cannot silently become runtime eligible', () => {
  const data = fixture();
  data.relationsRegistry.relations[0].runtime_eligible = true;
  const result = validateAssessmentKnowledgeConsistency(data);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('must remain unreviewed')));
});

test('draft content cannot point to a subtopic owned by another topic', () => {
  const data = fixture();
  data.contentDrafts[0].records[0].subtopic_id = 'T19-S01';
  const result = validateAssessmentKnowledgeConsistency(data);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('invalid canonical topic/subtopic mapping')));
});
