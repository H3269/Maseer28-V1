import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildContentMappingQueue } from '../scripts/generate-content-mapping-queue.mjs';
import { auditContentMappings } from '../scripts/audit-content-mappings.mjs';

const read = async (relative) => JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8'));
const [content, topics, subtopics] = await Promise.all([
  read('../public/content/path-content.json'),
  read('../public/assistant/knowledge/topics.v1.json'),
  read('../public/assistant/knowledge/subtopics.v1.json'),
]);

test('queue creates one pending record per course day without guessing subtopics', () => {
  const queue = buildContentMappingQueue({ content, topics });
  assert.equal(queue.mappings.length, 952);
  assert.equal(queue.runtime_eligible, false);
  assert.ok(queue.mappings.every((item) => item.mapping_status === 'pending_review'));
  assert.ok(queue.mappings.every((item) => item.subtopic_ids.length === 0));
});

test('queue preserves existing human review and refuses silent source replacement', () => {
  const initial = buildContentMappingQueue({ content, topics });
  const first = initial.mappings[0];
  first.mapping_status = 'in_review';
  first.review.rationale = 'بازبینی در حال انجام';
  const preserved = buildContentMappingQueue({ content, topics, existing: initial });
  assert.equal(preserved.mappings[0].mapping_status, 'in_review');
  assert.equal(preserved.mappings[0].review.rationale, 'بازبینی در حال انجام');
  const changed = structuredClone(content);
  const category = Object.values(changed.categories)[0];
  category.days[0].id = 'changed-source-id';
  assert.throws(() => buildContentMappingQueue({ content: changed, topics, existing: initial }), /manual reconciliation/);
});

test('empty review ledger reports coverage gaps without inventing approvals', () => {
  const queue = buildContentMappingQueue({ content, topics });
  const report = auditContentMappings({ content, topics, subtopics, mappingSet: { ...queue, mappings: [] } });
  assert.deepEqual(report.errors, []);
  assert.equal(report.counts.expected_source_days, 952);
  assert.equal(report.counts.missing_records, 952);
  assert.equal(report.readiness.complete_source_coverage, false);
  assert.equal(report.readiness.approved_for_runtime, false);
});

test('approved mappings require same-parent subtopic and complete review metadata', () => {
  const queue = buildContentMappingQueue({ content, topics });
  const first = queue.mappings[0];
  const validSubtopic = subtopics.subtopics.find((item) => item.topic_id === first.source_topic_id);
  first.subtopic_ids = [validSubtopic.subtopic_id];
  first.mapping_status = 'approved';
  first.review = {
    reviewer_id: 'reviewer-1',
    reviewed_at: '2026-11-01T12:00:00Z',
    rationale: 'ارتباط محتوای روز با زیرموضوع با بررسی متن کامل تأیید شد.',
    evidence_ids: ['EVIDENCE-DRAFT-01'],
  };
  const report = auditContentMappings({ content, topics, subtopics, mappingSet: queue });
  assert.ok(report.errors.length === 0, report.errors.join('\n'));
  first.subtopic_ids = [subtopics.subtopics.find((item) => item.topic_id !== first.source_topic_id).subtopic_id];
  const invalid = auditContentMappings({ content, topics, subtopics, mappingSet: queue });
  assert.ok(invalid.errors.some((item) => item.includes('another parent topic')));
});
