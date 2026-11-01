import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildReviewQueue, auditCourseContentQuality } from '../scripts/audit-course-content-quality.mjs';

const read=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
const [content,topics]=await Promise.all([read('../public/content/path-content.json'),read('../public/assistant/knowledge/topics.v1.json')]);

test('review queue covers every source day without pre-scoring',()=>{
 const queue=buildReviewQueue(content,topics);
 assert.equal(queue.length,952);
 assert.ok(queue.every(r=>r.review_status==='pending_review'));
 assert.ok(queue.every(r=>Object.values(r.scores).every(v=>v===null)));
});

test('audit reports missing reviews and template warnings without claiming quality',()=>{
 const report=auditCourseContentQuality({content,topics,ledger:{runtime_eligible:false,reviews:[]}});
 assert.equal(report.coverage.expected_days,952);
 assert.equal(report.coverage.missing_reviews,952);
 assert.equal(report.readiness.approved_for_educational_review,false);
 assert.ok(Object.keys(report.text_template_warnings).includes('exercise'));
 assert.ok(report.limitations.some(x=>x.includes('معنای بالینی')));
});

test('educational approval is blocked by incomplete or low scores',()=>{
 const review=buildReviewQueue(content,topics)[0];
 review.review_status='approved_for_educational_review';
 review.scores={target_specificity:3,psychological_mechanism:3,evidence_support:3,exercise_alignment:3,progression_and_difficulty:3,safety_and_cautions:1,outcome_measurement:3,accessibility:3};
 review.reviewer_id='expert-1';review.reviewed_at='2026-11-01T12:00:00Z';review.rationale='Reviewed';review.evidence_ids=['EVD_TEST_01'];
 const report=auditCourseContentQuality({content,topics,ledger:{runtime_eligible:false,reviews:[review]}});
 assert.ok(report.errors.some(x=>x.includes('safety score')));
 assert.ok(report.errors.some(x=>x.includes('all eight scores')));
});

test('approved educational review requires full metadata and scores',()=>{
 const review=buildReviewQueue(content,topics)[0];
 review.review_status='approved_for_educational_review';
 review.scores=Object.fromEntries(Object.keys(review.scores).map(k=>[k,2]));
 review.reviewer_id='expert-1';review.reviewed_at='2026-11-01T12:00:00Z';review.rationale='Reviewed against the full daily lesson.';review.evidence_ids=['EVD_TEST_01'];
 const report=auditCourseContentQuality({content,topics,ledger:{runtime_eligible:false,reviews:[review]}});
 assert.deepEqual(report.errors,[]);
});
