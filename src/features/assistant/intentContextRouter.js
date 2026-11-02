const TOPIC_RULES = [
  ['T01', ['خشم', 'عصبانی', 'عصبانیت']],
  ['T02', ['اضطراب', 'نگرانی مداوم', 'دلشوره', 'نگران آینده']],
  ['T03', ['ترس', 'می‌ترسم', 'می ترسم', 'وحشت', 'هراس']],
  ['T04', ['نفرت', 'بیزاری', 'متنفرم']],
  ['T05', ['حسادت', 'حسود']],
  ['T06', ['سوگ', 'فقدان', 'از دست دادن عزیز', 'غمگین', 'اندوه']],
  ['T07', ['احساس گناه', 'عذاب وجدان', 'گناهکار']],
  ['T08', ['وابستگی عاطفی', 'وابسته‌ام', 'بدون او نمی‌توانم']],
  ['T09', ['اهمال‌کاری', 'کارها را عقب', 'به تعویق می‌اندازم']],
  ['T10', ['بی‌خوابی', 'خوابم نمی‌برد', 'از خواب بیدار']],
  ['T11', ['عادت تکراری', 'رفتار تکراری', 'موهایم را می‌کنم', 'پوستم را می‌کنم']],
  ['T12', ['نه گفتن', 'مرزبندی', 'حد و مرز']],
  ['T13', ['تنهایی', 'احساس تنهایی', 'انزوا']],
  ['T14', ['کمبود انگیزه', 'انگیزه ندارم', 'میل شروع ندارم']],
  ['T15', ['اعتماد به نفس', 'اعتمادبه‌نفس']],
  ['T16', ['نشخوار فکری', 'افکار منفی', 'فکرهای تکراری']],
  ['T17', ['مشکل رابطه', 'مشکلات رابطه', 'اختلاف با همسر', 'تعارض رابطه']],
  ['T18', ['نفرت از خود', 'از خودم متنفرم', 'خودم را دوست ندارم']],
  ['T19', ['خودسرزنشی', 'خودم را سرزنش', 'همه تقصیرها گردن من']],
  ['T20', ['کمال‌گرایی', 'باید بی‌نقص']],
  ['T21', ['اجتناب', 'فرار از موقعیت', 'از موقعیت دوری']],
  ['T22', ['استرس', 'فشار روانی', 'تحت فشار']],
  ['T23', ['بی‌ارزشی', 'بی‌ارزشم']],
  ['T24', ['کنترل هیجان', 'تنظیم هیجان', 'احساساتم از کنترل خارج']],
  ['T25', ['رنجش', 'کینه', 'دلخوری طولانی']],
  ['T26', ['شرم', 'خجالت از خود', 'احساس رسوایی']],
  ['T27', ['ترس از قضاوت', 'قضاوت دیگران', 'نگران نظر دیگران', 'مسخره‌ام کنند']],
  ['T28', ['ترس از شکست', 'از شکست می‌ترسم']],
  ['T29', ['ترس از طرد', 'طرد شدن', 'ترک شدن', 'رد شدن از طرف']],
  ['T30', ['شک و تردید', 'دودلی', 'تصمیم‌گیری سخت']],
  ['T31', ['کنترل‌گری', 'همه چیز باید دست من', 'رفتار کنترلی']],
  ['T32', ['بی‌انگیزگی', 'بی‌انرژی', 'علاقه ندارم']],
  ['T33', ['خودانتقادی', 'از خودم ایراد', 'منتقد درونی']],
];

const SAFETY_CUES = [
  'خودکشی', 'قصد خودکشی', 'به زندگی‌ام پایان', 'به زندگیم پایان',
  'خودم را بکشم', 'خودمو بکشم', 'به خودم آسیب', 'خودزنی',
  'به کسی آسیب بزنم', 'او را بکشم', 'تهدید به قتل', 'خشونت خانگی',
  'در خانه امن نیستم', 'الان در خطرم', 'دیگه نمی‌کشم', 'همه‌چی تمومه',
];

const LIMITATIONS = [
  'این خروجی حاصل قواعد واژگانی محدود و قطعی است؛ برداشت اولیه است و تشخیص یا ارزیابی بالینی محسوب نمی‌شود.',
  'نفی، نقل‌قول، کنایه و بافت پیچیده ممکن است فراتر از قواعد این نسخه باشند؛ در ابهام باید پرسش روشن‌ساز مطرح شود.',
  'وجود یا نبود یک موضوع در فهرست، وجود یا نبود مشکل روان‌شناختی را اثبات نمی‌کند.',
];

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function normalize(value) {
  return String(value ?? '').normalize('NFKC')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

function removeAttributedQuotes(value) {
  return value
    .replace(/(?:دوستم|مادرم|پدرم|همسرم|مدیرم|او)\s+گفت\s*[«"“]([^»"”]+)[»"”]/g, ' ')
    .replace(/(?:گفت|گفته)\s*[«"“]([^»"”]+)[»"”]/g, ' ');
}

function classifyIntent(value) {
  if (/\b(ترجمه|تعریف|اطلاعات|توضیح بده|معنی)\b/.test(value) && /درباره|برای/.test(value)) return 'general_information';
  if (/چه راهکاری|راهکار|چطور حل|چه کار کنم|تمرین/.test(value)) return 'request_strategy';
  if (/متخصص|روانشناس|درمانگر|کمک تخصصی/.test(value)) return 'professional_help_decision';
  if (/خلاصه.*(اشتباه|درست نیست)|منظورم این نبود|اصلاح می‌کنم/.test(value)) return 'correct_summary';
  if (/می‌خواهم بفهمم|می‌خواهم بدانم|درک کنم/.test(value)) return 'understand_problem';
  if (value.length > 0) return 'share_experience';
  return 'other_or_unclear';
}

function hasNegatedTopic(value, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp('(?:من\\s+)?(?:اصلاً\\s+)?(?:' + escaped + ')(?:\\s+را)?\\s+(?:ندارم|نیستم|نمی‌خواهم|نمی‌ترسم)');
  return pattern.test(value);
}

function findTopics(value) {
  const evidenceText = removeAttributedQuotes(value);
  const hits = [];
  for (const [topic_id, phrases] of TOPIC_RULES) {
    const matched = phrases.filter((phrase) => normalize(evidenceText).includes(normalize(phrase)) && !hasNegatedTopic(normalize(evidenceText), normalize(phrase)));
    if (matched.length) {
      const phrase = matched.sort((a, b) => b.length - a.length)[0];
      hits.push({
        topic_id,
        role: 'unknown',
        confidence_band: 'low',
        evidence_quotes: [phrase],
        uncertainty_reason: 'تطبیق واژگانی به‌تنهایی برای تعیین نقش یا اولویت موضوع کافی نیست.',
      });
    }
  }
  return hits.slice(0, 3);
}

export function routeSemanticIntake({ text, requestId = 'local-request', priorContext = {} } = {}) {
  const raw = String(text ?? '').trim();
  const normalized = normalize(raw);
  const userAttributedText = removeAttributedQuotes(raw);
  const userNormalized = normalize(userAttributedText);
  const safetyMatches = SAFETY_CUES.filter((cue) => userNormalized.includes(normalize(cue)));
  const quotedSafetyMatches = raw === userAttributedText ? [] : SAFETY_CUES.filter((cue) => normalize(raw).includes(normalize(cue)));
  const safetyContextPresent = safetyMatches.length > 0 || quotedSafetyMatches.length > 0;
  const explicitlyNegatedSafety = safetyMatches.length > 0 && safetyMatches.every((cue) => {
    const index = userNormalized.indexOf(normalize(cue));
    const before = userNormalized.slice(Math.max(0, index - 45), index);
    const after = userNormalized.slice(index + normalize(cue).length, index + normalize(cue).length + 35);
    return /(?:قصد|برنامه|فکر)\s*(?:خودکشی|آسیب)?\s*(?:را)?\s*(?:ندارم|نیست|نمی‌خواهم)$/.test(before)
      || /^(?:\s|را\s*)?(?:نمی‌خواهم|نمی‌توانم|نمی تونم|نمی‌زنم|نمی‌کنم|ندارم)/.test(after);
  });
  const explicitImmediateIntent = /(?:الان|همین الآن|امشب).{0,35}(?:می‌خواهم|قصد دارم|برنامه دارم).{0,35}(?:بکشم|آسیب بزنم|به خودم آسیب)/.test(userNormalized)
    || /(?:قصد|برنامه)\s+(?:قطعی\s+)?دارم.{0,35}(?:خودکشی|آسیب بزنم|بکشم)/.test(userNormalized);
  const topics = findTopics(raw);
  const negationPresent = /(?:ندارم|نیستم|نمی‌خواهم|نمی‌ترسم|موافق نیستم)/.test(normalized);
  const quotePresent = /[«“"].+[»”"]/.test(raw);
  const correctionPresent = /منظورم|اصلاح می‌کنم|در واقع|نه اینکه/.test(normalized);
  const multiTopic = topics.length > 1;
  const intentLabel = classifyIntent(normalized);
  const uncertainties = [];
  const contradictions = [];

  if (quotePresent) uncertainties.push('بخشی از متن داخل نقل‌قول است؛ انتساب آن به تجربه یا باور کاربر قطعی نیست.');
  if (negationPresent) uncertainties.push('نشانه نفی دیده شد؛ دامنه نفی ممکن است به کل موضوع یا فقط یک برچسب اشاره کند.');
  if (correctionPresent) contradictions.push('کاربر احتمالاً در حال اصلاح یا دقیق‌تر کردن گفته قبلی است؛ برداشت قبلی نباید بدون بازبینی حفظ شود.');
  if (multiTopic) uncertainties.push('بیش از یک موضوع احتمالی دیده شد؛ اولویت اصلی هنوز مشخص نیست.');
  if (safetyContextPresent) uncertainties.push('عبارت بالقوه مرتبط با ایمنی دیده شد؛ این عبارت به‌تنهایی قصد یا خطر فوری را اثبات نمی‌کند و باید مستقیماً روشن شود.');
  if (raw !== userAttributedText) uncertainties.push('عبارت ایمنی در نقل‌قول منتسب به شخص دیگری آمده است؛ وضعیت خود کاربر و شخص نقل‌شده باید از هم تفکیک شود.');
  if (explicitlyNegatedSafety) uncertainties.push('نشانه نفی در کنار عبارت ایمنی دیده شد؛ نتیجه‌گیری درباره سطح خطر از روی تطبیق واژگانی مجاز نیست.');

  let nextQuestion = null;
  if (safetyMatches.length) {
    nextQuestion = {
      text: 'آیا همین الآن خطر فوری، قصد یا برنامه عملی برای آسیب به خودت یا شخص دیگری وجود دارد؟ اگر پاسخ روشن نیست، بگو مطمئن نیستی.',
      purpose: 'safety_clarification',
      discriminates_between: ['خطر فوری', 'فکر یا عبارت بدون قصد فعلی', 'ابهام نیازمند کمک انسانی'],
    };
  } else if (multiTopic || quotePresent || negationPresent || correctionPresent || topics.length === 0) {
    nextQuestion = {
      text: 'برای اینکه برداشت اشتباه نکنم، کدام بخش تجربه‌ات مسئله اصلی توست؟ یک نمونه مشخص و اخیر می‌گویی؟',
      purpose: 'topic_disambiguation',
      discriminates_between: topics.map((item) => item.topic_id),
    };
  }

  const situationalFacts = priorContext.situational_facts ?? {};
  const output = {
    schema_version: '1.0.0',
    request_id: String(requestId || 'local-request'),
    intent: {
      label: intentLabel,
      ambiguity: (multiTopic || quotePresent || negationPresent || correctionPresent || topics.length === 0) ? 'high' : safetyMatches.length ? 'medium' : 'low',
    },
    semantic_summary: raw ? raw.slice(0, 600) : null,
    situational_facts: {
      situation: situationalFacts.situation ?? null,
      thought: situationalFacts.thought ?? null,
      emotion: situationalFacts.emotion ?? null,
      body_response: situationalFacts.body_response ?? null,
      behavior: situationalFacts.behavior ?? null,
      impact: situationalFacts.impact ?? null,
      duration: situationalFacts.duration ?? null,
      user_goal: situationalFacts.user_goal ?? null,
    },
    topic_candidates: topics,
    uncertainties,
    contradictions,
    next_question: nextQuestion,
    safety_handoff: {
      handoff_required: Boolean(explicitImmediateIntent && !explicitlyNegatedSafety),
      trigger_evidence: [...new Set([...safetyMatches, ...quotedSafetyMatches])].slice(0, 5),
    },
    limitations: LIMITATIONS,
  };

  return deepFreeze(output);
}
