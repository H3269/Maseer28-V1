import test from 'node:test';
import assert from 'node:assert/strict';
import { validateIndependentReviewLedger } from '../scripts/validate-independent-review-ledger.mjs';

const base = {
 schema_version:'1.0.0', ledger_id:'maseer28-independent-content-review-ledger-v1',
 blind_review_policy:{required_reviewers:2,independent:true,reviewer_ids_must_differ:true,submissions_hidden_from_other_reviewer_until_both_submitted:true,no_prepopulated_scores_or_reviewer_identity:true},
 governance:{release_score_threshold:null,disagreement_resolution:'third_qualified_adjudicator_required_no_averaging',runtime_requires:'approved_record_and_separate_versioned_runtime_grant'},
 records:[],event_log:[]
};
const mkReview=(id,score=3)=>({reviewer_id:id,status:'submitted',scores:Object.fromEntries('ABCDEFGH'.split('').map(k=>[k,score])),reviewer_qualification:{credential_basis:'verified professional qualification',scope:'relevant content domain',verified_by:'independent verifier'},conflict_of_interest:{declared:false},submitted_at:'2026-11-02T10:00:00Z',findings:[],hard_stop_flags:[],evidence_claim_reviews:[]});
const mkRecord=(reviews,extra={})=>({content_id:'DRAFT_T15_D04',content_version:'1.0.0',topic_id:'T15',day_number:4,reviews,decision:'hold',runtime_eligible:false,...extra});

test('empty template is valid and contains no fabricated reviews',()=>{const r=validateIndependentReviewLedger(base);assert.equal(r.valid,true,r.errors.join('\n'));assert.equal(r.summary.records,0);});
test('one reviewer cannot advance a record to expert decision',()=>{const l=structuredClone(base);l.records=[mkRecord([mkReview('reviewer-a')],{decision:'expert_reviewed'})];const r=validateIndependentReviewLedger(l);assert.ok(r.errors.some(x=>x.includes('two submitted independent reviews')));});
test('same reviewer cannot submit two independent reviews',()=>{const l=structuredClone(base);l.records=[mkRecord([mkReview('reviewer-a'),mkReview('reviewer-a')])];const r=validateIndependentReviewLedger(l);assert.ok(r.errors.some(x=>x.includes('distinct')));});
test('disagreement requires third-party adjudication and cannot be averaged',()=>{const l=structuredClone(base);l.records=[mkRecord([mkReview('reviewer-a',2),mkReview('reviewer-b',3)],{decision:'approved',decision_rationale:'approved',decided_at:'2026-11-02T12:00:00Z'})];const r=validateIndependentReviewLedger(l);assert.ok(r.errors.some(x=>x.includes('third-party adjudication')));});
test('open P1 or hard stop blocks approval',()=>{const l=structuredClone(base);const a=mkReview('reviewer-a'),b=mkReview('reviewer-b');a.findings=[{finding_id:'F1',severity:'P1',location:'exercise',rationale:'risk',resolved:false}];l.records=[mkRecord([a,b],{decision:'approved',decision_rationale:'approved',decided_at:'2026-11-02T12:00:00Z'})];const r=validateIndependentReviewLedger(l);assert.ok(r.errors.some(x=>x.includes('blocks expert decision')));});
test('runtime cannot be enabled without a separate exact-version grant',()=>{const l=structuredClone(base);l.records=[mkRecord([mkReview('reviewer-a'),mkReview('reviewer-b')],{decision:'approved',decision_rationale:'approved',decided_at:'2026-11-02T12:00:00Z',runtime_eligible:true})];const r=validateIndependentReviewLedger(l);assert.ok(r.errors.some(x=>x.includes('separate time-bounded grant')));});
test('audit events must be append-only linked and uniquely sequenced',()=>{const l=structuredClone(base);l.event_log=[{event_id:'e1',sequence:2,previous_event_id:'wrong',event_type:'review_submitted',actor_id:'reviewer-a',occurred_at:'2026-11-02T10:00:00Z',payload_digest:'sha256:abc'}];const r=validateIndependentReviewLedger(l);assert.ok(r.errors.some(x=>x.includes('append-only hash chain')));});
