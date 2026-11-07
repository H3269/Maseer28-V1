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

const FOLLOW_UP = /^(?:بیشتر|ادامه|بیشتر توضیح|توضیح بده|مثال بزن|یک مثال|تمرین بده|چه تمرینی|همین|همان|اون|این|منظورم|در موردش|درباره اش)/u;
const SUMMARY = /(?:خلاصه|چکیده|مرور کلی|مهم ترین نکات|نکات اصلی|موضوع اصلی)/u;
const LIST = /(?:چه کتاب|فهرست کتاب|کتاب های موجود|کتابخانه چه کتاب)/u;
const COMPARE = /(?:تفاوت|مقایسه|فرق|چه فرقی)/u;
const EXAMPLE_OR_EXERCISE = /(?:مثال بزن|یک مثال|تمرین|برنامه هفت|عادت روزانه)/u;

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
    const heading = blocks.filter((b) => b.type === 'heading').map((b) => b.text).join(' · ')
      || String(page.title || '').trim();
    for (const block of blocks) {
      if (block.type === 'heading') continue;
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
  const ordinal = normalized.match(/(?:جلد|کتاب) (اول|دوم|سوم|چهارم|پنجم|1|2|3|4|5)/u)?.[1];
  const ids = { اول: 1, دوم: 2, سوم: 3, چهارم: 4, پنجم: 5, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
  if (ordinal && ids[ordinal]) {
    const selected = books.find((book) => Number(book.legacyId) === ids[ordinal]);
    if (selected) return selected;
  }
  const exact = books.find((book) => {
    const title = normalizeLibraryText(book.title);
    return title.length > 4 && normalized.includes(title);
  });
  if (exact) return exact;
  if (normalized.includes('از حقیقت تا واقعیت')) {
    const first = books.find((book) => Number(book.legacyId) === 1);
    if (first) return first;
  }
  if (state?.bookId && FOLLOW_UP.test(normalized)) {
    return books.find((book) => String(book.legacyId) === String(state.bookId)) || null;
  }
  return null;
}

function sourceLabel(item) {
  return [item.heading, item.page ? 'صفحه ' + item.page : ''].filter(Boolean).join(' · ') || 'متن کتاب';
}

function formatPassages(passages) {
  return passages.map((item, index) => {
    const excerpt = item.text.length > 560 ? item.text.slice(0, 557).trimEnd() + '…' : item.text;
    return (index + 1) + ') ' + excerpt + '\nمنبع: ' + sourceLabel(item);
  }).join('\n\n');
}

function bookHeadings(book) {
  const rows = [];
  for (const page of book.content?.pages || []) {
    for (const block of pageBlocks(page)) {
      if (block.type === 'heading' || (block.text.length < 150 && /^(?:فصل|بخش|پیوست|مقدمه|نتیجه گیری)/u.test(normalizeLibraryText(block.text)))) {
        rows.push({ text: block.text, page: Number(page.sourcePage || page.page) || null });
      }
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

function summaryReply(book, passages) {
  const headings = bookHeadings(book);
  const selected = [];
  const targets = [0, 0.2, 0.4, 0.6, 0.8, 1].map((ratio) => Math.round((passages.length - 1) * ratio));
  for (const target of targets) {
    const item = passages[target];
    if (item && !selected.some((row) => row.page === item.page)) selected.push(item);
  }
  const chapterText = headings.length
    ? '\n\nساختار قابل مشاهده کتاب:\n' + headings.slice(0, 22).map((item) => '- ' + item.text + (item.page ? ' (صفحه ' + item.page + ')' : '')).join('\n')
    : '';
  return 'نمای کلی مستند «' + book.title + '»\n' +
    'این مرور از تیترهای ثبت‌شده و گزیده‌های متن در نسخه بارگذاری‌شده ساخته شده است؛ چکیده تألیفیِ کامل یا ارزیابی علمی کتاب نیست.' +
    chapterText +
    (selected.length ? '\n\nگزیده‌های متنی از بخش‌های مختلف کتاب:\n' + formatPassages(selected) : '') +
    '\n\nمحدودیت: تیترها و گزیده‌های بالا نمایی از ساختار و متن در دسترس می‌دهند؛ ادعای پوشش کامل همه استدلال‌های کتاب ندارند.';
}

function listBooksReply(books) {
  return 'کتاب‌های موجود در کتابخانه:\n' + books.map((book, index) => {
    const subject = book.content?.subtitle || book.content?.description || '';
    return (index + 1) + ') ' + book.title + (subject ? '\nموضوع ثبت‌شده: ' + subject : '');
  }).join('\n\n');
}

function compareBooksReply(books) {
  return 'مقایسه ساختاری کتابخانه بر اساس عنوان، توضیح ثبت‌شده و تیترهای واقعی متن:\n\n' +
    books.map((book) => {
      const headings = bookHeadings(book).slice(0, 4);
      const subject = book.content?.subtitle || book.content?.description || 'توضیح موضوعی مستقل ثبت نشده است';
      return '• ' + book.title + '\nموضوع ثبت‌شده: ' + subject +
        (headings.length ? '\nمحورهای قابل مشاهده در تیترها: ' + headings.map((item) => item.text).join('؛ ') : '');
    }).join('\n\n') +
    '\n\nاین مقایسه ساختاری است؛ برای نتیجه‌گیری درباره تفاوت استدلال‌ها باید فصل‌های مرتبط هر دو کتاب جداگانه بررسی شوند.';
}

export function answerLibraryBookTurn({ books = [], message = '', conversationState = null } = {}) {
  const available = books.filter((book) => book?.content && Array.isArray(book.content.pages));
  if (!available.length) return null;
  const normalized = normalizeLibraryText(message);
  if (LIST.test(normalized)) return { message: listBooksReply(available), conversationState: null };
  if (COMPARE.test(normalized) && /(?:کتاب|پنج|همه)/u.test(normalized)) {
    return { message: compareBooksReply(available), conversationState: null };
  }

  const book = pickBook(available, message, conversationState);
  if (!book) {
    const asksBook = /(?:کتاب|جلد|خلاصه|چکیده|متن کتاب|فصل|نویسنده)/u.test(normalized);
    if (!asksBook) return null;
    return { message: 'برای اینکه متن اشتباهی را به تو نسبت ندهم، نام یکی از کتاب‌ها یا شماره جلد را مشخص کن. پنج کتاب موجود در کتابخانه را می‌توانم بررسی کنم.', conversationState: null };
  }

  const allPassages = passagesForBook(book);
  if (!allPassages.length) {
    return { message: 'متن قابل‌جست‌وجوی «' + book.title + '» در نسخه فعلی بارگذاری نشده است؛ بنابراین پاسخ یا خلاصه حدسی ارائه نمی‌کنم.', conversationState: { bookId: book.legacyId, bookTitle: book.title, lastQuery: '' } };
  }

  const followUp = Boolean(FOLLOW_UP.test(normalized) && conversationState?.bookId);
  const effectiveQuery = followUp && conversationState.lastQuery ? conversationState.lastQuery : message;
  const asksSummary = SUMMARY.test(normalized);
  const queryWeights = asksSummary ? new Map() : expandedQueryTerms(effectiveQuery);
  const frequency = buildFrequencyIndex(allPassages);
  const phrase = normalizeLibraryText(effectiveQuery);
  const ranked = asksSummary
    ? allPassages
    : allPassages.map((passage, index) => ({
      ...passage,
      index,
      score: scorePassage(passage, queryWeights, frequency, allPassages.length, phrase),
    })).filter((passage) => passage.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected = asksSummary ? [] : chooseDiverse(ranked, 5);
  if (!asksSummary && !selected.length) {
    return {
      message: 'در متن قابل‌دسترسی «' + book.title + '» برای این پرسش شاهد قابل اتکایی پیدا نکردم. ممکن است موضوع با واژه‌های دیگری بیان شده باشد؛ اگر نام فصل یا اصطلاح کتاب را می‌دانی، بگو تا دقیق‌تر بررسی کنم.',
      conversationState: { bookId: book.legacyId, bookTitle: book.title, lastQuery: effectiveQuery },
    };
  }

  let reply;
  if (asksSummary) {
    reply = summaryReply(book, allPassages);
  } else {
    reply = (followUp ? 'ادامه بررسی همان موضوع در «' + book.title + '» بر اساس متن کتاب:' : 'بخش‌های مرتبط با پرسش تو در «' + book.title + '»:') +
      '\n\n' + formatPassages(selected) +
      '\n\nیادآوری: این‌ها گزیده‌های واقعی از متن نسخه بارگذاری‌شده‌اند؛ تفسیر یا توصیه‌ای که صریحاً در متن نیامده باشد به نویسنده نسبت داده نمی‌شود.';
    if (EXAMPLE_OR_EXERCISE.test(normalized)) {
      reply += '\n\nمرز پاسخ: این نسخه موتور، متن مرتبط را پیدا می‌کند اما هنوز مثال شخصی‌سازی‌شده یا برنامه تمرینی تازه تولید نمی‌کند. برای جلوگیری از ساختن مطلب و نسبت‌دادن آن به کتاب، فعلاً فقط منبع مرتبط را نشان می‌دهم.';
    }
  }

  return {
    message: reply,
    conversationState: {
      bookId: book.legacyId,
      bookTitle: book.title,
      lastQuery: followUp ? (conversationState.lastQuery || effectiveQuery) : message,
      lastSources: (asksSummary ? [] : selected).map((item) => ({ page: item.page, heading: item.heading })),
    },
  };
}

export function answerLibraryBookQuestion(args = {}) {
  return answerLibraryBookTurn(args)?.message ?? null;
}
