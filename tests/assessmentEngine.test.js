import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAssessmentSession,
  getAssessmentSummary,
  getCurrentQuestion,
  submitAssessmentAnswer,
  stopAssessment,
  assessmentEngineMetadata,
  classifySafetyAnswer,
  classifySafetyDomains,
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

test('safety concern domains distinguish self-harm, harm to others, and threat from another person', () => {
  assert.deepEqual(classifySafetyDomains('گاهی فکر می‌کنم خودم را بکشم'), ['risk_of_self_harm']);
  assert.deepEqual(classifySafetyDomains('می‌ترسم به کسی آسیب بزنم'), ['risk_of_harm_to_others']);
  assert.deepEqual(classifySafetyDomains('در خانه امن نیستم و او مرا تهدید می‌کند'), ['risk_from_another_person']);
  assert.deepEqual(classifySafetyDomains('بله'), ['domain_not_yet_determined']);
});

test('empty answers are rejected without advancing the question', () => {
  const session = createAssessmentSession();
  assert.throws(() => answer(session, '   '), /پاسخ خالی/);
  assert.equal(getCurrentQuestion(session).id, 'open_problem');
});

test('direct educational questions do not enter the personal assessment state machine', () => {
  let session = createAssessmentSession();
  session = answer(session, 'اضطراب چیست؟');
  assert.equal(session.semantic_intake.intent.label, 'general_information');
  assert.equal(session.status, 'information_request_not_supported');
  assert.equal(getCurrentQuestion(session), null);
  assert.equal(session.next_step.content_available, false);
  assert.match(session.next_step.message, /درخواست اطلاعات عمومی/);
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

test('safety answer classifier does not mistake a leading no for a complete negative answer', () => {
  assert.equal(classifySafetyAnswer('نه، مطمئن نیستم'), 'clarification_needed');
  assert.equal(classifySafetyAnswer('نه، شاید نتوانم کنترلش کنم'), 'clarification_needed');
  assert.equal(classifySafetyAnswer('نه، برنامه دارم'), 'urgent_human_support_recommended');
  assert.equal(classifySafetyAnswer('بله، ولی قصد ندارم'), 'urgent_human_support_recommended');
});

test('safety answer classifier accepts clear negative disclosure but not ambiguous elaboration', () => {
  assert.equal(classifySafetyAnswer('نه'), 'no_immediate_risk_disclosed');
  assert.equal(classifySafetyAnswer('خیر، قصد ندارم'), 'no_immediate_risk_disclosed');
  assert.equal(classifySafetyAnswer('نه، قصد آسیب ندارم'), 'no_immediate_risk_disclosed');
  assert.equal(classifySafetyAnswer('شاید'), 'clarification_needed');
  assert.equal(classifySafetyAnswer(''), 'clarification_needed');
});

test('ambiguous negative safety response keeps the safety gate active', () => {
  let session = createAssessmentSession();
  session = answer(session, 'مدتی است نگرانم');
  session = answer(session, 'نه، مطمئن نیستم');
  assert.equal(session.safety_state, 'clarification_needed');
  assert.equal(getCurrentQuestion(session).id, 'safety_clarification');
  assert.equal(session.status, 'in_progress');
});

test('clear negative safety disclosure can proceed without claiming guaranteed safety', () => {
  let session = createAssessmentSession();
  session = answer(session, 'مدتی است نگرانم');
  session = answer(session, 'نه، قصد آسیب ندارم');
  assert.equal(session.safety_state, 'no_immediate_risk_disclosed');
  assert.equal(getCurrentQuestion(session).id, 'impact');
  assert.equal(session.status, 'in_progress');
});


test('assessment runtime exposes semantic intent output and preserves the shared intake contract', () => {
  let session = createAssessmentSession();
  session = answer(session, 'من اضطراب ندارم؛ فقط نگران آینده‌ام و از قضاوت دیگران می‌ترسم.');
  assert.equal(session.semantic_intake.schema_version, '1.0.0');
  assert.equal(session.semantic_intake.intent.ambiguity, 'high');
  assert.ok(session.semantic_intake.topic_candidates.some((item) => item.topic_id === 'T02'));
  assert.ok(session.semantic_intake.topic_candidates.some((item) => item.topic_id === 'T27'));
  session = answer(session, 'نه');
  session = answer(session, 'در کارم تمرکز ندارم');
  session = answer(session, 'چند هفته است');
  session = answer(session, 'می‌خواهم بفهمم چه خبر است');
  assert.equal(session.semantic_intake.situational_facts.impact, 'در کارم تمرکز ندارم');
  assert.equal(session.semantic_intake.situational_facts.duration, 'چند هفته است');
  assert.equal(session.semantic_intake.situational_facts.user_goal, 'می‌خواهم بفهمم چه خبر است');
});


test('stopping an assessment clears semantic context and topic hypotheses too', () => {
  let session = createAssessmentSession();
  session = answer(session, 'مدتی است اضطراب دارم');
  const stopped = stopAssessment(session);
  assert.deepEqual(stopped.answers, {});
  assert.deepEqual(stopped.candidate_topics, []);
  assert.equal(stopped.semantic_intake, null);
  assert.equal(stopped.safety_context_flag, false);
});

test('explicit user correction replaces rather than merges the earlier topic hypothesis', () => {
  let session = createAssessmentSession();
  session = answer(session, 'مدتی است اضطراب دارم');
  session = answer(session, 'نه');
  session = answer(session, 'در کارم اثر گذاشته');
  session = answer(session, 'چند هفته است');
  session = answer(session, 'می‌خواهم مسئله را بفهمم');
  session = answer(session, 'منظورم این نبود؛ در واقع مشکل اصلی من اهمال‌کاری است و کارها را عقب می‌اندازم.');
  assert.equal(session.answers.open_problem_original, 'مدتی است اضطراب دارم');
  assert.match(session.answers.open_problem, /اهمال‌کاری/);
  assert.equal(session.candidate_topics.some((item) => item.topic_id === 'T09'), true);
  assert.equal(session.candidate_topics.some((item) => item.topic_id === 'T02'), false);
  assert.equal(session.summary.user_report, session.answers.open_problem);
});


test('engine rejects oversized input even when called outside the UI', () => {
  const session = createAssessmentSession();
  assert.throws(() => answer(session, 'الف'.repeat(3001)), /حداکثر ۳۰۰۰ نویسه/);
  assert.equal(getCurrentQuestion(session).id, 'open_problem');
});


test('explicit immediate danger in the opening answer pauses before routine intake', () => {
  let session = createAssessmentSession();
  session = answer(session, 'امشب قصد دارم خودم را بکشم.');
  assert.equal(session.status, 'paused_for_human_support');
  assert.equal(session.safety_state, 'urgent_human_support_recommended');
  assert.equal(getCurrentQuestion(session), null);
  assert.equal(session.referral.priority, 'urgent');
});

test('ambiguous safety language still asks a direct question instead of auto-referring', () => {
  let session = createAssessmentSession();
  session = answer(session, 'دیگه نمی‌کشم و همه‌چی تمومه.');
  assert.equal(session.status, 'in_progress');
  assert.equal(getCurrentQuestion(session).id, 'safety_now');
  assert.equal(session.safety_state, 'not_assessed');
});


test('adaptive policy skips questions already answered in the opening message', () => {
  let session = createAssessmentSession();
  session = answer(session, 'سه ماه است در محل کار به‌خاطر اضطراب تمرکزم را از دست داده‌ام و می‌خواهم راهکار عملی پیدا کنم.');
  session = answer(session, 'نه');
  assert.equal(session.current_question.id, 'summary_confirmation');
  assert.equal(session.summary.duration, 'در پیام آغازین اشاره شده');
  assert.equal(session.summary.impact, 'در پیام آغازین اشاره شده');
  assert.equal(session.summary.user_goal, 'دریافت راهکار');
});

test('declining a question advances the intake without repeating it', () => {
  let session = createAssessmentSession();
  session = answer(session, 'مدتی است اضطراب دارم');
  session = answer(session, 'نه');
  assert.equal(session.current_question.id, 'impact');
  session = answer(session, 'ترجیح می‌دهم نگویم');
  assert.equal(session.current_question.id, 'duration');
  assert.equal(session.semantic_intake.situational_facts.impact, null);
});


test('general information requests do not enter the personal assessment flow', () => {
  let session = createAssessmentSession();
  session = answer(session, 'من فقط برای ترجمه یک متن درباره اضطراب سؤال دارم؛ خودم چنین تجربه‌ای ندارم.');
  assert.equal(session.status, 'information_request_not_supported');
  assert.equal(getCurrentQuestion(session), null);
  assert.equal(session.next_step.content_available, false);
  assert.ok(session.next_step.message.includes('به‌جای حدس‌زدن'));
});
