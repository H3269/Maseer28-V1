import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCourseContentQualityReviewLedger } from '../scripts/generate-course-content-quality-review-queue.mjs';
import { auditCourseContentQuality } from '../scripts/audit-course-content-quality.mjs';

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [content, topics, evidenceRegistry, existing] = await Promise.all([
  read('../public/content/path-content.json'),
  read('../public/assistant/knowledge/topics.v1.json'),
  read('../public/assistant/evidence/evidence.v1.json'),
  read('../public/assistant/reviews/course-content-quality-review.v1.json'),
]);

test('quality review queue creates exactly 952 pending records and never enables runtime', () => {
  const ledger = buildCourseContentQualityReviewLedger({ content, topics, existing });
  assert.equal(ledger.reviews.length, 952);
  assert.equal(ledger.runtime_eligible, false);
  assert.ok(ledger.reviews.every((item) => item.review_status === 'pending_review'));
  assert.ok(ledger.reviews.every((item) => Object.values(item.scores).every((score) => score === null)));
});

test('quality review queue preserves human work and rejects silent source replacement', () => {
  const initial = buildCourseContentQualityReviewLedger({ content, topics, existing });
  const first = initial.reviews[0];
  first.review_status = 'in_review';
  first.reviewer_id = 'owner-expert';
  first.rationale = 'بازبینی تخصصی در حال انجام است.';
  const preserved = buildCourseContentQualityReviewLedger({ content, topics, existing: initial });
  assert.equal(preserved.reviews[0].review_status, 'in_review');
  assert.equal(preserved.reviews[0].reviewer_id, 'owner-expert');
  assert.equal(preserved.reviews[0].rationale, 'بازبینی تخصصی در حال انجام است.');

  const changed = structuredClone(content);
  const firstCategory = Object.values(changed.categories)[0];
  firstCategory.days[0].id = 'changed-source-content-id';
  assert.throws(() => buildCourseContentQualityReviewLedger({ content: changed, topics, existing: initial }), /manual reconciliation/);
});

test('generated ledger has complete review coverage but no approval or runtime readiness', () => {
  const ledger = buildCourseContentQualityReviewLedger({ content, topics, existing });
  const report = auditCourseContentQuality({ content, topics, ledger, evidenceRegistry });
  assert.deepEqual(report.errors, []);
  assert.equal(report.coverage.expected_days, 952);
  assert.equal(report.coverage.review_records, 952);
  assert.equal(report.coverage.missing_reviews, 0);
  assert.equal(report.coverage.pending_review, 952);
  assert.equal(report.readiness.complete_review_coverage, true);
  assert.equal(report.readiness.all_reviewed, false);
  assert.equal(report.readiness.approved_for_educational_review, false);
  assert.equal(report.readiness.runtime_eligible, false);
});

test('queue refuses duplicate and unknown existing review records', () => {
  const initial = buildCourseContentQualityReviewLedger({ content, topics, existing });
  assert.throws(() => buildCourseContentQualityReviewLedger({
    content, topics, existing: { ...initial, reviews: [...initial.reviews, initial.reviews[0]] },
  }), /duplicate review IDs/);
  assert.throws(() => buildCourseContentQualityReviewLedger({
    content, topics, existing: { ...initial, reviews: [...initial.reviews, { review_id: 'UNKNOWN' }] },
  }), /not present in the current course registry/);
});
