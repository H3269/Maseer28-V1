import { routeSemanticIntake } from './intentContextRouter.js';
import { routeAssistantTurn } from './assistantTurnEngine.js';

const QUESTION = {
  open: { id: 'open_problem', stage: 'open_intent', prompt: 'دوست داری درباره چه مسئله‌ای صحبت کنیم؟ با زبان خودت توضیح بده؛ لازم نیست از بین موضوعات اپ چیزی انتخاب کنی.' },
  safety: { id: 'safety_now', stage: 'safety_check', prompt: 'پیش از ادامه یک بررسی کوتاه ایمنی: آیا همین الآن احتمال می‌دهی به خودت یا شخص دیگری آسیب بزنی، یا کسی در حال حاضر تو را در معرض خطر قرار داده است؟ می‌توانی «بله»، «نه» یا «مطمئن نیستم» بگویی.' },
  impact: { id: 'impact', stage: 'context_and_impact', prompt: 'این مسئله در زندگی روزمره‌ات چه اثری گذاشته است؟ اگر می‌توانی یک نمونه واقعی و اخیر بگو.' },
  duration: { id: 'duration', stage: 'context_and_impact', prompt: 'این وضعیت از چه زمانی شروع شده و معمولاً هر چند وقت یک‌بار اتفاق می‌افتد؟' },
  goal: { id: 'goal', stage: 'open_intent', prompt: 'از این گفتگو بیشتر چه کمکی می‌خواهی: فهمیدن مسئله، پیدا کردن راهکار، یا تصمیم‌گیری درباره کمک تخصصی؟' },
  clarify: { id: 'clarify_example', stage: 'differential_clarification', prompt: 'برای اینکه اشتباه دسته‌بندی نکنم، یک موقعیت مشخص و اخیر را تعریف می‌کنی؟ در آن لحظه چه اتفاقی افتاد، چه فکری از ذهنت گذشت و چه احساسی داشتی؟' },
  summary: { id: 'summary_confirmation', stage: 'collaborative_summary', prompt: 'این خلاصه تا چه اندازه تجربه‌ات را درست بازتاب می‌دهد؟ چه چیزی را باید اصلاح یا اضافه کنم؟' },
  summary_revision: { id: 'summary_revision', stage: 'collaborative_summary', prompt: 'کدام بخش را دقیقاً اصلاح کنم: شرح مسئله، اثر، مدت، هدف یا موضوع احتمالی؟ لطفاً اصلاح را با زبان خودت بنویس.' },
  safety_uncertain: { id: 'safety_clarification', stage: 'safety_check', prompt: 'منظورت از پاسخ قبلی برایم روشن نیست. آیا در همین الآن قصد، برنامه یا احتمال عملی آسیب‌زدن به خودت یا دیگری وجود دارد؟ می‌توانی بگویی «بله»، «نه» یا «مطمئن نیستم».' },
};

function normalize(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .replace(/[\u064A\u0649]/g, 'ی')
    .replace(/\u0643/g, 'ک')
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function classifySafetyDomains(text) {
  const value = normalize(text);
  const domains = [];
  if (/(خودکشی|خودم را بکشم|خودمو بکشم|به خودم آسیب|خودزنی|خودآسیبی|آسیب زدن به خودم|فکر آسیب زدن به خودم|کاش نبودم|کاش بمیرم|نمی خواهم زنده باشم|نمی خوام زنده باشم)/.test(value)) {
    domains.push('risk_of_self_harm');
  }
  if (/(به کسی آسیب|به او آسیب|او را بکشم|تهدید به قتل|می خواهم کسی را بکشم|می خواهم به دیگران آسیب)/.test(value)) {
    domains.push('risk_of_harm_to_others');
  }
  if (/(خشونت خانگی|در خانه امن نیستم|خانه امن نیست|تهدیدم کرد|تهدیدم می کند|مورد ضرب و شتم|از طرف .* تهدید|کسی مرا تهدید)/.test(value)) {
    domains.push('risk_from_another_person');
  }
  return domains.length ? domains : ['domain_not_yet_determined'];
}

export function classifySafetyAnswer(text) {
  const value = normalize(text);
  if (!value) return 'clarification_needed';

  const uncertainty = [
    'مطمئن نیستم', 'نمی دانم', 'نمیدانم', 'شاید', 'احتمال دارد',
    'احتمالش هست', 'سخت است بگویم', 'سخته بگم', 'نمی توانم بگویم',
    'نمی تونم بگم', 'نامشخص است',
  ];
  if (uncertainty.some((phrase) => value.includes(normalize(phrase)))) {
    if (value.includes('قصد دارم') || value.includes('برنامه دارم')) {
      return 'urgent_human_support_recommended';
    }
    return 'clarification_needed';
  }

  const explicitIntent = [
    'قصد دارم', 'برنامه دارم', 'تصمیم دارم', 'می خواهم به خودم آسیب',
    'می خواهم به او آسیب', 'ممکن است به خودم آسیب بزنم',
    'ممکن است به کسی آسیب بزنم', 'کنترلش از دستم خارج می شود',
  ];
  if (explicitIntent.some((phrase) => value.includes(normalize(phrase)))) {
    return 'urgent_human_support_recommended';
  }

  if (/^(بله|آره|اره|yes)(?:[،,\s]|$)/.test(value)) {
    return 'urgent_human_support_recommended';
  }

  const directNegative = /^(نه|خیر|no)(?:[،,\s]|$)/.test(value);
  if (directNegative) {
    const residual = value.replace(/^(نه|خیر|no)[،,\s]*/, '').trim();
    if (!residual || /^(?:قصد(?:\s+[^،,]+)?\s+ندارم|برنامه(?:\s+[^،,]+)?\s+ندارم|نمی خواهم|نمیخوام|هیچ قصدی ندارم)(?:[.!؟،,\s]|$)/.test(residual)) {
      return 'no_immediate_risk_disclosed';
    }
    return 'clarification_needed';
  }

  return 'clarification_needed';
}

function isDeclinedAnswer(value) {
  const normalized = normalize(value);
  return [
    'رد می کنم',
    'ترجیح می دهم نگویم',
    'نمی دانم',
    'نمی خوام پاسخ بدهم',
    'نمی خواهم پاسخ بدهم',
    'فعلا نمی خواهم',
    'نامشخص است',
  ].includes(normalized);
}

function hasDurationEvidence(value) {
  return /(?:چند روز|چند هفته|چند ماه|چند سال|از کودکی|از بچگی|از پارسال|از سال گذشته|از ماه گذشته|هر روز|هر شب|از \\d+ (?:روز|هفته|ماه|سال)|\\d+ (?:روز|هفته|ماه|سال)|(?:یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|چند) (?:روز|هفته|ماه|سال))/.test(normalize(value));
}

function hasImpactEvidence(value) {
  return /(?:در زندگی روزمره|در کارم|در رابطه|باعث شده|اثر گذاشته|اختلال ایجاد|تمرکزم را|خوابم را|روابطم را|نمی توانم کار|نمی تونم کار)/.test(normalize(value));
}

function hasConcreteExample(value) {
  return /(?:وقتی|مثلاً|برای مثال|دیروز|امروز|در جلسه|در محل کار|با همسرم|در خانه|هفته گذشته)/.test(normalize(value));
}

function inferredGoal(intentLabel) {
  return ({
    understand_problem: 'فهم بهتر مسئله',
    request_strategy: 'دریافت راهکار',
    professional_help_decision: 'تصمیم‌گیری درباره کمک تخصصی',
  })[intentLabel] ?? null;
}

function updateSemanticContext(session, requestId) {
  const opening = session.answers.open_problem || '';
  const facts = {
    impact: isDeclinedAnswer(session.answers.impact) ? null : (session.answers.impact || (hasImpactEvidence(opening) ? opening : null)),
    duration: isDeclinedAnswer(session.answers.duration) ? null : (session.answers.duration || (hasDurationEvidence(opening) ? opening : null)),
    user_goal: isDeclinedAnswer(session.answers.goal) ? null : (session.answers.goal || null),
  };
  session.semantic_intake = routeSemanticIntake({
    text: opening,
    requestId,
    priorContext: { situational_facts: facts },
  });
  if (!facts.user_goal) {
    facts.user_goal = inferredGoal(session.semantic_intake.intent.label);
    if (facts.user_goal) {
      session.semantic_intake = routeSemanticIntake({
        text: opening,
        requestId,
        priorContext: { situational_facts: facts },
      });
    }
  }
  session.candidate_topics = session.semantic_intake.topic_candidates.map((item) => ({
    topic_id: item.topic_id,
    matched_phrases: item.evidence_quotes,
    status: 'tentative_hypothesis',
    confidence_band: item.confidence_band,
  }));
}

function buildAssessmentSummary(session, contextExample = null) {
  const candidates = session.candidate_topics.length
    ? session.candidate_topics
    : [{ topic_id: 'T34', status: 'needs_clarification' }];
  session.candidate_topics = candidates;
  session.summary = {
    user_report: session.answers.open_problem,
    context_example: contextExample,
    impact: session.answers.impact || (hasImpactEvidence(session.answers.open_problem) ? 'در پیام آغازین اشاره شده' : 'در گفتگو مشخص نشد'),
    duration: session.answers.duration || (hasDurationEvidence(session.answers.open_problem) ? 'در پیام آغازین اشاره شده' : 'در گفتگو مشخص نشد'),
    user_goal: session.answers.goal || inferredGoal(session.semantic_intake?.intent?.label) || 'در گفتگو مشخص نشد',
    candidate_topics: candidates.map((item) => ({ topic_id: item.topic_id, status: item.status || 'tentative_hypothesis' })),
    limitations: [
      'این دسته‌بندی بر پایه قواعد واژگانی محدود و گفته‌های همین گفتگو است؛ ارزیابی روان‌شناختی یا تشخیص نیست.',
      'نبودن یک موضوع در فهرست به معنی رد آن نیست.',
      'هیچ رابطه علّی میان موضوعات از این تطبیق نتیجه‌گیری نمی‌شود.',
    ],
  };
}

function chooseNextIntakeQuestion(session) {
  const opening = session.answers.open_problem || '';
  const answered = (id) => typeof session.answers[id] === 'string' && session.answers[id].trim().length > 0;
  if (!answered('impact') && !hasImpactEvidence(opening)) return QUESTION.impact;
  if (!answered('duration') && !hasDurationEvidence(opening)) return QUESTION.duration;
  const intent = session.semantic_intake?.intent?.label;
  const goalAlreadyClear = ['understand_problem', 'request_strategy', 'professional_help_decision'].includes(intent);
  if (!answered('goal') && !goalAlreadyClear) return QUESTION.goal;
  const topics = session.semantic_intake?.topic_candidates ?? [];
  const ambiguous = session.semantic_intake?.intent?.ambiguity === 'high' || topics.length !== 1;
  const needsExample = !hasConcreteExample(opening);
  if ((ambiguous || needsExample) && (session.clarification_attempts ?? 0) < 1) {
    const prompt = session.semantic_intake?.next_question?.purpose === 'topic_disambiguation'
      ? session.semantic_intake.next_question.text
      : QUESTION.clarify.prompt;
    return { ...QUESTION.clarify, prompt };
  }
  return QUESTION.summary;
}

export function createAssessmentSession({ localOnly = true } = {}) {
  if (localOnly !== true) throw new Error('این موتور فقط برای پردازش محلی طراحی شده است؛ ارسال ابری در این نسخه پشتیبانی نمی‌شود.');
  return {
    schema_version: '1.0.0',
    protocol_id: 'maseer28-adaptive-intake',
    status: 'in_progress',
    safety_state: 'not_assessed',
    current_question: QUESTION.open,
    safety_context_flag: false,
    answers: {},
    candidate_topics: [],
    semantic_intake: null,
    clarification_attempts: 0,
    summary_revision_count: 0,
    summary: null,
    processing: 'local_in_memory_only',
  };
}

export function getCurrentQuestion(session) {
  return session?.current_question ?? null;
}

export function submitAssessmentAnswer(session, answer) {
  if (!session || session.status !== 'in_progress') throw new Error('جلسه ارزیابی فعال نیست.');
  if (!session.current_question) throw new Error('پرسشی برای پاسخ‌گویی وجود ندارد.');
  const value = String(answer ?? '').trim();
  if (!value) throw new Error('پاسخ خالی است؛ می‌توانی بگویی «رد می‌کنم» یا جلسه را متوقف کنی.');
  if (value.length > 3000) throw new Error('پاسخ بیش از حد طولانی است؛ حداکثر ۳۰۰۰ نویسه مجاز است.');
  const next = { ...session, answers: { ...session.answers }, candidate_topics: [...session.candidate_topics], summary: session.summary ? { ...session.summary } : null };
  const questionId = next.current_question.id;
  next.answers[questionId] = value;

  if (!['open_problem', 'safety_now', 'safety_clarification'].includes(questionId)) {
    const safetyProbe = routeSemanticIntake({ text: value, requestId: `assessment-safety-interrupt-${questionId}` });
    if (safetyProbe.next_question?.purpose === 'safety_clarification') {
      next.semantic_intake = safetyProbe;
      next.safety_context_flag = true;
      if (safetyProbe.safety_handoff.handoff_required) {
        next.status = 'paused_for_human_support';
        next.safety_state = 'urgent_human_support_recommended';
        next.current_question = null;
        next.referral = {
          priority: 'urgent',
          safety_domains: classifySafetyDomains([next.answers.open_problem, value].filter(Boolean).join(' ')),
          instruction: 'از اینجا ارزیابی خودکار را متوقف می‌کنیم. این ابزار نوع و شدت خطر را به‌طور معتبر ارزیابی نمی‌کند. اگر خطر در همین لحظه وجود دارد، در صورت امکان به مکان امن برو و با خدمات اورژانسی محل زندگی یا فرد قابل اعتماد تماس بگیر. اگر تهدید از سوی شخص دیگری است، از مواجهه مستقیم با او خودداری کن و از یک فرد یا مرکز حمایتی امن کمک بگیر.',
        };
        return next;
      }
      next.safety_state = 'not_assessed';
      next.current_question = QUESTION.safety;
      return next;
    }
  }

  if (questionId === 'open_problem') {
    const routedTurn = routeAssistantTurn({ text: value, knowledgeItems: [], requestId: 'assessment-open-problem' });
    next.semantic_intake = routedTurn.intake;
    next.safety_context_flag = ['safety_clarification_required', 'urgent_human_support_required'].includes(routedTurn.status);

    if (routedTurn.status === 'knowledge_unavailable') {
      next.status = 'information_request_not_supported';
      next.current_question = null;
      next.next_step = {
        content_available: false,
        reason: 'مسیر پاسخ‌گویی دانشی و بازیابی محتوای تأییدشده هنوز در runtime فعال نیست.',
        message: routedTurn.message,
      };
      return next;
    }

    if (routedTurn.status === 'urgent_human_support_required') {
      next.status = 'paused_for_human_support';
      next.safety_state = 'urgent_human_support_recommended';
      next.current_question = null;
      next.referral = {
        priority: 'urgent',
        safety_domains: classifySafetyDomains(value),
        instruction: routedTurn.message,
      };
      return next;
    }

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
        safety_domains: questionId === 'safety_now' || questionId === 'safety_clarification'
          ? classifySafetyDomains([next.answers.open_problem, value].filter(Boolean).join(' '))
          : ['domain_not_yet_determined'],
        instruction: 'این ابزار جایگزین کمک فوری نیست و پاسخ مثبت به پرسش ترکیبی، نوع خطر را به‌تنهایی مشخص نمی‌کند. اگر خطر در همین الآن وجود دارد، از موقعیت خطر فاصله بگیر، تنها نمان و با خدمات اورژانسی محل زندگی یا فرد قابل اعتماد تماس بگیر. در صورت تهدید از سوی شخص دیگر، از مواجهه مستقیم با او خودداری کن و از حمایت امن کمک بگیر.',
      };
      return next;
    }
    if (next.safety_state === 'clarification_needed') {
      next.current_question = QUESTION.safety_uncertain;
      return next;
    }
    updateSemanticContext(next, 'assessment-after-safety');
    next.current_question = chooseNextIntakeQuestion(next);
    if (next.current_question.id === 'summary_confirmation') buildAssessmentSummary(next);
    return next;
  }

  if (questionId === 'impact' || questionId === 'duration' || questionId === 'goal') {
    updateSemanticContext(next, `assessment-after-${questionId}`);
    next.current_question = chooseNextIntakeQuestion(next);
    if (next.current_question.id === 'summary_confirmation') buildAssessmentSummary(next);
  } else if (questionId === 'clarify_example') {
    next.clarification_attempts = (next.clarification_attempts ?? 0) + 1;
    const isCorrection = /منظورم|اصلاح می‌کنم|در واقع|اشتباه برداشت|نه اینکه/.test(normalize(value));
    const clarificationText = isCorrection ? value : [next.answers.open_problem, value].join(' ');
    if (isCorrection) {
      next.answers.open_problem_original = next.answers.open_problem;
      next.answers.open_problem = value;
    }
    const routed = routeSemanticIntake({
      text: clarificationText,
      requestId: 'assessment-topic-clarification',
      priorContext: { situational_facts: next.semantic_intake?.situational_facts ?? {
        impact: next.answers.impact,
        duration: next.answers.duration,
        user_goal: next.answers.goal,
      } },
    });
    next.semantic_intake = routed;
    const extra = routed.topic_candidates.map((item) => ({
      topic_id: item.topic_id,
      matched_phrases: item.evidence_quotes,
      status: 'tentative_hypothesis',
      confidence_band: item.confidence_band,
    }));
    next.candidate_topics = extra.slice(0, 3);
    if (next.candidate_topics.length === 0) next.candidate_topics = [{ topic_id: 'T34', matched_phrases: [], status: 'needs_clarification' }];
    buildAssessmentSummary(next, isCorrection ? null : value);
    next.current_question = QUESTION.summary;
  } else if (questionId === 'summary_confirmation') {
    next.answers.summary_feedback = value;
    const normalizedFeedback = normalize(value);
    const hasCorrectionCue = /اما|ولی|درست نیست|اشتباه|اصلاح|کمتر گفتم|بیشتر گفتم|جا افتاده|جا انداختم/.test(normalizedFeedback);
    const explicitlyConfirmed = /^(?:بله|آره|اره)(?:[.!؟،\s].*(?:دقیق است|درست است|همین است|موافقم|کامل است))?$/.test(normalizedFeedback) || /^(?:تایید|تایید شده|درست است|همین است|موافقم|کامل است|دقیق است|فعلا همین)[.!؟،\s]*$/.test(normalizedFeedback);
    if (explicitlyConfirmed && !hasCorrectionCue) {
      next.status = 'completed';
      next.current_question = null;
      next.next_step = {
        content_available: false,
        reason: 'هیچ تمرین یا مداخله‌ای تا تأیید علمی و تخصصی به این موتور متصل نشده است.',
        recommendation: 'ابتدا خلاصه را با یک متخصص یا خودت دقیق‌تر کن؛ در صورت تداوم رنج یا اختلال عملکرد، ارزیابی متخصص سلامت روان مناسب است.',
      };
    } else if ((next.summary_revision_count ?? 0) < 2) {
      next.summary_revision_count = (next.summary_revision_count ?? 0) + 1;
      next.current_question = QUESTION.summary_revision;
    } else {
      next.status = 'summary_needs_review';
      next.current_question = null;
      next.next_step = {
        content_available: false,
        reason: 'خلاصه پس از دو دور اصلاح هنوز تأیید نشده است.',
        message: 'خلاصه را تأییدشده ثبت نمی‌کنم. گفتگو برای بازبینی بیشتر متوقف شده تا برداشت نادرست به مرحله بعد منتقل نشود.',
      };
    }
  } else if (questionId === 'summary_revision') {
    next.answers.summary_revision = value;
    const normalizedRevision = normalize(value);
    const replacesTopic = /موضوع اصلی|منظورم|در واقع|اصلاح می کنم|به جای/.test(normalizedRevision);
    if (replacesTopic) {
      next.answers.open_problem_original ??= next.answers.open_problem;
      next.answers.open_problem = value;
      updateSemanticContext(next, 'assessment-summary-topic-correction');
      const revisedCandidates = next.semantic_intake.topic_candidates.map((item) => ({
        topic_id: item.topic_id,
        status: 'tentative_hypothesis',
      }));
      next.candidate_topics = revisedCandidates.length ? revisedCandidates : [{ topic_id: 'T34', status: 'needs_clarification' }];
      next.summary = {
        ...next.summary,
        user_report: value,
        candidate_topics: next.candidate_topics,
      };
    } else {
      const extra = `\nتوضیح تکمیلی کاربر: ${value}`;
      next.summary = {
        ...next.summary,
        user_report: `${next.summary?.user_report ?? next.answers.open_problem}${extra}`.slice(0, 1200),
        impact: /اثر|شدت|خواب|تمرکز|کار|رابطه/.test(normalizedRevision) ? value : next.summary?.impact,
        duration: /مدت|روز|هفته|ماه|سال|از چه زمانی/.test(normalizedRevision) ? value : next.summary?.duration,
        user_goal: /هدف|می خواهم|کمک/.test(normalizedRevision) ? value : next.summary?.user_goal,
      };
    }
    next.current_question = QUESTION.summary;
  }
  return next;
}

export function stopAssessment(session) {
  if (!session) return null;
  return {
    ...session,
    status: 'stopped_by_user',
    current_question: null,
    safety_state: 'not_assessed',
    safety_context_flag: false,
    answers: {},
    candidate_topics: [],
    semantic_intake: null,
    clarification_attempts: 0,
    summary_revision_count: 0,
    summary: null,
    referral: undefined,
    next_step: undefined,
  };
}

export function getAssessmentSummary(session) {
  return session?.summary ?? null;
}

export const assessmentEngineMetadata = Object.freeze({
  version: '1.0.0',
  runtime_status: 'experimental_local_only',
  diagnostic_use: false,
  validated_screening_tool: false,
  cloud_processing: false,
  safety_triage_validated: false,
  clinical_review_complete: false,
  uses_unreviewed_relation_graph: false,
  auto_recommends_interventions: false,
});
