import fs from 'node:fs';
import { assessmentEngineTopicRuleIds } from '../src/features/assistant/assessmentEngine.js';

const EXPECTED_TOPIC_IDS = Array.from({ length: 34 }, (_, i) => `T${String(i + 1).padStart(2, '0')}`);
const EXPECTED_RULE_IDS = EXPECTED_TOPIC_IDS.filter((id) => id !== 'T34');
const CONTENT_FILES = [
  'public/assistant/content-drafts/day01-34-topic-drafts.v1.json',
  'public/assistant/content-drafts/day02-34-topic-drafts.v1.json',
  'public/assistant/content-drafts/day03-34-topic-drafts.v1.json',
  'public/assistant/content-drafts/day04-08-self-evaluation-cluster-pilot.v1.json',
];

export function validateAssessmentKnowledgeConsistency({
  topicsRegistry,
  subtopicsRegistry,
  relationsRegistry,
  topicDefinitions,
  contentDrafts,
  engineRuleIds = assessmentEngineTopicRuleIds,
}) {
  const errors = [];
  const topics = topicsRegistry?.topics ?? [];
  const subtopics = subtopicsRegistry?.subtopics ?? [];
  const relations = relationsRegistry?.relations ?? [];
  const topicIds = new Set(topics.map((item) => item.topic_id));
  const subtopicById = new Map(subtopics.map((item) => [item.subtopic_id, item]));
  const relationById = new Map(relations.map((item) => [item.relation_id, item]));

  if (JSON.stringify(topics.map((item) => item.topic_id)) !== JSON.stringify(EXPECTED_TOPIC_IDS)) {
    errors.push('canonical topic registry must contain ordered T01..T34');
  }
  if (new Set(engineRuleIds).size !== engineRuleIds.length) errors.push('engine topic rule ids must be unique');
  for (const id of engineRuleIds) {
    if (!topicIds.has(id)) errors.push(`engine rule references unknown canonical topic: ${id}`);
  }
  if (JSON.stringify([...engineRuleIds].sort()) !== JSON.stringify([...EXPECTED_RULE_IDS].sort())) {
    errors.push('engine lexical rules must cover T01..T33; T34 is the explicit clarification fallback, not a keyword classifier');
  }

  for (const topic of topics) {
    const linked = topic.subtopic_ids ?? [];
    if (linked.length !== 3) errors.push(`topic ${topic.topic_id} must link exactly three proposed subtopics`);
    for (const subtopicId of linked) {
      const item = subtopicById.get(subtopicId);
      if (!item || item.topic_id !== topic.topic_id) errors.push(`invalid topic/subtopic link: ${topic.topic_id} -> ${subtopicId}`);
    }
    for (const relationId of topic.relation_ids ?? []) {
      if (!relationById.has(relationId)) errors.push(`topic ${topic.topic_id} references missing relation ${relationId}`);
    }
    if ((topic.content_ids ?? []).length) errors.push(`unreviewed topic ${topic.topic_id} must not expose approved content ids`);
    if ((topic.safety_rule_ids ?? []).length) errors.push(`topic ${topic.topic_id} has safety rule links without an approved safety registry`);
  }

  if (subtopics.length !== 102) errors.push('canonical subtopic registry must contain 102 proposed entries');
  for (const item of subtopics) {
    if (!topicIds.has(item.topic_id)) errors.push(`subtopic ${item.subtopic_id} has unknown parent ${item.topic_id}`);
    if (item.review_status !== 'draft' || item.definition_status !== 'pending_expert_review') {
      errors.push(`subtopic ${item.subtopic_id} must remain pending expert review`);
    }
    if ((item.content_ids ?? []).length) errors.push(`unreviewed subtopic ${item.subtopic_id} must not expose approved content ids`);
    if ((item.safety_rule_ids ?? []).length) errors.push(`subtopic ${item.subtopic_id} has unapproved safety rule links`);
  }

  if (relationsRegistry?.status !== 'candidate_only_not_for_runtime') {
    errors.push('relation registry must remain candidate-only and unavailable to runtime');
  }
  for (const relation of relations) {
    if (!topicIds.has(relation.source_topic_id) || !topicIds.has(relation.target_topic_id)) {
      errors.push(`relation ${relation.relation_id} references unknown topic`);
    }
    if (relation.status !== 'candidate_unreviewed' || relation.runtime_eligible !== false ||
        relation.causal_claim !== false || (relation.evidence_ids ?? []).length) {
      errors.push(`relation ${relation.relation_id} must remain unreviewed, non-causal and runtime-ineligible`);
    }
  }

  const definitions = topicDefinitions?.definitions ?? [];
  if (definitions.length !== 34) errors.push('topic working definitions must contain 34 entries');
  for (const definition of definitions) {
    if (!topicIds.has(definition.topic_id)) errors.push(`definition references unknown topic ${definition.topic_id}`);
    if (definition.review_status !== 'pending_expert_review' || (definition.evidence_ids ?? []).length) {
      errors.push(`definition ${definition.topic_id} must remain unreviewed with no evidence ids`);
    }
  }

  let draftRecordCount = 0;
  for (const [fileIndex, file] of (contentDrafts ?? []).entries()) {
    const records = file?.records ?? [];
    draftRecordCount += records.length;
    for (const record of records) {
      const subtopic = subtopicById.get(record.subtopic_id);
      if (!topicIds.has(record.topic_id) || !subtopic || subtopic.topic_id !== record.topic_id) {
        errors.push(`draft ${record.content_id} has invalid canonical topic/subtopic mapping`);
      }
      if (record.review_status !== 'draft_pending_expert_review' || record.runtime_eligible !== false) {
        errors.push(`draft ${record.content_id} must remain blocked from runtime`);
      }
      if (record.reviewer || record.reviewed_at) errors.push(`draft ${record.content_id} has an unsubstantiated review attribution`);
    }
    if (fileIndex < 3 && records.length !== 34) errors.push(`day draft file ${fileIndex + 1} must contain 34 records`);
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      canonicalTopics: topics.length,
      engineLexicalRuleTopics: engineRuleIds.length,
      explicitFallback: 'T34',
      canonicalSubtopics: subtopics.length,
      candidateRelations: relations.length,
      draftContentRecords: draftRecordCount,
      relationsRuntimeEligible: relations.filter((item) => item.runtime_eligible === true).length,
    },
  };
}

if (process.argv[1]?.endsWith('validate-assessment-knowledge-consistency.mjs')) {
  const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
  const result = validateAssessmentKnowledgeConsistency({
    topicsRegistry: read('public/assistant/knowledge/topics.v1.json'),
    subtopicsRegistry: read('public/assistant/knowledge/subtopics.v1.json'),
    relationsRegistry: read('public/assistant/knowledge/relations.v1.json'),
    topicDefinitions: read('public/assistant/knowledge/topic-definitions-draft.v1.json'),
    contentDrafts: CONTENT_FILES.map(read),
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) throw new Error('Assessment/knowledge consistency validation failed');
}
