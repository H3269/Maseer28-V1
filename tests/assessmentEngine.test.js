import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAssessmentSession,
  getAssessmentSummary,
  getCurrentQuestion,
  submitAssessmentAnswer,
  stopAssessment,
  assessmentEngineMetadata,
} from '../src/features/assistant/assessmentEngine.js';

function answer(session, value) {
  return submitAssessmentAnswer(session, value);
}

test('session starts with an open question and keeps data in memory only', () => {
  const session = createAssessmentSession();
  assert.equal(getCurrentQuestion(session).id, 'open_problem');
  assert.equal(session.processing, 'local_in_memory_only');
  assert.equal(assessmentEngineMetadata.cloud_processing, false);
  assert.equal(assessmentEngineMetadata.diagnostic_use, false);
});

test('empty answers are rejected without advancing the question', () => {
  const session = createAssessmentSession();
  assert.throws(() => answer(session, '   '), /پاسخ خالی/);
  assert.equal(getCurrentQuestion(session).id, 'open_problem');
});

test('ordinary concern proceeds through one question at a time and produces tentative topic hypotheses', () => {
  let session = createAssessmentSession();
  session = answer(session, 'مدتی است اضطراب و نگرانی مداوم دارم');
  assert.equal(getCurrentQuestion(session).id, 'safety_now');
  session = answer(session, 'نه');
  assert.equal(getCurrentQuestion(session).id, 'impact');
  session = answer(session, 'در کار و خوابم اثر گذاشته است');
  assert.equal(getCurrentQuestion(session).id, 'duration');
  session = answer(session, 'حدود سه ماه، بیشتر روزها');
  assert.equal(getCurrentQuestion(session).id, 'goal');
  session = answer(session, 'می‌خواهم مسئله را بهتر بفهمم');
  assert.equal(getCurrentQuestion(session).id, 'clarify_example');
  session = answer(session, 'وقتی آینده نامعلوم است نگران می‌شوم و مدام فکر می‌کنم');
  assert.equal(getCurrentQuestion(session).id, 'summary_confirmation');
  const summary = getAssessmentSummary(session);
  assert.ok(summary.candidate_topics.some((item) => item.topic_id === 'T02'));
  assert.ok(summary.candidate_topics.every((item) => item.status === 'tentative_hypothesis'));
  assert.ok(summary.limitations.length >= 3);
  session = answer(session, 'بله');
  assert.equal(session.status, 'completed');
  assert.equal(session.next_step.content_available, false);
});

test('safety language interrupts routine intake and asks a direct current-safety question', () => {
  let session = createAssessmentSession();
  session = answer(session, 'گاهی فکر می‌کنم به خودم آسیب بزنم');
  assert.equal(getCurrentQuestion(session).id, 'safety_now');
  assert.equal(session.safety_context_flag, true);
  assert.equal(session.safety_state, 'not_assessed');
});

test('an affirmative current danger response pauses the assessment for human support', () => {
  let session = createAssessmentSession();
  session = answer(session, 'خودم را بکشم');
  session = answer(session, 'بله');
  assert.equal(session.status, 'paused_for_human_support');
  assert.equal(session.safety_state, 'urgent_human_support_recommended');
  assert.equal(getCurrentQuestion(session), null);
  assert.ok(session.referral.instruction);
});

test('uncertain safety response triggers clarification rather than being treated as safe', () => {
  let session = createAssessmentSession();
  session = answer(session, 'خودکشی');
  session = answer(session, 'مطمئن نیستم');
  assert.equal(session.safety_state, 'clarification_needed');
  assert.equal(getCurrentQuestion(session).id, 'safety_clarification');
});

test('a negative direct safety answer records only non-disclosure, not a guarantee of safety', () => {
  let session = createAssessmentSession();
  session = answer(session, 'خودزنی');
  session = answer(session, 'نه');
  assert.equal(session.safety_state, 'no_immediate_risk_disclosed');
  assert.equal(getCurrentQuestion(session).id, 'impact');
});

test('user can stop and clear in-memory answers', () => {
  let session = createAssessmentSession();
  session = answer(session, 'احساس تنهایی دارم');
  const stopped = stopAssessment(session);
  assert.equal(stopped.status, 'stopped_by_user');
  assert.deepEqual(stopped.answers, {});
  assert.equal(stopped.summary, null);
});

test('unmatched concerns use T34 as a clarification route, not a diagnosis', () => {
  let session = createAssessmentSession();
  session = answer(session, 'یک مسئله پیچیده دارم که نمی‌دانم چطور توضیح بدهم');
  session = answer(session, 'نه');
  session = answer(session, 'در کار و زندگی روزمره اثر گذاشته');
  session = answer(session, 'چند هفته است');
  session = answer(session, 'می‌خواهم بفهمم چه خبر است');
  session = answer(session, 'هنوز نمی‌توانم نمونه مشخصی پیدا کنم');
  const item = getAssessmentSummary(session).candidate_topics[0];
  assert.equal(item.topic_id, 'T34');
  assert.equal(item.status, 'needs_clarification');
});

test('cloud processing is explicitly rejected by this experimental engine', () => {
  assert.throws(() => createAssessmentSession({ localOnly: false }), /ارسال ابری/);
});


test('non-affirmative summary feedback withdraws tentative topics and asks for a correction',()=>{
 let session=createAssessmentSession();
 session=answer(session,'مدتی است اضطراب دارم');
 session=answer(session,'نه');
 session=answer(session,'در کارم اثر گذاشته');
 session=answer(session,'چند ماه');
 session=answer(session,'می‌خواهم بفهمم');
 session=answer(session,'وقتی آینده نامعلوم است اضطراب می‌گیرم');
 assert.ok(getAssessmentSummary(session).candidate_topics.some(item=>item.topic_id==='T02'));
 session=answer(session,'نه، برداشتت اشتباه است');
 assert.equal(getCurrentQuestion(session).id,'summary_revision');
 assert.equal(session.summary.review_status,'correction_requested');
 assert.equal(session.summary.candidate_topics.length,0);
 assert.equal(session.summary.topic_assessment_status,'withdrawn_pending_reassessment');
});

test('user correction replaces the current interpretation and requires reconfirmation',()=>{
 let session=createAssessmentSession();
 session=answer(session,'مدتی است اضطراب دارم');
 session=answer(session,'نه');
 session=answer(session,'در کارم اثر گذاشته');
 session=answer(session,'چند ماه');
 session=answer(session,'می‌خواهم بفهمم');
 session=answer(session,'وقتی آینده نامعلوم است اضطراب می‌گیرم');
 session=answer(session,'خلاصه درست نیست');
 session=answer(session,'مسئله اصلی فشار کاری است؛ اضطراب موضوع اصلی من نیست');
 assert.equal(getCurrentQuestion(session).id,'summary_confirmation');
 assert.equal(session.summary.user_correction,'مسئله اصلی فشار کاری است؛ اضطراب موضوع اصلی من نیست');
 assert.equal(session.summary.candidate_topics.length,0);
 assert.equal(session.summary.review_status,'user_corrected_pending_confirmation');
 assert.equal(session.summary.topic_assessment_status,'requires_reassessment');
 session=answer(session,'بله');
 assert.equal(session.status,'completed');
 assert.equal(session.summary.review_status,'user_confirmed');
});

test('only an explicit affirmative confirms a summary',()=>{
 let session=createAssessmentSession();
 session=answer(session,'یک مسئله دارم');
 session=answer(session,'نه');
 session=answer(session,'اثر گذاشته');
 session=answer(session,'چند هفته');
 session=answer(session,'می‌خواهم بفهمم');
 session=answer(session,'یک مثال مشخص');
 session=answer(session,'تقریباً درست است، اما یک نکته مهم جا افتاده');
 assert.equal(session.status,'in_progress');
 assert.equal(getCurrentQuestion(session).id,'summary_revision');
});
