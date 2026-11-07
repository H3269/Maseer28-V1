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
  assert.match(response, /یک نمونه فرضی و تمرین پیشنهادی دستیار/u);
  assert.match(response, /ساخته دستیارند/u);
});


test('recommendations explain their limited basis instead of pretending to know the reader', () => {
  const response = answerLibraryBookQuestion({ books, message: 'برای اینکه خودم را بهتر بشناسم از کدام کتاب شروع کنم؟' });
  assert.match(response, /پیشنهاد شروع مطالعه/);
  assert.match(response, /بر پایه موضوع و ساختار ثبت‌شده/);
  assert.match(response, /نه شناخت وضعیت شخصی تو/);
  assert.match(response, /هنر شناخت و دگرگونی احساسات/);
});

test('scientific validity questions distinguish book excerpts from scientific evidence', () => {
  const response = answerLibraryBookQuestion({ books, message: 'در کتاب پنجم آیا این دیدگاه از نظر روان‌شناسی علمی قابل دفاع است؟' });
  assert.match(response, /به‌تنهایی.*اعتبار علمی/u);
  assert.match(response, /پژوهش‌های معتبر و مستقل/u);
  assert.match(response, /منبع:/);
});

test('the assistant does not fabricate an opposing scientific view', () => {
  const response = answerLibraryBookQuestion({ books, message: 'در کتاب پنجم آیا دیدگاه مخالفی هم وجود دارد؟' });
  assert.match(response, /نمی‌توانم وجود یا محتوای یک دیدگاه مخالف مشخص را اثبات کنم/u);
  assert.match(response, /نباید به نویسنده نسبت داد/u);
});

test('generated examples and weekly plans are explicitly attributed to the assistant', () => {
  const example = answerLibraryBookQuestion({ books, message: 'در کتاب پنجم درباره احساسات یک مثال بزن' });
  assert.match(example, /یک نمونه فرضی و تمرین پیشنهادی دستیار/u);
  assert.match(example, /ساخته دستیارند/u);
  const plan = answerLibraryBookQuestion({ books, message: 'در کتاب پنجم برای شناخت احساسات برنامه هفت روزه بده' });
  assert.match(plan, /برنامه هفت‌روزه پیشنهادی دستیار/u);
  assert.match(plan, /نقل قول یا برنامه تألیفی کتاب نیست/u);
});

test('contextual follow-ups retain the selected book even when the wording is not a fixed follow-up phrase', () => {
  const first = answerLibraryBookTurn({ books, message: 'در کتاب پنجم درباره چرخه احساسات چه نوشته؟' });
  const second = answerLibraryBookTurn({ books, message: 'چه محدودیت‌هایی دارد؟', conversationState: first.conversationState });
  assert.match(second.message, /هنر شناخت و دگرگونی احساسات/u);
  assert.match(second.message, /محدودیت/u);
});

test('progress guidance uses observable behavior and avoids clinical claims', () => {
  const response = answerLibraryBookQuestion({ books, message: 'در کتاب پنجم از کجا بفهمم در این توصیه پیشرفت کرده‌ام؟' });
  assert.match(response, /رفتارهای قابل مشاهده/u);
  assert.match(response, /نه معیار تشخیصی یا درمانی/u);
});


test('book-specific introductions use actual metadata and chapter headings', () => {
  const response = answerLibraryBookQuestion({ books, message: 'کتاب اول درباره چه موضوعی است؟' });
  assert.match(response, /رشد فردی، خودشناسی، تحول درونی/u);
  assert.match(response, /محورهای قابل مشاهده/u);
});

test('author-intent questions ask for a precise section instead of guessing', () => {
  const response = answerLibraryBookQuestion({ books, message: 'در کتاب پنجم نویسنده در این بخش دقیقاً چه منظوری دارد؟' });
  assert.match(response, /عنوان فصل، شماره صفحه یا چند کلمه/u);
  assert.match(response, /نمی‌خواهم نیت نویسنده را حدس بزنم/u);
});

test('concept comparisons request two named concepts and offer real book headings', () => {
  const response = answerLibraryBookQuestion({ books, message: 'در کتاب پنجم دو مفهوم مهم را با هم مقایسه می‌کنی؟' });
  assert.match(response, /دو مفهوم مشخص را انتخاب کن/u);
  assert.match(response, /فصل/u);
});

test('a low-pressure alternative is available when a suggested exercise is difficult', () => {
  const response = answerLibraryBookQuestion({ books, message: 'در کتاب پنجم اگر نتوانم این تمرین را انجام بدهم چه جایگزینی دارم؟' });
  assert.match(response, /جایگزین ساده پیشنهادی دستیار/u);
  assert.match(response, /لازم نیست به خودت فشار بیاوری/u);
});


test('anxiety guidance points to retrieved passages and avoids treatment claims', () => {
  const response = answerLibraryBookQuestion({ books, message: 'در کتاب پنجم کدام بخش‌ها برای مدیریت اضطراب مفید هستند؟' });
  assert.match(response, /اطلاعات کتابی و خودآگاهی عمومی/u);
  assert.match(response, /منبع:/u);
  assert.match(response, /جای ارزیابی متخصص را نمی‌گیرد/u);
});

test('anger guidance connects a practical step to sourced text without promising control', () => {
  const response = answerLibraryBookQuestion({ books, message: 'در کتاب پنجم اگر هنگام عصبانیت کنترل واکنشم سخت باشد چه چیزی کمک می‌کند؟' });
  assert.match(response, /پیشنهاد عملی دستیار/u);
  assert.match(response, /منبع:/u);
  assert.match(response, /سرکوب احساس/u);
});

test('confidence guidance distinguishes assistant suggestion from author text', () => {
  const response = answerLibraryBookQuestion({ books, message: 'در کتاب اول برای تقویت اعتمادبه‌نفس چه نکته‌ای وجود دارد؟' });
  assert.match(response, /پیشنهاد تکمیلی دستیار/u);
  assert.match(response, /متن نویسنده نیست/u);
  assert.match(response, /منبع:/u);
});
