import { ASSESSMENT_CONTEXT_VERSION, extractConservativeAssessmentEvidence } from './assessmentLanguageContext.v1.js';
import { validateAssistantContext } from './assistantContext.v1.js';
import { assessmentTopicRuleRegistry } from './assessmentTopicRuleRegistry.v1.js';

// Fail closed: lexical topic hints remain unavailable until the registry itself
// is explicitly authorized and every rule has completed independent review.
const TOPIC_RULES = assessmentTopicRuleRegistry.runtime_authorization === true &&
  assessmentTopicRuleRegistry.runtime_eligible === true &&
  assessmentTopicRuleRegistry.status === 'approved_for_runtime' &&
  assessmentTopicRuleRegistry.rules.every((rule) =>
    rule.runtime_eligible === true && rule.review_status === 'approved'
  )
  ? assessmentTopicRuleRegistry.rules.map(({ topic_id, phrases }) => [topic_id, phrases])
  : [];

const SAFETY_CUES = [
  'خودکشی', 'قصد خودکشی', 'به زندگی ام پایان', 'به زندگیم پایان',
  'خودم را بکشم', 'خودمو بکشم', 'به خودم آسیب', 'خودزنی',
  'به کسی آسیب بزنم', 'او را بکشم', 'تهدید به قتل', 'خشونت خانگی',
  'در خانه امن نیستم', 'الان در خطرم',
];

const QUESTION = {
  open: { id: 'open_problem', stage: 'open_intent', prompt: 'دوست داری درباره چه مسئله‌ای صحبت کنیم؟ با زبان خودت توضیح بده؛ لازم نیست از بین موضوعات اپ چیزی انتخاب کنی.' },
  safety: { id: 'safety_now', stage: 'safety_check', prompt: 'پیش از ادامه یک بررسی کوتاه ایمنی: آیا همین الآن احتمال می‌دهی به خودت یا شخص دیگری آسیب بزنی، یا کسی در حال حاضر تو را در معرض خطر قرار داده است؟ می‌توانی «بله»، «نه» یا «مطمئن نیستم» بگویی.' },
  impact: { id: 'impact', stage: 'context_and_impact', prompt: 'این مسئله در زندگی روزمره‌ات چه اثری گذاشته است؟ اگر می‌توانی یک نمونه واقعی و اخیر بگو.' },
  duration: { id: 'duration', stage: 'context_and_impact', prompt: 'این وضعیت از چه زمانی شروع شده و معمولاً هر چند وقت یک‌بار اتفاق می‌افتد؟' },
  goal: { id: 'goal', stage: 'open_intent', prompt: 'از این گفتگو بیشتر چه کمکی می‌خواهی: فهمیدن مسئله، پیدا کردن راهکار، یا تصمیم‌گیری درباره کمک تخصصی؟' },
  clarify: { id: 'clarify_example', stage: 'differential_clarification', prompt: 'برای اینکه اشتباه دسته‌بندی نکنم، یک موقعیت مشخص و اخیر را تعریف می‌کنی؟ در آن لحظه چه اتفاقی افتاد، چه فکری از ذهنت گذشت و چه احساسی داشتی؟' },
  summary: { id: 'summary_confirmation', stage: 'collaborative_summary', prompt: 'این خلاصه تا چه اندازه تجربه‌ات را درست بازتاب می‌دهد؟ چه چیزی را باید اصلاح یا اضافه کنم؟' },
  summary_revision: { id: 'summary_revision', stage: 'user_correction', prompt: 'ممنون که اصلاح کردی. لطفاً دقیق بگو کدام بخش برداشت من نادرست بود و به‌جای آن چه چیزی را باید بفهمم؟ اگر موضوعات پیشنهادی اشتباه‌اند، بگو کدام‌یک را کنار بگذارم.' },
  safety_uncertain: { id: 'safety_clarification', stage: 'safety_check', prompt: 'منظورت از پاسخ قبلی برایم روشن نیست. آیا در همین الآن قصد، برنامه یا احتمال عملی آسیب‌زدن به خودت یا دیگری وجود دارد؟ می‌توانی بگویی «بله»، «نه» یا «مطمئن نیستم».' },
};

function normalize(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .replace(/[\u064A\u0649]/g, 'ی')
    .replace(/\u0643/g, 'ک')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function detectSafetyCue(text) {
  const normalized = normalize(text);
  return SAFETY_CUES.some((cue) => normalized.includes(normalize(cue)));
}

function isExplicitlyNegated(normalized, phrase) {
  const needle = normalize(phrase);
  const index = normalized.indexOf(needle);
  if (index < 0) return false;
  const before = normalized.slice(Math.max(0, index - 18), index);
  const after = normalized.slice(index + needle.length, index + needle.length + 22);
  return /(?:نه|هرگز|اصلاً|ابداً)\s*$/.test(before) ||
    /^\s*(?:نیستم|نیست|نبودم|نبود|نمی\S*|ندارم|ندارد|نخواهم|نمی\s+خواهم)/.test(after);
}

function isRejectedAttribution(normalized, topicId) {
  if (!['T18', 'T19', 'T23', 'T26', 'T33'].includes(topicId)) return false;
  const attributed = /(?:دوستم|مادرم|پدرم|همسرم|مدیرم|او|دیگران)\s+(?:گفت|گفته|نوشت|می\s+گوید)/.test(normalized);
  const rejected = /(?:ولی|اما|با\s+این\s+حال).{0,45}(?:قبول\s+ندارم|موافق\s+نیستم|درست\s+نمی\s+دانم|باور\s+نمی\s+کنم)/.test(normalized);
  return attributed && rejected;
}

function isMetaLanguageRequest(normalized) {
  return /(?:برای\s+ترجمه|ترجمه\s+(?:این\s+)?جمله|معنی\s+(?:این\s+)?عبارت|مثال\s+(?:فرضی|از)|جمله\s+فرضی|چطور\s+می(?:شود|شه)\s+گفت)/.test(normalized);
}

function detectTopics(text) {
  const context = extractConservativeAssessmentEvidence(text);
  const normalized = normalize(context.evidence_text);
  if (!normalized) return [];
  const hits = [];
  for (const [topic_id, phrases] of TOPIC_RULES) {
    if (isRejectedAttribution(normalized, topic_id)) continue;
    const uniquePhrases = [...new Map(phrases.map((phrase) => [normalize(phrase), phrase])).values()];
    const matched = uniquePhrases.filter((phrase) =>
      normalized.includes(normalize(phrase)) && !isExplicitlyNegated(normalized, phrase)
    );
    if (matched.length) hits.push({ topic_id, matched_phrases: matched });
  }
  // T04 is a broad anger/aversion category; when the explicit self-directed
  // construct T18 is present, do not let the generic phrase duplicate it.
  const filteredHits = hits.some((item) => item.topic_id === 'T18')
    ? hits.filter((item) => item.topic_id !== 'T04')
    : hits;
  return filteredHits.sort((a, b) => b.matched_phrases.length - a.matched_phrases.length).slice(0, 3);
}

function classifySafetyAnswer(text) {
  const value = normalize(text);
  if (/^(بله|آره|اره|yes)(\\b|$)/.test(value) ||
      ((value.includes('قصد دارم') || value.includes('برنامه دارم')) && detectSafetyCue(value))) {
    return 'urgent_human_support_recommended';
  }
  // A negative opening must not override risk language later in the same answer.
  // Only a standalone negative is treated as non-disclosure; qualified answers
  // are clarified rather than interpreted as proof of safety.
  if (/^(نه|خیر|no)[.!؟،,]*$/.test(value)) return 'no_immediate_risk_disclosed';
  return 'clarification_needed';
}

export function createAssessmentSession({ localOnly = true, assistantContext = null, consentState = {} } = {}) {
  if (localOnly !== true) throw new Error('این موتور فقط برای پردازش محلی طراحی شده است؛ ارسال ابری در این نسخه پشتیبانی نمی‌شود.');
  let validatedContext = null;
  if (assistantContext) {
    const validation = validateAssistantContext(assistantContext, { consentState });
    if (validation.valid) validatedContext = assistantContext;
  }
  return {
    schema_version: '1.0.0',
    protocol_id: 'maseer28-adaptive-intake',
    status: 'in_progress',
    safety_state: 'not_assessed',
    current_question: QUESTION.open,
    safety_context_flag: false,
    answers: {},
    candidate_topics: [],
    summary: null,
    processing: 'local_in_memory_only',
    assistant_context: validatedContext,
  };
}

export function getCurrentQuestion(session) {
  return session?.current_question ?? null;
}

export function submitAssessmentAnswer(session, answer, { consentState = {} } = {}) {
  if (!session || session.status !== 'in_progress') throw new Error('جلسه ارزیابی فعال نیست.');
  if (!session.current_question) throw new Error('پرسشی برای پاسخ‌گویی وجود ندارد.');
  const value = String(answer ?? '').trim();
  if (!value) throw new Error('پاسخ خالی است؛ می‌توانی بگویی «رد می‌کنم» یا جلسه را متوقف کنی.');
  const contextValidation = session.assistant_context
    ? validateAssistantContext(session.assistant_context, { consentState })
    : { valid: false };
  const next = {
    ...session,
    assistant_context: contextValidation.valid ? session.assistant_context : null,
    answers: { ...session.answers },
    candidate_topics: [...session.candidate_topics],
    summary: session.summary ? { ...session.summary } : null,
  };
  const questionId = next.current_question.id;
  next.answers[questionId] = value;

  if (questionId === 'open_problem') {
    next.safety_context_flag = detectSafetyCue(value);
    next.current_question = QUESTION.safety;
    return next;
  }

  if (questionId === 'safety_now' || questionId === 'safety_clarification') {
    next.safety_state = classifySafetyAnswer(value);
    if (next.safety_state === 'urgent_human_support_recommended') {
      next.status = 'paused_for_human_support';
      next.current_question = null;
      next.referral = {
        priority: 'urgent',
        instruction: 'این ابزار جایگزین کمک فوری نیست. اگر خطر در همین الآن وجود دارد، از موقعیت خطر فاصله بگیر، تنها نمان، با خدمات اورژانسی محل زندگی یا فرد قابل اعتماد تماس بگیر و در صورت امکان به نزدیک‌ترین مرکز درمانی مراجعه کن.',
      };
      return next;
    }
    if (next.safety_state === 'clarification_needed') {
      next.current_question = QUESTION.safety_uncertain;
      return next;
    }
    next.current_question = QUESTION.impact;
    return next;
  }

  if (questionId === 'impact') next.current_question = QUESTION.duration;
  else if (questionId === 'duration') next.current_question = QUESTION.goal;
  else if (questionId === 'goal') {
    next.candidate_topics = detectTopics(next.answers.open_problem);
    next.current_question = QUESTION.clarify;
  } else if (questionId === 'clarify_example') {
    const extra = detectTopics(value);
    const merged = new Map([...next.candidate_topics, ...extra].map((item) => [item.topic_id, item]));
    next.candidate_topics = [...merged.values()].slice(0, 3);
    if (next.candidate_topics.length === 0) next.candidate_topics = [{ topic_id: 'T34', matched_phrases: [], status: 'needs_clarification' }];
    const names = next.candidate_topics.map((item) => item.topic_id);
    next.summary = {
      user_report: next.answers.open_problem,
      context_example: value,
      impact: next.answers.impact,
      duration: next.answers.duration,
      user_goal: next.answers.goal,
      candidate_topics: next.candidate_topics.map((item) => ({ topic_id: item.topic_id, status: item.status || 'tentative_hypothesis', matched_rule_phrases: [...(item.matched_phrases || [])] })),
      evidence_processing: {
        context_extraction_version: ASSESSMENT_CONTEXT_VERSION,
        matching_method: assessmentTopicRuleRegistry.matching_method,
        semantic_understanding: false,
        status: 'experimental_not_clinically_validated',
      },
      limitations: [
        'این دسته‌بندی بر پایه تطبیق واژه‌ها و گفته‌های همین گفتگو است؛ ارزیابی روان‌شناختی یا تشخیص نیست.',
        'نبودن یک موضوع در فهرست به معنی رد آن نیست.',
        'هیچ رابطه علّی میان موضوعات از این تطبیق نتیجه‌گیری نمی‌شود.',
      ],
    };
    next.current_question = QUESTION.summary;
  } else if (questionId === 'summary_confirmation') {
    const accepted = normalize(value).replace(/[.!؟،,]/g, '').trim();
    if (['بله', 'آره', 'اره', 'درسته', 'درست است', 'خلاصه درست است', 'بله درست است'].includes(accepted)) {
      next.answers.summary_feedback = value;
      next.summary.review_status = 'user_confirmed';
      next.status = 'completed';
      next.current_question = null;
      next.next_step = {
        content_available: false,
        reason: 'هیچ تمرین یا مداخله‌ای تا تأیید علمی و تخصصی به این موتور متصل نشده است.',
        recommendation: 'ابتدا خلاصه را با یک متخصص یا خودت دقیق‌تر کن؛ در صورت تداوم رنج یا اختلال عملکرد، ارزیابی متخصص سلامت روان مناسب است.',
      };
    } else {
      next.summary.review_status = 'correction_requested';
      next.summary.prior_candidate_topics = [...next.summary.candidate_topics];
      next.summary.candidate_topics = [];
      next.summary.topic_assessment_status = 'withdrawn_pending_reassessment';
      next.summary.correction_request = value;
      next.current_question = QUESTION.summary_revision;
    }
  } else if (questionId === 'summary_revision') {
    next.answers.summary_revision = value;
    next.summary.user_correction = value;
    next.summary.review_status = 'user_corrected_pending_confirmation';
    next.summary.topic_assessment_status = 'requires_reassessment';
    next.summary.candidate_topics = [];
    next.summary.limitations = [
      ...next.summary.limitations,
      'پس از اصلاح کاربر، فرضیه‌های موضوعی قبلی کنار گذاشته شدند؛ موتور هنوز توان بازارزیابی معتبر موضوع را ندارد و نباید آن‌ها را به‌عنوان برداشت جاری نمایش دهد.',
      'متن اصلاح‌شده کاربر باید توسط خود کاربر یا متخصص بازبینی شود؛ این اصلاح به‌تنهایی تشخیص یا ارزیابی علمی محسوب نمی‌شود.',
    ];
    next.current_question = QUESTION.summary;
  }
  return next;
}

export function stopAssessment(session) {
  if (!session) return null;
  return { ...session, status: 'stopped_by_user', current_question: null, answers: {}, summary: null, assistant_context: null };
}

export function getAssessmentSummary(session) {
  return session?.summary ?? null;
}

// Catalog IDs are exposed for consistency checks; this does not mean the rules are active.
export const assessmentEngineTopicRuleIds = Object.freeze(assessmentTopicRuleRegistry.rules.map(({ topic_id }) => topic_id));

export const assessmentEngineMetadata = Object.freeze({
  version: '1.0.0',
  topic_rule_registry_version: assessmentTopicRuleRegistry.registry_version,
  topic_rule_runtime_authorized: TOPIC_RULES.length > 0,
  topic_rule_runtime_status: TOPIC_RULES.length > 0 ? 'authorized' : 'disabled_fail_closed',
  active_topic_rule_count: TOPIC_RULES.length,
  context_extraction_version: ASSESSMENT_CONTEXT_VERSION,
  runtime_status: 'experimental_local_only',
  diagnostic_use: false,
  validated_screening_tool: false,
  cloud_processing: false,
  safety_triage_validated: false,
  clinical_review_complete: false,
  uses_unreviewed_relation_graph: false,
  auto_recommends_interventions: false,
});
