import { getLibraryBookProfile, formatLibraryProfileItems } from './libraryBookProfiles.js';
import { rankLibraryPassages, formatLocalSynthesis } from './libraryLocalReasoning.js';

const STOP = new Set('از به با در برای که این آن را و یا یک های هایش هست است شود می کند کردن درباره چگونه چیست چه اگر اما زیرا تا پس روی خود انسان زندگی من تو شما کتاب جلد'.split(' '));

const SYNONYM_GROUPS = [
  ['اضطراب', 'استرس', 'نگرانی', 'دلشوره', 'تشویش', 'تنش', 'بی قراری'],
  ['خشم', 'عصبانیت', 'پرخاش', 'غضب', 'عصبانی'],
  ['اعتمادبه نفس', 'اعتماد به نفس', 'خودباوری', 'عزت نفس', 'ارزشمندی'],
  ['خودشناسی', 'شناخت خود', 'خویشتن شناسی', 'آگاهی از خود'],
  ['احساس', 'هیجان', 'عاطفه', 'حس'],
  ['تغییر', 'تحول', 'دگرگونی', 'دگردیسی'],
  ['باور', 'اعتقاد', 'نگرش', 'ذهنیت'],
  ['عادت', 'رفتار تکراری', 'خو'],
  ['ترس', 'هراس', 'وحشت', 'نگرانی'],
  ['رابطه', 'ارتباط', 'تعامل'],
  ['آرامش', 'آسودگی', 'سکون'],
  ['هدف', 'مقصود', 'غایت'],
];

const FOLLOW_UP = /^(?:بیشتر|ادامه|بیشتر توضیح|توضیح بده|مثال بزن|یک مثال|تمرین بده|چه تمرینی|همین|همان|اون|این|منظورم|در موردش|درباره اش|چه محدودیت|چه تفاوت|چرا|چطور|چگونه|اگر|پس|این توصیه|این مفهوم|این موضوع)/u;
const SUMMARY = /(?:خلاصه|چکیده|مرور کلی)/u;
const LIST = /(?:چه کتاب|فهرست کتاب|کتاب های موجود|کتابخانه چه کتاب)/u;
const BOOK_SUBJECT = /(?:کتاب .*درباره چه|موضوع اصلی کتاب|موضوع کتاب چیست)/u;
const COMPARE = /(?:تفاوت|مقایسه|فرق|چه فرقی)/u;
const EXAMPLE_OR_EXERCISE = /(?:مثال بزن|یک مثال|تمرین|برنامه هفت|عادت روزانه)/u;
const RECOMMEND = /(?:کدام کتاب|چه کتابی|از کدام کتاب|برای شروع مطالعه|پیشنهاد.*کتاب|کتاب مناسب)/u;
const SELF_KNOWLEDGE = /(?:خودشناسی|خودم را بهتر بشناسم|شناخت خود)/u;
const SCIENCE = /(?:از نظر روان شناسی|علمی قابل دفاع|پشتوانه علمی|شواهد علمی)/u;
const ALTERNATIVE_VIEW = /(?:دیدگاه متفاوت|دیدگاه مخالف|نظر مخالف|نقد دیگری)/u;
const LIMITATIONS = /(?:محدودیت|نقطه ضعف|ضعف این دیدگاه|چه ایرادی)/u;
const WEEK_PLAN = /(?:برنامه هفت|هفت روز|۷ روز|هفت روزه)/u;
const PROGRESS = /(?:پیشرفت|از کجا بفهمم|چطور بفهمم.*بهتر)/u;
const DAILY_APPLICATION = /(?:زندگی روزمره|به کار ببرم|کاربرد.*زندگی)/u;
const ALTERNATIVE_EXERCISE = /(?:جایگزین|نتوانم.*تمرین|نمی توانم.*تمرین|ساده تر)/u;
const AUTHOR_MEANING = /(?:نویسنده.*منظور|منظور نویسنده|دقیقاً چه منظوری)/u;
const AUTHOR_REASON = /(?:چرا نویسنده|دلیل نویسنده)/u;
const CONCEPT_COMPARE = /(?:دو مفهوم|مقایسه.*مفهوم|مفهوم.*با هم)/u;
const ANXIETY = /(?:اضطراب|استرس|دلشوره|نگرانی)/u;
const ANGER = /(?:خشم|عصبانیت|عصبانی|پرخاش)/u;
const CONFIDENCE = /(?:اعتماد به نفس|اعتمادبه نفس|خودباوری|عزت نفس)/u;
const KEY_POINTS = /(?:مهم ترین نکات|نکات اصلی|نکات کلیدی)/u;
const SIMPLE_EXPLAIN = /(?:به زبان ساده|ساده و قابل فهم|توضیح ساده|بیشتر توضیح|جزئیات بیشتر|بیشتر باز کن)/u;

const READER_TOC_HELP = /(?:فهرست فصل|فهرست مطالب|صفحه موردنظر|پیدا کنم)/u;
const READER_DISPLAY_HELP = /(?:اندازه نوشته|اندازه متن|زمینه مطالعه|رنگ زمینه)/u;
const READER_PROGRESS_HELP = /(?:ادامه مطالعه|ادامه بدهم|بین صفحه ها|جابجا شوم|جابجایی بین صفحه)/u;
const BOOK_AUDIENCE = /(?:کتاب|جلد) (?:اول|دوم|سوم|چهارم|پنجم|[1-5]).*(?:برای چه هدف|برای چه کسی|چه خواننده ای|مناسب تر است|مناسب چه کسانی)/u;
const BOOKS_COMBINED_HELP = /(?:کتاب ها و کتابچه|کتاب ها.*کنار هم|کتاب ها.*در کنار هم)/u;
const CHANGE_BARRIER = /(?:تغییر رفتار|در تغییر رفتار|گیر کرده|مانع اجرا)/u;

function libraryReaderHelp(message) {
  const normalized = normalizeLibraryText(message);
  if (READER_TOC_HELP.test(normalized)) {
    return 'برای پیدا کردن فصل یا صفحه در کتاب‌خوان کتابخانه:\n۱) دکمه «فهرست مطالب» را در نوار بالای کتاب‌خوان یا دکمه فهرست در پایین صفحه بزن.\n۲) عنوان فصل یا بخش موردنظرت را در فهرست پیدا کن.\n۳) با انتخاب عنوان، کتاب‌خوان به همان بخش می‌رود.\n\nاگر شماره صفحه مشخصی را می‌خواهی، از کنترل جابه‌جایی صفحه در پایین کتاب‌خوان استفاده کن. عنوان‌ها و شماره صفحه‌ها ممکن است با توجه به نسخه کتاب متفاوت باشند.';
  }
  if (READER_DISPLAY_HELP.test(normalized)) {
    return 'برای تنظیم ظاهر مطالعه:\n- برای بزرگ‌تر کردن نوشته، دکمه «A+» را در نوار بالای کتاب‌خوان بزن.\n- برای کوچک‌تر کردن نوشته، دکمه «A−» را بزن.\n- برای تغییر زمینه مطالعه، دکمه تغییر زمینه را در همان نوار انتخاب کن؛ با هر بار زدن، حالت زمینه عوض می‌شود.\n\nاین تنظیم‌ها برای راحتی خواندن‌اند و محتوای کتاب را تغییر نمی‌دهند.';
  }
  if (READER_PROGRESS_HELP.test(normalized)) {
    return 'برای ادامه مطالعه و جابه‌جایی بین صفحه‌ها:\n- با دکمه «ادامه مطالعه» روی کارت کتاب، مطالعه را از محل ذخیره‌شده ادامه بده.\n- در خود کتاب‌خوان، از پیکان‌های صفحه بعد و قبل برای جابه‌جایی استفاده کن.\n- نوار جابه‌جایی پایین صفحه نیز امکان حرکت میان صفحه‌ها را می‌دهد.\n\nپیشرفت مطالعه برای هر کتاب ذخیره می‌شود؛ اگر کتاب را از ابتدا باز کنی، می‌توانی از فهرست مطالب به بخش دلخواه بروی.';
  }
  return null;
}

export function normalizeLibraryText(value) {
  return String(value ?? '').normalize('NFKC')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

function stem(word) {
  let value = word;
  for (const suffix of ['ترین', 'تر', 'هایی', 'های', 'ها', 'هایش', 'شان', 'مان', 'تان', 'اش', 'ات', 'ام', 'ی']) {
    if (value.length > suffix.length + 3 && value.endsWith(suffix)) {
      value = value.slice(0, -suffix.length);
      break;
    }
  }
  return value;
}

function terms(value) {
  return normalizeLibraryText(value).split(' ')
    .filter((word) => word.length > 1 && !STOP.has(word))
    .map(stem);
}

function expandedQueryTerms(value) {
  const original = terms(value);
  const expanded = new Map(original.map((term) => [term, 3]));
  const normalized = normalizeLibraryText(value);
  for (const group of SYNONYM_GROUPS) {
    if (group.map(normalizeLibraryText).some((phrase) => phrase.length > 2 && normalized.includes(phrase))) {
      for (const phrase of group) {
        for (const term of terms(phrase)) if (!expanded.has(term)) expanded.set(term, 1.15);
      }
    }
  }
  return expanded;
}

function pageBlocks(page) {
  const blocks = Array.isArray(page?.blocks) ? page.blocks : [{ type: 'paragraph', text: page?.text || '' }];
  return blocks.map((block) => ({
    type: block?.type || 'paragraph',
    text: String(block?.text || (Array.isArray(block?.rows) ? block.rows.flat().join(' ') : '')).trim(),
  })).filter((block) => block.type === 'heading' || block.text.length > 24);
}

function passagesForBook(book) {
  const rows = [];
  for (const page of Array.isArray(book?.content?.pages) ? book.content.pages : []) {
    const blocks = pageBlocks(page);
    let heading = String(page.title || '').trim();
    const substantive = blocks.filter((block) => block.type !== 'heading');
    const pageHeadingCount = blocks.filter((block) => block.type === 'heading').length;
    const normalizedPageText = normalizeLibraryText(blocks.map((block) => block.text).join(' '));
    const frontMatter = /فهرست مطالب|تقدیم نامه|سپاسگزاری|پیشگفتار|یادداشتی درباره این مجموعه|شناسنامه/u.test(normalizedPageText);
    // Contents/front-matter pages often pack dozens of unrelated headings together.
    // They are not reliable evidence for topical retrieval or book summaries.
    if (frontMatter && Number(page.sourcePage || page.page) <= 12) continue;
    for (const block of blocks) {
      if (block.type === 'heading') {
        heading = block.text;
        continue;
      }
      if (pageHeadingCount > 4 && Number(page.sourcePage || page.page) <= 12 && !substantive.length) continue;
      rows.push({
        text: block.text,
        page: Number(page.sourcePage || page.page) || null,
        heading,
        pageIndex: Number(page.page) || rows.length + 1,
      });
    }
  }
  return rows;
}

function buildFrequencyIndex(passages) {
  const frequency = new Map();
  for (const passage of passages) {
    for (const term of new Set(terms(passage.text + ' ' + passage.heading))) {
      frequency.set(term, (frequency.get(term) || 0) + 1);
    }
  }
  return frequency;
}

function scorePassage(passage, queryWeights, frequency, total, phrase) {
  const counts = new Map();
  for (const term of terms(passage.text)) counts.set(term, (counts.get(term) || 0) + 1);
  const heading = new Set(terms(passage.heading));
  let score = 0;
  for (const [term, weight] of queryWeights) {
    const count = counts.get(term) || 0;
    if (!count && !heading.has(term)) continue;
    const df = frequency.get(term) || 0;
    const idf = Math.log(1 + (total - df + 0.5) / (df + 0.5));
    score += weight * idf * (1 + Math.log(Math.max(1, count)) + (heading.has(term) ? 2.4 : 0));
  }
  if (phrase && normalizeLibraryText(passage.text).includes(phrase)) score += 5;
  if (passage.text.length > 100 && passage.text.length < 900) score += 0.25;
  return score;
}

function chooseDiverse(ranked, limit) {
  const selected = [];
  const pages = new Set();
  const headings = new Set();
  for (const passage of ranked) {
    const page = passage.page ?? passage.pageIndex;
    const heading = passage.heading || '';
    if (pages.has(page) || (heading && headings.has(heading) && selected.length < limit - 1)) continue;
    selected.push(passage);
    pages.add(page);
    if (heading) headings.add(heading);
    if (selected.length >= limit) break;
  }
  if (selected.length < limit) {
    for (const passage of ranked) {
      const page = passage.page ?? passage.pageIndex;
      if (pages.has(page)) continue;
      selected.push(passage);
      pages.add(page);
      if (selected.length >= limit) break;
    }
  }
  return selected;
}

function pickBook(books, text, state) {
  const normalized = normalizeLibraryText(text);
  // Resolve a full book title before ordinal words: "کتابچه تکمیلی جلد سوم"
  // is book four, not book three.
  const exact = books.find((book) => {
    const title = normalizeLibraryText(book.title);
    return title.length > 4 && normalized.includes(title);
  });
  if (exact) return exact;
  const ordinal = normalized.match(/(?:جلد|کتاب) (اول|دوم|سوم|چهارم|پنجم|1|2|3|4|5)/u)?.[1];
  const ids = { اول: 1, دوم: 2, سوم: 3, چهارم: 4, پنجم: 5, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
  if (ordinal && ids[ordinal]) {
    const selected = books.find((book) => Number(book.legacyId) === ids[ordinal]);
    if (selected) return selected;
  }
  if (normalized.includes('از حقیقت تا واقعیت')) {
    const first = books.find((book) => Number(book.legacyId) === 1);
    if (first) return first;
  }
  if (state?.bookId) {
    return books.find((book) => String(book.legacyId) === String(state.bookId)) || null;
  }
  return null;
}

function sourceLabel(item) {
  return [item.heading, item.page ? 'صفحه ' + item.page : ''].filter(Boolean).join(' · ') || 'متن کتاب';
}

function formatOrdinalPrefix(index) {
  const ordinal = String(index + 1).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
  // RLM anchors the ordinal at the RTL line start while preserving number-then-close-paren order.
  return '\u200F' + ordinal + ')\u200F ';
}

function formatPassages(passages) {
  return passages.map((item, index) => {
    const excerpt = item.text.length > 560 ? item.text.slice(0, 557).trimEnd() + '…' : item.text;
    return formatOrdinalPrefix(index) + excerpt + '\nمنبع: ' + sourceLabel(item);
  }).join('\n\n');
}

function bookHeadings(book) {
  const rows = [];
  for (const page of book.content?.pages || []) {
    const blocks = pageBlocks(page);
    const pageNumber = Number(page.sourcePage || page.page) || 0;
    const pageText = normalizeLibraryText(blocks.map((block) => block.text).join(' '));
    const frontMatter = /فهرست مطالب|تقدیم نامه|سپاسگزاری|پیشگفتار|یادداشتی درباره این مجموعه|شناسنامه/u.test(pageText);
    if (frontMatter && pageNumber <= 12) continue;
    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      if (block.type !== 'heading' && !/^(?:فصل|بخش|پیوست|مقدمه|نتیجه گیری)/u.test(normalizeLibraryText(block.text))) continue;
      let title = block.text.trim();
      const next = blocks[index + 1];
      // Some book pages store the section name as a short paragraph immediately
      // after a structural heading such as "بخش اول:".
      if (/^(?:فصل|بخش|پیوست|مرحله|هفته)\s+[^:：]{1,24}[:：]$/u.test(title)
        && next?.type !== 'heading' && next?.text?.trim().length > 2 && next.text.trim().length <= 100) {
        title += ' ' + next.text.trim();
      }
      rows.push({ text: title, page: pageNumber || null });
    }
  }
  const seen = new Set();
  return rows.filter((row) => {
    const key = normalizeLibraryText(row.text);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function representativePassages(passages, limit = 5) {
  if (!passages.length) return [];
  const targets = Array.from({ length: limit }, (_, index) =>
    Math.round(index * (passages.length - 1) / Math.max(1, limit - 1))
  );
  const selected = [];
  const seenPages = new Set();
  for (const target of targets) {
    const item = passages[target];
    if (!item) continue;
    const page = item.page ?? item.pageIndex;
    if (seenPages.has(page)) continue;
    selected.push(item);
    seenPages.add(page);
  }
  return selected;
}

function chapterRepresentativePassages(passages, limit = 6) {
  const byHeading = new Map();
  for (const item of passages) {
    const heading = String(item.heading || '').trim();
    const normalizedHeading = normalizeLibraryText(heading);
    const page = Number(item.page || item.pageIndex || 0);
    if (page > 0 && page <= 8) continue;
    if (!/(فصل|بخش|پیوست)/u.test(normalizedHeading)) continue;
    if (/(تمرین|کاربرگ|جمع بندی|روز [۰-۹0-9]+)/u.test(normalizedHeading)) continue;
    if (String(item.text || '').trim().length < 90) continue;
    if (!byHeading.has(normalizedHeading)) byHeading.set(normalizedHeading, item);
  }
  const chapters = [...byHeading.values()];
  return chapters.length
    ? representativePassages(chapters, Math.min(limit, chapters.length))
    : representativePassages(passages.filter((item) => String(item.text || '').trim().length >= 90), limit);
}

function formatProfileItemsWithEvidence(book, items) {
  return items.map(([heading, description, page], index) => {
    const sourcePage = (book.content?.pages || []).find((candidate) =>
      Number(candidate.sourcePage || candidate.page) === Number(page)
    );
    const blocks = Array.isArray(sourcePage?.blocks) ? sourcePage.blocks : [];
    const sourceBlocks = blocks
      .filter((block) => block.type !== 'heading')
      .map((block) => String(block.text || (Array.isArray(block.rows) ? block.rows.flat().join(' ') : '')).trim())
      .filter((text) => text.length > 24);
    const targetTerms = new Set(terms(heading + ' ' + description));
    const rankedBlocks = sourceBlocks.map((text, sourceIndex) => ({
      text,
      sourceIndex,
      score: terms(text).reduce((score, term) => score + (targetTerms.has(term) ? 1 : 0), 0),
    })).sort((a, b) => b.score - a.score || b.text.length - a.text.length);
    const bestBlock = rankedBlocks[0];
    let sourceText = bestBlock?.text || sourceBlocks.join(' ');
    // Short labels and workbook prompts can be the most relevant match but are
    // not meaningful evidence alone; extend them with adjacent text from the
    // same cited page instead of incorrectly declaring the page unsupported.
    if (sourceText.length < 80 && bestBlock) {
      const start = bestBlock.sourceIndex;
      const adjacent = sourceBlocks.slice(start, Math.min(sourceBlocks.length, start + 5));
      sourceText = adjacent.join(' ').trim();
      if (sourceText.length < 80 && start > 0) {
        sourceText = sourceBlocks.slice(Math.max(0, start - 2), start).concat(adjacent).join(' ').trim();
      }
    }
    const sourceHeading = blocks
      .filter((block) => block.type === 'heading')
      .map((block) => String(block.text || '').trim())
      .filter(Boolean)
      .join(' / ');
    const hasEvidence = sourceText.length > 80;
    const excerpt = hasEvidence
      ? sourceText.slice(0, 160) + (sourceText.length > 160 ? '…' : '')
      : 'در صفحه ارجاع‌شده گزیده متنیِ کافی برای نمایش پیدا نشد.';
    return formatOrdinalPrefix(index) + heading + '\n' + description +
      '\nشاهد کوتاه متن: ' + excerpt +
      '\nمنبع: ' + (hasEvidence ? [sourceHeading, 'صفحه ' + page].filter(Boolean).join(' · ') : 'صفحه ' + page);
  }).join('\n\n');
}

function recommendationEvidence(book, limit = 1) {
  const profile = getLibraryBookProfile(book);
  if (profile?.summary?.length) {
    return '\nشاهدهای مرتبط از متن کتاب:\n' +
      formatProfileItemsWithEvidence(book, profile.summary.slice(0, limit));
  }
  const passages = chapterRepresentativePassages(passagesForBook(book), limit);
  return passages.length
    ? '\nگزیده‌های مرتبط از متن کتاب:\n' + formatPassages(passages)
    : '\nبرای این پیشنهاد، شاهد متنیِ قابل نمایش در نسخه فعلی پیدا نشد.';
}

function summaryReply(book, passages) {
  const profile = getLibraryBookProfile(book);
  if (profile) {
    return 'خلاصه راهنمای محتوایی «' + book.title + '»\n\n' +
      'این جمع‌بندی، بازنویسی دستیار بر پایه موضوع‌ها و بخش‌های قابل بررسی متن است؛ نقل قول مستقیم نویسنده نیست و جای مطالعه کامل کتاب را نمی‌گیرد.\n\n' +
      formatProfileItemsWithEvidence(book, profile.summary) +
      '\n\nخط اصلی کتاب: ' + profile.plain +
      '\n\nبرای مطالعه دقیق‌تر، هر محور را با صفحه منبع در خود کتاب دنبال کن.';
  }
  const headings = mainBookHeadings(book);
  const substantive = passages.filter((item) => {
    const heading = normalizeLibraryText(item.heading);
    const text = normalizeLibraryText(item.text);
    const page = Number(item.page || item.pageIndex || 0);
    const earlyCoverPages = book.legacyId !== 4 && page > 0 && page <= 8;
    return !earlyCoverPages
      && !/(تقدیم نامه|سپاسگزاری|فهرست مطالب|پیشگفتار|یادداشتی درباره این مجموعه|شناسنامه|تمرین|کاربرگ|جمع بندی|روز [۰-۹0-9]+)/u.test(heading)
      && !/(تقدیم نامه|سپاسگزاری|فهرست مطالب|پیشگفتار)/u.test(text)
      && item.text.length >= 90;
  });
  const byHeading = new Map();
  for (const item of substantive) {
    const heading = String(item.heading || '').trim();
    if (!heading || !/(فصل|بخش|پیوست)/u.test(normalizeLibraryText(heading))) continue;
    const key = normalizeLibraryText(heading);
    if (!byHeading.has(key)) byHeading.set(key, item);
  }
  const chapterPassages = [...byHeading.values()];
  const selected = chapterPassages.length
    ? representativePassages(chapterPassages, Math.min(12, chapterPassages.length))
    : representativePassages(substantive, 6);
  const chapterText = headings.length
    ? '\n\nنقشه فصل‌ها و بخش‌های اصلی:\n' + headings
      .filter((item) => !/(تمرین|کاربرگ|جمع بندی|روز [۰-۹0-9]+)/u.test(normalizeLibraryText(item.text)))
      .slice(0, 24)
      .map((item) => '- ' + item.text + (item.page ? ' (صفحه ' + item.page + ')' : ''))
      .join('\n')
    : '';
  return 'مرور محتواییِ ساختاری «' + book.title + '»\n' +
    'این پاسخ، خلاصه تفسیریِ کامل یا جایگزین مطالعه کتاب نیست؛ نقشه‌ای از فصل‌ها همراه با گزیده‌ای از متن واقعی هر بخش است.' +
    chapterText +
    (selected.length ? '\n\nگزیده‌های نماینده از فصل‌ها و بخش‌ها:\n' + formatPassages(selected) : '') +
    '\n\nمحدودیت: برای کتابی که پروفایل محتواییِ بازبینی‌شده ندارد، این خروجی فقط مرور ساختاری است.';
}


function listBooksReply(books) {
  return 'کتاب‌های موجود در کتابخانه:\n' + books.map((book, index) => {
    const subject = book.content?.subtitle || book.content?.description || '';
    return (index + 1) + ') ' + book.title + (subject ? '\nموضوع ثبت‌شده: ' + subject : '');
  }).join('\n\n');
}

function compareBooksReply(books) {
  const rows = books.map((book) => {
    const profile = getLibraryBookProfile(book);
    const subject = profile?.subject || book.content?.subtitle || book.content?.description || 'توضیح موضوعی مستقل ثبت نشده است';
    const focus = profile?.comparison || 'برای این کتاب هنوز جمع‌بندی مقایسه‌ایِ بازبینی‌شده ثبت نشده است.';
    const pair = profile?.conceptPair?.length === 2 ? profile.conceptPair : null;
    const concept = pair && profile?.conceptComparison
      ? '\nنمونه تمایز مفهومی: ' + pair.join(' در برابر ') + ' — ' + profile.conceptComparison
      : '';
    let evidence = '';
    if (pair) {
      const passages = passagesForBook(book);
      const first = retrieveConceptEvidence(passages, pair[0], 1);
      const second = retrieveConceptEvidence(passages, pair[1], 1);
      evidence = first.length && second.length
        ? '\nشاهدهای صفحه‌ای برای دو مفهوم:\n' + formatPassages([...first, ...second])
        : '\nبرای هر دو مفهوم شاهد صفحه‌ای کافی پیدا نشد؛ این تمایز را باید پیش از نتیجه‌گیری در متن اصلی بازبینی کرد.';
    }
    return '• «' + book.title + '»\nمحور اصلی: ' + subject + '\nجایگاه در مجموعه: ' + focus + concept + evidence;
  });
  return [
    'مقایسه ساختاری و موضوعی پنج کتاب کتابخانه مسیر ۲۸',
    rows.join('\n\n'),
    'جمع‌بندی مسیر مطالعه: جلد اول پایه عمومی خودشناسی را می‌سازد؛ جلد دوم سازوکارهای شناخت و یادگیری را عمیق‌تر بررسی می‌کند؛ جلد سوم موانع تبدیل آگاهی به رفتار را می‌کاود؛ کتابچه چهارم ابزار اجرایی مکمل جلد سوم است؛ و کتاب پنجم بر سواد هیجانی و شناخت و تنظیم احساسات تمرکز دارد.',
    'این نقشه مطالعه بر اساس پروفایل‌های محتوایی ثبت‌شده است؛ نه رتبه‌بندی علمی، اثربخشی درمانی یا نظر قطعی نویسندگان.'
  ].join('\n\n');
}


function mainBookHeadings(book) {
  return bookHeadings(book).filter((item) =>
    /فصل|بخش|تمرین|پیوست|هفته|روز|اصل|مرحله|جمع بندی/u.test(normalizeLibraryText(item.text))
    && !/تقدیم نامه|سپاسگزاری|پیشگفتار|فهرست مطالب|یک نکته مهم|یادداشتی درباره این مجموعه/u.test(normalizeLibraryText(item.text))
  );
}

function bookSubject(book) {
  const profile = getLibraryBookProfile(book);
  const headings = mainBookHeadings(book).slice(0, 8).map((item) => item.text);
  return [profile?.subject, book.content?.subtitle, book.content?.description, ...headings].filter(Boolean).join('؛ ');
}

function recommendBooks(books, message) {
  const normalized = normalizeLibraryText(message);
  const beginner = /(?:تازه|مبتدی|اولین بار|شروع مطالعه|از کجا شروع)/u.test(normalized) && !CHANGE_BARRIER.test(normalized);
  if (beginner) {
    const first = books.find((book) => Number(book.legacyId) === 1) || books[0];
    const emotions = books.find((book) => Number(book.legacyId) === 5);
    const workbook = books.find((book) => Number(book.legacyId) === 4);
    const profile = getLibraryBookProfile(first);
    return 'پیشنهاد روشن برای شروع: «' + first.title + '».\n' +
      (profile?.beginner || 'این کتاب برای شروع مسیر مناسب‌تر به نظر می‌رسد.') +
      recommendationEvidence(first, 1) +
      (emotions ? '\n\nاگر مسئله اصلی‌ات شناخت و تنظیم احساسات است، «' + emotions.title + '» گزینه شروعِ موضوعی مناسبی است.' + recommendationEvidence(emotions, 1) : '') +
      (workbook ? '\n\n«' + workbook.title + '» را به‌عنوان کتاب اول پیشنهاد نمی‌کنم؛ این کتابچه ابزار اجرایی است و در کنار جلد سوم بیشترین فایده را دارد.' + recommendationEvidence(workbook, 1) : '') +
      '\n\nاین پیشنهاد بر اساس ساختار و محتوای کتاب‌هاست؛ اگر هدفت را مشخص کنی، ترتیب مطالعه را دقیق‌تر می‌کنم.';
  }
  const candidates = SELF_KNOWLEDGE.test(normalized)
    ? books.filter((book) => /خودشناسی|شناخت احساس|شناخت خود|احساسات/u.test(normalizeLibraryText(bookSubject(book))))
    : CHANGE_BARRIER.test(normalized)
      ? books.filter((book) => [3, 4].includes(Number(book.legacyId)))
      : books;
  const chosen = candidates.length ? candidates : books;
  return 'پیشنهاد مطالعه بر اساس موضوع ثبت‌شده و محتوای بررسی‌شده:\n\n' +
    chosen.slice(0, 3).map((book, index) => {
      const profile = getLibraryBookProfile(book);
      return (index + 1) + ') «' + book.title + '»\n' +
        (profile?.beginner || profile?.subject || book.content?.subtitle || 'توضیح موضوعی مستقل ثبت نشده است') +
        recommendationEvidence(book, 1);
    }).join('\n\n') +
    '\n\nاین پیشنهاد بر پایه محتوای کتاب‌هاست، نه شناخت وضعیت شخصی تو.';
}


function hasTopicEvidence(passages, pattern) {
  return passages.some((passage) => pattern.test(normalizeLibraryText(passage.text + ' ' + passage.heading)));
}

function structuredGuidance(intent, book, passages, message) {
  const source = formatPassages(passages.slice(0, 4));
  const title = '«' + book.title + '»';
  const evidence = 'شواهد قابل بازیابی از کتاب:\n\n' + source;
  if (SCIENCE.test(intent)) return 'از متن این کتاب به‌تنهایی نمی‌توان اعتبار علمی یک دیدگاه را تأیید کرد. برای چنین داوری‌ای باید ادعا را دقیق مشخص کنیم و آن را با پژوهش‌های معتبر و مستقل بسنجیم.\n\n' + evidence + '\n\nمرزبندی: گزیده‌های بالا نشان می‌دهند کتاب چه می‌گوید؛ آن‌ها به‌تنهایی اثبات علمی درستی ادعا نیستند.';
  if (ALTERNATIVE_VIEW.test(intent)) return 'ممکن است درباره این موضوع دیدگاه‌های دیگری وجود داشته باشد، اما از متن در دسترس این کتاب نمی‌توانم وجود یا محتوای یک دیدگاه مخالف مشخص را اثبات کنم. دیدگاه بیرونی را نباید به نویسنده نسبت داد.\n\n' + evidence + '\n\nاگر بخواهی، پرسش را به یک ادعای مشخص تبدیل می‌کنیم تا جداگانه با منابع علمی مستقل بررسی شود.';
  if (ANXIETY.test(intent)) return 'بخش‌های زیر از نظر شناخت احساسات، نگرانی یا واکنش‌های مرتبط با پرسش تو قابل بررسی‌اند. این‌ها اطلاعات کتابی و خودآگاهی عمومی‌اند، نه تشخیص یا درمان اضطراب:\n\n' + source + '\n\nاگر اضطراب شدید، مداوم یا مختل‌کننده زندگی است، این متن جای ارزیابی متخصص را نمی‌گیرد.';
  if (ANGER.test(intent)) {
    const angerEvidence = normalizeLibraryText(passages.map((item) => item.text + ' ' + item.heading).join(' '));
    const supportsAlternative = /پاسخ جایگزین|راه(?: های)? سالم تر(?:ی)?|بیان سالم تر|پاسخ دیگری را انتخاب/u.test(angerEvidence);
    const scope = supportsAlternative
      ? 'گزیده‌های بازیابی‌شده به شناخت احساس‌های زیرین خشم و امکان انتخاب شیوه سالم‌تری برای بیان آن اشاره می‌کنند.'
      : 'در گزیده حاضر فقط اهمیت مشاهده آنچه هنگام عصبانیت رخ می‌دهد دیده می‌شود؛ برای نشانه‌های اولیه یا پاسخ جایگزین مشخص، شاهد کافی در این کتاب پیدا نکردم.';
    return scope + '\n\nپیشنهاد عملی دستیار این است که در یک موقعیت کم‌تنش، محرک، احساس، میل فوری و پاسخ انتخاب‌شده را جداگانه ثبت کنی. این پیشنهاد، نقل قول کتاب نیست و هدفش سرکوب احساس یا توجیه آسیب به خود/دیگران نیست.\n\n' + evidence;
  }
  if (CONFIDENCE.test(intent)) return 'در بخش‌های بازیابی‌شده، فقط نکته‌هایی را می‌توان به کتاب نسبت داد که شاهد متنی دارند. برای تقویت اعتمادبه‌نفس، پیشنهاد تکمیلی دستیار این است که یک اقدام کوچک و قابل انجام انتخاب کنی و شواهد انجام آن را ثبت کنی؛ این توصیه، متن نویسنده نیست.\n\n' + evidence;
  if (LIMITATIONS.test(intent)) return 'برای ارزیابی محدودیت‌ها باید میان محدودیت متن کتاب و محدودیت کاربرد توصیه در زندگی واقعی فرق بگذاریم. از همین متن می‌توان گفت این گزیده‌ها به‌تنهایی همه شرایط فردی، تفاوت‌های زمینه‌ای یا شواهد علمی بیرونی را پوشش نمی‌دهند.\n\n' + evidence + '\n\nاین ارزیابی، تحلیل محتاطانه دستیار است و نه نقل قول از نویسنده.';
  if (WEEK_PLAN.test(intent)) return 'برنامه هفت‌روزه پیشنهادی دستیار بر پایه موضوع بازیابی‌شده از ' + title + ' است؛ این برنامه نقل قول یا برنامه تألیفی کتاب نیست:\n\n' +
    'روز ۱: مفهوم یا موقعیت مرتبط را بخوان و یک نمونه شخصیِ کم‌تنش ثبت کن.\nروز ۲: فقط نشانه‌ها و شرایط پیش از آن را مشاهده کن.\nروز ۳: فکر، احساس و رفتار را جداگانه یادداشت کن.\nروز ۴: یک پاسخ جایگزین کوچک و ایمن انتخاب کن.\nروز ۵: آن پاسخ را در موقعیتی آسان امتحان کن.\nروز ۶: نتیجه را بدون سرزنش بررسی و در صورت نیاز ساده‌ترش کن.\nروز ۷: شواهد رفتاری، دشواری‌ها و قدم بعدی را مرور کن.\n\nمعیار موفقیت، انجام کامل و بی‌نقص نیست؛ مشاهده و ثبت یک تغییر کوچک است. اگر تمرین فشار روانی را بیشتر کرد، متوقفش کن و از نسخه ساده‌تر استفاده کن.\n\n' + evidence;
  if (ALTERNATIVE_EXERCISE.test(intent)) return 'اگر تمرین اصلی دشوار است، آن را کوچک‌تر کن؛ لازم نیست به خودت فشار بیاوری:\n\nجایگزین ساده پیشنهادی دستیار: فقط یک موقعیت را در یک جمله ثبت کن و نام احساست را بنویس. اگر همین هم دشوار است، تنها یک کلمه درباره حال خودت یادداشت کن یا تمرین را به زمان مناسب‌تری موکول کن.\n\nاین جایگزین، پیشنهاد دستیار است و نقل قول کتاب نیست. اگر تمرین ناراحتی یا فشار را بیشتر کرد، آن را متوقف کن.\n\n' + evidence;
  if (AUTHOR_MEANING.test(intent) || AUTHOR_REASON.test(intent)) return 'برای توضیح دقیق منظور یا دلیل نویسنده باید بدانم به کدام جمله، پاراگراف یا فصل اشاره می‌کنی. از روی یک پرسش کلی نباید نیت نویسنده را حدس بزنم.\n\nنزدیک‌ترین شواهدی که از پرسش فعلی بازیابی شده‌اند:\n\n' + source + '\n\nاگر عنوان فصل یا چند کلمه از همان بخش را بفرستی، آن را دقیق‌تر بررسی می‌کنم و برداشت خودم را از متن نویسنده جدا نگه می‌دارم.';
  if (CONCEPT_COMPARE.test(intent)) return 'برای مقایسه دقیق، باید دو مفهوم مشخص باشند. در حال حاضر می‌توانم محورهای واقعی کتاب را نشان بدهم؛ اما انتخاب دو مفهوم به‌جای تو ممکن است مقایسه‌ای بی‌ربط بسازد.\n\nچند عنوان قابل مشاهده در این کتاب:\n' + bookHeadings(book).slice(0, 12).map((item) => '• ' + item.text + (item.page ? '، صفحه ' + item.page : '')).join('\n') + '\n\nنام دو مفهوم را بگو تا تعریف، شباهت، تفاوت و کاربردشان را بر اساس متن مقایسه کنم.';
  if (PROGRESS.test(intent)) return 'برای سنجش پیشرفت, به رفتارهای قابل مشاهده توجه کن، نه اینکه انتظار داشته باشی همیشه احساس خاصی داشته باشی:\n- چند بار توانستی موقعیت یا احساس را زودتر تشخیص بدهی؟\n- آیا پیش از واکنش مکث کوتاهی ایجاد شد؟\n- آیا یک انتخاب آگاهانه‌تر انجام دادی؟\n- بعد از دشواری، چقدر سریع‌تر به تمرین برگشتی؟\n\nاین شاخص‌ها پیشنهاد سنجش دستیارند، نه معیار تشخیصی یا درمانی.\n\n' + evidence;
  if (EXAMPLE_OR_EXERCISE.test(intent)) return 'یک نمونه فرضی و تمرین پیشنهادی دستیار بر پایه موضوع متن:\n\nمثال فرضی: اگر در یک گفت‌وگو متوجه شوی واکنشت سریع و شدید شده، می‌توانی پیش از پاسخ چند لحظه مکث کنی و نام احساست را مشخص کنی.\n\nتمرین کم‌فشار: در پایان روز فقط یک موقعیت را ثبت کن: چه اتفاقی افتاد؟ چه احساسی داشتم؟ چه واکنشی نشان دادم؟ دفعه بعد چه انتخاب کوچکی دارم؟\n\nاین مثال و تمرین ساخته دستیارند، نه نقل قول کتاب و نه توصیه درمانی.\n\n' + evidence;
  if (DAILY_APPLICATION.test(intent)) return 'برای تبدیل مفهوم به عمل، آن را به یک رفتار کوچک و قابل مشاهده محدود کن:\n۱) یک موقعیت مشخص انتخاب کن.\n۲) پیش از واکنش، نشانه یا احساس خود را نام ببر.\n۳) یک پاسخ کوچک و ایمن را امتحان کن.\n۴) نتیجه را کوتاه ثبت کن و بر اساس تجربه اصلاح کن.\n\nاین گام‌ها پیشنهاد کاربردی دستیارند؛ پایه کتابی آن‌ها در گزیده‌های زیر آمده است.\n\n' + evidence;
  if (SIMPLE_EXPLAIN.test(intent)) return 'می‌توانم متن مرتبط را ساده‌سازی کنم، اما برای جلوگیری از تحریف، ابتدا شاهدهای خود کتاب را نشان می‌دهم. برداشت ساده و محتاطانه از این گزیده‌ها این است که باید میان آنچه رخ می‌دهد، برداشتی که از آن می‌کنیم و واکنشی که نشان می‌دهیم تمایز بگذاریم. این برداشت فقط در صورتی معتبر است که با بخش انتخاب‌شده منطبق باشد؛ برای توضیح دقیق‌تر، نام فصل یا پاراگراف را مشخص کن.\n\n' + evidence;
  if (KEY_POINTS.test(intent)) {
    const profile = getLibraryBookProfile(book);
    if (profile?.keyPoints?.length) {
      return 'نکته‌های کلیدی منتخب «' + book.title + '» (راهنمای مطالعه، نه رتبه‌بندی قطعی نویسنده):\n\n' +
        formatProfileItemsWithEvidence(book, profile.keyPoints.map(([point, page]) => [point, 'این نکته، بازنویسی دستیار از محور محتوایی فصل است؛ شاهد کوتاه متن در ادامه آمده است.', page])) +
        '\n\nاین‌ها بازنویسی دستیارند؛ برای فهم کامل استدلال، متن فصل‌های ارجاع‌شده را بخوان.';
    }
    return 'محورهای قابل مشاهده در بخش‌های اصلی کتاب (نه رتبه‌بندی قطعی مهم‌ترین نکات):\n\n' + source + '\n\nاین گزیده‌ها برای آشنایی با چند فصل‌اند؛ تعیین اهمیت و اولویت نکات به تحلیل کامل استدلال هر فصل نیاز دارد.';
  }
  return evidence;
}

function hasExplicitSectionReference(value) {
  const normalized = normalizeLibraryText(String(value || ''));
  const numberedSection = /(?:فصل|بخش|پیوست)\s+(?:اول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم|نهم|دهم|یازدهم|دوازدهم|[0-9]+)/u;
  const namedSection = /(?:عنوان فصل|عنوان بخش)\s+[\p{L}]{3,}/u;
  return numberedSection.test(normalized)
    || /صفحه\s*[0-9]+/u.test(normalized)
    || namedSection.test(normalized);
}

function hasExplicitClaimReference(value) {
  const raw = String(value || '');
  const normalized = normalizeLibraryText(raw);
  return hasExplicitSectionReference(raw)
    || /(?:ادعا|جمله|عبارت|توصیه)\s*(?:مشخص|این است|که|:)/u.test(normalized)
    || /[«"][^»"]{8,}[»"]/u.test(raw);
}

function extractSimpleConceptPair(message) {
  const normalized = normalizeLibraryText(message)
    .replace(/^(?:منظورم|مفهوم ها|دو مفهوم|این دو مفهوم|مقایسه این دو)\s*/u, '')
    .replace(/\s+(?:را|رو|با هم|هستند|است)$/u, '')
    .trim();
  const parts = normalized.split(/\s+(?:و|با)\s+/u).map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2) return null;
  const valid = parts.every((part) => part.length >= 2 && part.split(' ').length <= 4);
  return valid && parts[0] !== parts[1] ? parts : null;
}

function extractConceptPair(message) {
  const normalized = normalizeLibraryText(message)
    .replace(/(?:در )?(?:کتاب|جلد) (?:اول|دوم|سوم|چهارم|پنجم|1|2|3|4|5) /u, '')
    .trim();
  const patterns = [
    /(?:مقایسه|تفاوت|فرق)(?: بین)?\s+(.{2,48}?)\s+(?:و|با)\s+(.{2,48}?)(?=\s+(?:را|رو|در|برای|چیست|کدام|با هم|کن|بده|می کنی)|$)/u,
    /(?:مفهوم )?(.{2,40}?)\s+و\s+(.{2,40}?)\s+(?:را )?با هم مقایسه/u,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const clean = (value) => value.replace(/^(?:مفهوم|مفاهیم|دو مفهوم) /u, '').replace(/^(?:موضوع|اصل) /u, '').trim();
    const first = clean(match[1]);
    const second = clean(match[2]);
    if (first.length >= 2 && second.length >= 2 && first !== second) return [first, second];
  }
  return null;
}

function retrieveConceptEvidence(passages, concept, limit = 3) {
  return rankLibraryPassages(passages, concept, limit);
}

function compareConceptEvidenceReply(book, concepts, passages) {
  const [first, second] = concepts;
  const firstEvidence = retrieveConceptEvidence(passages, first);
  const secondEvidence = retrieveConceptEvidence(passages, second);
  if (!firstEvidence.length || !secondEvidence.length) {
    const missing = [!firstEvidence.length ? first : null, !secondEvidence.length ? second : null].filter(Boolean);
    return 'در «' + book.title + '» برای مفهوم ' + missing.map((item) => '«' + item + '»').join(' و ') +
      ' شاهد متنی کافی پیدا نکردم. برای مقایسه قابل اتکا، لطفاً اصطلاح دقیق‌تر، عنوان فصل یا شماره صفحه را مشخص کن. از روی حدس، تعریف یا تفاوتی نمی‌سازم.';
  }
  return 'مقایسه مستند دو مفهوم در «' + book.title + '»' +
    '\n\nمفهوم اول: «' + first + '»\n' + formatPassages(firstEvidence) +
    '\n\nمفهوم دوم: «' + second + '»\n' + formatPassages(secondEvidence) +
    '\n\nجمع‌بندی دقیق: گزیده‌های بالا نشان می‌دهند هر مفهوم در چه بافتی از کتاب مطرح شده است. چون موتور فعلی قاعده‌محور است، از هم‌پوشانی چند واژه به‌تنهایی شباهت یا تفاوت معنایی قطعی نتیجه نمی‌گیرم؛ این خروجی مقایسه شواهد متنی است، نه تحلیل نهایی استدلال نویسنده.';
}

export function answerLibraryBookTurn({ books = [], message = '', conversationState = null } = {}) {
  const available = books.filter((book) => book?.content && Array.isArray(book.content.pages));
  if (!available.length) return null;
  const normalized = normalizeLibraryText(message);
  const readerHelp = libraryReaderHelp(normalized);
  if (readerHelp) return { message: readerHelp, conversationState: null };
  if (BOOKS_COMBINED_HELP.test(normalized)) {
    return {
      message: 'برای استفاده پیوسته از کتابخانه، می‌توانی این ترتیب را در نظر بگیری:\n۱) جلد اول برای آشنایی پایه با خودشناسی، باورها، انتخاب و اقدام.\n۲) جلد دوم برای فهم عمیق‌تر ادراک، حافظه، عادت و سازوکارهای یادگیری.\n۳) جلد سوم برای بررسی موانع اجرای تغییر و طراحی پاسخ جایگزین.\n۴) کتابچه تکمیلی جلد سوم را همراه جلد سوم به کار ببر؛ این کتابچه ابزار ثبت زنجیره رفتار، سنجش فایده و هزینه و طراحی پاسخ تازه است؛ مکمل مطالعه نظری است و جایگزین مطالعه نظری نیست.\n۵) جلد پنجم برای شناخت و تنظیم احساسات، به‌عنوان مسیر موضوعی مکمل قابل استفاده است.\n\nلازم نیست همه کتاب‌ها را پشت سر هم بخوانی؛ از هدف فعلی‌ات شروع کن و کتابچه را زمانی بردار که می‌خواهی یک رفتار مشخص را ثبت و بررسی کنی.',
      conversationState: null,
    };
  }
  if (LIST.test(normalized)) return { message: listBooksReply(available), conversationState: null };
  const audienceBook = BOOK_AUDIENCE.test(normalized) ? pickBook(available, message, conversationState) : null;
  if (RECOMMEND.test(normalized) && !audienceBook) return { message: recommendBooks(available, normalized), conversationState: null };
  if (COMPARE.test(normalized) && !CONCEPT_COMPARE.test(normalized) && !ALTERNATIVE_VIEW.test(normalized) && /(?:کتاب|پنج|همه)/u.test(normalized)) {
    return { message: compareBooksReply(available), conversationState: null };
  }

  const book = pickBook(available, message, conversationState);
  if (!book) {
    const asksBook = /(?:کتاب|جلد|خلاصه|چکیده|متن کتاب|فصل|نویسنده)/u.test(normalized);
    if (!asksBook) return null;
    return { message: 'برای اینکه متن اشتباهی را به تو نسبت ندهم، نام یکی از کتاب‌ها یا شماره جلد را مشخص کن. پنج کتاب موجود در کتابخانه را می‌توانم بررسی کنم.', conversationState: null };
  }

  const followUp = Boolean(conversationState?.bookId && !/(?:جلد|کتاب) (?:اول|دوم|سوم|چهارم|پنجم|1|2|3|4|5)/u.test(normalized));
  const effectiveQuery = followUp && conversationState.lastQuery
    ? conversationState.lastQuery + ' ' + message
    : message;
  const intentText = normalizeLibraryText(effectiveQuery);
  const currentTurnHasGuidanceIntent = [
    SCIENCE, ALTERNATIVE_VIEW, LIMITATIONS, WEEK_PLAN, PROGRESS,
    EXAMPLE_OR_EXERCISE, DAILY_APPLICATION, SIMPLE_EXPLAIN, KEY_POINTS,
    ANXIETY, ANGER, CONFIDENCE, ALTERNATIVE_EXERCISE, AUTHOR_MEANING, AUTHOR_REASON,
  ].some((pattern) => pattern.test(normalized));
  const responseIntent = currentTurnHasGuidanceIntent ? normalized : intentText;
  const hasSectionReference = hasExplicitSectionReference(message) || Boolean(conversationState?.lastSources?.length);
  const hasClaimReference = hasExplicitClaimReference(message) || Boolean(conversationState?.lastSources?.length);

  if ((AUTHOR_MEANING.test(intentText) || AUTHOR_REASON.test(intentText)) && !hasSectionReference) {
    return { message: 'در «' + book.title + '»، برای توضیح دقیق منظور نویسنده لطفاً عنوان فصل، شماره صفحه یا چند کلمه از همان بخش را مشخص کن. هنوز معلوم نیست «این بخش» به کدام قسمت کتاب اشاره دارد؛ نمی‌خواهم نیت نویسنده را حدس بزنم.', conversationState: { bookId: book.legacyId, bookTitle: book.title, lastQuery: message } };
  }
  if (CONCEPT_COMPARE.test(intentText) || conversationState?.pendingConceptCompare) {
    const concepts = extractConceptPair(message) || (conversationState?.pendingConceptCompare ? extractSimpleConceptPair(message) : null);
    if (concepts) {
      const passages = passagesForBook(book);
      const reply = compareConceptEvidenceReply(book, concepts, passages);
      return {
        message: reply,
        conversationState: { bookId: book.legacyId, bookTitle: book.title, lastQuery: effectiveQuery, comparedConcepts: concepts, pendingConceptCompare: false },
      };
    }
    const profile = getLibraryBookProfile(book);
    if (profile?.conceptPair?.length === 2) {
      const suggestedPair = profile.conceptPair;
      const passages = passagesForBook(book);
      const evidenceReply = compareConceptEvidenceReply(book, suggestedPair, passages);
      const comparison = profile.conceptComparison
        ? 'مقایسه محوریِ بازنویسی‌شده توسط دستیار:\n' + profile.conceptComparison + '\n\n'
        : '';
      return {
        message: 'دو مفهوم محوری برای مقایسه در «' + book.title + '»:\n' +
          '۱) ' + suggestedPair[0] + '\n۲) ' + suggestedPair[1] + '\n\n' +
          comparison + evidenceReply,
        conversationState: { bookId: book.legacyId, bookTitle: book.title, lastQuery: effectiveQuery, comparedConcepts: suggestedPair, pendingConceptCompare: false },
      };
    }
    const headings = mainBookHeadings(book).slice(0, 14);
    return { message: 'در «' + book.title + '»، برای مقایسه لطفاً نام دو مفهوم را مشخص کن. نمونه قالب: «مفهوم باور و احساس را با هم مقایسه کن». این‌ها چند عنوان واقعی از ساختار کتاب هستند:\n' + headings.map((item) => '• ' + item.text + (item.page ? '، صفحه ' + item.page : '')).join('\n'), conversationState: { bookId: book.legacyId, bookTitle: book.title, lastQuery: effectiveQuery, pendingConceptCompare: true } };
  }
  if (BOOK_AUDIENCE.test(normalized)) {
    const profile = getLibraryBookProfile(book);
    const headings = mainBookHeadings(book).slice(0, 5);
    const evidence = chapterRepresentativePassages(passagesForBook(book), 2);
    return {
      message: 'راهنمای مخاطب «' + book.title + '»\nاین کتاب برای چه هدف و خواننده‌ای مناسب‌تر است؟\n\n' +
        (profile?.beginner || profile?.comparison || profile?.subject || 'برای این کتاب توضیح مخاطب مستقلی ثبت نشده است.') +
        (profile?.subject ? '\n\nموضوع‌هایی که پوشش می‌دهد: ' + profile.subject : '') +
        (headings.length ? '\n\nبخش‌های مرتبط برای شروع: ' + headings.map((item) => item.text + (item.page ? '، صفحه ' + item.page : '')).join('؛ ') : '') +
        (evidence.length ? '\n\nشواهد از متن کتاب:\n' + formatPassages(evidence) : '') +
        '\n\nاین راهنمای انتخاب بر پایه ساختار و محتوای کتاب است و به معنی ارزیابی یا شناخت وضعیت شخصی خواننده نیست.',
      conversationState: { bookId: book.legacyId, bookTitle: book.title, lastQuery: effectiveQuery },
    };
  }
  if (BOOK_SUBJECT.test(normalized)) {
    const profile = getLibraryBookProfile(book);
    const headings = mainBookHeadings(book).slice(0, 8);
    const subjectEvidence = chapterRepresentativePassages(passagesForBook(book), 2);
    return { message: 'موضوع اصلی «' + book.title + '»\n\n' +
      (profile?.plain || profile?.subject || book.content?.subtitle || book.content?.description || 'توضیح موضوعی مستقل ثبت نشده است') +
      (profile?.subject ? '\n\nحوزه‌های اصلی کتاب: ' + profile.subject : '') +
      (headings.length ? '\n\nبخش‌های راهنما:\n' + headings.slice(0, 5).map((item) => '• ' + item.text + (item.page ? '، صفحه ' + item.page : '')).join('\n') : '') +
      (subjectEvidence.length ? '\n\nشواهد متنی از کتاب:\n' + formatPassages(subjectEvidence) : '') +
      '\n\nاین توضیح، بازنویسی دستیار بر پایه پروفایل محتوایی و متن کتاب است؛ نقل قول مستقیم نویسنده نیست.',
      conversationState: { bookId: book.legacyId, bookTitle: book.title, lastQuery: effectiveQuery } };
  }
  const allPassages = passagesForBook(book);
  if (!allPassages.length) {
    return { message: 'متن قابل‌جست‌وجوی «' + book.title + '» در نسخه فعلی بارگذاری نشده است؛ بنابراین پاسخ یا خلاصه حدسی ارائه نمی‌کنم.', conversationState: { bookId: book.legacyId, bookTitle: book.title, lastQuery: effectiveQuery } };
  }

  const unresolvedReference = /(?:این بخش|این مفهوم|این مطالب|این توصیه|این موضوع|این دیدگاه|این تمرین|همین تمرین)/u.test(intentText);
  if (unresolvedReference && !SCIENCE.test(intentText) && !ALTERNATIVE_VIEW.test(intentText) && !LIMITATIONS.test(intentText)
    && !hasSectionReference) {
    return {
      message: 'برای اینکه تمرین، مثال یا تحلیل نامرتبط نسازم، لازم است بدانم منظورت کدام بخش از «' + book.title + '» است. عنوان فصل، شماره صفحه یا چند واژه از همان قسمت را بفرست؛ بعد پاسخ را به همان متن وصل می‌کنم و پیشنهاد خودم را از گفته نویسنده جدا می‌نویسم.',
      conversationState: { bookId: book.legacyId, bookTitle: book.title, lastQuery: effectiveQuery, awaitingSection: true },
    };
  }
  if ((SCIENCE.test(intentText) || ALTERNATIVE_VIEW.test(intentText) || LIMITATIONS.test(intentText))
    && !hasClaimReference) {
    return {
      message: 'در «' + book.title + '»، برای بررسی علمی، دیدگاه مخالف یا محدودیت‌ها باید ادعا یا توصیه مشخص باشد. لطفاً جمله، عنوان فصل یا صفحه‌ای را که درباره‌اش می‌پرسی مشخص کن. بدون دانستن ادعای موردنظر، آوردن چند گزیده نامرتبط می‌تواند گمراه‌کننده باشد.',
      conversationState: { bookId: book.legacyId, bookTitle: book.title, lastQuery: effectiveQuery, awaitingClaim: true },
    };
  }
  if (SIMPLE_EXPLAIN.test(intentText) && /مفهوم اصلی/u.test(intentText)
    && !hasSectionReference && !conversationState?.lastSources?.length) {
    const profile = getLibraryBookProfile(book);
    const headings = mainBookHeadings(book).slice(0, 8);
    const subject = profile?.subject || book.content?.subtitle || book.content?.description || 'توضیح موضوعی مستقل ثبت نشده است';
    const simpleEvidence = chapterRepresentativePassages(passagesForBook(book), 2);
    return {
      message: 'توضیح ساده مفهوم اصلی «' + book.title + '»\n\n' +
        (profile?.plain || 'موضوع معرفی‌شده: ' + subject) +
        (headings.length ? '\n\nبرای مطالعه جزئی‌تر، این بخش‌ها نقطه شروع مناسبی‌اند:\n' + headings.slice(0, 5).map((item) => '• ' + item.text + (item.page ? '، صفحه ' + item.page : '')).join('\n') : '') +
        (simpleEvidence.length ? '\n\nشواهد متنی برای این توضیح:\n' + formatPassages(simpleEvidence) : '') +
        '\n\nاین توضیح، بازنویسی دستیار بر پایه ساختار و متن بررسی‌شده است؛ نقل قول مستقیم نویسنده نیست.',
      conversationState: { bookId: book.legacyId, bookTitle: book.title, lastQuery: effectiveQuery, awaitingSection: true },
    };
  }
  // The previous turn supplies context; the new turn still contributes fresh retrieval terms.
  const asksSummary = SUMMARY.test(intentText);
  // For a follow-up that introduces a new analytical intent (for example,
  // asking for limitations), rank evidence against that new request first.
  // Keep the previous topic in intentText/state, but do not let its older
  // keywords drown out the evidence sought in the latest turn.
  const freshIntent = LIMITATIONS.test(message) || SCIENCE.test(message)
    || ALTERNATIVE_VIEW.test(message) || PROGRESS.test(message);
  const retrievalQuery = followUp && freshIntent ? message : effectiveQuery;
  // Local hybrid retrieval combines BM25-style term weights, heading boosts,
  // phrase/proximity signals and conservative Persian concept expansion.
  const ranked = asksSummary
    ? allPassages
    : rankLibraryPassages(allPassages, retrievalQuery, 16);

  let selected = asksSummary
    ? []
    : KEY_POINTS.test(normalized)
      ? chapterRepresentativePassages(allPassages, 6)
      : chooseDiverse(ranked, 5);
  if (!asksSummary && !selected.length && (SCIENCE.test(intentText) || ALTERNATIVE_VIEW.test(intentText) || LIMITATIONS.test(intentText) || PROGRESS.test(intentText))) {
    const reply = SCIENCE.test(intentText)
      ? 'از متن در دسترس این کتاب شاهد کافی برای داوری علمی این ادعا پیدا نکردم. از متن کتاب به‌تنهایی نمی‌توان اعتبار علمی یک دیدگاه را تأیید کرد؛ برای پاسخ دقیق باید ادعای مشخص را با پژوهش‌های معتبر و مستقل بررسی کرد. این پاسخ عمداً از تأیید یا رد بی‌منبع خودداری می‌کند.'
      : ALTERNATIVE_VIEW.test(intentText)
        ? 'در متن بازیابی‌شده شاهد کافی برای معرفی یک دیدگاه مخالف مشخص پیدا نکردم؛ نمی‌توانم وجود یا محتوای یک دیدگاه مخالف مشخص را اثبات کنم. دیدگاه بیرونی را حدس نمی‌زنم و نباید به نویسنده نسبت دهم؛ برای این کار باید منابع مستقل بررسی شوند.'
        : PROGRESS.test(intentText)
          ? 'برای سنجش پیشرفت می‌توانی رفتارهای قابل مشاهده را ثبت کنی: تشخیص زودتر موقعیت، مکث پیش از واکنش، انتخاب آگاهانه‌تر و بازگشت به تمرین پس از دشواری. این شاخص‌ها پیشنهاد عمومی دستیارند، نه معیار تشخیصی یا درمانی؛ چون شاهد مشخصی از کتاب بازیابی نشد، آن‌ها را به نویسنده نسبت نمی‌دهم.'
          : 'در متن بازیابی‌شده شاهد کافی برای ارزیابی محدودیت همین توصیه پیدا نکردم. اگر فصل یا توصیه مشخص را نام ببری، می‌توانم محدودیت‌های متن و محدودیت کاربرد آن را جداگانه بررسی کنم.';
    return { message: 'در «' + book.title + '»: ' + reply, conversationState: { bookId: book.legacyId, bookTitle: book.title, lastQuery: effectiveQuery } };
  }
  if (!asksSummary && !selected.length) {
    return {
      message: 'در متن قابل‌دسترسی «' + book.title + '» برای این پرسش شاهد قابل اتکایی پیدا نکردم. ممکن است موضوع با واژه‌های دیگری بیان شده باشد؛ اگر نام فصل یا اصطلاح کتاب را می‌دانی، بگو تا دقیق‌تر بررسی کنم.',
      conversationState: { bookId: book.legacyId, bookTitle: book.title, lastQuery: effectiveQuery },
    };
  }

  const directTopicChecks = [
    [ANXIETY, /اضطراب|استرس|نگران|دلشوره|تشویش|بی قرار|تنش/u, 'برای اضطراب'],
    [ANGER, /خشم|عصب|پرخاش|غضب/u, 'برای خشم و عصبانیت'],
    [CONFIDENCE, /اعتماد به نفس|اعتمادبه نفس|خودباور|عزت نفس|ارزشمند/u, 'برای اعتمادبه‌نفس'],
  ];
  for (const [intentPattern, evidencePattern, label] of directTopicChecks) {
    // Apply topic-specific evidence filtering only when the current turn asks about that topic. A follow-up about limitations or alternatives must be allowed to retrieve its own evidence from the same conversation context.
    if (!intentPattern.test(normalized)) continue;
    const topicEvidence = selected.filter((passage) => {
      const textEvidence = normalizeLibraryText(passage.text);
      const headingEvidence = normalizeLibraryText(passage.heading);
      const occurrences = textEvidence.match(new RegExp(evidencePattern.source, 'gu')) || [];
      // A heading that directly names the topic is strong evidence. In body
      // text, require repeated topic evidence so an incidental mention cannot
      // be presented as topic-specific guidance.
      const body = String(passage.text || '').trim();
      const proximityEvidence = CONFIDENCE.test(intentText)
        ? /(?:اعتماد به نفس|اعتمادبه نفس).{0,80}(?:افزایش|تقویت|کاهش|محدود|ساخت)|(?:افزایش|تقویت|کاهش|محدود|ساخت).{0,80}(?:اعتماد به نفس|اعتمادبه نفس)/u.test(textEvidence)
        : ANXIETY.test(intentText)
          ? /(?:اضطراب|استرس|نگرانی|دلشوره).{0,80}(?:مدیریت|تنظیم|کاهش|اجتناب|بدن|واکنش|مداخله)|(?:مدیریت|تنظیم|کاهش|اجتناب|بدن|واکنش|مداخله).{0,80}(?:اضطراب|استرس|نگرانی|دلشوره)/u.test(textEvidence)
          : /(?:خشم|عصب|پرخاش|غضب).{0,80}(?:واکنش|رفتار|مکث|پاسخ|احساس|مرز|تحقیر|بی احترامی|عمل)|(?:واکنش|رفتار|مکث|پاسخ|احساس|مرز|تحقیر|بی احترامی|عمل).{0,80}(?:خشم|عصب|پرخاش|غضب)/u.test(textEvidence);
      return evidencePattern.test(headingEvidence)
        || (body.length >= 80 && occurrences.length > 0 && proximityEvidence);
    });
    if (!topicEvidence.length) {
      return {
        message: 'در «' + book.title + '»، در گزیده‌های بازیابی‌شده شاهد مستقیم و کافی ' + label + ' پیدا نکردم. نمی‌خواهم بخش‌های عمومی کتاب را به‌اشتباه مرتبط معرفی کنم. اگر فصل یا اصطلاح مشخصی مدنظرت است، آن را بگو تا همان بخش را بررسی کنم.',
        conversationState: {
          bookId: book.legacyId,
          bookTitle: book.title,
          lastQuery: followUp ? effectiveQuery : message,
          lastSources: [],
        },
      };
    }
    // Do not pad a topic-specific answer with generic passages that merely
    // matched other words in the query; only directly relevant evidence stays.
    selected = topicEvidence;
  }

  let reply;
  if (asksSummary) {
    reply = summaryReply(book, allPassages);
  } else if (SCIENCE.test(responseIntent) || ALTERNATIVE_VIEW.test(responseIntent) || LIMITATIONS.test(responseIntent)
    || WEEK_PLAN.test(responseIntent) || PROGRESS.test(responseIntent) || EXAMPLE_OR_EXERCISE.test(responseIntent)
    || DAILY_APPLICATION.test(responseIntent) || SIMPLE_EXPLAIN.test(responseIntent) || KEY_POINTS.test(responseIntent)
    || ANXIETY.test(responseIntent) || ANGER.test(responseIntent) || CONFIDENCE.test(responseIntent)
    || ALTERNATIVE_EXERCISE.test(responseIntent) || AUTHOR_MEANING.test(responseIntent) || AUTHOR_REASON.test(responseIntent)) {
    reply = 'در «' + book.title + '»:\n\n' + structuredGuidance(responseIntent, book, selected, responseIntent);
  } else {
    const synthesized = formatLocalSynthesis(book.title, retrievalQuery, selected);
    reply = synthesized
      ? synthesized + '\n\nشواهد قابل بازیابی از کتاب:\n' + formatPassages(selected.slice(0, 3))
      : (followUp ? 'ادامه بررسی همان موضوع در «' + book.title + '» بر اساس متن کتاب:' : 'بخش‌های مرتبط با پرسش تو در «' + book.title + '»:') +
        '\n\n' + formatPassages(selected) +
        '\n\nیادآوری: این‌ها گزیده‌های واقعی از متن نسخه بارگذاری‌شده‌اند؛ تفسیر یا توصیه‌ای که صریحاً در متن نیامده باشد به نویسنده نسبت داده نمی‌شود.';
  }

  return {
    message: reply,
    conversationState: {
      bookId: book.legacyId,
      bookTitle: book.title,
      lastQuery: followUp ? effectiveQuery : message,
      lastSources: (asksSummary ? [] : selected).map((item) => ({ page: item.page, heading: item.heading })),
    },
  };
}

export function answerLibraryBookQuestion(args = {}) {
  return answerLibraryBookTurn(args)?.message ?? null;
}
