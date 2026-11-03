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

function manifestFor(item) {
  return {
    schema_version: '1.0.0',
    manifest_id: 'test-manifest',
    status: 'active',
    approved_items: [{
      item_id: item.item_id,
      review_record_id: item.approval.review_record_id,
      reviewer_role: item.approval.reviewer_role,
      reviewed_at: item.approval.reviewed_at,
      version: item.approval.version,
    }],
  };
}

function manifestForMany(items) {
  return {
    schema_version: '1.0.0',
    manifest_id: 'test-manifest-many',
    status: 'active',
    approved_items: items.map((item) => ({
      item_id: item.item_id,
      review_record_id: item.approval.review_record_id,
      reviewer_role: item.approval.reviewer_role,
      reviewed_at: item.approval.reviewed_at,
      version: item.approval.version,
    })),
  };
}

test('draft or unreviewed knowledge is never retrieved', () => {
  const result = retrieveApprovedKnowledge({
    query: 'نگرانی درباره آینده',
    items: [approved({ approval: { status: 'draft', reviewer_role: 'evidence_reviewer', review_record_id: 'REV-SAMPLE-001', reviewed_at: '2026-10-20T10:00:00Z', version: '1.0.0' } })],
  });
  assert.equal(result.status, 'no_approved_content');
  assert.deepEqual(result.results, []);
});

test('approved content is returned with source and review attribution', () => {
  const result = retrieveApprovedKnowledge({ query: 'نگرانی آینده', items: [approved()], approvalManifest: manifestFor(approved()) });
  assert.equal(result.status, 'results_found');
  assert.equal(result.results[0].source.source_id, 'SRC-001');
  assert.equal(result.results[0].approval.reviewer_role, 'evidence_reviewer');
  assert.equal(result.results[0].approval.review_record_id, 'REV-SAMPLE-001');
  assert.ok(result.results[0].excerpt.includes('تشخیص'));
});

test('topic filters prevent retrieval from unrelated topics', () => {
  const result = retrieveApprovedKnowledge({ query: 'نگرانی آینده', topicIds: ['T03'], items: [approved()], approvalManifest: manifestFor(approved()) });
  assert.equal(result.status, 'no_relevant_match');
});

test('exercise content without qualified clinical approval and stop conditions is excluded', () => {
  const exercise = approved({
    content_type: 'exercise',
    approval: { status: 'approved_for_assistant', reviewer_role: 'evidence_reviewer', reviewed_at: '2026-10-20T10:00:00Z', version: '1.0.0' },
  });
  const result = retrieveApprovedKnowledge({ query: 'نگرانی', items: [exercise], approvalManifest: manifestFor(exercise) });
  assert.equal(result.status, 'no_approved_content');
});

test('exercise content requiring human review is not served as a routine retrieval result', () => {
  const exercise = approved({
    content_type: 'exercise',
    safety: { level: 'human_review_required', stop_conditions: ['نیازمند بررسی انسانی'] },
    approval: { status: 'approved_for_assistant', reviewer_role: 'qualified_clinician', review_record_id: 'REV-SAMPLE-CLIN-001', reviewed_at: '2026-10-20T10:00:00Z', version: '1.0.0' },
  });
  const result = retrieveApprovedKnowledge({ query: 'نگرانی', items: [exercise], approvalManifest: manifestFor(exercise) });
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
  assert.equal(retrieveApprovedKnowledge({ query: '   ', items: [approved()], approvalManifest: manifestFor(approved()) }).status, 'insufficient_query');
  const items = Array.from({ length: 8 }, (_, index) => approved({ item_id: `K-${index}`, title: `نگرانی ${index}` }));
  assert.equal(retrieveApprovedKnowledge({ query: 'نگرانی', items, approvalManifest: manifestForMany(items), limit: 100 }).results.length, 5);
});


test('invalid topic filters fail closed instead of broadening the search', () => {
  const result = retrieveApprovedKnowledge({ query: 'نگرانی', topicIds: ['T99'], items: [approved()], approvalManifest: manifestFor(approved()) });
  assert.equal(result.status, 'invalid_topic_filter');
  assert.deepEqual(result.results, []);
});


test('approval without a traceable review record is rejected', () => {
  const item = approved({ approval: { status: 'approved_for_assistant', reviewer_role: 'evidence_reviewer', reviewed_at: '2026-10-20T10:00:00Z', version: '1.0.0' } });
  const result = retrieveApprovedKnowledge({ query: 'نگرانی', items: [item] });
  assert.equal(result.status, 'no_approved_content');
});


test('approved item metadata is insufficient without an active manifest allowlist', () => {
  const result = retrieveApprovedKnowledge({ query: 'نگرانی', items: [approved()] });
  assert.equal(result.status, 'no_approved_content');
});


test('empty or mismatched approval manifests fail closed', () => {
  const item = approved();
  const emptyManifest = { schema_version: '1.0.0', manifest_id: 'empty', status: 'empty_pending_external_review', approved_items: [] };
  assert.equal(retrieveApprovedKnowledge({ query: 'نگرانی', items: [item], approvalManifest: emptyManifest }).status, 'no_approved_content');
  const mismatchedManifest = manifestFor(item);
  mismatchedManifest.approved_items[0].review_record_id = 'REV-OTHER';
  assert.equal(retrieveApprovedKnowledge({ query: 'نگرانی', items: [item], approvalManifest: mismatchedManifest }).status, 'no_approved_content');
});


test('exercise retrieval requires qualified clinical review and explicit stop conditions', () => {
  const exercise = approved({
    content_type: 'exercise',
    safety: { level: 'caution', stop_conditions: ['در صورت افزایش ناراحتی تمرین را متوقف کن.'] },
    approval: { status: 'approved_for_assistant', reviewer_role: 'qualified_clinician', review_record_id: 'REV-CLIN-EX-01', reviewed_at: '2026-10-20T10:00:00Z', version: '1.0.0' },
  });
  const result = retrieveApprovedKnowledge({ query: 'نگرانی', items: [exercise], approvalManifest: manifestFor(exercise) });
  assert.equal(result.status, 'results_found');
  assert.equal(result.results[0].safety.level, 'caution');
  assert.equal(result.results[0].safety.stop_conditions.length, 1);
});


test('duplicate approval manifest identifiers invalidate the entire allowlist', () => {
  const item = approved();
  const manifest = manifestFor(item);
  manifest.approved_items.push({ ...manifest.approved_items[0], review_record_id: 'REV-DUPLICATE' });
  const result = retrieveApprovedKnowledge({ query: 'نگرانی', items: [item], approvalManifest: manifest });
  assert.equal(result.status, 'no_approved_content');
  assert.deepEqual(result.results, []);
});

test('one malformed approval manifest entry invalidates otherwise valid entries', () => {
  const item = approved();
  const manifest = manifestFor(item);
  manifest.approved_items.push({ item_id: 'K-BAD', review_record_id: '', reviewer_role: 'unknown', reviewed_at: 'not-a-date', version: '' });
  const result = retrieveApprovedKnowledge({ query: 'نگرانی', items: [item], approvalManifest: manifest });
  assert.equal(result.status, 'no_approved_content');
});


test('duplicate approved catalog item IDs invalidate retrieval instead of shadowing content', () => {
  const item = approved();
  const conflicting = approved({ content: 'متن دیگری با همان شناسه که نباید بی‌صدا جایگزین شود.' });
  const result = retrieveApprovedKnowledge({
    query: 'نگرانی',
    items: [item, conflicting],
    approvalManifest: manifestFor(item),
  });
  assert.equal(result.status, 'no_approved_content');
  assert.deepEqual(result.results, []);
});

test('duplicate IDs fail closed even when only one catalog record is approved', () => {
  const item = approved();
  const draftDuplicate = approved({
    content: 'نسخه پیش‌نویس با همان شناسه',
    approval: { status: 'draft', reviewer_role: 'evidence_reviewer', review_record_id: 'REV-DRAFT', reviewed_at: '2026-10-20T10:00:00Z', version: '1.0.0' },
  });
  const result = retrieveApprovedKnowledge({
    query: 'نگرانی',
    items: [item, draftDuplicate],
    approvalManifest: manifestFor(item),
  });
  assert.equal(result.status, 'no_approved_content');
  assert.deepEqual(result.results, []);
});

test('general strategy wording is treated as query framing rather than a required knowledge term', () => {
  const item = approved();
  const result = retrieveApprovedKnowledge({
    query: 'چه راهکاری برای نگرانی وجود دارد؟',
    items: [item],
    approvalManifest: manifestFor(item),
  });
  assert.equal(result.status, 'results_found');
  assert.equal(result.results[0].item_id, item.item_id);
});
