import test from 'node:test';
import assert from 'node:assert/strict';
import { validateP0ReviewQueue, P0_TOPIC_IDS } from '../scripts/lib/p0ReviewQueueValidation.js';

function fixture() {
  const topics = P0_TOPIC_IDS.map((topic_id) => ({ topic_id, name: topic_id }));
  const subtopics = P0_TOPIC_IDS.flatMap((topic_id) => [1, 2, 3].map((n) => ({ topic_id, subtopic_id: `${topic_id}-S0${n}` })));
  const canonicalContent = { categories: {} };
  const entries = [];
  for (const topic of topics) {
    const days = Array.from({ length: 28 }, (_, i) => {
      const id = `${topic.topic_id}-DAY-${String(i + 1).padStart(2, '0')}`;
      entries.push({
        id, topic_id: topic.topic_id, day: i + 1,
        source: { path: 'public/content/path-content.json', blob_sha: 'abc123' },
        triage_status: 'unassigned_pending_review', subtopic_ids: [],
        learning_objective: null, target_skill: null, teaching_point: null,
        review_decision: null, safety_gate_status: 'not_reviewed', evidence_refs: [],
        reviewer: { name: null, qualification: null, organization: null },
        review_record_id: null, reviewed_at: null, notes: null,
      });
      return { id };
    });
    canonicalContent.categories[topic.name] = { days };
  }
  return {
    ledger: {
      schema_version: '1.0.0', status: 'working_queue_not_approved_content',
      generated_from: { canonical_blob_sha: 'abc123' },
      scope: { topic_ids: [...P0_TOPIC_IDS], topic_count: 9, days_per_topic: 28, entry_count: 252 },
      policy: { runtime_eligibility: false, no_automatic_subtopic_assignment: true, no_ai_approval: true },
      entries,
    },
    canonicalContent, topicRegistry: { topics }, subtopicRegistry: { subtopics }, canonicalBlobSha: 'abc123',
  };
}

test('accepts a complete pending 252-entry P0 queue', () => assert.deepEqual(validateP0ReviewQueue(fixture()), []));
test('rejects duplicate canonical IDs', () => {
  const d = fixture(); d.ledger.entries[1].id = d.ledger.entries[0].id;
  assert.ok(validateP0ReviewQueue(d).some((e) => e.includes('duplicate ID')));
});
test('rejects a stale canonical fingerprint', () => {
  const d = fixture(); d.canonicalBlobSha = 'different';
  assert.ok(validateP0ReviewQueue(d).some((e) => e.includes('fingerprint is stale')));
});
test('rejects subtopic IDs belonging to another topic', () => {
  const d = fixture(); d.ledger.entries[0].subtopic_ids = ['T06-S01'];
  assert.ok(validateP0ReviewQueue(d).some((e) => e.includes('does not belong')));
});
test('rejects review activity without human trace', () => {
  const d = fixture(); d.ledger.entries[0].triage_status = 'general_support';
  assert.ok(validateP0ReviewQueue(d).some((e) => e.includes('human trace')));
});
test('requires evidence and learning fields for topic-specific mapping', () => {
  const d = fixture(); const e = d.ledger.entries[0];
  e.triage_status = 'topic_specific'; e.subtopic_ids = ['T04-S01'];
  e.reviewer = { name: 'Reviewer', qualification: 'Qualified' }; e.review_record_id = 'REV-001'; e.reviewed_at = '2026-11-05T12:00:00Z';
  assert.ok(validateP0ReviewQueue(d).some((message) => message.includes('requires evidence')));
});
test('never permits runtime activation through the review queue', () => {
  const d = fixture(); d.ledger.policy.runtime_eligibility = true;
  assert.ok(validateP0ReviewQueue(d).some((e) => e.includes('runtime eligibility')));
});
