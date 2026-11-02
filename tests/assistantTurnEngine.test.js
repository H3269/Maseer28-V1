import test from 'node:test';
import assert from 'node:assert/strict';
import { routeAssistantTurn } from '../src/features/assistant/assistantTurnEngine.js';

const knowledge = [{
  schema_version: '1.0.0',
  item_id: 'K-T02-001',
  title: 'اضطراب و نگرانی',
  content: 'اضطراب می‌تواند با نگرانی درباره آینده و موقعیت‌های نامطمئن همراه باشد. این متن آموزشی است و تشخیص محسوب نمی‌شود.',
  topic_ids: ['T02'],
  content_type: 'education',
  source: { source_id: 'SRC-T02-001', title: 'منبع آموزشی تأییدشده', locator: 'approved/education/t02#intro' },
  approval: { status: 'approved_for_assistant', reviewer_role: 'evidence_reviewer', review_record_id: 'REV-SAMPLE-001', reviewed_at: '2026-10-20T10:00:00Z', version: '1.0.0' },
}];

const approvalManifest = {
  schema_version: '1.0.0',
  manifest_id: 'test-manifest',
  status: 'active',
  approved_items: [{
    item_id: 'K-T02-001',
    review_record_id: 'REV-SAMPLE-001',
    reviewer_role: 'evidence_reviewer',
    reviewed_at: '2026-10-20T10:00:00Z',
    version: '1.0.0',
  }],
};

test('safety gate runs before knowledge retrieval', () => {
  const result = routeAssistantTurn({ text: 'امشب قصد دارم خودم را بکشم.', knowledgeItems: knowledge, approvalManifest });
  assert.equal(result.status, 'urgent_human_support_required');
  assert.deepEqual(result.knowledge, []);
});

test('ambiguous personal experience asks for clarification instead of returning advice', () => {
  const result = routeAssistantTurn({ text: 'هم عصبانی‌ام و هم می‌ترسم.', knowledgeItems: knowledge });
  assert.equal(result.status, 'clarification_required');
  assert.deepEqual(result.knowledge, []);
});

test('general information can only return approved excerpts with source attribution', () => {
  const result = routeAssistantTurn({ text: 'اضطراب چیست؟', knowledgeItems: knowledge, approvalManifest });
  assert.equal(result.status, 'approved_knowledge_available');
  assert.equal(result.knowledge[0].source.source_id, 'SRC-T02-001');
  assert.equal(result.knowledge[0].approval.reviewer_role, 'evidence_reviewer');
});

test('general information with no approved material returns no fabricated answer', () => {
  const result = routeAssistantTurn({ text: 'اضطراب چیست؟', knowledgeItems: [] });
  assert.equal(result.status, 'knowledge_unavailable');
  assert.deepEqual(result.knowledge, []);
  assert.ok(result.message.includes('به‌جای حدس‌زدن'));
});

test('clear personal experience stays in intake rather than jumping to recommendations', () => {
  const result = routeAssistantTurn({ text: 'مدتی است اضطراب دارم و در کارم تمرکز ندارم.' , knowledgeItems: knowledge, approvalManifest });
  assert.equal(result.status, 'personal_intake_required');
  assert.deepEqual(result.knowledge, []);
});


test('general strategy requests do not get misclassified as personal assessment', () => {
  const result = routeAssistantTurn({ text: 'چه راهکاری برای اضطراب وجود دارد؟' });
  assert.equal(result.status, 'intent_scope_clarification_required');
  assert.deepEqual(result.knowledge, []);
});

test('professional-help questions without personal context clarify scope first', () => {
  const result = routeAssistantTurn({ text: 'چه زمانی مراجعه به روانشناس لازم است؟' });
  assert.equal(result.status, 'intent_scope_clarification_required');
});


test('assistant turn entrypoint rejects empty and oversized inputs before routing', () => {
  assert.equal(routeAssistantTurn({ text: '   ' }).status, 'invalid_input');
  assert.equal(routeAssistantTurn({ text: 'الف'.repeat(3001) }).status, 'input_too_long');
});
