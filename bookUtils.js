import { uid } from '../../shared/utils.js';

export function normalizeBookContent(input, fallbackTitle = 'کتاب بدون عنوان') {
  if (!input || typeof input !== 'object') throw new Error('ساختار فایل کتاب معتبر نیست.');
  const title = String(input.title || fallbackTitle).trim();
  const rawPages = Array.isArray(input.pages) ? input.pages : [];
  if (!rawPages.length) throw new Error('فایل کتاب باید حداقل یک صفحه داشته باشد.');
  const pages = rawPages.map((page, index) => normalizePage(page, index + 1));
  const chapters = Array.isArray(input.chapters)
    ? input.chapters.map((c) => ({ page: Number(c.page) || 1, title: String(c.title || '').trim() })).filter((c) => c.title)
    : inferChapters(pages);
  return {
    ...input,
    title,
    version: String(input.version || '1.0'),
    pages,
    chapters,
  };
}

function normalizePage(page, number) {
  if (typeof page === 'string') return { page: number, text: page };
  if (!page || typeof page !== 'object') return { page: number, text: '' };
  if (Array.isArray(page.blocks)) return { ...page, page: Number(page.page) || number, blocks: page.blocks.map(normalizeBlock) };
  return { ...page, page: Number(page.page) || number, text: String(page.text || '') };
}

function normalizeBlock(block) {
  if (typeof block === 'string') return { type: 'paragraph', text: block };
  return {
    ...(block || {}),
    type: block?.type || 'paragraph',
    level: block?.level,
    text: block?.text === undefined ? '' : String(block.text),
    rows: Array.isArray(block?.rows) ? block.rows.map((row) => Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : []) : block?.rows,
  };
}

export function pageToText(page) {
  if (typeof page?.text === 'string') return page.text;
  if (Array.isArray(page?.blocks)) return page.blocks.map((b) => b.text || '').join('\n\n');
  return '';
}

export function inferChapters(pages) {
  const chapters = [];
  const re = /^(?:فصل|پیوست|بخش)\s+[\u0600-\u06FF\d۰-۹٠-٩]+.*$/m;
  pages.forEach((page, idx) => {
    const text = pageToText(page);
    const match = text.match(re);
    if (match) chapters.push({ page: Number(page.page) || idx + 1, title: match[0].trim() });
  });
  return chapters;
}

export function textToBook(text, title = 'کتاب جدید') {
  const clean = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!clean) throw new Error('فایل متنی خالی است.');
  const paragraphs = clean.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  const pages = [];
  let bucket = [];
  let count = 0;
  const flush = () => {
    if (!bucket.length) return;
    pages.push({ page: pages.length + 1, text: bucket.join('\n\n') });
    bucket = [];
    count = 0;
  };
  paragraphs.forEach((p) => {
    if (count + p.length > 2600 && bucket.length) flush();
    bucket.push(p);
    count += p.length;
  });
  flush();
  return normalizeBookContent({ version: '1.0', title, pages });
}

export function createBookRecord({ title, subtitle = '', author = '', description = '', coverDataUrl = '', versionId, order = 999 }) {
  const now = new Date().toISOString();
  return {
    id: uid('book'),
    title,
    subtitle,
    author,
    description,
    coverDataUrl,
    activeVersionId: versionId,
    order,
    createdAt: now,
    updatedAt: now,
  };
}

export function createVersionRecord({ bookId, versionLabel, filename, mimeType, content, source = 'upload' }) {
  return {
    id: uid('ver'),
    bookId,
    versionLabel: String(versionLabel || content?.version || '1.0'),
    filename: filename || '',
    mimeType: mimeType || 'application/json',
    content,
    source,
    createdAt: new Date().toISOString(),
  };
}

export function buildReaderPages(book, linesPerPage = 16) {
  const result = [];
  const chapterMap = new Map((book.chapters || []).map((c) => [Number(c.page), c.title]));
  for (const source of book.pages || []) {
    const sourcePage = Number(source.page) || 1;
    const chapter = chapterMap.get(sourcePage) || '';
    const text = pageToText(source).replace(/\u00a0/g, ' ').trim();
    const logical = text.split(/\n+/).map((x) => x.trim()).filter(Boolean);
    const lines = [];
    logical.forEach((paragraph) => {
      const chunks = wrapText(paragraph, 72);
      lines.push(...chunks, '');
    });
    while (lines.length && !lines[lines.length - 1]) lines.pop();
    for (let i = 0; i < Math.max(lines.length, 1); i += linesPerPage) {
      result.push({
        index: result.length + 1,
        sourcePage,
        chapter,
        lines: lines.slice(i, i + linesPerPage),
      });
    }
  }
  return result;
}

function wrapText(text, maxChars) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const out = [];
  let line = '';
  words.forEach((word) => {
    if (!line) { line = word; return; }
    if ((line + ' ' + word).length <= maxChars) line += ` ${word}`;
    else { out.push(line); line = word; }
  });
  if (line) out.push(line);
  return out;
}
