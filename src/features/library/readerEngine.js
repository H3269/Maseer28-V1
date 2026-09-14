export const READER_LINES_PER_PAGE = 16;

const POEMS = {
  1: { title: 'عشق یعنی کاهش رنج بشر', lines: ['ای که میپرسی نشان عشق چیست', 'عشق چیزی جز ظهور مهر نیست', 'عشق یعنی مشکلی آسان کنی', 'درد یک درمانده ای درمان کنی', 'در میان این همه غوغا و شر', 'عشق یعنی کاهش رنج بشر'] },
  2: { title: '', lines: ['ننگرم کس را وگر هم بنگرم', 'او بهانه باشد و تو منظرم', 'عاشق صنع تو ام در شکر و صبر', 'عاشق مصنوع کی باشم چو گبر', 'عاشق صنع خدا بافر بود', 'عاشق مصنوع او کافر بود'] },
};

const APPENDIX_NUMS = {
  'اول': '۱', 'دوم': '۲', 'سوم': '۳', 'چهارم': '۴', 'پنجم': '۵', 'ششم': '۶', 'هفتم': '۷',
  'هشتم': '۸', 'نهم': '۹', 'دهم': '۱۰', 'یازدهم': '۱۱', 'دوازدهم': '۱۲', 'سیزدهم': '۱۳', 'چهاردهم': '۱۴',
};

const FRONT_MATTER_RE = /^(?:تقدیم(?:‌| )?نامه|سپاسگزاری|یادداشتی درباره این مجموعه|پیشگفتار(?:‌| )?(?:نویسنده|ناشر)?|مقدمه|فهرست مطالب|منشور زندگی پس از خواندن کتاب|دفتر کار عملی)$/u;
const STRONG_HEADING_RE = /^(?:جمع[‌ -]?بندی(?:\s+فصل(?:\s+[\u0600-\u06FF۰-۹0-9]+)?)?|تمرین(?:\s+(?:جامع|نهایی|فصل(?:\s+[\u0600-\u06FF۰-۹0-9]+)?))?|پرسش\s+پایان\s+روز|سخن(?:\s+پایانی|\s+آخر)|نتیجه[‌ -]?گیری(?:\s+نویسنده)?|دعوت به ادامه مسیر|پیام(?:\s+پایانی|\s+نویسنده(?:\s+.{1,50})?)?|یک نکته مهم|نکته مهم|یک اصل مهم|قانون(?:\s+اصلی|\s+اول|\s+دوم|\s+سوم)?|روش استفاده|روش ثبت هر روز|روش استفاده از کتاب|ارزیابی نقطه شروع|گزارش نهایی|نقشه ادامه مسیر|قبل از شروع|آخرین تمرین|پایان مسیر|هدف\s*:)$/u;
const PREFIX_HEADING_RE = /^(?:مرحله\s+(?:[۰-۹0-9]+|اول|دوم|سوم|چهارم|پنجم)|گام\s+(?:[۰-۹0-9]+|اول|دوم|سوم|چهارم|پنجم)|تمرین\s+(?:عملی|فصل|جامع|نهایی|شماره|[۰-۹0-9]+)|بخش\s+(?:اول|دوم|سوم|چهارم|پنجم|پایانی|عملی|تکمیلی|[۰-۹0-9]+)|هفته\s+(?:اول|دوم|سوم|چهارم|[۰-۹0-9]+)|روز\s*[۰-۹0-9]+)/u;
const LABEL_RE = /^(?:هدف\s*:|مشاهده$|تشخیص$|تجربه جدید$|اصلاح$|واقعیت فعلی\s*:|حقیقت(?:ی)?(?: مطلوب)?(?: من)?\s*:|رفتار(?:های)?(?: اصلی)?(?: من)?\s*:|محرک(?: اصلی)?\s*:|پاسخ(?: جایگزین)?(?: من)?\s*:|نتیجه(?: فوری| واقعی)?\s*:)/u;

// Major practice/workbook modules are treated as self-contained reading units.
// This is a layout rule only: the authored text is never rewritten.
const PRACTICE_PAGE_BREAK_RE = /^(?:تمرین(?:\s|\u200c)+عملی(?:\s|\u200c)+(?:شماره(?:\s|\u200c)*)?[۰-۹0-9]+|تمرین(?:\s|\u200c)+جامع(?:\s|\u200c)+فصل(?:\s+[^.!؟؛:]{1,32})?|کاربرگ(?:\s|\u200c)+فصل(?:\s+[^.!؟؛:]{1,32})?|دفتر(?:\s|\u200c)+کار(?:\s|\u200c)+عملی)$/u;

const TOC_TITLE_RE = /^فهرست مطالب\s*[:：]?$/u;
const TOC_CHAPTER_RE = /^(?:فصل(?:\u200c|\s)*(?:اول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم|نهم|دهم|یازدهم|دوازدهم|سیزدهم|چهاردهم|پانزدهم|شانزدهم|هفدهم|هجدهم|نوزدهم|بیستم|پایانی|[۰-۹0-9]+)\s*[:：]?|ضمیمه(?:\s|\u200c)+|پیوست(?:\s|\u200c)+)/u;
const TOC_PART_RE = /^(?:(?:بخش(?:\u200c|\s)+(?:اول|دوم|سوم|چهارم|پنجم|پایانی|عملی|[۰-۹0-9]+)|بخش(?:\u200c|\s)*های تکمیلی)(?:\s*[:：].*)?|بخش(?:\u200c|\s)*عملی(?:\u200c|\s)*کتاب|ضمائم(?:\u200c|\s)*کتاب|ضمائم|ضمایم(?:\u200c|\s)*کتاب|ضمایم|ضماییم)$/u;
const TOC_HARD_STOP_RE = /^(?:دفتر کار عملی|دفتر تمرین|کاربرگ(?:\s|\u200c)|راهنمای استفاده عملی)(?:\s|$)/u;

function baseCleanReaderText(value) {
  return String(value ?? '')
    .replace(/\u00ad/g, '')
    .replace(/[\u200e\u200f\ufeff]/g, '')
    // Word/PDF extraction artifact only; it is not authored book content.
    .replace(/V{3,}/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Display text: preserve authored wording, punctuation and ordering.  The reader
// only removes invisible/import artifacts and normalises whitespace required by
// the layout engine.  Editorial decisions below are visual/structural only.
export function editorialReaderText(value) {
  return baseCleanReaderText(value);
}

// A normalised copy is used only for structural detection (headings, TOC, etc.).
// It is never rendered, so these repairs cannot change the visible book text.
function structureReaderText(value) {
  let s = baseCleanReaderText(value);
  if (!s) return s;

  s = s.replace(/[\u0600-\u06FF]+(?:\u200c[\u0600-\u06FF]+){2,}/gu, (token) => {
    const parts = token.split('\u200c').filter(Boolean);
    const tail = parts[parts.length - 1] || '';
    if (parts.length === 3 && /^(?:ها|های|هایی|تر|ترین|تری|ای|ام|ات|اش|مان|تان|شان|کننده|شونده|شده|یافته|خورده)$/u.test(tail)) return token;
    let x = token.replace(/\u200c+/g, ' ');
    x = x.replace(/(^|\s)(ن?می)\s+([\u0600-\u06FF])/gu, '$1$2\u200c$3');
    x = x.replace(/([\u0600-\u06FF])\s+(ها|های|هایی|تر|ترین)(?=$|\s)/gu, '$1\u200c$2');
    x = x.replace(/\s{2,}/g, ' ');
    return x;
  });

  s = s.replace(/درطول(?=\s|\u200c|[،؛:.!?؟]|$)/gu, 'در طول');
  s = s.replace(/یادمی(?=\s|\u200c|گیرد|$)/gu, 'یاد می');
  s = s.replace(/گیردچگونه/gu, 'گیرد چگونه');
  s = s.replace(/بهتربشناسد/gu, 'بهتر بشناسد');
  s = s.replace(/راتأیید/gu, 'را تأیید');
  s = s.replace(/([۰-۹0-9])\s*\.\s*\.(?=\s*[\u0600-\u06FF«])/gu, '$1. ');
  s = s.replace(/،{2,}/gu, '،').replace(/؛{2,}/gu, '؛').replace(/؟{2,}/gu, '؟').replace(/!{2,}/g, '!');
  s = s.replace(/(^|[^.])\.{2}(?=[^.\s]*[\u0600-\u06FF])/gu, '$1.');
  s = s.replace(/\s+([،؛؟!,:])/gu, '$1');
  s = s.replace(/\s+\.(?!\.)/g, '.');
  s = s.replace(/([،؛؟!,:])(?=[\u0600-\u06FF«])/gu, '$1 ');
  s = s.replace(/\.(?=[\u0600-\u06FF«])/gu, '. ');
  s = s.replace(/([۰-۹0-9])\.(?=[\u0600-\u06FF«])/gu, '$1. ');
  s = s.replace(/(^|[\s«(\[])((?:ن)?می)\s+([\u0600-\u06FF])/gu, '$1$2\u200c$3');
  s = s.replace(/[ \t]{2,}/g, ' ').trim();
  return s.replace(/«\s+/gu, '«').replace(/\s+»/gu, '»');
}

function splitBookBlocks(text) {
  let t = String(text || '').replace(/\r/g, '');
  t = t.replace(/(?<!\n)(?=(سپاسگزاری|تقدیم(?:‌| )?نامه|پیشگفتار(?:‌| )?(?:نویسنده|ناشر)?|فهرست مطالب|فصل [آ-ی]+[۰-۹0-9]*[:：]))/g, '\n\n');
  // Some legacy Word pages use only one line break around a practice heading.
  // Isolate that exact heading as a structural block without changing its text.
  t = t.replace(/(?:[ \t]*\n)?(تمرین(?:\s|\u200c)+عملی(?:\s|\u200c)+(?:شماره(?:\s|\u200c)*)?[۰-۹0-9]+)(?:[ \t]*\n)?/gu, '\n\n$1\n\n');
  return t.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
}

function rawPageBlocks(page) {
  if (Array.isArray(page?.blocks)) return page.blocks;
  return splitBookBlocks(page?.text || '').map((text) => ({ type: 'paragraph', text: editorialReaderText(text) }));
}

function readerText(value) {
  return structureReaderText(value);
}

function norm(value) {
  return readerText(String(value ?? '')).replace(/[\u200e\u200f\u202a-\u202e]/g, '').replace(/\s+/g, ' ').trim();
}

function structureNorm(value) {
  return norm(value)
    .replace(/^ضمای(?:ی)?م/u, 'ضمائم')
    .replace(/^تقدیم نامه$/u, 'تقدیم‌نامه')
    .replace(/^تقدیمنامه$/u, 'تقدیم‌نامه');
}

export function chapterParts(title, bookId) {
  const t = editorialReaderText(title || '');
  let parts = [t];
  // Split only for visual hierarchy. Keep the authored delimiter visible so the
  // chapter opener does not rewrite the supplied title.
  const first = t.match(/^([^·:؛]+?)(\s*[·:؛]\s*)(.+)$/u);
  const lead = first ? first[1].trim() : '';
  if (first) parts = [`${first[1].trim()}${first[2].trim()}`, first[3].trim()];
  if (Number(bookId) === 4 && parts.length === 1) {
    const m = t.match(/^(پیوست\s+[^\s]+)\s+(.*)$/u);
    if (m) parts = [m[1], m[2]];
  }
  if (/^فصل\s+/u.test(t) && parts.length === 1) {
    const m = t.match(/^(فصل\s+[^\s]+)\s+(.*)$/u);
    if (m) parts = [m[1], m[2]];
  }
  return {
    eyebrow: parts.length > 1 ? parts[0] : Number(bookId) === 4 ? 'پیوست' : /^فصل\s/u.test(t) ? 'فصل' : 'بخش',
    title: parts.length > 1 ? parts[1] : t,
    full: t,
    // Structural matching only. Keeping the lead separately lets a section
    // opener such as «بخش عملی کتاب» or «ضمایم کتاب» start exactly where its
    // first authored line occurs, instead of leaking into the previous chapter.
    lead,
  };
}

function isRuleText(text) {
  return /^(?:[-ـ—–_\s]{3,}|[─━═]{2,}|•\s*•\s*•)$/u.test(norm(text));
}

function isChapterEcho(text, chapter, bookId) {
  if (!chapter) return false;
  const a = structureNorm(text);
  const parts = chapterParts(chapter.title, bookId);
  const vals = [structureNorm(chapter.title), structureNorm(parts.full), structureNorm(parts.lead), structureNorm(parts.eyebrow), structureNorm(parts.title)].filter(Boolean);
  return vals.some((v) => a === v)
    || (/^پیوست\s/u.test(a) && /^پیوست\s/u.test(structureNorm(chapter.title)))
    || (/^فصل\s/u.test(a) && /^فصل\s/u.test(structureNorm(chapter.title)));
}

function isFrontMatterTitle(text) {
  return FRONT_MATTER_RE.test(norm(text));
}

function practiceSubtitleCandidate(text, previousText) {
  const t = norm(text);
  const prev = norm(previousText);
  if (!PRACTICE_PAGE_BREAK_RE.test(prev) || !t || t.length > 72) return false;
  if (/^[۰-۹0-9]+(?:[.)]|\s)/u.test(t)) return false;
  if (/[.!؟؛:]$/u.test(t)) return false;
  const words = t.split(/\s+/u).filter(Boolean);
  return words.length >= 2 && words.length <= 9;
}

function shortHeadingCandidate(text, nextText, bookId) {
  const t = norm(text);
  const next = norm(nextText);
  if (!t || t.length > 66 || !next || next.length < 42) return false;
  if (/^[«“"'([{]/u.test(t)) return false;
  if (/^[۰-۹0-9]+(?:[.)]|\s)/u.test(t)) return false;
  if (/^(?:بله|خیر|یا|مثلاً|برای مثال|اکنون|امروز|فردا|هدف|واقعیت|حقیقت)$/u.test(t)) return false;
  if (/^(?:اما|اگر|وقتی|پس|بنابراین|یعنی|در این|به این|با این|از این|برای این)/u.test(t)) return false;
  const words = t.split(/\s+/u).filter(Boolean);
  if (words.length < 2 || words.length > 8) return false;
  if (/[.!،]$/u.test(t)) return false;
  if (Number(bookId) <= 2) {
    // In volumes 1 and 2 much of the original Word emphasis was flattened.
    // Recover only title-shaped standalone paragraphs. The next paragraph must
    // carry real prose, so short narrative sentences do not become headings.
    if (/؟$/u.test(t) && /^(?:چرا|چگونه|حقیقت|واقعیت|باور|ذهن|احساس|هویت|پذیرش|تغییر|انسان|ناخودآگاه|آیا|چه\s)/u.test(t)) return true;
    if (next.length < 72) return false;
    if (/[.!،]$/u.test(t)) return false;
    if (/[:：]$/u.test(t) && !/^(?:مدل|بخش|مرحله|گام|روش|پروتکل|تمرین|قانون|اصل|پرسش)/u.test(t)) return false;
    return words.length >= 2 && words.length <= 7 && t.length <= 58;
  }
  // Volumes 3 and 4 already carry structured heading blocks from their source
  // documents. Do not promote ordinary questions or short sentences there.
  return false;
}

function collectKnownHeadings(book) {
  const set = new Set();
  const firstChapter = Math.min(...(book.chapters || []).map((c) => Number(c.page)).filter((n) => Number.isFinite(n) && n > 0), Infinity);
  let inToc = false;
  let seenChapters = 0;
  for (const row of bookRows(book)) {
    if (row.source >= firstChapter) break;
    const blocks = row.blocks || [];
    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i];
      if (block?.type === 'table' || block?.type === 'separator') continue;
      const t = norm(block?.text);
      if (!t) continue;
      const nextText = blocks.slice(i + 1).map((x) => norm(x?.text)).find(Boolean) || '';
      if (TOC_TITLE_RE.test(t)) { inToc = true; seenChapters = 0; continue; }
      if (!inToc) continue;
      if (isTocStop(t, nextText, seenChapters)) { inToc = false; continue; }
      if (TOC_CHAPTER_RE.test(t)) seenChapters += 1;
      if (t.length > 96 || /[.!]$/u.test(t) || /^[«“"']/u.test(t)) continue;
      set.add(t);
    }
  }
  return set;
}

function headingBlockIsNarrativeContinuation(text, previousText) {
  const t = norm(text);
  const prev = norm(previousText);
  if (!t || !prev) return false;
  // A few imported Word runs were tagged as headings only because a line break
  // crossed formatting boundaries. If the alleged heading is grammatically the
  // continuation of the preceding sentence, keep it as body text. Visible text
  // is untouched; this changes only typography.
  if (/[.!؟!…»]$/u.test(prev)) return false;
  if (/^(?:فصل|بخش|پیوست|ضمیمه|تمرین|کاربرگ|هفته|روز|اصل|قانون|جمع[‌ -]?بندی|جدول|فرم|روش|نتیجه|یادآوری|سخن|مرحله|گام)\b/u.test(t)) return false;
  return /[.!؟!…]$/u.test(t) && t.length > 42;
}

function readerKind(text, block, context = {}) {
  const t = norm(text);
  if (!t) return { kind: 'body', level: 0 };

  if (isFrontMatterTitle(t)) return { kind: 'heading1', level: 1, freshPage: true };
  if (PRACTICE_PAGE_BREAK_RE.test(t)) return { kind: 'exerciseTitle', level: 2, freshPage: true, practice: true };
  if (practiceSubtitleCandidate(t, context.previousText)) return { kind: 'exerciseSubtitle', level: 3, practiceSubtitle: true };
  if (block?.type === 'heading' && headingBlockIsNarrativeContinuation(t, context.previousText)) return { kind: 'body', level: 0 };
  if (block?.type === 'heading') {
    const level = Math.max(1, Math.min(3, Number(block.level) || 3));
    if (level === 1) return { kind: 'heading1', level, freshPage: true };
    if (level === 2) return { kind: 'heading', level };
    return { kind: 'subheading', level };
  }
  if (block?.type === 'list') return { kind: 'list', level: 0 };

  if (/^(?:فصل|پیوست)\s+/u.test(t)) return { kind: 'body', level: 0 };
  if (/^ضمیمه\s+/u.test(t)) return { kind: 'heading1', level: 1, freshPage: true, toc: Number(context.bookId) === 3 };
  if (/^اصل\s+(?:اول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم|نهم|دهم|یازدهم|دوازدهم|سیزدهم|چهاردهم|[۰-۹0-9]+)(?:\s*[:：]|\s|$)/u.test(t)) return { kind: 'subheading', level: 3 };
  if (/^روز\s*[۰-۹0-9]+$/u.test(t)) return { kind: 'dayTitle', level: 2 };
  if (/^(?:هفته\s+(?:اول|دوم|سوم|چهارم|[۰-۹0-9]+)|روش ثبت هر روز|روش استفاده(?: از کتاب)?|یک سؤال نهایی|یادآوری|جمله پایانی|سخن آخر|آخرین تمرین|سخن پایانی|پیام پایانی|دعوت به ادامه مسیر)$/u.test(t)) return { kind: 'subheading', level: 2 };
  if (LABEL_RE.test(t)) return { kind: 'label', level: 3 };
  if (STRONG_HEADING_RE.test(t) || PREFIX_HEADING_RE.test(t)) return { kind: 'heading', level: 2 };
  if (context.knownHeadings?.has(t)) return { kind: 'subheading', level: 3, inferred: true };
  if (/^[۰-۹0-9]+[.)]\s+.{2,60}$/u.test(t)) return { kind: 'label', level: 3 };
  if (shortHeadingCandidate(t, context.nextText, context.bookId)) return { kind: 'subheading', level: 3, inferred: true };
  return { kind: 'body', level: 0 };
}

function breakLongToken(token, maxWidth, ctx) {
  if (ctx.measureText(token).width <= maxWidth) return [token];
  const out = [];
  let current = '';
  for (const char of token) {
    const test = current + char;
    if (current && ctx.measureText(test).width > maxWidth) {
      out.push(current);
      current = char;
    } else current = test;
  }
  if (current) out.push(current);
  return out;
}

function wrap(text, maxWidth, ctx) {
  const src = editorialReaderText(text);
  if (!src) return [];
  const words = src.split(/\s+/u).filter(Boolean);
  const lines = [];
  let line = '';
  for (const raw of words) {
    const pieces = breakLongToken(raw, maxWidth, ctx);
    for (const word of pieces) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function sentenceSegments(text) {
  const s = editorialReaderText(text);
  if (!s) return [];
  const out = [];
  let start = 0;
  for (let i = 0; i < s.length; i += 1) {
    if (!/[.!؟!]/u.test(s[i])) continue;
    let end = i + 1;
    while (end < s.length && /[»”"')\]]/u.test(s[end])) end += 1;
    if (end === s.length || /\s/u.test(s[end])) {
      const segment = s.slice(start, end).trim();
      if (segment) out.push(segment);
      start = end;
      while (start < s.length && /\s/u.test(s[start])) start += 1;
      i = start - 1;
    }
  }
  const tail = s.slice(start).trim();
  if (tail) out.push(tail);
  return out.length ? out : [s];
}

function bookRows(book) {
  return (book.pages || []).map((page, index) => ({
    source: Number(page.sourcePage || page.page || index + 1),
    page,
    blocks: rawPageBlocks(page).map((block) => ({ ...block, text: block?.text !== undefined ? String(block.text) : block?.text })),
  }));
}

function measureFactory(width, fontPx, family) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const safeCtx = ctx || { font: '', measureText: (value) => ({ width: String(value).length * fontPx * 0.55 }) };
  const pad = Math.max(18, Math.min(44, width * 0.055));
  const available = Math.max(130, width - pad * 2 - 2);
  function font(size = fontPx, weight = 450) {
    safeCtx.font = `${weight} ${size}px ${family}`;
    return safeCtx;
  }
  return { ctx: safeCtx, pad, available, fontPx, family, font };
}

function cleanTableRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => (Array.isArray(row) ? row.map((cell) => editorialReaderText(cell)) : []))
    .filter((row) => row.some(Boolean));
}

function tableRowsPerPage(columns) {
  if (columns >= 8) return 5;
  if (columns >= 6) return 6;
  if (columns >= 5) return 7;
  if (columns >= 4) return 8;
  if (columns >= 3) return 9;
  return 10;
}

function looksLikeTableCaption(text, block) {
  const t = norm(text);
  if (!t || t.length > 84) return false;
  if (block?.type === 'heading') return true;
  return /^(?:[۰-۹0-9]+[.)]?\s*)?(?:جدول|فرم|برنامه|ارزیابی|ماتریس|ثبت)\b/u.test(t)
    || /جدول/u.test(t);
}

function nextMeaningfulBlock(blocks, start) {
  for (let i = start; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (block?.type === 'separator') continue;
    if (block?.type === 'table') return { block, index: i };
    if (norm(block?.text)) return { block, index: i };
  }
  return null;
}

function tocKind(text) {
  const t = norm(text);
  if (TOC_TITLE_RE.test(t)) return 'tocTitle';
  if (TOC_PART_RE.test(t)) return 'tocPart';
  if (TOC_CHAPTER_RE.test(t)) return 'tocChapter';
  return 'tocSub';
}

function isTocStop(text, nextText, seenChapters) {
  const t = norm(text);
  if (!seenChapters) return false;
  if (TOC_HARD_STOP_RE.test(t)) return true;
  const next = norm(nextText);
  if (isFrontMatterTitle(t) && next.length > 110) return true;
  if (t.length > 150 && !TOC_CHAPTER_RE.test(t) && !TOC_PART_RE.test(t)) return true;
  return false;
}

function tocStyle(kind) {
  if (kind === 'tocTitle') return { factor: 1.42, weight: 950 };
  if (kind === 'tocPart') return { factor: 1.12, weight: 850 };
  if (kind === 'tocChapter') return { factor: 1.18, weight: 800 };
  return { factor: .94, weight: 480 };
}

export function buildLegacyReaderLayout({ book, bookId, cover = '', width, fontPx, fontFamily }) {
  const m = measureFactory(Math.max(1, width), fontPx, fontFamily || 'Tahoma, Arial, sans-serif');
  const pages = [];
  let lines = [];
  let pageSources = new Set();
  let paragraphSerial = 0;
  const sourceFirst = new Map();
  const chapterAnchors = [];
  const chapters = [...(book.chapters || [])].sort((a, c) => Number(a.page) - Number(c.page));
  const chapterMap = new Map(chapters.map((c) => [Number(c.page), c]));
  const firstChapterSource = chapters.length ? Number(chapters[0].page) || Infinity : Infinity;
  const insertedChapters = new Set();
  const poem = POEMS[Number(bookId)] || null;
  let poemDone = false;
  const knownHeadings = collectKnownHeadings(book);
  const MIN_SPLIT_FRAGMENT = 3;
  const HEADING_FOLLOW_LINES = 3;
  let tocActive = false;
  let tocSeenChapters = 0;
  let lastTocKind = ''; 

  function flush() {
    if (!lines.length) return;
    while (lines.length < READER_LINES_PER_PAGE) lines.push({ text: '', kind: 'blank', sourcePage: Number(lines[0]?.sourcePage) || 1 });
    const index = pages.length;
    const pageSource = Number(lines.find((x) => !['blank', 'spacer'].includes(x.kind))?.sourcePage) || Number(lines[0]?.sourcePage) || 1;
    pages.push({ type: 'text', lines: lines.slice(0, READER_LINES_PER_PAGE), sourcePage: pageSource });
    for (const source of pageSources) if (!sourceFirst.has(source)) sourceFirst.set(source, index);
    lines = [];
    pageSources = new Set();
  }

  function remaining() { return READER_LINES_PER_PAGE - lines.length; }

  function pushLine(text, kind, source, extra = {}) {
    if (lines.length >= READER_LINES_PER_PAGE) flush();
    lines.push({ text: String(text || ''), kind: kind || 'body', sourcePage: Number(source) || 1, ...extra });
    pageSources.add(Number(source) || 1);
  }

  function pushWrappedArray(wrapped, kind, source, meta = {}) {
    if (!wrapped.length) return;
    let cursor = 0;
    while (cursor < wrapped.length) {
      let cap = remaining();
      const left = wrapped.length - cursor;
      if (lines.length && cap < MIN_SPLIT_FRAGMENT && left > cap) { flush(); cap = remaining(); }
      let take = Math.min(cap, left);
      const tail = left - take;
      if (tail > 0 && tail < MIN_SPLIT_FRAGMENT && take > MIN_SPLIT_FRAGMENT) take = Math.max(MIN_SPLIT_FRAGMENT, take - (MIN_SPLIT_FRAGMENT - tail));
      if (take <= 0) { flush(); continue; }
      for (let j = 0; j < take; j += 1) {
        const global = cursor + j;
        pushLine(wrapped[global], kind, source, {
          paragraphId: meta.paragraphId,
          paraStart: Boolean(meta.paraStart) && global === 0,
          paraEnd: Boolean(meta.paraEnd) && global === wrapped.length - 1,
          sentenceStart: Boolean(meta.sentenceStart) && global === 0,
          sentenceEnd: Boolean(meta.sentenceEnd) && global === wrapped.length - 1,
          lineContinue: !(Boolean(meta.paraEnd) && global === wrapped.length - 1),
        });
      }
      cursor += take;
      if (cursor < wrapped.length) flush();
    }
  }

  function addParagraph(text, kind, source, sizeFactor = 1, weight = 450) {
    const normalized = editorialReaderText(text);
    if (!normalized) return;
    const paragraphId = ++paragraphSerial;
    const size = m.fontPx * sizeFactor;
    m.font(size, weight);
    const whole = wrap(normalized, m.available, m.ctx);
    if (!whole.length) return;

    if (whole.length <= READER_LINES_PER_PAGE) {
      if (lines.length && whole.length > remaining()) flush();
      whole.forEach((line, index) => pushLine(line, kind, source, {
        paragraphId,
        paraStart: index === 0,
        paraEnd: index === whole.length - 1,
        sentenceStart: index === 0,
        sentenceEnd: index === whole.length - 1,
        lineContinue: index < whole.length - 1,
      }));
      return;
    }

    if (lines.length && remaining() < MIN_SPLIT_FRAGMENT) flush();
    const segments = sentenceSegments(normalized);
    for (let si = 0; si < segments.length; si += 1) {
      m.font(size, weight);
      const sw = wrap(segments[si], m.available, m.ctx);
      if (!sw.length) continue;
      const firstSentence = si === 0;
      const lastSentence = si === segments.length - 1;
      if (sw.length <= READER_LINES_PER_PAGE && lines.length && sw.length > remaining()) flush();
      pushWrappedArray(sw, kind, source, {
        paragraphId,
        paraStart: firstSentence,
        paraEnd: lastSentence,
        sentenceStart: true,
        sentenceEnd: true,
      });
    }
  }

  function addHeading(text, kind, source, level = 2) {
    const factor = kind === 'heading1' ? 1.32 : kind === 'exerciseTitle' ? 1.26 : kind === 'exerciseSubtitle' ? 1.14 : kind === 'dayTitle' ? 1.20 : kind === 'heading' ? 1.22 : kind === 'subheading' ? 1.17 : 1.03;
    const weight = kind === 'label' ? 760 : kind === 'exerciseSubtitle' ? 800 : kind === 'subheading' ? 880 : kind === 'exerciseTitle' ? 900 : 950;
    m.font(m.fontPx * factor, weight);
    const wrapped = wrap(editorialReaderText(text), m.available, m.ctx);
    const spacer = kind === 'label' ? 0 : 1;
    const follow = kind === 'heading1' || kind === 'exerciseTitle' ? 4 : HEADING_FOLLOW_LINES;
    const need = Math.min(READER_LINES_PER_PAGE, wrapped.length + spacer + follow);
    if (lines.length && remaining() < need) flush();
    wrapped.forEach((line, index) => pushLine(line, kind, source, {
      paraStart: index === 0,
      paraEnd: index === wrapped.length - 1,
      lineContinue: false,
      level,
    }));
    if (spacer && remaining() > follow) pushLine('', 'spacer', source, { paraStart: false, paraEnd: true });
  }


  function tocWrappedLineCount(text, kind) {
    const style = tocStyle(kind);
    const indent = kind === 'tocSub' ? Math.max(12, Math.min(24, width * .025)) : 0;
    m.font(m.fontPx * style.factor, style.weight);
    return Math.max(1, wrap(editorialReaderText(text), Math.max(100, m.available - indent), m.ctx).length);
  }

  function tocChapterNeed(blocks, startIndex) {
    let need = 0;
    for (let j = startIndex; j < blocks.length; j += 1) {
      const text = norm(blocks[j]?.text);
      if (!text) continue;
      const kind = tocKind(text);
      if (j > startIndex && (kind === 'tocChapter' || kind === 'tocPart' || kind === 'tocTitle')) break;
      if (j > startIndex && isTocStop(text, blocks.slice(j + 1).map((x) => norm(x?.text)).find(Boolean) || '', tocSeenChapters)) break;
      need += tocWrappedLineCount(blocks[j]?.text, kind);
    }
    // One quiet line between complete chapter groups, never inside a group.
    return Math.min(READER_LINES_PER_PAGE, need + (lines.length && lastTocKind !== 'tocPart' ? 1 : 0));
  }

  function addTocEntry(text, kind, source) {
    const visible = editorialReaderText(text);
    if (!visible) return;
    const style = tocStyle(kind);
    const indent = kind === 'tocSub' ? Math.max(12, Math.min(24, width * .025)) : 0;
    m.font(m.fontPx * style.factor, style.weight);
    const wrapped = wrap(visible, Math.max(100, m.available - indent), m.ctx);
    if (!wrapped.length) return;

    if (kind === 'tocTitle') {
      if (lines.length) flush();
    } else if (kind === 'tocPart') {
      // Persian book typography: a major part heading must not hang at page foot.
      if (lines.length && remaining() < Math.min(6, wrapped.length + 4)) flush();
      if (lines.length && lastTocKind !== 'tocTitle' && remaining() > wrapped.length + 2) pushLine('', 'tocGap', source);
    } else if (kind === 'tocChapter') {
      if (lines.length && lastTocKind !== 'tocPart' && lastTocKind !== 'tocTitle' && remaining() > wrapped.length + 1) pushLine('', 'tocGap', source);
    }

    if (lines.length && wrapped.length > remaining()) flush();
    wrapped.forEach((line, index) => pushLine(line, kind, source, {
      paraStart: index === 0,
      paraEnd: index === wrapped.length - 1,
      lineContinue: false,
    }));
    lastTocKind = kind;
  }

  function addChapter(chapter, source) {
    flush();
    const parts = chapterParts(chapter.title, bookId);
    const index = pages.length;
    pages.push({ type: 'chapter', chapter: parts, chapterKind: chapter.kind || 'chapter', sourcePage: source });
    chapterAnchors.push({ title: parts.full, source, page: index, kind: chapter.kind || 'chapter' });
    if (!sourceFirst.has(source)) sourceFirst.set(source, index);
    insertedChapters.add(source);
  }

  function addInlineTocAnchor(title, source) {
    const clean = editorialReaderText(title);
    if (!clean || chapterAnchors.some((x) => x.source === source && norm(x.title) === norm(clean))) return;
    chapterAnchors.push({ title: clean, source, page: pages.length, kind: 'subsection' });
  }

  function addPoem(item, source) {
    flush();
    if (item.title) pushLine(item.title, 'poemTitle', source, { paraStart: true, paraEnd: true });
    item.lines.forEach((line) => pushLine(line, 'poem', source, { paraStart: true, paraEnd: true }));
    flush();
  }

  function addTable(rows, source, title = '') {
    const cleanRows = cleanTableRows(rows);
    if (!cleanRows.length) return;
    flush();
    const columns = Math.max(...cleanRows.map((row) => row.length), 1);
    const header = cleanRows[0];
    const body = cleanRows.slice(1);
    const perPage = tableRowsPerPage(columns);
    const chunks = body.length ? Array.from({ length: Math.ceil(body.length / perPage) }, (_, i) => body.slice(i * perPage, (i + 1) * perPage)) : [[]];
    chunks.forEach((chunk, chunkIndex) => {
      const index = pages.length;
      pages.push({
        type: 'table',
        title: editorialReaderText(title) || 'جدول',
        rows: [header, ...chunk],
        columns,
        sourcePage: source,
        continued: chunkIndex > 0,
      });
      if (!sourceFirst.has(source)) sourceFirst.set(source, index);
    });
  }

  const sourceRows = bookRows(book);
  for (const row of sourceRows) {
    const source = Number(row.source) || 1;
    if (tocActive && source >= firstChapterSource) { tocActive = false; lastTocKind = ''; }
    const chapter = chapterMap.get(source);
    const blocks = row.blocks || [];
    // Some Word pages contain the tail of the previous section before the next
    // section heading (notably book 3 pages 285 and 300). Insert the dedicated
    // opener exactly where that heading occurs instead of at the source-page edge.
    const chapterEchoIndex = chapter
      ? blocks.findIndex((candidate) => isChapterEcho(norm(candidate?.text), chapter, bookId))
      : -1;
    if (chapter && chapterEchoIndex < 0 && !insertedChapters.has(source)) addChapter(chapter, source);
    let pendingTableTitle = '';
    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i];
      // Keep two representations: `text` is structural-only and is never rendered;
      // `visibleText` preserves the author's wording/punctuation for display.
      const visibleText = editorialReaderText(block?.text);
      const text = norm(block?.text);
      if (!text && block?.type !== 'separator' && block?.type !== 'table') continue;
      const nextText = blocks.slice(i + 1).map((x) => norm(x?.text)).find(Boolean) || '';
      if (chapter && i === chapterEchoIndex && !insertedChapters.has(source)) {
        addChapter(chapter, source);
        continue;
      }
      if (chapter && isChapterEcho(text, chapter, bookId)) continue;

      // The printed table of contents is a navigation composition, not body prose.
      // Preserve every authored line, but apply a Persian hierarchy and keep each
      // chapter with its listed sub-sections whenever they fit on one reader page.
      if (!tocActive && source < firstChapterSource && TOC_TITLE_RE.test(text)) {
        tocActive = true;
        tocSeenChapters = 0;
        lastTocKind = '';
      }
      if (tocActive && source < firstChapterSource) {
        if (isTocStop(text, nextText, tocSeenChapters)) {
          tocActive = false;
          lastTocKind = '';
          if (lines.length) flush();
        } else if (block?.type !== 'table' && block?.type !== 'separator') {
          const kind = tocKind(text);
          if (kind === 'tocChapter') {
            const need = tocChapterNeed(blocks, i);
            if (lines.length && remaining() < need) flush();
            tocSeenChapters += 1;
          }
          addTocEntry(block?.text ?? text, kind, source);
          continue;
        }
      }

      if (poem && !poemDone) {
        if (poem.title && text === norm(poem.title) && blocks.slice(i + 1, i + 1 + poem.lines.length).map((x) => norm(x.text)).join('|') === poem.lines.map(norm).join('|')) {
          addPoem(poem, source); i += poem.lines.length; poemDone = true; continue;
        }
        if (text === norm(poem.lines[0])) {
          const candidate = blocks.slice(i, i + poem.lines.length).map((x) => norm(x.text));
          if (candidate.join('|') === poem.lines.map(norm).join('|')) {
            addPoem(poem, source); i += poem.lines.length - 1; poemDone = true; continue;
          }
        }
      }

      if (block?.type === 'separator' || isRuleText(text)) {
        const upcoming = nextMeaningfulBlock(blocks, i + 1);
        if (pendingTableTitle && upcoming?.block?.type === 'table') continue;
        pushLine('•  •  •', 'separator', source, { paraStart: true, paraEnd: true });
        continue;
      }
      if (block?.type === 'table' && Array.isArray(block.rows)) {
        addTable(block.rows, source, pendingTableTitle);
        pendingTableTitle = '';
        continue;
      }

      const upcoming = nextMeaningfulBlock(blocks, i + 1);
      if (upcoming?.block?.type === 'table' && looksLikeTableCaption(text, block)) {
        pendingTableTitle = visibleText;
        continue;
      }
      const previousText = blocks.slice(0, i).reverse().map((x) => norm(x?.text)).find(Boolean) || '';
      const meta = readerKind(text, block, { bookId, source, nextText, previousText, knownHeadings });
      if (meta.freshPage && lines.length) flush();
      // Give a major practical exercise the same visual breathing room as a
      // printed section opener, while keeping its first subtitle and prose with it.
      if (meta.kind === 'exerciseTitle' && !lines.length) pushLine('', 'spacer', source, { paraStart: false, paraEnd: true });
      if (meta.toc) addInlineTocAnchor(visibleText, source);
      if (['heading1', 'exerciseTitle', 'exerciseSubtitle', 'heading', 'subheading', 'label', 'dayTitle'].includes(meta.kind)) {
        addHeading(visibleText, meta.kind, source, meta.level);
        continue;
      }
      addParagraph(visibleText, meta.kind, source, 1, meta.kind === 'list' ? 520 : 450);
    }
  }

  flush();
  if (!pages.length) pages.push({ type: 'text', lines: Array.from({ length: READER_LINES_PER_PAGE }, () => ({ text: '', kind: 'blank', sourcePage: 1 })), sourcePage: 1 });

  let sourceAnchors = [...sourceFirst.entries()]
    .map(([source, page]) => ({ source: Number(source), page: Number(page) }))
    .sort((a, c) => a.source - c.source);
  let shiftedChapters = chapterAnchors
    .slice()
    .sort((a, c) => a.page - c.page || a.source - c.source);

  // Digital front matter. The original cover stays page 1. For volume 3,
  // the author's supplied opening image is shown immediately after the cover,
  // before any extracted text. This adds presentation only and does not alter
  // or remove a single character from the book content.
  const openingPages = [{ type: 'cover', cover, sourcePage: 0 }];
  if (Number(bookId) === 3) {
    openingPages.push({
      type: 'frontispiece',
      // image: '/assets/reader/book3-opening-page.png',
      image: `${import.meta.env.BASE_URL}assets/reader/book3-opening-page.png`,
      alt: 'صفحه آغازین جلد سوم',
      sourcePage: 0,
    });
  }
  pages.unshift(...openingPages);
  const openingShift = openingPages.length;
  sourceAnchors = sourceAnchors.map((anchor) => ({ ...anchor, page: anchor.page + openingShift }));
  shiftedChapters = shiftedChapters.map((anchor) => ({ ...anchor, page: anchor.page + openingShift }));

  return {
    pages,
    pageCount: pages.length,
    sourceAnchors,
    chapterAnchors: shiftedChapters,
  };
}

export function pageForSource(layout, source) {
  const n = Number(source) || 1;
  const anchors = layout?.sourceAnchors || [];
  const exact = anchors.find((anchor) => anchor.source === n);
  if (exact) return exact.page;
  let best = anchors[0] || { page: 1, source: 1 };
  for (const anchor of anchors) {
    if (anchor.source <= n) best = anchor;
    else break;
  }
  return best.page;
}

export function currentChapter(layout, pageIndex) {
  let best = null;
  for (const chapter of layout?.chapterAnchors || []) {
    if (chapter.page <= pageIndex) best = chapter;
    else break;
  }
  return best;
}

export function endsSentence(text) {
  return /[.!؟!…][»”"'’\)\]]*$/u.test(String(text || '').trim());
}

export function previewPageText(page) {
  return (page?.blocks || rawPageBlocks(page)).map((block) => block.type === 'table'
    ? (block.rows || []).map((row) => row.map(editorialReaderText).join(' | ')).join('\n')
    : editorialReaderText(block.text || ''))
    .filter(Boolean).join('\n\n').slice(0, 1800);
}
