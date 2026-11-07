const STOP = new Set('از به با در برای که این آن را و یا یک های هایش هست است شود می کند کردن درباره چگونه چیست چه اگر اما زیرا تا پس روی خود انسان زندگی'.split(' '));

export function normalizeLibraryText(value) {
  return String(value ?? '').normalize('NFKC')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

function terms(value) {
  return normalizeLibraryText(value).split(' ').filter((word) => word.length > 1 && !STOP.has(word));
}

function pageBlocks(page) {
  const blocks = Array.isArray(page?.blocks) ? page.blocks : [{ type: 'paragraph', text: page?.text || '' }];
  return blocks.map((block) => ({
    type: block?.type || 'paragraph',
    text: String(block?.text || (Array.isArray(block?.rows) ? block.rows.flat().join(' ') : '')).trim(),
  })).filter((block) => block.text.length > 35);
}

function passagesForBook(book) {
  const pages = Array.isArray(book?.content?.pages) ? book.content.pages : [];
  const rows = [];
  for (const page of pages) {
    const blocks = pageBlocks(page);
    const heading = blocks.filter((b) => b.type === 'heading').map((b) => b.text).join(' · ');
    for (const block of blocks) {
      if (block.type === 'heading') continue;
      rows.push({
        text: block.text,
        page: Number(page.sourcePage || page.page) || null,
        heading: heading || String(page.title || '').trim(),
      });
    }
  }
  return rows;
}

function scorePassage(passage, queryTerms, corpusFrequency) {
  const counts = new Map();
  for (const term of terms(passage.text)) counts.set(term, (counts.get(term) || 0) + 1);
  let score = 0;
  for (const term of queryTerms) {
    if (counts.has(term)) score += 2 + Math.min(3, counts.get(term));
    if (passage.heading && terms(passage.heading).includes(term)) score += 2;
  }
  const distinct = counts.size;
  score += Math.min(1.5, distinct / 80);
  if (passage.text.length > 220 && passage.text.length < 1000) score += 0.5;
  return score;
}

function pickBook(books, text) {
  const normalized = normalizeLibraryText(text);
  const ordinal = normalized.match(/(?:جلد|کتاب) (اول|دوم|سوم|چهارم|پنجم|1|2|3|4|5)/u)?.[1];
  const ordinalIds = { 'اول': 1, 'دوم': 2, 'سوم': 3, 'چهارم': 4, 'پنجم': 5, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 };
  if (ordinal && ordinalIds[ordinal]) {
    const selected = books.find((book) => Number(book.legacyId) === ordinalIds[ordinal]);
    if (selected) return selected;
  }
  const exact = books.find((book) => {
    const title = normalizeLibraryText(book.title);
    return title.length > 4 && normalized.includes(title);
  });
  if (exact) return exact;
  if (normalized.includes('از حقیقت تا واقعیت')) {
    const volume = books.find((book) => Number(book.legacyId) === 1);
    if (volume) return volume;
  }
  return null;
}

export function answerLibraryBookQuestion({ books = [], message = '' } = {}) {
  const available = books.filter((book) => book?.content && Array.isArray(book.content.pages));
  if (!available.length) return null;
  const normalized = normalizeLibraryText(message);
  const asksList = /(?:چه کتاب|فهرست کتاب|کتاب های موجود|کتابخانه چه کتاب)/u.test(normalized);
  if (asksList) return 'کتاب‌های بارگذاری‌شده در کتابخانه:\n' + available.map((book, i) => `${i + 1}) ${book.title}`).join('\n');

  const book = pickBook(available, message);
  if (!book) {
    const isBookRequest = /(?:کتاب|جلد|خلاصه|چکیده|متن کتاب|فصل|نویسنده)/u.test(normalized);
    if (!isBookRequest) return null;
    return 'برای اینکه متن اشتباهی را خلاصه نکنم، نام یکی از کتاب‌ها را در پرسشت بنویس. پنج کتاب موجود در کتابخانه را می‌توانم بررسی کنم.';
  }

  const allPassages = passagesForBook(book);
  if (!allPassages.length) return `متن قابل‌جست‌وجوی «${book.title}» در نسخه فعلی بارگذاری نشده است؛ بنابراین خلاصه‌ای حدسی ارائه نمی‌کنم.`;

  const asksSummary = /(?:خلاصه|چکیده|مرور کلی|مهم ترین نکات|نکات اصلی)/u.test(normalized);
  const queryTerms = asksSummary ? [] : terms(message).filter((term) => !terms(book.title).includes(term));
  const ranked = allPassages.map((passage, index) => ({
    ...passage,
    index,
    score: queryTerms.length ? scorePassage(passage, queryTerms) : scorePassage(passage, terms(passage.heading || '')) + Math.min(2, passage.text.length / 500),
  })).filter((passage) => passage.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected = [];
  const seenPages = new Set();
  for (const passage of ranked) {
    const key = passage.page ?? passage.index;
    if (seenPages.has(key)) continue;
    selected.push(passage);
    seenPages.add(key);
    if (selected.length === 4) break;
  }
  if (!selected.length) {
    return `در متن قابل‌دسترسی «${book.title}» برای این پرسش تطابق قابل اتکایی پیدا نکردم. پرسش را با واژه‌های مشخص‌تر یا نام فصل مطرح کن.`;
  }

  const lead = asksSummary
    ? `مرور فشرده و متن‌محور «${book.title}» بر اساس گزیده‌های واقعی کتاب. این نسخه گزیده‌محور است و بازنویسی تفسیری یا ارزیابی علمی مستقل محسوب نمی‌شود:`
    : `بخش‌های مرتبط با پرسش تو در «${book.title}»:`;
  const excerpts = selected.map((item, index) => {
    const locator = [item.heading, item.page ? `صفحه ${item.page}` : ''].filter(Boolean).join(' · ');
    const excerpt = item.text.length > 520 ? item.text.slice(0, 517).trimEnd() + '…' : item.text;
    return `${index + 1}) ${excerpt}\nمنبع: ${locator || 'متن کتاب'}`;
  });
  return `${lead}\n\n${excerpts.join('\n\n')}\n\nیادآوری: این پاسخ فقط از متن نسخه بارگذاری‌شده استخراج شده است؛ اگر مطلبی در گزیده‌ها نیامده، به معنی نبودنش در کل کتاب نیست.`;
}
