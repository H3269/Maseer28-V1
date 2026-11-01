import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { auditKnowledgeGraph } from '../scripts/audit-knowledge-graph.mjs';

const root = new URL('../public/assistant/knowledge/', import.meta.url);
const load = async (name) => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const registries = {
  topicsRegistry: await load('topics.v1.json'),
  subtopicsRegistry: await load('subtopics.v1.json'),
  relationsRegistry: await load('relations.v1.json'),
  definitionsRegistry: await load('topic-definitions-draft.v1.json'),
};

test('knowledge graph references are structurally consistent', () => {
  const report = auditKnowledgeGraph(registries);
  assert.deepEqual(report.errors, []);
  assert.equal(report.counts.topics, 34);
  assert.equal(report.counts.draft_subtopics, 102);
  assert.equal(report.counts.candidate_relations, 40);
  assert.equal(report.counts.orphan_subtopics, 0);
});

test('unreviewed candidate relations remain excluded from runtime', () => {
  const report = auditKnowledgeGraph(registries);
  assert.equal(report.counts.runtime_eligible_relations, 0);
  assert.equal(report.readiness.approved_for_runtime, false);
});

test('missing evidence and course mappings are reported as readiness gaps, not fabricated', () => {
  const report = auditKnowledgeGraph(registries);
  assert.equal(report.counts.topics_with_evidence_links, 0);
  assert.equal(report.counts.topics_with_content_links, 0);
  assert.equal(report.counts.topics_with_intervention_links, 0);
  assert.equal(report.readiness.evidence_linkage_complete, false);
  assert.equal(report.readiness.content_linkage_complete, false);
  assert.equal(report.readiness.intervention_linkage_complete, false);
});


test('audit rejects duplicate IDs and premature evidence or runtime activation',()=>{
 const changed=structuredClone(registries);
 changed.topicsRegistry.topics[1].topic_id=changed.topicsRegistry.topics[0].topic_id;
 changed.subtopicsRegistry.subtopics[1].subtopic_id=changed.subtopicsRegistry.subtopics[0].subtopic_id;
 changed.relationsRegistry.relations[0].runtime_eligible=true;
 changed.relationsRegistry.relations[1].evidence_grade='high';
 changed.definitionsRegistry.definitions[0].evidence_ids=['EVD_UNVERIFIED'];
 const report=auditKnowledgeGraph(changed);
 assert.ok(report.errors.some(item=>item.includes('Duplicate topic ID')));
 assert.ok(report.errors.some(item=>item.includes('Duplicate subtopic ID')));
 assert.ok(report.errors.some(item=>item.includes('Unsafe relation state')));
 assert.ok(report.errors.some(item=>item.includes('must not claim evidence')));
});
