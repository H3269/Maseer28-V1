import test from 'node:test';
import assert from 'node:assert/strict';
import { retrieveApprovedKnowledge } from '../src/features/assistant/knowledgeGateway.js';

const approved = (overrides = {}) => ({
  schema_version: '1.0.0',
  item_id: 'K-T02-001',
  title: 'نگرانی و عدم قطعیت',
  content: 'نگرانی درباره آینده ممکن است در موقعیت‌های نامطمئن رخ دهد. این توضیح آموزشی است و تشخیص محسوب نمی‌شود.',
  topic_ids: ['T02'],
  content_type: 'education',
  source: { source_id: 'SRC-001', title: 'راهنمای آموزشی نمونه', locator: 'docs/sample-guide#section-1' },
  approval: { status: 'approved_for_assistant', reviewer_role: 'evidence_reviewer', review_record_id: 'REV-SAMPLE-001', reviewed_at: '2026-10-20T10:00:00Z', version: '1.0.0' },
  ...overrides,
});

test('draft or unreviewed knowledge is never retrieved', () => {
  const result = retrieveApprovedKnowledge({
    query: 'نگرانی درباره آینده',
    items: [approved({ approval: { status: 'draft', reviewer_role: 'evidence_reviewer', review_record_id: 'REV-SAMPLE-001', reviewed_at: '2026-10-20T10:00:00Z', version: '1.0.0' } })],
  });
  assert.equal(result.status, 'no_approved_content');
  assert.deepEqual(result.results, []);
});

test('approved content is returned with source and review attribution', () => {
  const result = retrieveApprovedKnowledge({ query: 'نگرانی آینده', items: [approved()] });
  assert.equal(result.status, 'results_found');
  assert.equal(result.results[0].source.source_id, 'SRC-001');
  assert.equal(result.results[0].approval.reviewer_role, 'evidence_reviewer');
  assert.equal(result.results[0].approval.review_record_id, 'REV-SAMPLE-001');
  assert.ok(result.results[0].excerpt.includes('تشخیص'));
});

test('topic filters prevent retrieval from unrelated topics', () => {
  const result = retrieveApprovedKnowledge({ query: 'نگرانی آینده', topicIds: ['T03'], items: [approved()] });
  assert.equal(result.status, 'no_relevant_match');
});

test('exercise content without qualified clinical approval and stop conditions is excluded', () => {
  const exercise = approved({
    content_type: 'exercise',
    approval: { status: 'approved_for_assistant', reviewer_role: 'evidence_reviewer', reviewed_at: '2026-10-20T10:00:00Z', version: '1.0.0' },
  });
  const result = retrieveApprovedKnowledge({ query: 'نگرانی', items: [exercise] });
  assert.equal(result.status, 'no_approved_content');
});

test('exercise content requiring human review is not served as a routine retrieval result', () => {
  const exercise = approved({
    content_type: 'exercise',
    safety: { level: 'human_review_required', stop_conditions: ['نیازمند بررسی انسانی'] },
    approval: { status: 'approved_for_assistant', reviewer_role: 'qualified_clinician', review_record_id: 'REV-SAMPLE-CLIN-001', reviewed_at: '2026-10-20T10:00:00Z', version: '1.0.0' },
  });
  const result = retrieveApprovedKnowledge({ query: 'نگرانی', items: [exercise] });
  assert.equal(result.status, 'no_approved_content');
});

test('invalid topic IDs and duplicate topic IDs cannot pass the approval gate', () => {
  const result = retrieveApprovedKnowledge({
    query: 'نگرانی',
    items: [approved({ topic_ids: ['T02', 'T02'] }), approved({ item_id: 'BAD', topic_ids: ['T99'] })],
  });
  assert.equal(result.status, 'no_approved_content');
});

test('empty queries and result limits are handled safely', () => {
  assert.equal(retrieveApprovedKnowledge({ query: '   ', items: [approved()] }).status, 'insufficient_query');
  const items = Array.from({ length: 8 }, (_, index) => approved({ item_id: `K-${index}`, title: `نگرانی ${index}` }));
  assert.equal(retrieveApprovedKnowledge({ query: 'نگرانی', items, limit: 100 }).results.length, 5);
});


test('invalid topic filters fail closed instead of broadening the search', () => {
  const result = retrieveApprovedKnowledge({ query: 'نگرانی', topicIds: ['T99'], items: [approved()] });
  assert.equal(result.status, 'invalid_topic_filter');
  assert.deepEqual(result.results, []);
});


test('approval without a traceable review record is rejected', () => {
  const item = approved({ approval: { status: 'approved_for_assistant', reviewer_role: 'evidence_reviewer', reviewed_at: '2026-10-20T10:00:00Z', version: '1.0.0' } });
  const result = retrieveApprovedKnowledge({ query: 'نگرانی', items: [item] });
  assert.equal(result.status, 'no_approved_content');
});
