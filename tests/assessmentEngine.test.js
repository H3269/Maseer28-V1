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
  session = answer(session, 'خلاصه کلی درست است اما شدت آن را کمتر گفتم');
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

test('mixed negative and uncertain safety answers require clarification', () => {
  for (const response of ['نه، اما مطمئن نیستم', 'نه ولی شاید', 'خیر، نمی‌توانم قول بدهم']) {
    let session = createAssessmentSession();
    session = answer(session, 'خودآسیبی');
    session = answer(session, response);
    assert.equal(session.safety_state, 'clarification_needed', response);
    assert.equal(getCurrentQuestion(session).id, 'safety_clarification', response);
  }
});

test('only a standalone negative answer is recorded as non-disclosure', () => {
  for (const response of ['نه', 'خیر', 'no']) {
    let session = createAssessmentSession();
    session = answer(session, 'تهدید');
    session = answer(session, response);
    assert.equal(session.safety_state, 'no_immediate_risk_disclosed', response);
    assert.equal(getCurrentQuestion(session).id, 'impact', response);
  }
});

test('an initial safety cue cannot be cleared by a single negative answer', () => {
  let session = createAssessmentSession();
  session = answer(session, 'گاهی فکر می‌کنم به خودم آسیب بزنم');
  session = answer(session, 'نه');
  assert.equal(session.safety_context_flag, true);
  assert.equal(session.safety_state, 'contextual_risk_clarification_required');
  assert.equal(getCurrentQuestion(session).id, 'safety_context_clarification');
  session = answer(session, 'نه، منظورم یک فکر قدیمی بود و الآن قصد یا برنامه‌ای ندارم');
  assert.equal(session.safety_context_flag, true);
  assert.equal(session.safety_state, 'risk_context_present_no_immediate_risk_disclosed');
  assert.equal(getCurrentQuestion(session).id, 'impact');
});

test('uncertainty during contextual safety clarification keeps the session on safety clarification', () => {
  let session = createAssessmentSession();
  session = answer(session, 'گاهی فکر می‌کنم به خودم آسیب بزنم');
  session = answer(session, 'نه');
  session = answer(session, 'مطمئن نیستم');
  assert.equal(getCurrentQuestion(session).id, 'safety_context_clarification');
  assert.equal(session.safety_context_flag, true);
});

test('contextual safety flag remains visible in summary and requires human review', () => {
  let session = createAssessmentSession();
  session = answer(session, 'گاهی فکر می‌کنم به خودم آسیب بزنم');
  session = answer(session, 'نه');
  session = answer(session, 'نه، منظورم فکر قدیمی بود و الآن قصدی ندارم');
  session = answer(session, 'در کار و خوابم اثر گذاشته است');
  session = answer(session, 'حدود سه ماه');
  session = answer(session, 'می‌خواهم مسئله را بفهمم');
  session = answer(session, 'وقتی تنها می‌شوم مضطرب می‌شوم');
  const summary = getAssessmentSummary(session);
  assert.equal(summary.safety_context_flag, true);
  assert.equal(summary.safety_state, 'risk_context_present_no_immediate_risk_disclosed');
  session = answer(session, 'خلاصه درست است');
  assert.equal(session.next_step.human_review_recommended, true);
});
