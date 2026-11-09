import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSharedCopyProposal } from '../scripts/validate-shared-copy-proposals.mjs';

const makeProposal = () => ({
  status: 'draft_pending_expert_review',
  records: Array.from({ length: 34 }, (_, index) => ({
    topic_id: `T${String(index + 1).padStart(2, '0')}`,
    proposed_title: `عنوان ${index + 1}`,
    proposed_intro: `مقدمه ${index + 1}`,
    proposed_closing: `پایان ${index + 1}`,
    copy_review_status: 'draft_pending_expert_review',
    runtime_eligible: false,
  })),
});

test('day 1-3 shared-copy proposal batches require 34 unique topic-specific entries', () => {
  const report = auditSharedCopyProposal(makeProposal());
  assert.equal(report.ok, true);
  assert.equal(report.record_count, 34);
  assert.equal(report.unique_topic_count, 34);
  assert.deepEqual(report.errors, []);
});

test('shared-copy proposal audit rejects duplicate text and runtime eligibility', () => {
  const proposal = makeProposal();
  proposal.records[1].proposed_intro = proposal.records[0].proposed_intro;
  proposal.records[2].runtime_eligible = true;
  const report = auditSharedCopyProposal(proposal);
  assert.equal(report.ok, false);
  assert.ok(report.errors.includes('duplicate_proposed_intro'));
  assert.ok(report.errors.includes('runtime_eligible_record_found'));
});

test('audit accepts the five distinct support-copy variants in the day-one batch', () => {
  const proposal = {
    status: 'draft_pending_expert_review',
    fields: ['lightExerciseText', 'lightActionText', 'progressActionText', 'restExerciseText', 'restActionText'],
    records: Array.from({ length: 34 }, (_, index) => ({
      topic_id: `T${String(index + 1).padStart(2, '0')}`,
      lightExerciseText: `تمرین سبک ${index + 1}`,
      lightActionText: `اقدام سبک ${index + 1}`,
      progressActionText: `گام پیشرفت ${index + 1}`,
      restExerciseText: `تمرین استراحت ${index + 1}`,
      restActionText: `اقدام استراحت ${index + 1}`,
      review_status: 'draft_pending_expert_review',
      runtime_eligible: false,
    })),
  };
  const report = auditSharedCopyProposal(proposal);
  assert.equal(report.ok, true);
  assert.equal(report.record_count, 34);
});
