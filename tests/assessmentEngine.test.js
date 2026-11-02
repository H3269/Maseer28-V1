import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAssessmentSession, getAssessmentSummary, getCurrentQuestion,
  submitAssessmentAnswer, stopAssessment, assessmentEngineMetadata,
  assessmentEngineTopicRuleIds,
} from '../src/features/assistant/assessmentEngine.js';
import { assessmentTopicRuleRegistry } from '../src/features/assistant/assessmentTopicRuleRegistry.v1.js';

const answer = (session, value) => submitAssessmentAnswer(session, value);
function completeIntake(opening, clarification = 'یک نمونه مشخص از همین تجربه') {
  let session = createAssessmentSession();
  session = answer(session, opening);
  session = answer(session, 'نه');
  session = answer(session, 'در زندگی روزمره‌ام اثر گذاشته است');
  session = answer(session, 'چند هفته است');
  session = answer(session, 'می‌خواهم بهتر بفهمم چه اتفاقی می‌افتد');
  session = answer(session, clarification);
  return session;
}

test('session starts locally with an open question', () => {
  const session = createAssessmentSession();
  assert.equal(getCurrentQuestion(session).id, 'open_problem');
  assert.equal(session.processing, 'local_in_memory_only');
  assert.equal(assessmentEngineMetadata.cloud_processing, false);
  assert.equal(assessmentEngineMetadata.diagnostic_use, false);
});

test('unreviewed registry is disabled at the engine boundary, not only in the UI', () => {
  assert.equal(assessmentTopicRuleRegistry.runtime_authorization, false);
  assert.equal(assessmentTopicRuleRegistry.runtime_eligible, false);
  assert.equal(assessmentEngineMetadata.topic_rule_runtime_authorized, false);
  assert.equal(assessmentEngineMetadata.topic_rule_runtime_status, 'disabled_fail_closed');
  assert.equal(assessmentEngineTopicRuleIds.length, 33); // catalog inventory, not active runtime rules
  assert.equal(assessmentEngineMetadata.active_topic_rule_count, 0);
});

test('lexical matches cannot produce topic candidates while registry authorization is false', () => {
  const session = completeIntake('مدتی است اضطراب، نگرانی مداوم و بی‌خوابی دارم');
  const topics = getAssessmentSummary(session).candidate_topics;
  assert.deepEqual(topics.map((item) => item.topic_id), ['T34']);
  assert.equal(topics[0].status, 'needs_clarification');
});

test('quoted, attributed, translated, or negated phrases also cannot activate disabled rules', () => {
  const examples = [
    'او گفت «من بی‌ارزشم»',
    'برای ترجمه جمله «من از خودم متنفرم» کمک می‌خواهم',
    'من از خودم متنفر نیستم',
    'دوستم گفت من اضطراب دارم',
  ];
  for (const example of examples) {
    const session = completeIntake(example);
    assert.deepEqual(
      getAssessmentSummary(session).candidate_topics.map((item) => item.topic_id),
      ['T34'],
      example
    );
  }
});

test('safety question path remains independent of topic-rule authorization', () => {
  let session = createAssessmentSession();
  session = answer(session, 'گاهی فکر می‌کنم به خودم آسیب بزنم');
  assert.equal(getCurrentQuestion(session).id, 'safety_now');
  assert.equal(session.safety_context_flag, true);
  session = answer(session, 'قصد دارم به خودم آسیب بزنم');
  assert.equal(session.status, 'paused_for_human_support');
  assert.equal(session.safety_state, 'urgent_human_support_recommended');
});

test('uncertain safety response is clarified, not treated as safe', () => {
  let session = createAssessmentSession();
  session = answer(session, 'خودکشی');
  session = answer(session, 'مطمئن نیستم');
  assert.equal(session.safety_state, 'clarification_needed');
  assert.equal(getCurrentQuestion(session).id, 'safety_clarification');
});

test('only a standalone negative safety answer records non-disclosure', () => {
  let session = createAssessmentSession();
  session = answer(session, 'گاهی فکر می‌کنم به خودم آسیب بزنم');
  session = answer(session, 'نه');
  assert.equal(session.safety_state, 'no_immediate_risk_disclosed');
  assert.equal(getCurrentQuestion(session).id, 'impact');
});

test('qualified denial is clarified rather than interpreted as a guarantee', () => {
  let session = createAssessmentSession();
  session = answer(session, 'گاهی فکر می‌کنم به خودم آسیب بزنم');
  session = answer(session, 'نه، قصد ندارم به خودم آسیب بزنم');
  assert.equal(session.safety_state, 'clarification_needed');
  assert.equal(getCurrentQuestion(session).id, 'safety_clarification');
});

test('ordinary intake continues and requests clarification when no authorized topic exists', () => {
  const session = completeIntake('یک مسئله پیچیده دارم');
  assert.equal(getCurrentQuestion(session).id, 'summary_confirmation');
  assert.deepEqual(getAssessmentSummary(session).candidate_topics.map((item) => item.topic_id), ['T34']);
  assert.equal(getAssessmentSummary(session).evidence_processing.semantic_understanding, false);
});

test('summary correction withdraws the provisional clarification route', () => {
  let session = completeIntake('مدتی است اضطراب دارم');
  session = answer(session, 'خلاصه درست نیست');
  assert.equal(getCurrentQuestion(session).id, 'summary_revision');
  assert.equal(getAssessmentSummary(session).candidate_topics.length, 0);
  session = answer(session, 'منظورم فقط فشار کاری بود');
  assert.equal(getCurrentQuestion(session).id, 'summary_confirmation');
  assert.equal(getAssessmentSummary(session).candidate_topics.length, 0);
  assert.equal(getAssessmentSummary(session).topic_assessment_status, 'requires_reassessment');
});

test('empty answers are rejected without advancing', () => {
  const session = createAssessmentSession();
  assert.throws(() => answer(session, '   '), /پاسخ خالی/);
  assert.equal(getCurrentQuestion(session).id, 'open_problem');
});

test('cloud processing is rejected', () => {
  assert.throws(() => createAssessmentSession({ localOnly: false }), /ارسال ابری/);
});

test('user can stop and clear in-memory answers', () => {
  let session = createAssessmentSession();
  session = answer(session, 'احساس تنهایی دارم');
  const stopped = stopAssessment(session);
  assert.equal(stopped.status, 'stopped_by_user');
  assert.deepEqual(stopped.answers, {});
  assert.equal(stopped.summary, null);
});
