import test from 'node:test';
import assert from 'node:assert/strict';
import { validateIndependentReviewLedger } from '../scripts/validate-independent-review-ledger.mjs';

const base = {
 schema_version:'1.0.0', ledger_id:'maseer28-independent-content-review-ledger-v1',
 blind_review_policy:{review_model:'single_authorized_owner_expert_review',required_reviewers:1,independent:false,optional_peer_review_allowed:true,no_prepopulated_scores_or_reviewer_identity:true},
 governance:{release_score_threshold:null,disagreement_resolution:'owner_expert_documents_final_decision; optional_peer_input_is_advisory',decision_authority:'authorized_product_owner_or_designated_expert',runtime_requires:'approved_record_and_separate_versioned_runtime_grant'},
 records:[],event_log:[]
};
const mkReview=(id,score=3)=>({reviewer_id:id,status:'submitted',scores:Object.fromEntries('ABCDEFGH'.split('').map(k=>[k,score])),reviewer_qualification:{credential_basis:'verified professional qualification',scope:'relevant content domain',verified_by:'independent verifier'},conflict_of_interest:{declared:false},submitted_at:'2026-11-02T10:00:00Z',findings:[],hard_stop_flags:[],evidence_claim_reviews:[]});
const mkRecord=(reviews,extra={})=>({content_id:'DRAFT_T15_D04',content_version:'1.0.0',topic_id:'T15',day_number:4,reviews,decision:'hold',runtime_eligible:false,...extra});

test('empty template is valid and contains no fabricated reviews',()=>{const r=validateIndependentReviewLedger(base);assert.equal(r.valid,true,r.errors.join('\n'));assert.equal(r.summary.records,0);});
test('one authorized owner-expert can make the documented expert decision',()=>{const l=structuredClone(base);l.records=[mkRecord([mkReview('owner-expert')],{decision:'expert_reviewed',decision_rationale:'Owner expert reviewed the complete version.',decided_at:'2026-11-02T12:00:00Z'})];const r=validateIndependentReviewLedger(l);assert.equal(r.valid,true,r.errors.join('\\n'));});
test('a second review cannot be misrepresented as a required independent approval',()=>{const l=structuredClone(base);l.records=[mkRecord([mkReview('owner-expert'),mkReview('peer')])];const r=validateIndependentReviewLedger(l);assert.ok(r.errors.some(x=>x.includes('one authorized owner-expert review')));});
test('optional peer input does not replace owner expert decision authority',()=>{const l=structuredClone(base);l.governance.decision_authority='peer_majority';const r=validateIndependentReviewLedger(l);assert.ok(r.errors.some(x=>x.includes('review governance')));});
test('open P1 or hard stop blocks approval',()=>{const l=structuredClone(base);const a=mkReview('owner-expert');a.findings=[{finding_id:'F1',severity:'P1',location:'exercise',rationale:'risk',resolved:false}];l.records=[mkRecord([a,b],{decision:'approved',decision_rationale:'approved',decided_at:'2026-11-02T12:00:00Z'})];const r=validateIndependentReviewLedger(l);assert.ok(r.errors.some(x=>x.includes('blocks expert decision')));});
test('runtime cannot be enabled without a separate exact-version grant',()=>{const l=structuredClone(base);l.records=[mkRecord([mkReview('owner-expert')],{decision:'approved',decision_rationale:'approved',decided_at:'2026-11-02T12:00:00Z',runtime_eligible:true})];const r=validateIndependentReviewLedger(l);assert.ok(r.errors.some(x=>x.includes('separate time-bounded grant')));});
test('audit events must be append-only linked and uniquely sequenced',()=>{const l=structuredClone(base);l.event_log=[{event_id:'e1',sequence:2,previous_event_id:'wrong',event_type:'review_submitted',actor_id:'reviewer-a',occurred_at:'2026-11-02T10:00:00Z',payload_digest:'sha256:abc'}];const r=validateIndependentReviewLedger(l);assert.ok(r.errors.some(x=>x.includes('append-only hash chain')));});
