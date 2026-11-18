import test from 'node:test';
import assert from 'node:assert/strict';
import { retrieveKnowledge } from '../src/features/assistant/knowledgeGateway.js';

const item = (overrides = {}) => ({
  schema_version: '1.0.0',
  item_id: 'K-SAMPLE-001',
  title: 'نگرانی و اضطراب',
  content: 'نگرانی درباره آینده و راه‌های شناخت آن',
  topic_ids: ['T02'],
  content_type: 'education',
  source: { source_id: 'SRC-T02-001', title: 'منبع آموزشی', locator: 'chapter-1#intro' },
  ...overrides,
});

test('source-linked knowledge is retrievable without reviewer or approval metadata', () => {
  const result = retrieveKnowledge({ query: 'نگرانی آینده', items: [item()] });
  assert.equal(result.status, 'results_found');
  assert.equal(result.results[0].item_id, 'K-SAMPLE-001');
  assert.equal(result.results[0].source.source_id, 'SRC-T02-001');
  assert.equal('approval' in result.results[0], false);
});

test('knowledge retrieval still requires a valid source and stable item fields', () => {
  const invalid = item({ source: { source_id: '', title: '', locator: '' } });
  assert.equal(retrieveKnowledge({ query: 'نگرانی', items: [invalid] }).status, 'knowledge_unavailable');
});

test('exercise knowledge keeps independent safety requirements', () => {
  const exercise = item({
    content_type: 'exercise',
    safety: { level: 'caution', stop_conditions: ['در صورت افزایش ناراحتی تمرین را متوقف کن.'] },
  });
  const result = retrieveKnowledge({ query: 'نگرانی', items: [exercise] });
  assert.equal(result.status, 'results_found');
  assert.equal(result.results[0].safety.level, 'caution');
  assert.equal(result.results[0].safety.stop_conditions.length, 1);
});

test('exercise content with an explicit elevated safety requirement is not served as routine knowledge', () => {
  const exercise = item({
    content_type: 'exercise',
    safety: { level: 'human_review_required', stop_conditions: ['در صورت خطر توقف کن.'] },
  });
  assert.equal(retrieveKnowledge({ query: 'نگرانی', items: [exercise] }).status, 'knowledge_unavailable');
});

test('invalid topic IDs and duplicate topic IDs are rejected', () => {
  assert.equal(retrieveKnowledge({ query: 'نگرانی', topicIds: ['T99'], items: [item()] }).status, 'invalid_topic_filter');
  assert.equal(retrieveKnowledge({ query: 'نگرانی', items: [item({ topic_ids: ['T02', 'T02'] })] }).status, 'knowledge_unavailable');
});

test('empty query and missing source catalog return explicit statuses', () => {
  assert.equal(retrieveKnowledge({ query: '   ', items: [item()] }).status, 'insufficient_query');
  assert.equal(retrieveKnowledge({ query: 'نگرانی', items: [] }).status, 'knowledge_unavailable');
});

test('duplicate catalog item IDs invalidate retrieval rather than shadowing content', () => {
  const first = item();
  const second = item({ content: 'متن متفاوت با شناسه تکراری' });
  assert.equal(retrieveKnowledge({ query: 'نگرانی', items: [first, second] }).status, 'invalid_catalog');
});

test('topic filters and result limits are applied', () => {
  const items = [
    item({ item_id: 'K-1', topic_ids: ['T02'] }),
    item({ item_id: 'K-2', topic_ids: ['T03'] }),
  ];
  const result = retrieveKnowledge({ query: 'نگرانی', topicIds: ['T02'], items, limit: 1 });
  assert.equal(result.status, 'results_found');
  assert.deepEqual(result.results.map((entry) => entry.item_id), ['K-1']);
});
