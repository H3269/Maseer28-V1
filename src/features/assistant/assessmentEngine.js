const TOPIC_RULES = [
  ['T01', ['خشم', 'عصبانی', 'عصبانیت', 'از کوره', 'جوش میارم']],
  ['T02', ['اضطراب', 'نگرانی مداوم', 'دلشوره', 'نگران آینده']],
  ['T03', ['ترس', 'میترسم', 'می ترسم', 'وحشت', 'هراس']],
  ['T04', ['نفرت', 'بیزاری از', 'متنفرم']],
  ['T05', ['حسادت', 'حسود']],
  ['T06', ['سوگ', 'فقدان', 'از دست دادن عزیز', 'غمگین', 'اندوه']],
  ['T07', ['احساس گناه', 'عذاب وجدان', 'گناهکار']],
  ['T08', ['وابستگی عاطفی', 'وابسته ام', 'بدون او نمیتوانم', 'بدون او نمی توانم']],
  ['T09', ['اهمال کاری', 'اهمال‌کاری', 'کارها را عقب', 'به تعویق می اندازم', 'شروع کار سخت']],
  ['T10', ['بی خوابی', 'بی‌خوابی', 'خوابم نمیبرد', 'خوابم نمی برد', 'از خواب بیدار']],
  ['T11', ['عادت تکراری', 'رفتار تکراری', 'موهایم را میکنم', 'پوستم را میکنم']],
  ['T12', ['نه گفتن', 'مرزبندی', 'حد و مرز', 'درخواست دیگران را رد']],
  ['T13', ['تنهایی', 'احساس تنهایی', 'انزوا', 'کسی را ندارم']],
  ['T14', ['کمبود انگیزه', 'انگیزه ندارم', 'میل شروع ندارم']],
  ['T15', ['اعتماد به نفس', 'اعتمادبه نفس', 'از پسش برنمیام']],
  ['T16', ['نشخوار فکری', 'افکار منفی', 'فکرهای تکراری', 'ذهنم رها نمیکند']],
  ['T17', ['مشکل رابطه', 'مشکلات رابطه', 'اختلاف با همسر', 'تعارض رابطه']],
  ['T18', ['نفرت از خود', 'از خودم متنفرم', 'خودم را دوست ندارم']],
  ['T19', ['خودسرزنشی', 'خودم را سرزنش', 'همه تقصیرها گردن من']],
  ['T20', ['کمال گرایی', 'کمال‌گرایی', 'باید بی نقص', 'باید بی‌نقص']],
  ['T21', ['اجتناب', 'فرار از موقعیت', 'از موقعیت دوری']],
  ['T22', ['استرس', 'فشار روانی', 'تحت فشار']],
  ['T23', ['بی ارزشی', 'بی‌ارزشی', 'بی ارزشم', 'بی‌ارزشم']],
  ['T24', ['کنترل هیجان', 'تنظیم هیجان', 'احساساتم از کنترل خارج']],
  ['T25', ['رنجش', 'کینه', 'دلخوری طولانی']],
  ['T26', ['شرم', 'خجالت از خود', 'احساس رسوایی']],
  ['T27', ['ترس از قضاوت', 'قضاوت دیگران', 'نگران نظر دیگران']],
  ['T28', ['ترس از شکست', 'از شکست میترسم', 'از شکست می ترسم']],
  ['T29', ['ترس از طرد', 'طرد شدن', 'ترک شدن', 'رد شدن از طرف']],
  ['T30', ['شک و تردید', 'دودلی', 'تصمیم گیری سخت', 'تصمیم‌گیری سخت']],
  ['T31', ['کنترل گری', 'کنترل‌گری', 'همه چیز باید دست من', 'رفتار کنترلی']],
  ['T32', ['بی انگیزگی', 'بی‌انگیزگی', 'بی انرژی', 'بی‌انرژی', 'علاقه ندارم']],
  ['T33', ['خودانتقادی', 'از خودم ایراد', 'منتقد درونی']],
];

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

function detectTopics(text) {
  const normalized = normalize(text);
  const hits = [];
  for (const [topic_id, phrases] of TOPIC_RULES) {
    const matched = phrases.filter((phrase) => normalized.includes(normalize(phrase)));
    if (matched.length) hits.push({ topic_id, matched_phrases: matched });
  }
  return hits.sort((a, b) => b.matched_phrases.length - a.matched_phrases.length).slice(0, 3);
}

function classifySafetyAnswer(text) {
  const value = normalize(text);
  const uncertaintyCues = [
    'مطمئن نیستم', 'نمی دانم', 'نمی‌دانم', 'شاید', 'ممکن است', 'ممکنه',
    'احتمال دارد', 'نه ولی', 'نه اما', 'خیر ولی', 'خیر اما',
    'نمی توانم قول', 'نمی‌توانم قول', 'نمی تونم قول', 'نمی‌تونم قول',
  ];
  if (uncertaintyCues.some((cue) => value.includes(normalize(cue)))) return 'clarification_needed';
  if (/^(بله|آره|اره|yes)(\b|$)/.test(value) || value.includes('قصد دارم') || value.includes('برنامه دارم')) {
    return 'urgent_human_support_recommended';
  }
  // Only a clear, standalone negative answer is treated as non-disclosure.
  // Mixed or explanatory answers require clarification rather than being
  // silently interpreted as a negative safety response.
  if (/^(نه|خیر|no)$/.test(value)) return 'no_immediate_risk_disclosed';
  return 'clarification_needed';
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
  const next = { ...session, answers: { ...session.answers }, candidate_topics: [...session.candidate_topics], summary: session.summary ? { ...session.summary } : null };
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
      candidate_topics: next.candidate_topics.map((item) => ({ topic_id: item.topic_id, status: item.status || 'tentative_hypothesis' })),
      limitations: [
        'این دسته‌بندی بر پایه تطبیق واژه‌ها و گفته‌های همین گفتگو است؛ ارزیابی روان‌شناختی یا تشخیص نیست.',
        'نبودن یک موضوع در فهرست به معنی رد آن نیست.',
        'هیچ رابطه علّی میان موضوعات از این تطبیق نتیجه‌گیری نمی‌شود.',
      ],
    };
    next.current_question = QUESTION.summary;
  } else if (questionId === 'summary_confirmation') {
    next.answers.summary_feedback = value;
    next.status = 'completed';
    next.current_question = null;
    next.next_step = {
      content_available: false,
      reason: 'هیچ تمرین یا مداخله‌ای تا تأیید علمی و تخصصی به این موتور متصل نشده است.',
      recommendation: 'ابتدا خلاصه را با یک متخصص یا خودت دقیق‌تر کن؛ در صورت تداوم رنج یا اختلال عملکرد، ارزیابی متخصص سلامت روان مناسب است.',
    };
  }
  return next;
}

export function stopAssessment(session) {
  if (!session) return null;
  return { ...session, status: 'stopped_by_user', current_question: null, answers: {}, summary: null };
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
