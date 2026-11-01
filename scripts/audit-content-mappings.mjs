import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const normalize = (value) => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();

export function auditContentMappings({ content, topics, subtopics, evidenceRegistry, mappingSet }) {
  const errors = [];
  const topicList = topics.topics ?? [];
  const subtopicList = subtopics.subtopics ?? [];
  const categoryEntries = Object.entries(content.categories ?? {});
  if (topicList.length !== 34) errors.push(`Expected 34 topics, found ${topicList.length}.`);
  if (subtopicList.length !== 102) errors.push(`Expected 102 subtopics, found ${subtopicList.length}.`);
  if (categoryEntries.length !== 34) errors.push(`Expected 34 content categories, found ${categoryEntries.length}.`);
  const topicByName = new Map();
  const topicIds = new Set();
  for (const item of topicList) {
    const name = normalize(item.name);
    if (!name || topicByName.has(name)) errors.push(`Missing or duplicate normalized topic name: ${name}`);
    if (!item.topic_id || topicIds.has(item.topic_id)) errors.push(`Missing or duplicate topic ID: ${item.topic_id}`);
    topicByName.set(name, item);
    topicIds.add(item.topic_id);
  }
  const subtopicById = new Map();
  for (const item of subtopicList) {
    if (!item.subtopic_id || subtopicById.has(item.subtopic_id)) errors.push(`Missing or duplicate subtopic ID: ${item.subtopic_id}`);
    subtopicById.set(item.subtopic_id, item);
  }
  const evidenceById = new Map();
  for (const item of evidenceRegistry?.evidence ?? []) {
    if (!item.evidence_id || evidenceById.has(item.evidence_id)) errors.push(`Missing or duplicate evidence ID: ${item.evidence_id}`);
    evidenceById.set(item.evidence_id, item);
  }
  const expected = new Map();
  const sourceContentIds = new Set();

  for (const [topicName, category] of Object.entries(content.categories ?? {})) {
    const topic = topicByName.get(normalize(topicName));
    if (!topic) {
      errors.push(`No exact topic match for content category: ${topicName}`);
      continue;
    }
    if (!Array.isArray(category.days) || category.days.length !== 28) errors.push(`Expected 28 days for category: ${topicName}`);
    for (const [index, day] of (category.days ?? []).entries()) {
      if (!day.id) errors.push(`Missing source content ID for ${topicName}, day ${index + 1}`);
      if (sourceContentIds.has(day.id)) errors.push(`Duplicate source content ID: ${day.id}`);
      sourceContentIds.add(day.id);
      const mappingId = `MAP_${topic.topic_id}_D${String(index + 1).padStart(2, '0')}`;
      expected.set(mappingId, { topic, topicName, dayNumber: index + 1, contentId: day.id });
    }
  }

  if (!Array.isArray(mappingSet?.mappings)) errors.push('Mapping set must contain a mappings array.');
  if (!['draft_review_queue_only','under_review','reviewed_not_runtime_approved'].includes(mappingSet?.status)) errors.push('Mapping set status is invalid or too permissive.');
  if (!['draft_requires_expert_review','under_review','reviewed_not_runtime_approved'].includes(evidenceRegistry?.status)) errors.push('Evidence registry status is invalid or too permissive.');
  const seen = new Set();
  const counts = { pending_review: 0, in_review: 0, approved: 0, rejected: 0 };
  for (const mapping of mappingSet.mappings ?? []) {
    const expectedRecord = expected.get(mapping.mapping_id);
    if (seen.has(mapping.mapping_id)) errors.push(`Duplicate mapping id: ${mapping.mapping_id}`);
    seen.add(mapping.mapping_id);
    if (!expectedRecord) {
      errors.push(`Unknown mapping id: ${mapping.mapping_id}`);
      continue;
    }
    if (mapping.source_topic_id !== expectedRecord.topic.topic_id ||
        mapping.source_topic_name !== expectedRecord.topicName ||
        Number(mapping.day_number) !== expectedRecord.dayNumber ||
        mapping.content_id !== expectedRecord.contentId) {
      errors.push(`Source identity mismatch: ${mapping.mapping_id}`);
    }
    if (!Object.hasOwn(counts, mapping.mapping_status)) {
      errors.push(`Invalid mapping status: ${mapping.mapping_id}`);
      continue;
    }
    counts[mapping.mapping_status] += 1;

    if (!Array.isArray(mapping.subtopic_ids) || new Set(mapping.subtopic_ids).size !== mapping.subtopic_ids.length) errors.push(`Subtopic IDs must be a unique array: ${mapping.mapping_id}`);
    for (const subtopicId of mapping.subtopic_ids ?? []) {
      const subtopic = subtopicById.get(subtopicId);
      if (!subtopic) errors.push(`Unknown subtopic ${subtopicId}: ${mapping.mapping_id}`);
      else if (subtopic.topic_id !== mapping.source_topic_id) {
        errors.push(`Subtopic belongs to another parent topic: ${mapping.mapping_id} -> ${subtopicId}`);
      }
    }

    if (mapping.mapping_status === 'approved') {
      const review = mapping.review ?? {};
      if (!(mapping.subtopic_ids ?? []).length) errors.push(`Approved mapping has no subtopic: ${mapping.mapping_id}`);
      if (!String(review.reviewer_id ?? '').trim()) errors.push(`Approved mapping lacks reviewer: ${mapping.mapping_id}`);
      if (!review.reviewed_at || Number.isNaN(Date.parse(review.reviewed_at))) errors.push(`Approved mapping lacks valid review date: ${mapping.mapping_id}`);
      if (!String(review.rationale ?? '').trim()) errors.push(`Approved mapping lacks rationale: ${mapping.mapping_id}`);
      if (!Array.isArray(review.evidence_ids) || !review.evidence_ids.length) errors.push(`Approved mapping lacks evidence IDs: ${mapping.mapping_id}`);
      if (new Set(review.evidence_ids ?? []).size !== (review.evidence_ids ?? []).length) errors.push(`Approved mapping evidence IDs must be unique: ${mapping.mapping_id}`);
      for (const evidenceId of review.evidence_ids ?? []) {
        const evidence = evidenceById.get(evidenceId);
        if (!evidence) errors.push(`Approved mapping references unknown evidence ${evidenceId}: ${mapping.mapping_id}`);
        else if (evidence.review_status !== 'approved' || !evidence.reviewer_id?.trim() || !evidence.reviewed_at || Number.isNaN(Date.parse(evidence.reviewed_at)) || !evidence.title?.trim() || !evidence.citation?.trim() || !evidence.population?.trim() || !evidence.study_type?.trim()) {
          errors.push(`Approved mapping references unapproved or untraceable evidence ${evidenceId}: ${mapping.mapping_id}`);
        }
      }
    } else if (mapping.mapping_status === 'rejected' && !String(mapping.review?.rationale ?? '').trim()) {
      errors.push(`Rejected mapping lacks rationale: ${mapping.mapping_id}`);
    }
  }

  const missing = [...expected.keys()].filter((id) => !seen.has(id));
  if (mappingSet.runtime_eligible !== false) errors.push('Mapping set must remain runtime_eligible=false.');
  if (evidenceRegistry?.runtime_eligible !== false) errors.push('Evidence registry must remain runtime_eligible=false.');
  return {
    errors,
    counts: {
      expected_source_days: expected.size,
      mapping_records: seen.size,
      missing_records: missing.length,
      ...counts,
      approved_evidence_records: [...evidenceById.values()].filter((item) => item.review_status === 'approved').length,
    },
    readiness: {
      structural_integrity: errors.length === 0,
      complete_source_coverage: missing.length === 0,
      all_records_reviewed: missing.length === 0 && counts.pending_review === 0 && counts.in_review === 0,
      evidence_registry_ready: evidenceById.size > 0 && [...evidenceById.values()].every((item) => item.review_status === 'approved'),
      approved_for_runtime: false,
    },
    missing_mapping_ids: missing,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = auditContentMappings({
    content: readJson('public/content/path-content.json'),
    topics: readJson('public/assistant/knowledge/topics.v1.json'),
    subtopics: readJson('public/assistant/knowledge/subtopics.v1.json'),
    evidenceRegistry: readJson('public/assistant/evidence/evidence.v1.json'),
    mappingSet: readJson('public/assistant/mappings/course-content-mappings.v1.json'),
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.errors.length) process.exitCode = 1;
}
