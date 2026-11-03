const TOPIC_RULES = [
  ['T01', ['خشم', 'عصبانی', 'عصبانیت']],
  ['T02', ['اضطراب', 'نگرانی مداوم', 'دلشوره', 'نگران آینده']],
  ['T03', ['ترس', 'می‌ترسم', 'می ترسم', 'وحشت', 'هراس']],
  ['T04', ['نفرت', 'بیزاری', 'متنفرم']],
  ['T05', ['حسادت', 'حسود']],
  ['T06', ['سوگ', 'فقدان', 'از دست دادن عزیز', 'غمگین', 'اندوه', 'فوت', 'دلم برایش تنگ']],
  ['T07', ['احساس گناه', 'عذاب وجدان', 'گناهکار']],
  ['T08', ['وابستگی عاطفی', 'وابسته‌ام', 'بدون او نمی‌توانم', 'چندین بار زنگ می‌زنم']],
  ['T09', ['اهمال‌کاری', 'کارها را عقب', 'به تعویق می‌اندازم', 'عقب می‌اندازم']],
  ['T10', ['بی‌خوابی', 'خوابم نمی‌برد', 'از خواب بیدار', 'خوابم به هم ریخته']],
  ['T11', ['عادت تکراری', 'رفتار تکراری', 'موهایم را می‌کنم', 'پوستم را می‌کنم']],
  ['T12', ['نه گفتن', 'مرزبندی', 'حد و مرز']],
  ['T13', ['تنهایی', 'احساس تنهایی', 'انزوا']],
  ['T14', ['کمبود انگیزه', 'انگیزه ندارم', 'میل شروع ندارم']],
  ['T15', ['اعتماد به نفس', 'اعتمادبه‌نفس']],
  ['T16', ['نشخوار فکری', 'افکار منفی', 'فکرهای تکراری', 'ساعت‌ها فکر می‌کنم', 'مدام فکر می‌کنم']],
  ['T17', ['مشکل رابطه', 'مشکلات رابطه', 'اختلاف با همسر', 'تعارض رابطه', 'تحقیرم می‌کند', 'تهدیدم کرد', 'تهدیدم می‌کند']],
  ['T18', ['نفرت از خود', 'از خودم متنفرم', 'خودم را دوست ندارم']],
  ['T19', ['خودسرزنشی', 'خودم را سرزنش', 'همه تقصیرها گردن من']],
  ['T20', ['کمال‌گرایی', 'باید بی‌نقص', 'ناقص تحویل', 'بی‌نقص انجام']],
  ['T21', ['اجتناب', 'فرار از موقعیت', 'از موقعیت دوری', 'دوری می‌کنم']],
  ['T22', ['استرس', 'فشار روانی', 'تحت فشار']],
  ['T23', ['بی‌ارزشی', 'بی‌ارزشم']],
  ['T24', ['کنترل هیجان', 'تنظیم هیجان', 'احساساتم از کنترل خارج', 'کنترل خشم', 'هیجانم را کنترل']],
  ['T25', ['رنجش', 'کینه', 'دلخوری طولانی']],
  ['T26', ['شرم', 'خجالت از خود', 'خجالت می‌کشم', 'احساس رسوایی']],
  ['T27', ['ترس از قضاوت', 'از قضاوت', 'قضاوت دیگران', 'نگران نظر دیگران', 'مسخره‌ام کنند']],
  ['T28', ['ترس از شکست', 'از شکست می‌ترسم']],
  ['T29', ['ترس از طرد', 'طرد شدن', 'ترک شدن', 'ترکم می‌کند', 'ترکم می‌کنه', 'رد شدن از طرف']],
  ['T30', ['شک و تردید', 'دودلی', 'تصمیم‌گیری سخت', 'مطمئن نیستم']],
  ['T31', ['کنترل‌گری', 'همه چیز باید دست من', 'همه‌چیز طبق برنامه من', 'دیگران تصمیم بگیرند', 'رفتار کنترلی']],
  ['T32', ['بی‌انگیزگی', 'بی‌انرژی', 'انرژی ندارم', 'علاقه ندارم', 'دیگر علاقه‌ای ندارم']],
  ['T33', ['خودانتقادی', 'از خودم ایراد', 'منتقد درونی']],
];

export const ROUTED_TOPIC_IDS = Object.freeze(TOPIC_RULES.map(([topicId]) => topicId));

const SAFETY_CUES = [
  'خودکشی', 'قصد خودکشی', 'به زندگی‌ام پایان', 'به زندگیم پایان',
  'خودم را بکشم', 'خودمو بکشم', 'به خودم آسیب', 'خودزنی',
  'به کسی آسیب بزنم', 'به دیگران آسیب', 'به خودم صدمه', 'او را بکشم', 'تهدید به قتل', 'خشونت خانگی',
  'در خانه امن نیستم', 'خانه امن نیست', 'الان در خطرم', 'تهدیدم کرد', 'تهدیدم می‌کند', 'دیگه نمی‌کشم', 'همه‌چی تمومه', 'کاش نبودم', 'کاش بمیرم', 'نمی‌خواهم زنده باشم', 'نمی‌خوام زنده باشم', 'فکر آسیب زدن به خودم', 'آسیب زدن به خودم', 'فکر خودآسیبی', 'قصد آسیب', 'قصد خودآسیبی',
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
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

function removeAttributedQuotes(value) {
  return value
    .replace(/(?:دوستم|مادرم|پدرم|همسرم|مدیرم|او)\s+گفت\s*[«"“]([^»"”]+)[»"”]/g, ' ')
    .replace(/(?:گفت|گفته)\s*[«"“]([^»"”]+)[»"”]/g, ' ')
    // Unquoted third-party reports must not be treated as the user's intent.
    // Stop at punctuation so a separate first-person disclosure is preserved.
    .replace(/(?:دوستم|مادرم|پدرم|همسرم|مدیرم|او)\s+(?:گفت|گفته|می[‌\s]?گوید|می[‌\s]?گفت)\s+[^،.!؟؛]*(?=[،.!؟؛]|$)/g, ' ');
}

function classifyIntent(value) {
  const normalized = normalize(value);
  const deniesPersonalExperience = /خودم چنین تجربه(?:‌ای| ای) ندارم|برای خودم نیست|صرفاً برای ترجمه|فقط برای ترجمه/.test(normalized);
  const translationRequest = /(?:برای ترجمه|ترجمه (?:این|یک) متن|متن را ترجمه)/.test(normalized);
  const informationQuestion = /(?:چیست|چی هست|یعنی چه|چه معنایی دارد)|تعریف\s+\S+|معنی\s+\S+|اطلاعات(?:ی)?\s+(?:درباره|در مورد)|(?:درباره|در مورد).{0,35}توضیح (?:بده|دهید)/.test(normalized);
  const explicitPersonalContext = /(من خودم|برای من|تجربه می کنم|تجربه دارم|در زندگی من|مشکل خودم)/.test(normalized);
  if (translationRequest || (informationQuestion && (deniesPersonalExperience || !explicitPersonalContext))) return 'general_information';
  if (/چه راهکاری|راهکار|چطور حل|چه کار کنم|تمرین/.test(normalized)) return 'request_strategy';
  if (/متخصص|روانشناس|درمانگر|کمک تخصصی/.test(normalized)) return 'professional_help_decision';
  if (/خلاصه.*(اشتباه|درست نیست)|منظورم این نبود|اصلاح می کنم/.test(normalized)) return 'correct_summary';
  if (/می خواهم بفهمم|می خواهم بدانم|درک کنم/.test(normalized)) return 'understand_problem';
  if (normalized.length > 0) return 'share_experience';
  return 'other_or_unclear';
}

function hasNegatedTopic(value, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp('(?:من\\s+)?(?:اصلاً\\s+)?(?:' + escaped + ')(?:\\s+را)?\\s+(?:ندارم|نیستم|نمی خواهم|نمی ترسم)');
  return pattern.test(value);
}

function findNegatedTopicIds(value) {
  const normalized = normalize(removeAttributedQuotes(value));
  const ids = [];
  for (const [topicId, phrases] of TOPIC_RULES) {
    if (phrases.some((phrase) => normalized.includes(normalize(phrase)) && hasNegatedTopic(normalized, normalize(phrase)))) {
      ids.push(topicId);
    }
  }
  return ids;
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
      || /^(?:\s|را\s*)?(?:نمی خواهم|نمی توانم|نمی تونم|نمی زنم|نمی کنم|ندارم)/.test(after);
  });
  const explicitImmediateIntent = /(?:قصد|برنامه|تصمیم)\s+(?:قطعی\s+)?دارم.{0,45}(?:خودکشی کنم|خودم را بکشم|خودمو بکشم|به خودم آسیب بزنم|به کسی آسیب بزنم|به دیگران آسیب بزنم|به او آسیب بزنم|او را بکشم|کسی را بکشم)/.test(userNormalized)
    || /(?:^|[\s،,])(?:می خواهم|میخوام).{0,35}(?:خودکشی کنم|خودم را بکشم|خودمو بکشم|به خودم آسیب بزنم|به کسی آسیب بزنم|به دیگران آسیب بزنم|به او آسیب بزنم|او را بکشم|کسی را بکشم)/.test(userNormalized)
    || /(?:^|[\s،,])(?:دارم|مشغول).{0,25}(?:به خودم آسیب می زنم|به کسی آسیب می زنم|به دیگران آسیب می زنم|به او آسیب می زنم|خودزنی می کنم)/.test(userNormalized)
    || /(?:الان|همین الآن).{0,30}(?:خانه امن نیست|در خطرم|تهدیدم می‌کند)/.test(userNormalized)
    || /تهدیدم کرد.{0,25}(?:الان|همین الآن).{0,20}خانه امن نیست/.test(userNormalized);
  const correctionMatch = raw.match(/(?:منظورم(?:\s+این\s+است\s+که)?|در واقع|اصلاح می‌کنم)[،:؛\s]*(.*)$/);
  const semanticEvidenceText = correctionMatch?.[1]?.trim() || userAttributedText;
  const clearlyRejectedThirdPartyQuote = quotedSafetyMatches.length === 0
    && /(?:دوستم|مادرم|پدرم|همسرم|مدیرم|او)\s+گفت/.test(raw)
    && /موافق نیستم|قبول ندارم|این حرف درست نیست/.test(normalized);
  const topics = findTopics(semanticEvidenceText);
  const negatedTopicIds = findNegatedTopicIds(semanticEvidenceText);
  const negationPresent = negatedTopicIds.length > 0 || (!clearlyRejectedThirdPartyQuote && /موافق نیستم/.test(normalized));
  const quotePresent = /[«“"].+[»”"]/.test(raw);
  const correctionPresent = /منظورم|اصلاح می‌کنم|در واقع|نه اینکه/.test(normalized);
  const intentLabel = classifyIntent(normalized);
  const topicCandidates = intentLabel === 'general_information' ? [] : topics;
  const multiTopic = topicCandidates.length > 1;
  const uncertainties = [];
  const contradictions = [];

  if (quotePresent) uncertainties.push('بخشی از متن داخل نقل‌قول است؛ انتساب آن به تجربه یا باور کاربر قطعی نیست.');
  if (negationPresent) uncertainties.push('نفی به یکی از عبارت‌های موضوعی نزدیک است؛ باید روشن شود کاربر برچسب را رد می‌کند یا خود تجربه را.');
  if (correctionPresent) contradictions.push('کاربر احتمالاً در حال اصلاح یا دقیق‌تر کردن گفته قبلی است؛ برداشت قبلی نباید بدون بازبینی حفظ شود.');
  if (multiTopic) uncertainties.push('بیش از یک موضوع احتمالی دیده شد؛ اولویت اصلی هنوز مشخص نیست.');
  if (safetyContextPresent) uncertainties.push('عبارت بالقوه مرتبط با ایمنی دیده شد؛ این عبارت به‌تنهایی قصد یا خطر فوری را اثبات نمی‌کند و باید مستقیماً روشن شود.');
  if (quotedSafetyMatches.length) uncertainties.push('عبارت ایمنی به شخص دیگری نسبت داده شده است؛ وضعیت خود کاربر و شخص گزارش‌شده باید از هم تفکیک شود.');
  if (explicitlyNegatedSafety) uncertainties.push('نشانه نفی در کنار عبارت ایمنی دیده شد؛ نتیجه‌گیری درباره سطح خطر از روی تطبیق واژگانی مجاز نیست.');

  let nextQuestion = null;
  if (safetyContextPresent && intentLabel !== 'general_information') {
    nextQuestion = {
      text: 'آیا همین الآن خطر فوری، قصد یا برنامه عملی برای آسیب به خودت یا شخص دیگری وجود دارد؟ اگر پاسخ روشن نیست، بگو مطمئن نیستی.',
      purpose: 'safety_clarification',
      discriminates_between: ['خطر فوری', 'فکر یا عبارت بدون قصد فعلی', 'ابهام نیازمند کمک انسانی'],
    };
  } else if (intentLabel !== 'general_information' && !clearlyRejectedThirdPartyQuote &&
      (multiTopic || quotePresent || negationPresent || correctionPresent || topicCandidates.length === 0)) {
    nextQuestion = {
      text: 'برای اینکه برداشت اشتباه نکنم، کدام بخش تجربه‌ات مسئله اصلی توست؟ یک نمونه مشخص و اخیر می‌گویی؟',
      purpose: 'topic_disambiguation',
      discriminates_between: topicCandidates.map((item) => item.topic_id),
    };
  }

  const context = priorContext && typeof priorContext === 'object' ? priorContext : {};
  const situationalFacts = context.situational_facts && typeof context.situational_facts === 'object' ? context.situational_facts : {};
  const safeFact = (key) => typeof situationalFacts[key] === 'string' ? situationalFacts[key].trim().slice(0, 1000) || null : null;
  const safeRequestId = String(requestId ?? 'local-request').trim().slice(0, 128) || 'local-request';
  const output = {
    schema_version: '1.0.0',
    request_id: safeRequestId,
    intent: {
      label: intentLabel,
      ambiguity: intentLabel === 'general_information' || clearlyRejectedThirdPartyQuote ? 'low' : (multiTopic || quotePresent || negationPresent || correctionPresent || topics.length === 0) ? 'high' : safetyContextPresent ? 'medium' : 'low',
    },
    semantic_summary: raw ? raw.slice(0, 600) : null,
    situational_facts: {
      situation: safeFact('situation'),
      thought: safeFact('thought'),
      emotion: safeFact('emotion'),
      body_response: safeFact('body_response'),
      behavior: safeFact('behavior'),
      impact: safeFact('impact'),
      duration: safeFact('duration'),
      user_goal: safeFact('user_goal'),
    },
    topic_candidates: topicCandidates,
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
