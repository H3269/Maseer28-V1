export function auditKnowledgeGraph({ topicsRegistry, subtopicsRegistry, relationsRegistry, definitionsRegistry }) {
  const topics = topicsRegistry.topics ?? [];
  const subtopics = subtopicsRegistry.subtopics ?? [];
  const relations = relationsRegistry.relations ?? [];
  const definitions = definitionsRegistry.definitions ?? [];
  const errors = [];
  const topicById = new Map(topics.map((item) => [item.topic_id, item]));
  const subtopicIds = new Set(subtopics.map((item) => item.subtopic_id));
  const definitionIds = new Set(definitions.map((item) => item.topic_id));

  if (topics.length !== 34) errors.push(`Expected 34 topics; found ${topics.length}.`);
  if (definitions.length !== 34) errors.push(`Expected 34 definitions; found ${definitions.length}.`);
  if (subtopics.length !== 102) errors.push(`Expected 102 subtopics; found ${subtopics.length}.`);

  for (const topic of topics) {
    if (!definitionIds.has(topic.topic_id)) errors.push(`Missing definition: ${topic.topic_id}.`);
    const linked = topic.subtopic_ids ?? [];
    const actual = subtopics.filter((item) => item.topic_id === topic.topic_id).map((item) => item.subtopic_id);
    if (linked.length !== 3 || actual.some((id) => !linked.includes(id)) || linked.some((id) => !subtopicIds.has(id))) {
      errors.push(`Invalid subtopic links: ${topic.topic_id}.`);
    }
  }

  const unique = (items, key, label) => {
    const seen = new Set();
    for (const item of items) {
      const value = item?.[key];
      if (typeof value !== 'string' || !value.trim()) errors.push(`Missing ${label}.`);
      else if (seen.has(value)) errors.push(`Duplicate ${label}: ${value}.`);
      seen.add(value);
    }
  };
  unique(topics, 'topic_id', 'topic ID');
  unique(subtopics, 'subtopic_id', 'subtopic ID');
  unique(definitions, 'topic_id', 'definition topic ID');
  unique(relations, 'relation_id', 'relation ID');
  if (topicsRegistry.registry_status !== 'draft_requires_expert_review') errors.push('Topic registry must remain draft pending expert review.');
  if (relationsRegistry.status !== 'candidate_only_not_for_runtime') errors.push('Relation registry must remain candidate-only and unavailable to runtime.');
  const expectedTopicIds = Array.from({ length: 34 }, (_, index) => `T${String(index + 1).padStart(2, '0')}`);
  if (topics.length === 34 && JSON.stringify(topics.map((item) => item.topic_id)) !== JSON.stringify(expectedTopicIds)) {
    errors.push('Topic IDs must be ordered T01 through T34.');
  }
  for (const definition of definitions) {
    if (!topicById.has(definition.topic_id)) errors.push(`Definition has unknown topic: ${definition.topic_id}.`);
    if (definition.review_status !== 'pending_expert_review') errors.push(`Definition is not pending expert review: ${definition.topic_id}.`);
    if ((definition.evidence_ids ?? []).length) errors.push(`Unreviewed definition must not claim evidence: ${definition.topic_id}.`);
  }
  for (const subtopic of subtopics) {
    if (!topicById.has(subtopic.topic_id)) errors.push(`Subtopic has unknown parent: ${subtopic.subtopic_id}.`);
    if (subtopic.review_status !== 'draft' || subtopic.definition_status !== 'pending_expert_review') {
      errors.push(`Subtopic must remain a draft: ${subtopic.subtopic_id}.`);
    }
    if ((subtopic.evidence_ids ?? []).length) errors.push(`Unreviewed subtopic must not claim evidence: ${subtopic.subtopic_id}.`);
  }

  const relationById = new Map(relations.map((item) => [item.relation_id, item]));
  for (const relation of relations) {
    const source = topicById.get(relation.source_topic_id);
    const target = topicById.get(relation.target_topic_id);
    if (!source || !target) errors.push(`Unknown relation endpoint: ${relation.relation_id}.`);
    if (source && !(source.relation_ids ?? []).includes(relation.relation_id)) errors.push(`Source link missing: ${relation.relation_id}.`);
    if (target && !(target.relation_ids ?? []).includes(relation.relation_id)) errors.push(`Target link missing: ${relation.relation_id}.`);
    if (relation.runtime_eligible !== false || relation.causal_claim !== false || relation.status !== 'candidate_unreviewed' || relation.evidence_grade !== 'not_assessed' || (relation.evidence_ids ?? []).length > 0) {
      errors.push(`Unsafe relation state: ${relation.relation_id}.`);
    }
  }
  for (const topic of topics) {
    for (const id of topic.relation_ids ?? []) if (!relationById.has(id)) errors.push(`Unknown relation reference: ${topic.topic_id} -> ${id}.`);
  }

  const orphanSubtopics = subtopics.filter((item) => !(topicById.get(item.topic_id)?.subtopic_ids ?? []).includes(item.subtopic_id));
  if (orphanSubtopics.length) errors.push(`Found ${orphanSubtopics.length} orphan subtopics.`);

  return {
    errors,
    counts: {
      topics: topics.length,
      draft_definitions: definitions.length,
      draft_subtopics: subtopics.length,
      candidate_relations: relations.length,
      topics_with_evidence_links: topics.filter((item) => (item.evidence_ids ?? []).length > 0).length,
      definitions_with_evidence: definitions.filter((item) => (item.evidence_ids ?? []).length > 0).length,
      relations_with_evidence: relations.filter((item) => (item.evidence_ids ?? []).length > 0).length,
      topics_with_content_links: topics.filter((item) => (item.content_ids ?? []).length > 0).length,
      topics_with_intervention_links: topics.filter((item) => (item.intervention_ids ?? []).length > 0).length,
      runtime_eligible_relations: relations.filter((item) => item.runtime_eligible === true).length,
      orphan_subtopics: orphanSubtopics.length,
    },
    readiness: {
      structural_integrity: errors.length === 0,
      evidence_linkage_complete: topics.every((item) => (item.evidence_ids ?? []).length > 0) &&
        definitions.every((item) => (item.evidence_ids ?? []).length > 0) &&
        relations.every((item) => (item.evidence_ids ?? []).length > 0),
      content_linkage_complete: topics.every((item) => (item.content_ids ?? []).length > 0),
      intervention_linkage_complete: topics.every((item) => (item.intervention_ids ?? []).length > 0),
      approved_for_runtime: false,
    },
  };
}
