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


test('a negative opening cannot suppress risk language later in a safety answer', () => {
  let session = createAssessmentSession();
  session = answer(session, 'گاهی فکر می‌کنم به خودم آسیب بزنم');
  session = answer(session, 'نه، گاهی هنوز به خودم آسیب می‌زنم');
  assert.equal(session.safety_state, 'clarification_needed');
  assert.equal(getCurrentQuestion(session).id, 'safety_clarification');
});

test('a qualified denial is clarified instead of being treated as a standalone no', () => {
  let session = createAssessmentSession();
  session = answer(session, 'گاهی فکر می‌کنم به خودم آسیب بزنم');
  session = answer(session, 'نه، قصد ندارم به خودم آسیب بزنم');
  assert.equal(session.safety_state, 'clarification_needed');
  assert.equal(getCurrentQuestion(session).id, 'safety_clarification');
});

test('only a standalone negative answer is treated as non-disclosure', () => {
  let session = createAssessmentSession();
  session = answer(session, 'گاهی فکر می‌کنم به خودم آسیب بزنم');
  session = answer(session, 'خیر');
  assert.equal(session.safety_state, 'no_immediate_risk_disclosed');
  assert.equal(getCurrentQuestion(session).id, 'impact');
});


test('intent to seek ordinary support is not mistaken for intent to cause harm', () => {
  let session = createAssessmentSession();
  session = answer(session, 'گاهی فکر می‌کنم به خودم آسیب بزنم');
  session = answer(session, 'قصد دارم با دوستم صحبت کنم');
  assert.equal(session.safety_state, 'clarification_needed');
  assert.equal(getCurrentQuestion(session).id, 'safety_clarification');
});

test('explicit harm-related intent is escalated to human support', () => {
  let session = createAssessmentSession();
  session = answer(session, 'گاهی فکر می‌کنم به خودم آسیب بزنم');
  session = answer(session, 'قصد دارم به خودم آسیب بزنم');
  assert.equal(session.safety_state, 'urgent_human_support_recommended');
  assert.equal(session.status, 'paused_for_human_support');
});


function completeIntakeToSummary(opening, clarification = 'یک نمونه مشخص از همین تجربه') {
  let session = createAssessmentSession();
  session = answer(session, opening);
  session = answer(session, 'نه');
  session = answer(session, 'در زندگی روزمره‌ام اثر گذاشته است');
  session = answer(session, 'چند هفته است');
  session = answer(session, 'می‌خواهم بهتر بفهمم چه اتفاقی می‌افتد');
  session = answer(session, clarification);
  return session;
}

test('a rejected attributed insult is not classified as the user belief', () => {
  const session = completeIntakeToSummary(
    'دوستم گفت «تو بی‌ارزشی»، ولی من با این حرف موافق نیستم.'
  );
  assert.equal(getCurrentQuestion(session).id, 'summary_confirmation');
  assert.equal(
    getAssessmentSummary(session).candidate_topics.some((item) => item.topic_id === 'T23'),
    false
  );
});

test('a negated self-hatred phrase does not create a T18 hypothesis', () => {
  const session = completeIntakeToSummary('من نفرت از خود ندارم؛ از یک رفتار مشخص ناراحتم.');
  assert.equal(
    getAssessmentSummary(session).candidate_topics.some((item) => item.topic_id === 'T18'),
    false
  );
});

test('regret about a specific behavior is not automatically self-hatred or worthlessness', () => {
  const session = completeIntakeToSummary('از رفتار دیروزم ناراحتم، نه از خودم.');
  const ids = getAssessmentSummary(session).candidate_topics.map((item) => item.topic_id);
  assert.equal(ids.includes('T18'), false);
  assert.equal(ids.includes('T23'), false);
});

test('privacy protection alone does not create a shame hypothesis', () => {
  const session = completeIntakeToSummary('نمی‌خواهم موضوع خصوصی‌ام را برای دیگران افشا کنم.');
  assert.equal(
    getAssessmentSummary(session).candidate_topics.some((item) => item.topic_id === 'T26'),
    false
  );
});

test('constructive self-criticism remains a tentative T33 hint, not a maladaptive conclusion', () => {
  const session = completeIntakeToSummary(
    'خودانتقادی من کمک می‌کند رفتارم را اصلاح کنم و قدم بعدی را مشخص کنم.'
  );
  const item = getAssessmentSummary(session).candidate_topics.find((candidate) => candidate.topic_id === 'T33');
  assert.ok(item);
  assert.equal(item.status, 'tentative_hypothesis');
  assert.equal(session.summary.limitations.some((line) => line.includes('تشخیص نیست')), true);
});


test('explicit translation requests do not turn quoted example language into personal topic hypotheses', () => {
  const session = completeIntakeToSummary('برای ترجمه جمله «من بی‌ارزشم» کمک می‌خواهم.');
  assert.equal(
    getAssessmentSummary(session).candidate_topics.some((item) => item.topic_id === 'T23'),
    false
  );
});

test('externally attributed statements remain unclassified until the user clarifies ownership', () => {
  const session = completeIntakeToSummary('دوستم گفت من از خودم متنفرم.');
  const ids = getAssessmentSummary(session).candidate_topics.map((item) => item.topic_id);
  assert.equal(ids.includes('T18'), false);
});

test('multiple distinct self-evaluation experiences can coexist without forcing one primary topic', () => {
  const session = completeIntakeToSummary(
    'از خودم متنفرم، خودم را بابت آن اتفاق سرزنش می‌کنم و احساس می‌کنم بی‌ارزشم.'
  );
  const ids = getAssessmentSummary(session).candidate_topics.map((item) => item.topic_id);
  assert.ok(ids.includes('T18'));
  assert.ok(ids.includes('T19'));
  assert.ok(ids.includes('T23'));
  assert.ok(ids.length <= 3);
});

test('a harmed person denying responsibility is not assigned self-blame from the abuse context alone', () => {
  const session = completeIntakeToSummary(
    'مادرم به من آسیب زد و من خودم را بابت رفتار او مقصر نمی‌دانم.'
  );
  assert.equal(
    getAssessmentSummary(session).candidate_topics.some((item) => item.topic_id === 'T19'),
    false
  );
});

test('corrected user text does not silently revive old topic hypotheses', () => {
  let session = completeIntakeToSummary('مدتی است اضطراب دارم');
  assert.ok(getAssessmentSummary(session).candidate_topics.some((item) => item.topic_id === 'T02'));
  session = answer(session, 'خلاصه درست نیست');
  session = answer(session, 'موضوع من ترجمه عبارت بی‌ارزشم بود، نه تجربه شخصی');
  assert.equal(getCurrentQuestion(session).id, 'summary_confirmation');
  assert.equal(getAssessmentSummary(session).candidate_topics.length, 0);
  assert.equal(getAssessmentSummary(session).topic_assessment_status, 'requires_reassessment');
});
