const STOP_WORDS = new Set([
  'از','به','با','در','برای','که','این','آن','را','و','یا','یک','های','ها','است','هست','بود','شد','شود','می','کن','کند','کرد','کردن',
  'درباره','چگونه','چطور','چیست','چه','اگر','اما','چرا','پس','روی','خود','من','تو','شما','کتاب','جلد','اول','دوم','سوم','چهارم','پنجم',
  'لطفا','میشه','میشود','میتوانی','میتونه','بگو','توضیح','بده','نوشته','گفته','مطرح','میگوید','میکند','مورد','هم','همه','کدام'
]);

// Only close lexical equivalents are expanded strongly. Related-but-distinct
// concepts (e.g. confidence/self-esteem, fear/anxiety) are intentionally not
// merged, because doing so creates false evidence matches.
const CLOSE_EQUIVALENTS = [
  ['اضطراب','دلشوره','تشویش'],
  ['استرس','تنش','فشار روانی'],
  ['خشم','عصبانیت','غضب'],
  ['اعتماد به نفس','اعتمادبه نفس','خودباوری'],
  ['عزت نفس','احترام به خود','احساس ارزشمندی'],
  ['خودشناسی','شناخت خود','خویشتن شناسی','آگاهی از خود'],
  ['تغییر','دگرگونی','تحول'],
  ['باور','اعتقاد'],
  ['عادت','رفتار تکراری'],
  ['ترس','هراس','وحشت'],
  ['آرامش','آسودگی'],
  ['هدف','مقصود']
];

const RELATED_CONCEPTS = [
  { terms: ['اعتماد به نفس','اعتمادبه نفس','خودباوری'], related: ['عزت نفس','احساس ارزشمندی'], weight: 0.28 },
  { terms: ['عزت نفس','احترام به خود','احساس ارزشمندی'], related: ['اعتماد به نفس','خودباوری'], weight: 0.22 },
  { terms: ['اضطراب','دلشوره','تشویش'], related: ['ترس','نگرانی','بی قراری'], weight: 0.32 },
  { terms: ['ترس','هراس','وحشت'], related: ['اضطراب','نگرانی'], weight: 0.22 },
  { terms: ['باور','اعتقاد'], related: ['نگرش','ذهنیت'], weight: 0.28 },
  { terms: ['نگرش','ذهنیت'], related: ['باور','اعتقاد'], weight: 0.24 },
  { terms: ['احساس'], related: ['هیجان','عاطفه'], weight: 0.26 },
  { terms: ['هیجان','عاطفه'], related: ['احساس'], weight: 0.22 },
  { terms: ['نگرش'], related: ['ذهنیت'], weight: 0.24 },
  { terms: ['ذهنیت'], related: ['نگرش'], weight: 0.22 },
  { terms: ['رابطه'], related: ['ارتباط','تعامل'], weight: 0.25 },
  { terms: ['ارتباط','تعامل'], related: ['رابطه'], weight: 0.22 }
];

function normalize(value) {
  return String(value ?? '').normalize('NFKC')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

function stem(token) {
  let value = token;
  for (const suffix of ['ترین','تر','هایی','های','ها','شان','مان','تان','اش','ات','ام','ی']) {
    if (value.length > suffix.length + 3 && value.endsWith(suffix)) {
      value = value.slice(0, -suffix.length);
      break;
    }
  }
  return value;
}

function tokenize(value) {
  return normalize(value).split(' ').filter((word) => word.length > 1 && !STOP_WORDS.has(word)).map(stem);
}

function phrasePresent(query, phrase) {
  return phrase.length > 2 && query.includes(phrase);
}

function intentOf(query) {
  if (/(خلاصه|چکیده|مرور کلی)/u.test(query)) return 'summary';
  if (/(مقایسه|تفاوت|فرق)/u.test(query)) return 'compare';
  if (/(چرا|علت|دلیل|به چه علت)/u.test(query)) return 'why';
  if (/(چگونه|چطور|چه طور|روش|مراحل|راهکار)/u.test(query)) return 'how';
  if (/(یعنی|تعریف|به چه معنا|مفهوم .* چیست|منظور از)/u.test(query)) return 'definition';
  if (/(مثال|نمونه)/u.test(query)) return 'example';
  if (/(تمرین|اقدام|کار عملی|برنامه)/u.test(query)) return 'application';
  if (/(محدودیت|نقد|نقطه ضعف|ایراد)/u.test(query)) return 'critique';
  if (/(شواهد علمی|پشتوانه علمی|از نظر علمی)/u.test(query)) return 'science';
  return 'explore';
}

export function analyzeLibraryQuery(value) {
  const normalized = normalize(value);
  const terms = tokenize(normalized);
  const expansions = new Map(terms.map((term) => [term, 1]));
  for (const group of CLOSE_EQUIVALENTS) {
    if (group.some((phrase) => phrasePresent(normalized, normalize(phrase)))) {
      for (const phrase of group) {
        for (const term of tokenize(phrase)) {
          if (!expansions.has(term)) expansions.set(term, 0.72);
        }
      }
    }
  }
  for (const relation of RELATED_CONCEPTS) {
    if (relation.terms.some((phrase) => phrasePresent(normalized, normalize(phrase)))) {
      for (const phrase of relation.related) {
        for (const term of tokenize(phrase)) {
          if (!expansions.has(term)) expansions.set(term, relation.weight);
        }
      }
    }
  }
  const focusTerms = terms.filter((term) => term.length > 2);
  return Object.freeze({
    normalized,
    intent: intentOf(normalized),
    terms: Object.freeze(terms),
    focusTerms: Object.freeze(focusTerms),
    weights: expansions,
  });
}

function countTerms(text) {
  const counts = new Map();
  for (const term of tokenize(text)) counts.set(term, (counts.get(term) || 0) + 1);
  return counts;
}

function termProximity(tokens, queryTerms) {
  const wanted = [...queryTerms].filter((term) => tokens.includes(term));
  if (wanted.length < 2) return 0;
  let best = Infinity;
  for (let start = 0; start < tokens.length; start += 1) {
    if (!wanted.includes(tokens[start])) continue;
    const found = new Set([tokens[start]]);
    for (let end = start + 1; end < Math.min(tokens.length, start + 14); end += 1) {
      if (wanted.includes(tokens[end])) found.add(tokens[end]);
      if (found.size === wanted.length) {
        best = Math.min(best, end - start);
        break;
      }
    }
  }
  return Number.isFinite(best) ? Math.max(0, (14 - best) / 14) : 0;
}

function passageText(passage) {
  return String(passage?.text || '');
}

export function rankLibraryPassages(passages, query, limit = 5) {
  const rows = Array.isArray(passages) ? passages : [];
  if (!rows.length) return [];
  const analysis = analyzeLibraryQuery(query);
  const documents = rows.map((passage, index) => {
    const body = passageText(passage);
    const heading = String(passage?.heading || '');
    const bodyTokens = tokenize(body);
    const headingTokens = tokenize(heading);
    return { passage, index, body, heading, bodyTokens, headingTokens, counts: countTerms(body), length: Math.max(1, bodyTokens.length) };
  });
  const frequency = new Map();
  let totalLength = 0;
  for (const document of documents) {
    totalLength += document.length;
    for (const term of new Set([...document.bodyTokens, ...document.headingTokens])) {
      frequency.set(term, (frequency.get(term) || 0) + 1);
    }
  }
  const averageLength = totalLength / documents.length;
  const queryTerms = [...analysis.weights.keys()];
  const hasDirectEvidence = documents.some((document) => [...analysis.weights].some(([term, weight]) => weight >= 0.7 && (document.counts.has(term) || document.headingTokens.includes(term))));
  // Generic task words must not let a related-but-distinct concept masquerade
  // as direct evidence for the concept explicitly requested by the user.
  const directAnchorGroups = RELATED_CONCEPTS.filter((relation) =>
    relation.terms.some((phrase) => phrasePresent(analysis.normalized, normalize(phrase)))
  );
  const matchedConceptGroups = CLOSE_EQUIVALENTS.filter((group) => group.some((phrase) => phrasePresent(analysis.normalized, normalize(phrase))));
  // Multiword concept families require phrase-level evidence; broad single-word
  // concepts still need an exact term or a vetted strong equivalent.
  const strictConceptGroups = matchedConceptGroups.filter((group) => group.some((phrase) => normalize(phrase).split(' ').length > 1));
  const hasDirectConceptEvidence = strictConceptGroups.length > 0 && documents.some((document) => {
    const text = normalize(document.body + ' ' + document.heading);
    return strictConceptGroups.some((group) => group.some((phrase) => phrasePresent(text, normalize(phrase))));
  });
  const ranked = documents.map((document) => {
    const { passage, index, body, heading, bodyTokens, headingTokens, counts, length } = document;
    let score = 0;
    let matched = 0;
    let directMatches = 0;
    const normalizedDocument = normalize(body + ' ' + heading);
    const directAnchorMatches = directAnchorGroups.filter((group) =>
      group.terms.some((phrase) => phrasePresent(normalizedDocument, normalize(phrase)))
    ).length;
    const directConceptMatches = strictConceptGroups.filter((group) => group.some((phrase) => phrasePresent(normalizedDocument, normalize(phrase)))).length;
    for (const [term, weight] of analysis.weights) {
      const tf = counts.get(term) || 0;
      const inHeading = headingTokens.includes(term);
      if (tf || inHeading) {
        matched += 1;
        if (weight >= 0.7) directMatches += 1;
      }
      if (!tf && !inHeading) continue;
      const df = frequency.get(term) || 0;
      const idf = Math.log(1 + (documents.length - df + 0.5) / (df + 0.5));
      const k1 = 1.35;
      const b = 0.68;
      const normTf = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * length / Math.max(1, averageLength)));
      score += weight * idf * (normTf + (inHeading ? 2.1 : 0));
    }
    const normalizedBody = normalize(body);
    if (analysis.normalized.length > 5 && normalizedBody.includes(analysis.normalized)) score += 7;
    for (const phrase of CLOSE_EQUIVALENTS.flat()) {
      const normalizedPhrase = normalize(phrase);
      if (phrasePresent(analysis.normalized, normalizedPhrase) && phrasePresent(normalizedBody, normalizedPhrase)) {
        score += 2.4;
      }
    }
    score += termProximity(bodyTokens, queryTerms) * 1.6;
    const coverage = queryTerms.length ? matched / queryTerms.length : 0;
    score += coverage * 1.8;
    if (body.length >= 90 && body.length <= 1000) score += 0.18;
    return {
      ...passage,
      score,
      relevance: Math.min(1, coverage),
      retrievalIndex: index,
      intent: analysis.intent,
      directMatches,
      directConceptMatches,
      directAnchorMatches
    };
  }).filter((passage) => passage.score > 0
    && hasDirectEvidence
    && passage.directMatches > 0
    && (!directAnchorGroups.length || passage.directAnchorMatches > 0)
    && (!strictConceptGroups.length || (hasDirectConceptEvidence && passage.directConceptMatches > 0)))
    .sort((a, b) => b.score - a.score || a.retrievalIndex - b.retrievalIndex);

  const selected = [];
  const usedPages = new Set();
  const usedHeadings = new Set();
  for (const passage of ranked) {
    const pageKey = passage.page ?? passage.pageIndex ?? passage.retrievalIndex;
    const headingKey = normalize(passage.heading);
    if (usedPages.has(pageKey) || (headingKey && usedHeadings.has(headingKey) && selected.length < limit - 1)) continue;
    selected.push(passage);
    usedPages.add(pageKey);
    if (headingKey) usedHeadings.add(headingKey);
    if (selected.length >= limit) break;
  }
  if (selected.length < limit) {
    for (const passage of ranked) {
      const pageKey = passage.page ?? passage.pageIndex ?? passage.retrievalIndex;
      if (usedPages.has(pageKey)) continue;
      selected.push(passage);
      usedPages.add(pageKey);
      if (selected.length >= limit) break;
    }
  }
  return selected;
}

function sentenceScore(sentence, analysis, intent) {
  const tokens = tokenize(sentence);
  const tokenSet = new Set(tokens);
  let score = 0;
  for (const [term, weight] of analysis.weights) {
    if (tokenSet.has(term)) score += weight;
  }
  if (intent === 'why' && /(زیرا|چون|به دلیل|علت|سبب|در نتیجه|باعث)/u.test(normalize(sentence))) score += 1.8;
  if (intent === 'how' && /(ابتدا|سپس|بعد|مرحله|روش|تمرین|انجام|انتخاب)/u.test(normalize(sentence))) score += 1.3;
  if (intent === 'definition' && /(یعنی|عبارت است|به معنای|تعریف)/u.test(normalize(sentence))) score += 1.6;
  if (intent === 'compare' && /(اما|ولی|در مقابل|برخلاف|تفاوت|از سوی دیگر)/u.test(normalize(sentence))) score += 1.2;
  return score;
}

export function synthesizeLibraryEvidence(passages, query, limit = 3) {
  const analysis = analyzeLibraryQuery(query);
  const candidates = [];
  const seen = new Set();
  for (const passage of passages || []) {
    const text = passageText(passage);
    const sentences = text.split(/(?<=[.!؟?؛])\s+|\n+/u).map((part) => part.trim()).filter((part) => part.length >= 38);
    for (const sentence of sentences) {
      const key = normalize(sentence);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const score = sentenceScore(sentence, analysis, analysis.intent);
      if (score > 0) candidates.push({ sentence, score, page: passage.page, heading: passage.heading });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const chosen = [];
  const pages = new Set();
  for (const candidate of candidates) {
    const page = candidate.page ?? candidate.heading;
    if (pages.has(page)) continue;
    chosen.push(candidate);
    pages.add(page);
    if (chosen.length >= limit) break;
  }
  const coverage = analysis.terms.length
    ? analysis.terms.filter((term) => candidates.some((candidate) => tokenize(candidate.sentence).includes(term))).length / analysis.terms.length
    : 0;
  const evidenceLevel = chosen.length >= 2 && coverage >= 0.45 ? 'مناسب' : chosen.length ? 'محدود' : 'ناکافی';
  return Object.freeze({
    intent: analysis.intent,
    sentences: Object.freeze(chosen),
    evidenceLevel,
    coverage: Number(coverage.toFixed(2))
  });
}

export function formatLocalSynthesis(bookTitle, query, passages) {
  const synthesis = synthesizeLibraryEvidence(passages, query, 3);
  if (!synthesis.sentences.length) return null;
  const heading = synthesis.intent === 'why' ? 'پاسخ مستند به چرایی پرسش'
    : synthesis.intent === 'how' || synthesis.intent === 'application' ? 'نکته‌های اجراییِ پشتیبانی‌شده در متن'
      : synthesis.intent === 'definition' ? 'تعریف‌ها و توضیح‌های مرتبط در متن'
        : synthesis.intent === 'compare' ? 'شواهد مرتبط برای مقایسه'
          : 'پاسخ مستند بر پایه متن کتاب';
  const answer = synthesis.sentences.map((item, index) => {
    const page = item.page ? 'صفحه ' + item.page : 'صفحه نامشخص';
    return (index + 1) + ') ' + item.sentence + '\nمنبع: ' + [item.heading, page].filter(Boolean).join(' · ');
  }).join('\n\n');
  return heading + ' در «' + bookTitle + '»\n\n' +
    'این جمع‌بندی محلی و بدون اتصال ابری، از جمله‌های مرتبطِ نسخه فعال کتاب استخراج شده است؛ بازنویسی آزاد یا داوری علمی مستقل نیست.\n\n' +
    answer + '\n\n' +
    'قدرت شواهد بازیابی‌شده: ' + synthesis.evidenceLevel + '. این شاخص فقط میزان تطابق متن بازیابی‌شده با واژه‌های پرسش را نشان می‌دهد، نه قطعیت علمی پاسخ.';
}
