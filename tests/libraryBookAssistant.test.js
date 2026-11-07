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
    assert.match(response, /مرور ساختاری مستند/);
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
  assert.match(response, /هنر شناخت و دگرگونی احساسات/u);
  assert.match(response, /باید ادعا یا توصیه مشخص باشد/u);
  assert.match(response, /چند گزیده نامرتبط می‌تواند گمراه‌کننده باشد/u);
  assert.doesNotMatch(response, /منبع:/);
});

test('the assistant does not fabricate an opposing scientific view', () => {
  const response = answerLibraryBookQuestion({ books, message: 'در کتاب پنجم آیا دیدگاه مخالفی هم وجود دارد؟' });
  assert.match(response, /باید ادعا یا توصیه مشخص باشد/u);
  assert.doesNotMatch(response, /منبع:/);
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

test('progress questions about an unspecified recommendation request the referenced section first', () => {
  const response = answerLibraryBookQuestion({ books, message: 'در کتاب پنجم از کجا بفهمم در این توصیه پیشرفت کرده‌ام؟' });
  assert.match(response, /عنوان فصل، شماره صفحه یا چند واژه/u);
  assert.doesNotMatch(response, /رفتارهای قابل مشاهده/u);
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
  assert.match(response, /نام دو مفهوم را مشخص کن/u);
  assert.match(response, /فصل/u);
});

test('a low-pressure alternative asks for the exercise source when no prior section is known', () => {
  const response = answerLibraryBookQuestion({ books, message: 'در کتاب پنجم اگر نتوانم این تمرین را انجام بدهم چه جایگزینی دارم؟' });
  assert.match(response, /عنوان فصل، شماره صفحه یا چند واژه/u);
  assert.doesNotMatch(response, /جایگزین ساده پیشنهادی دستیار/u);
});

test('a low-pressure alternative is available when the exercise section is already in context', () => {
  const response = answerLibraryBookTurn({
    books,
    message: 'اگر نتوانم این تمرین را انجام بدهم چه جایگزینی دارم؟',
    conversationState: {
      bookId: 5,
      bookTitle: books[4].title,
      lastQuery: 'در کتاب پنجم تمرین پایانی فصل پنجم را توضیح بده',
      lastSources: [{ page: 44, heading: 'تمرین پایانی فصل پنجم: یافتن نقطه تغییر' }],
    },
  });
  assert.match(response.message, /جایگزین ساده پیشنهادی دستیار/u);
  assert.match(response.message, /لازم نیست به خودت فشار بیاوری/u);
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

test('confidence guidance refuses to invent book-specific advice without direct evidence', () => {
  const response = answerLibraryBookQuestion({ books, message: 'در کتاب اول برای تقویت اعتمادبه‌نفس چه نکته‌ای وجود دارد؟' });
  assert.match(response, /شاهد مستقیم و کافی برای اعتمادبه‌نفس/u);
  assert.doesNotMatch(response, /پیشنهاد تکمیلی دستیار/u);
});


test('key-point requests do not fall through to the generic book overview', () => {
  const response = answerLibraryBookQuestion({ books, message: 'در کتاب اول مهم‌ترین نکات کدام‌اند؟' });
  assert.match(response, /نکته‌های قابل استخراج از بخش‌های بازیابی‌شده/u);
  assert.doesNotMatch(response, /نمای کلی مستند/u);
  assert.match(response, /منبع:/u);
});

test('a contextual follow-up searches the new limitation question while retaining the selected topic', () => {
  const sampleBooks = [{
    title: 'کتاب آزمایشی',
    legacyId: 1,
    content: { pages: [
      { page: 1, sourcePage: 1, blocks: [{ type: 'heading', text: 'شناخت خشم' }, { type: 'paragraph', text: 'شناخت نشانه‌های عصبانیت به فرد کمک می‌کند پیش از واکنش مکث کند.' }] },
      { page: 2, sourcePage: 2, blocks: [{ type: 'heading', text: 'محدودیت‌های تمرین' }, { type: 'paragraph', text: 'این تمرین در شرایط خطر فوری یا هنگام شدت بسیار بالای هیجان کافی نیست و باید از حمایت مناسب استفاده کرد.' }] },
    ] },
  }];
  const first = answerLibraryBookTurn({ books: sampleBooks, message: 'در کتاب اول درباره خشم چه نوشته؟' });
  const second = answerLibraryBookTurn({
    books: sampleBooks,
    message: 'چه محدودیت‌هایی دارد؟',
    conversationState: first.conversationState,
  });
  assert.match(second.message, /محدودیت‌های تمرین/u);
  assert.match(second.message, /صفحه 2/u);
  assert.equal(second.conversationState.bookId, 1);
});


test('alternative-view questions are not mistaken for a comparison of all library books', () => {
  const response = answerLibraryBookQuestion({
    books,
    message: 'در کتاب پنجم آیا درباره این موضوع دیدگاه متفاوت یا مخالفی هم وجود دارد؟',
  });
  assert.match(response, /هنر شناخت و دگرگونی احساسات/u);
  assert.match(response, /برای بررسی علمی، دیدگاه مخالف یا محدودیت‌ها باید ادعا یا توصیه مشخص باشد/u);
  assert.doesNotMatch(response, /مقایسه ساختاری کتابخانه|منبع:/u);
});

test('the assistant does not label generic passages as anxiety-specific book guidance', () => {
  const sampleBooks = [{
    title: 'کتاب آزمایشی',
    legacyId: 1,
    content: { pages: [{ page: 1, sourcePage: 1, blocks: [
      { type: 'heading', text: 'برنامه‌ریزی روزانه' },
      { type: 'paragraph', text: 'مدیریت زمان و برنامه‌ریزی روزانه به سامان دادن کارهای معمول کمک می‌کند.' },
    ] }] },
  }];
  const response = answerLibraryBookQuestion({
    books: sampleBooks,
    message: 'در کتاب اول کدام بخش‌ها برای مدیریت اضطراب مفید هستند؟',
  });
  assert.match(response, /شاهد مستقیم و کافی برای اضطراب/u);
  assert.doesNotMatch(response, /از نظر شناخت احساسات، نگرانی/u);
});

test('explicitly named concept comparisons retrieve separate evidence and cite both concepts', () => {
  const sampleBooks = [{
    title: 'کتاب آزمایشی',
    legacyId: 1,
    content: { pages: [
      { page: 1, sourcePage: 1, blocks: [
        { type: 'heading', text: 'باورهای بنیادی' },
        { type: 'paragraph', text: 'باورها برداشت‌هایی هستند که فرد درباره خود و جهان می‌سازد و بر انتخاب‌های او اثر می‌گذارند.' },
      ] },
      { page: 2, sourcePage: 2, blocks: [
        { type: 'heading', text: 'شناخت احساسات' },
        { type: 'paragraph', text: 'احساسات تجربه‌های درونی هستند که با واکنش‌های بدنی و گرایش به رفتار همراه می‌شوند.' },
      ] },
    ] },
  }];
  const response = answerLibraryBookQuestion({
    books: sampleBooks,
    message: 'در کتاب اول مفهوم باور و احساس را با هم مقایسه کن',
  });
  assert.match(response, /مقایسه مستند دو مفهوم/u);
  assert.match(response, /مفهوم اول: «باور»/u);
  assert.match(response, /مفهوم دوم: «احساس»/u);
  assert.match(response, /منبع: باورهای بنیادی · صفحه 1/u);
  assert.match(response, /منبع: شناخت احساسات · صفحه 2/u);
  assert.match(response, /تحلیل نهایی استدلال نویسنده/u);
});

test('book overviews exclude dedication and contents pages from representative excerpts', () => {
  const sampleBooks = [{
    title: 'کتاب آزمایشی',
    legacyId: 1,
    content: { pages: [
      { page: 1, sourcePage: 1, blocks: [
        { type: 'heading', text: 'تقدیم‌نامه' },
        { type: 'paragraph', text: 'این متن فقط تقدیم‌نامه است و نباید در خلاصه محتوایی بیاید.' },
      ] },
      { page: 2, sourcePage: 2, blocks: [
        { type: 'heading', text: 'فصل اول: شناخت باورها' },
        { type: 'paragraph', text: 'باورها برداشت‌هایی هستند که بر انتخاب و رفتار انسان اثر می‌گذارند.' },
      ] },
      { page: 3, sourcePage: 3, blocks: [
        { type: 'heading', text: 'فصل دوم: انتخاب آگاهانه' },
        { type: 'paragraph', text: 'انتخاب آگاهانه به بررسی پیامدها و هماهنگی رفتار با هدف کمک می‌کند.' },
      ] },
    ] },
  }];
  const response = answerLibraryBookQuestion({ books: sampleBooks, message: 'خلاصه کتاب اول' });
  assert.match(response, /مرور ساختاری مستند/u);
  assert.match(response, /باورها برداشت‌هایی هستند/u);
  assert.doesNotMatch(response, /این متن فقط تقدیم‌نامه است/u);
});

test('vague references do not trigger generic exercises or plans without a prior cited section', () => {
  for (const question of [
    'در کتاب پنجم با توجه به این بخش چه تمرینی انجام بدهم؟',
    'در کتاب پنجم برای تمرین این موضوع برنامه هفت‌روزه بده',
    'در کتاب پنجم چطور این توصیه را به عادت تبدیل کنم؟',
  ]) {
    const response = answerLibraryBookQuestion({ books, message: question });
    assert.match(response, /عنوان فصل، شماره صفحه یا چند واژه/u);
    assert.doesNotMatch(response, /برنامه هفت‌روزه پیشنهادی دستیار|تمرین کم‌فشار:/u);
  }
});

test('a broad main-concept question gets a grounded plain-language structural overview', () => {
  const response = answerLibraryBookQuestion({ books, message: 'در کتاب پنجم مفهوم اصلی را به زبان ساده توضیح بده' });
  assert.match(response, /هنر شناخت و دگرگونی احساسات/u);
  assert.match(response, /مرور ساده و ساختاری/u);
  assert.match(response, /شناخت جهان احساسات/u);
  assert.doesNotMatch(response, /برداشت ساده و محتاطانه/u);
});

test('topic-specific guidance excludes passages that only match unrelated query terms', () => {
  const sampleBooks = [{
    title: 'کتاب آزمایشی',
    legacyId: 1,
    content: { pages: [
      { page: 1, sourcePage: 1, blocks: [
        { type: 'heading', text: 'اعتمادبه‌نفس و تجربه' },
        { type: 'paragraph', text: 'اعتمادبه‌نفس می‌تواند با تجربه اقدام‌های کوچک و مشاهده توانایی‌های خود تقویت شود.' },
      ] },
      { page: 2, sourcePage: 2, blocks: [
        { type: 'heading', text: 'زیست‌شناسی مغز' },
        { type: 'paragraph', text: 'انتقال‌دهنده عصبی در ارتباط میان سلول‌های عصبی نقش دارد.' },
      ] },
    ] },
  }];
  const response = answerLibraryBookQuestion({
    books: sampleBooks,
    message: 'در کتاب اول برای تقویت اعتمادبه‌نفس چه نکته‌ای وجود دارد؟',
  });
  assert.match(response, /اعتمادبه‌نفس می‌تواند با تجربه اقدام‌های کوچک/u);
  assert.doesNotMatch(response, /انتقال‌دهنده عصبی/u);
});

test('an unspecified exercise cannot receive a generic alternative before its source is known', () => {
  const response = answerLibraryBookQuestion({
    books,
    message: 'در کتاب پنجم اگر نتوانم این تمرین را انجام بدهم چه جایگزینی دارم؟',
  });
  assert.match(response, /هنر شناخت و دگرگونی احساسات/u);
  assert.match(response, /عنوان فصل، شماره صفحه یا چند واژه/u);
  assert.doesNotMatch(response, /جایگزین ساده پیشنهادی دستیار/u);
});
