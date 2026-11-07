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
const RECOMMEND = /(?:کدام کتاب|چه کتابی|از کدام کتاب|برای شروع مطالعه|از کجا شروع|پیشنهاد.*کتاب|کتاب مناسب)/u;
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
const SIMPLE_EXPLAIN = /(?:به زبان ساده|ساده و قابل فهم|توضیح ساده)/u;

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
  if (state?.bookId) {
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

function summaryReply(book, passages) {
  const headings = mainBookHeadings(book);
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
      const headings = mainBookHeadings(book).slice(0, 6);
      const subject = book.content?.subtitle || book.content?.description || 'توضیح موضوعی مستقل ثبت نشده است';
      return '• ' + book.title + '\nموضوع ثبت‌شده: ' + subject +
        (headings.length ? '\nمحورهای قابل مشاهده در تیترها: ' + headings.map((item) => item.text).join('؛ ') : '');
    }).join('\n\n') +
    '\n\nاین مقایسه ساختاری است؛ برای نتیجه‌گیری درباره تفاوت استدلال‌ها باید فصل‌های مرتبط هر دو کتاب جداگانه بررسی شوند.';
}


function mainBookHeadings(book) {
  return bookHeadings(book).filter((item) =>
    /فصل|بخش|تمرین|پیوست|هفته|روز|اصل|مرحله|جمع بندی/u.test(normalizeLibraryText(item.text))
    && !/تقدیم نامه|سپاسگزاری|پیشگفتار|فهرست مطالب|یک نکته مهم|یادداشتی درباره این مجموعه/u.test(normalizeLibraryText(item.text))
  );
}

function bookSubject(book) {
  const headings = mainBookHeadings(book).slice(0, 8).map((item) => item.text);
  return [book.content?.subtitle, book.content?.description, ...headings].filter(Boolean).join('؛ ');
}

function recommendBooks(books, message) {
  const normalized = normalizeLibraryText(message);
  const candidates = SELF_KNOWLEDGE.test(normalized)
    ? books.filter((book) => /خودشناسی|شناخت احساس|شناخت خود|احساسات/u.test(normalizeLibraryText(bookSubject(book))))
    : books;
  const chosen = candidates.length ? candidates : books;
  return 'پیشنهاد شروع مطالعه بر اساس اطلاعات ثبت‌شده و تیترهای واقعی کتاب‌ها:\n\n' +
    chosen.slice(0, 3).map((book, index) => {
      const headings = mainBookHeadings(book).slice(0, 3);
      return (index + 1) + ') «' + book.title + '»\nموضوع ثبت‌شده: ' +
        (book.content?.subtitle || book.content?.description || 'توضیح موضوعی مستقل ثبت نشده است') +
        (headings.length ? '\nبخش‌های قابل مشاهده: ' + headings.map((item) => item.text + (item.page ? '، صفحه ' + item.page : '')).join('؛ ') : '');
    }).join('\n\n') +
    '\n\nاین پیشنهاد فقط بر پایه موضوع و ساختار ثبت‌شده است، نه شناخت وضعیت شخصی تو. اگر بگویی بیشتر دنبال خودشناسی، شناخت احساسات یا تغییر عادت‌ها هستی، می‌توانم پیشنهاد را دقیق‌تر کنم.';
}

function structuredGuidance(intent, book, passages, message) {
  const source = formatPassages(passages.slice(0, 4));
  const title = '«' + book.title + '»';
  const evidence = 'شواهد قابل بازیابی از کتاب:\n\n' + source;
  if (SCIENCE.test(intent)) return 'از متن این کتاب به‌تنهایی نمی‌توان اعتبار علمی یک دیدگاه را تأیید کرد. برای چنین داوری‌ای باید ادعا را دقیق مشخص کنیم و آن را با پژوهش‌های معتبر و مستقل بسنجیم.\n\n' + evidence + '\n\nمرزبندی: گزیده‌های بالا نشان می‌دهند کتاب چه می‌گوید؛ آن‌ها به‌تنهایی اثبات علمی درستی ادعا نیستند.';
  if (ALTERNATIVE_VIEW.test(intent)) return 'ممکن است درباره این موضوع دیدگاه‌های دیگری وجود داشته باشد، اما از متن در دسترس این کتاب نمی‌توانم وجود یا محتوای یک دیدگاه مخالف مشخص را اثبات کنم. دیدگاه بیرونی را نباید به نویسنده نسبت داد.\n\n' + evidence + '\n\nاگر بخواهی، پرسش را به یک ادعای مشخص تبدیل می‌کنیم تا جداگانه با منابع علمی مستقل بررسی شود.';
  if (ANXIETY.test(intent)) return 'بخش‌های زیر از نظر شناخت احساسات، نگرانی یا واکنش‌های مرتبط با پرسش تو قابل بررسی‌اند. این‌ها اطلاعات کتابی و خودآگاهی عمومی‌اند، نه تشخیص یا درمان اضطراب:\n\n' + source + '\n\nاگر اضطراب شدید، مداوم یا مختل‌کننده زندگی است، این متن جای ارزیابی متخصص را نمی‌گیرد.';
  if (ANGER.test(intent)) return 'در متن بازیابی‌شده، محورهای مرتبط با شناخت خشم، نشانه‌های اولیه و انتخاب پاسخ جایگزین دیده می‌شود. پیشنهاد عملی دستیار این است که در یک موقعیت کم‌تنش، محرک، احساس، میل فوری و پاسخ انتخاب‌شده را جداگانه ثبت کنی. این پیشنهاد نقل قول کتاب نیست و هدفش سرکوب احساس یا توجیه آسیب به خود/دیگران نیست.\n\n' + evidence;
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
  if (KEY_POINTS.test(intent)) return 'نکته‌های قابل استخراج از بخش‌های بازیابی‌شده (نه لزوماً تمام نکات مهم کتاب):\n\n' + source + '\n\nبرای تهیه فهرست کامل و اولویت‌بندی‌شده باید فصل‌های کتاب را به‌صورت کامل مرور کرد.';
  return evidence;
}

export function answerLibraryBookTurn({ books = [], message = '', conversationState = null } = {}) {
  const available = books.filter((book) => book?.content && Array.isArray(book.content.pages));
  if (!available.length) return null;
  const normalized = normalizeLibraryText(message);
  if (LIST.test(normalized)) return { message: listBooksReply(available), conversationState: null };
  if (RECOMMEND.test(normalized)) return { message: recommendBooks(available, normalized), conversationState: null };
  if (COMPARE.test(normalized) && !CONCEPT_COMPARE.test(normalized) && /(?:کتاب|پنج|همه)/u.test(normalized)) {
    return { message: compareBooksReply(available), conversationState: null };
  }

  const book = pickBook(available, message, conversationState);
  if (!book) {
    const asksBook = /(?:کتاب|جلد|خلاصه|چکیده|متن کتاب|فصل|نویسنده)/u.test(normalized);
    if (!asksBook) return null;
    return { message: 'برای اینکه متن اشتباهی را به تو نسبت ندهم، نام یکی از کتاب‌ها یا شماره جلد را مشخص کن. پنج کتاب موجود در کتابخانه را می‌توانم بررسی کنم.', conversationState: null };
  }

  if ((AUTHOR_MEANING.test(normalized) || AUTHOR_REASON.test(normalized)) && !conversationState?.lastSources?.length) {
    return { message: 'در «' + book.title + '»، برای توضیح دقیق منظور نویسنده لطفاً عنوان فصل، شماره صفحه یا چند کلمه از همان بخش را مشخص کن. هنوز معلوم نیست «این بخش» به کدام قسمت کتاب اشاره دارد؛ نمی‌خواهم نیت نویسنده را حدس بزنم.', conversationState: { bookId: book.legacyId, bookTitle: book.title, lastQuery: message } };
  }
  if (CONCEPT_COMPARE.test(normalized)) {
    const headings = mainBookHeadings(book).slice(0, 14);
    return { message: 'در «' + book.title + '»، برای مقایسه لطفاً دو مفهوم مشخص را انتخاب کن. این‌ها چند عنوان واقعی از ساختار کتاب هستند:\n' + headings.map((item) => '• ' + item.text + (item.page ? '، صفحه ' + item.page : '')).join('\n'), conversationState: { bookId: book.legacyId, bookTitle: book.title, lastQuery: message } };
  }
  if (BOOK_SUBJECT.test(normalized)) {
    const headings = mainBookHeadings(book).slice(0, 10);
    return { message: 'بر اساس توضیح ثبت‌شده و تیترهای قابل مشاهده، موضوع «' + book.title + '» چنین معرفی شده است:\n' +
      (book.content?.subtitle || book.content?.description || 'توضیح موضوعی مستقل ثبت نشده است') +
      (headings.length ? '\n\nمحورهای قابل مشاهده:\n' + headings.map((item) => '• ' + item.text + (item.page ? '، صفحه ' + item.page : '')).join('\n') : '') +
      '\n\nاین معرفی بر پایه متادیتا و تیترهاست؛ برای شرح محتوای هر فصل باید متن همان فصل بررسی شود.',
      conversationState: { bookId: book.legacyId, bookTitle: book.title, lastQuery: message } };
  }
  const allPassages = passagesForBook(book);
  if (!allPassages.length) {
    return { message: 'متن قابل‌جست‌وجوی «' + book.title + '» در نسخه فعلی بارگذاری نشده است؛ بنابراین پاسخ یا خلاصه حدسی ارائه نمی‌کنم.', conversationState: { bookId: book.legacyId, bookTitle: book.title, lastQuery: '' } };
  }

  const followUp = Boolean(conversationState?.bookId && !/(?:جلد|کتاب) (?:اول|دوم|سوم|چهارم|پنجم|1|2|3|4|5)/u.test(normalized));
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

  const selected = asksSummary
    ? []
    : KEY_POINTS.test(normalized) && !ranked.length
      ? representativePassages(allPassages, 5)
      : chooseDiverse(ranked, 5);
  if (!asksSummary && !selected.length && (SCIENCE.test(normalized) || ALTERNATIVE_VIEW.test(normalized) || LIMITATIONS.test(normalized) || PROGRESS.test(normalized))) {
    const reply = SCIENCE.test(normalized)
      ? 'از متن در دسترس این کتاب شاهد کافی برای داوری علمی این ادعا پیدا نکردم. از متن کتاب به‌تنهایی نمی‌توان اعتبار علمی یک دیدگاه را تأیید کرد؛ برای پاسخ دقیق باید ادعای مشخص را با پژوهش‌های معتبر و مستقل بررسی کرد. این پاسخ عمداً از تأیید یا رد بی‌منبع خودداری می‌کند.'
      : ALTERNATIVE_VIEW.test(normalized)
        ? 'در متن بازیابی‌شده شاهد کافی برای معرفی یک دیدگاه مخالف مشخص پیدا نکردم؛ نمی‌توانم وجود یا محتوای یک دیدگاه مخالف مشخص را اثبات کنم. دیدگاه بیرونی را حدس نمی‌زنم و نباید به نویسنده نسبت دهم؛ برای این کار باید منابع مستقل بررسی شوند.'
        : PROGRESS.test(normalized)
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

  let reply;
  if (asksSummary) {
    reply = summaryReply(book, allPassages);
  } else if (SCIENCE.test(normalized) || ALTERNATIVE_VIEW.test(normalized) || LIMITATIONS.test(normalized)
    || WEEK_PLAN.test(normalized) || PROGRESS.test(normalized) || EXAMPLE_OR_EXERCISE.test(normalized)
    || DAILY_APPLICATION.test(normalized) || SIMPLE_EXPLAIN.test(normalized) || KEY_POINTS.test(normalized)
    || ANXIETY.test(normalized) || ANGER.test(normalized) || CONFIDENCE.test(normalized)
    || ALTERNATIVE_EXERCISE.test(normalized) || AUTHOR_MEANING.test(normalized) || AUTHOR_REASON.test(normalized)) {
    reply = 'در «' + book.title + '»:\n\n' + structuredGuidance(normalized, book, selected, normalized);
  } else {
    reply = (followUp ? 'ادامه بررسی همان موضوع در «' + book.title + '» بر اساس متن کتاب:' : 'بخش‌های مرتبط با پرسش تو در «' + book.title + '»:') +
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
