import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { answerLibraryBookQuestion, answerLibraryBookTurn } from '../src/features/assistant/libraryBookAssistant.js';

const root = new URL('../public/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('content/library.seed.json', root), 'utf8'));
const books = await Promise.all(manifest.books.map(async (meta) => ({
  title: meta.title,
  legacyId: meta.legacyId,
  content: JSON.parse(await readFile(new URL(meta.file, root), 'utf8')),
})));

test('all five seeded books return grounded overviews with source page locators', () => {
  assert.equal(books.length, 5);
  for (const book of books) {
    assert.ok(book.content.pages.length > 0, book.title + ' must have pages');
    const response = answerLibraryBookQuestion({
      books,
      message: 'خلاصه کتاب ' + ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم'][book.legacyId - 1],
    });
    assert.ok(response, book.title + ' should return an overview');
    assert.ok(response.includes(book.title));
    assert.match(response, /منبع:/);
    assert.match(response, /صفحه/);
    assert.match(response, /نمای کلی مستند/);
  }
});

test('the library inventory lists all five books', () => {
  const response = answerLibraryBookQuestion({ books, message: 'این کتابخانه چه کتاب‌هایی دارد؟' });
  for (const book of books) assert.ok(response.includes(book.title));
});

test('a focused question returns excerpts with source locators', () => {
  const book = books[4];
  const firstText = book.content.pages.flatMap((page) => page.blocks || [])
    .map((block) => block.text || '').find((text) => text.length > 80);
  assert.ok(firstText);
  const keyword = firstText.split(/\s+/).find((word) => word.length > 4);
  const response = answerLibraryBookQuestion({ books, message: 'در کتاب پنجم درباره ' + keyword + ' چه نوشته شده؟' });
  assert.ok(response.includes(book.title));
  assert.ok(response.includes('منبع:'));
});

test('concept synonyms retrieve semantically related source passages', () => {
  const sampleBooks = [{
    title: 'کتاب آزمایشی',
    legacyId: 1,
    content: { pages: [
      { page: 1, sourcePage: 1, blocks: [{ type: 'heading', text: 'مدیریت هیجان' }, { type: 'paragraph', text: 'برای کاهش دلشوره و نگرانی، ابتدا واکنش بدن را مشاهده کن و سپس تنفس آرام را تمرین کن.' }] },
      { page: 2, sourcePage: 2, blocks: [{ type: 'paragraph', text: 'در زمان آرامش می‌توان تجربه‌های روزانه را ثبت کرد.' }] },
    ] },
  }];
  const response = answerLibraryBookQuestion({ books: sampleBooks, message: 'در کتاب اول درباره اضطراب چه گفته شده؟' });
  assert.match(response, /دلشوره و نگرانی/);
  assert.match(response, /صفحه 1/);
});

test('follow-up questions retain the selected book and topic', () => {
  const sampleBooks = [{
    title: 'کتاب آزمایشی',
    legacyId: 1,
    content: { pages: [
      { page: 1, sourcePage: 1, blocks: [{ type: 'heading', text: 'شناخت خشم' }, { type: 'paragraph', text: 'شناخت نشانه‌های عصبانیت به فرد کمک می‌کند پیش از واکنش، مکث کند.' }] },
      { page: 2, sourcePage: 2, blocks: [{ type: 'paragraph', text: 'تمرین مکث کوتاه می‌تواند از رفتار تکانشی جلوگیری کند.' }] },
    ] },
  }];
  const first = answerLibraryBookTurn({ books: sampleBooks, message: 'در کتاب اول درباره خشم چه نوشته؟' });
  assert.equal(first.conversationState.bookId, 1);
  const second = answerLibraryBookTurn({ books: sampleBooks, message: 'بیشتر توضیح بده', conversationState: first.conversationState });
  assert.match(second.message, /کتاب آزمایشی/);
  assert.match(second.message, /ادامه بررسی همان موضوع/);
  assert.match(second.message, /عصبانیت/);
});

test('a comparison request uses recorded metadata and actual chapter headings', () => {
  const response = answerLibraryBookQuestion({ books, message: 'تفاوت موضوعی این پنج کتاب چیست؟' });
  for (const book of books) assert.ok(response.includes(book.title));
  assert.match(response, /مقایسه ساختاری/);
});

test('no answer is invented when the requested book is unavailable', () => {
  assert.equal(answerLibraryBookQuestion({ books: [], message: 'خلاصه کتاب پنجم' }), null);
});

test('general library page questions fall back to the page assistant', () => {
  assert.equal(answerLibraryBookQuestion({ books, message: 'این صفحه برای چیست؟' }), null);
});

test('book-related requests without a title ask the user to choose a book', () => {
  const response = answerLibraryBookQuestion({ books, message: 'لطفاً خلاصه کتاب را بگو' });
  assert.match(response, /نام یکی از کتاب‌ها/);
});

test('the local engine does not claim to generate a new example or exercise', () => {
  const sampleBooks = [{
    title: 'کتاب آزمایشی',
    legacyId: 1,
    content: { pages: [{ page: 1, sourcePage: 1, blocks: [{ type: 'paragraph', text: 'شناخت احساسات و ثبت روزانه آن‌ها به افزایش آگاهی کمک می‌کند.' }] }] },
  }];
  const response = answerLibraryBookQuestion({ books: sampleBooks, message: 'در کتاب اول درباره احساسات چه تمرینی پیشنهاد می‌شود؟' });
  assert.match(response, /هنوز مثال شخصی‌سازی‌شده یا برنامه تمرینی تازه تولید نمی‌کند/);
});
