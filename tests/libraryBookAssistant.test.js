import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { answerLibraryBookQuestion, answerLibraryBookTurn } from '../src/features/assistant/libraryBookAssistant.js';
import { getLibraryBookProfile } from '../src/features/assistant/libraryBookProfiles.js';
import { analyzeLibraryQuery, formatLocalSynthesis, rankLibraryPassages, synthesizeLibraryEvidence } from '../src/features/assistant/libraryLocalReasoning.js';
import { LIBRARY_ASSISTANT_PROMPT_GROUPS, LIBRARY_ASSISTANT_PROMPTS } from '../src/features/assistant/libraryAssistantPrompts.js';

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
    assert.match(response, /منبع(?: ساختاری)?:/);
    assert.match(response, /صفحه/);
    assert.match(response, /خلاصه راهنمای محتوایی|مرور محتواییِ ساختاری/u);
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
  assert.match(second.message, /شاهدهای خود کتاب|شواهد قابل بازیابی از کتاب/);
  assert.match(second.message, /عصبانیت/);
});

test('a comparison request uses recorded metadata and actual chapter headings', () => {
  const response = answerLibraryBookQuestion({ books, message: 'تفاوت موضوعی این پنج کتاب چیست؟' });
  for (const book of books) assert.ok(response.includes(book.title));
  assert.match(response, /مقایسه ساختاری و موضوعی پنج کتاب/u);
  assert.match(response, /نه تحلیل فصل‌به‌فصل استدلال/u);
  assert.ok((response.match(/شاهد کوتاه متن:/gu) || []).length >= 5, 'each book comparison must include a source excerpt');
  assert.ok((response.match(/منبع:/gu) || []).length >= 5, 'each book comparison must include a source locator');
  assert.doesNotMatch(response, /گزیده متنیِ کافی برای نمایش پیدا نشد/u, 'a curated comparison must not silently cite an empty source excerpt');
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
  assert.match(response, /پیشنهاد مطالعه/);
  assert.match(response, /بر اساس موضوع ثبت‌شده و محتوای بررسی‌شده/);
  assert.match(response, /نه شناخت وضعیت شخصی تو/);
  assert.match(response, /هنر شناخت و دگرگونی احساسات/);
  assert.match(response, /شاهدهای مرتبط از متن کتاب/u);
  assert.match(response, /شاهد کوتاه متن:/u);
  assert.match(response, /منبع:/u);
});


test('beginner recommendations include page evidence for the primary book and alternatives', () => {
  const response = answerLibraryBookQuestion({ books, message: 'اگر تازه می‌خواهم شروع کنم از کدام کتاب شروع کنم؟' });
  assert.match(response, /پیشنهاد روشن برای شروع/u);
  assert.match(response, /شاهدهای مرتبط از متن کتاب/u);
  assert.ok((response.match(/شاهد کوتاه متن:/gu) || []).length >= 2);
  assert.ok((response.match(/منبع:/gu) || []).length >= 2);
  assert.doesNotMatch(response, /گزیده متنیِ کافی برای نمایش پیدا نشد/u, 'recommended books must show usable page evidence');
});

test('profile evidence selection prefers the paragraph semantically related to the curated claim', () => {
  const sampleBook = {
    title: 'از حقیقت تا واقعیت — جلد اول',
    legacyId: 1,
    content: { pages: [{
      page: 9,
      sourcePage: 9,
      blocks: [
        { type: 'paragraph', text: 'این پاراگراف درباره موضوعی عمومی و نامرتبط است و فقط برای آزمودن انتخاب شاهد در صفحه قرار گرفته است. متن باید به اندازه کافی بلند باشد تا بتوان آن را به عنوان یک شاهد احتمالی در نظر گرفت.' },
        { type: 'heading', text: 'حقیقت و واقعیت' },
        { type: 'paragraph', text: 'واقعیت بیرونی با برداشت ذهنی یکی نیست. برای دیدن حقیقت باید رویداد، شواهد و تفسیر شخصی را از هم جدا کنیم؛ برداشت ما ممکن است بر واکنش اثر بگذارد اما خود واقعیت نیست.' },
      ],
    }] },
  };
  const response = answerLibraryBookQuestion({
    books: [sampleBook],
    message: 'برای خودشناسی از کدام کتاب شروع کنم؟',
  });
  assert.match(response, /شاهد کوتاه متن: واقعیت بیرونی با برداشت ذهنی یکی نیست/u);
  assert.match(response, /منبع: حقیقت و واقعیت · صفحه 9/u);
  assert.doesNotMatch(response, /این پاراگراف درباره موضوعی عمومی/u);
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
  assert.match(response, /عنوان فصل، شماره صفحه یا چند (?:کلمه|واژه)/u);
  assert.doesNotMatch(response, /رفتارهای قابل مشاهده/u);
});


test('book-specific introductions use actual metadata and chapter headings', () => {
  const response = answerLibraryBookQuestion({ books, message: 'کتاب اول درباره چه موضوعی است؟' });
  assert.match(response, /رشد فردی و خودشناسی/u);
  assert.match(response, /بخش‌های راهنما/u);
});

test('author-intent questions ask for a precise section instead of guessing', () => {
  const response = answerLibraryBookQuestion({ books, message: 'در کتاب پنجم نویسنده در این بخش دقیقاً چه منظوری دارد؟' });
  assert.match(response, /عنوان فصل، شماره صفحه یا چند (?:کلمه|واژه)/u);
  assert.match(response, /نمی‌خواهم نیت نویسنده را حدس بزنم/u);
  assert.doesNotMatch(response, /نزدیک‌ترین شواهد|منبع:/u);
});

test('concept comparisons choose a reviewed core pair when the user does not name concepts', () => {
  const response = answerLibraryBookQuestion({ books, message: 'در کتاب پنجم دو مفهوم مهم را با هم مقایسه می‌کنی؟' });
  assert.match(response, /احساس/u);
  assert.match(response, /هیجان/u);
  assert.match(response, /مقایسه/u);
  assert.match(response, /منبع:/u);
});

test('a low-pressure alternative asks for the exercise source when no prior section is known', () => {
  const response = answerLibraryBookQuestion({ books, message: 'در کتاب پنجم اگر نتوانم این تمرین را انجام بدهم چه جایگزینی دارم؟' });
  assert.match(response, /عنوان فصل، شماره صفحه یا چند (?:کلمه|واژه)/u);
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
  assert.match(response, /شاهد مستقیم و کافی برای اعتمادبه‌نفس پیدا نکردم/u);
  assert.doesNotMatch(response, /پیشنهاد تکمیلی دستیار/u);
});


test('key-point requests do not fall through to the generic book overview', () => {
  const response = answerLibraryBookQuestion({ books, message: 'در کتاب اول مهم‌ترین نکات کدام‌اند؟' });
  assert.match(response, /نکته‌های کلیدی منتخب/u);
  assert.doesNotMatch(response, /نمای کلی مستند/u);
  assert.match(response, /شاهد کوتاه متن:/u);
});

test('a contextual follow-up searches the new limitation question while retaining the selected topic', () => {
  const sampleBooks = [{
    title: 'کتاب آزمایشی',
    legacyId: 1,
    content: { pages: [
      { page: 1, sourcePage: 1, blocks: [{ type: 'heading', text: 'شناخت خشم' }, { type: 'paragraph', text: 'شناخت نشانه‌های عصبانیت به فرد کمک می‌کند پیش از واکنش مکث کند و محرک، احساس، میل فوری و پاسخ انتخاب‌شده را جداگانه مشاهده کند تا امکان انتخاب آگاهانه‌تری داشته باشد.' }] },
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
      { page: 9, sourcePage: 9, blocks: [
        { type: 'heading', text: 'فصل اول: شناخت باورها' },
        { type: 'paragraph', text: 'باورها برداشت‌هایی هستند که فرد درباره خود و جهان می‌سازد و می‌توانند بر انتخاب‌ها، رفتارهای روزمره و شیوه تفسیر رویدادهای زندگی او اثر بگذارند.' },
      ] },
      { page: 10, sourcePage: 10, blocks: [
        { type: 'heading', text: 'فصل دوم: انتخاب آگاهانه' },
        { type: 'paragraph', text: 'انتخاب آگاهانه یعنی پیش از اقدام، گزینه‌ها و پیامدهای احتمالی را بررسی کنیم و یک قدم کوچک و مشخص متناسب با هدف خود برداریم.' },
      ] },
    ] },
  }];
  const response = answerLibraryBookQuestion({ books: sampleBooks, message: 'خلاصه کتاب آزمایشی' });
  assert.match(response, /خلاصه راهنمای محتوایی|مرور محتواییِ ساختاری/u);
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
    assert.match(response, /عنوان فصل، شماره صفحه یا چند (?:کلمه|واژه)/u);
    assert.doesNotMatch(response, /برنامه هفت‌روزه پیشنهادی دستیار|تمرین کم‌فشار:/u);
  }
});

test('a broad main-concept question gets a grounded plain-language structural overview', () => {
  const response = answerLibraryBookQuestion({ books, message: 'در کتاب پنجم مفهوم اصلی را به زبان ساده توضیح بده' });
  assert.match(response, /هنر شناخت و دگرگونی احساسات/u);
  assert.match(response, /توضیح ساده مفهوم اصلی/u);
  assert.match(response, /پیام ساده کتاب/u);
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
  assert.match(response, /عنوان فصل، شماره صفحه یا چند (?:کلمه|واژه)/u);
  assert.doesNotMatch(response, /جایگزین ساده پیشنهادی دستیار/u);
});


test('follow-up retrieval combines the previous topic with the new user question', () => {
  const sampleBooks = [{
    title: 'کتاب آزمایشی',
    legacyId: 1,
    content: { pages: [
      { page: 1, sourcePage: 1, blocks: [
        { type: 'heading', text: 'شناخت خشم' },
        { type: 'paragraph', text: 'شناخت نشانه‌های عصبانیت به فرد کمک می‌کند پیش از واکنش، مکث کند و محرک را از پاسخ خود جدا سازد.' },
      ] },
      { page: 2, sourcePage: 2, blocks: [
        { type: 'heading', text: 'محدودیت‌های تمرین' },
        { type: 'paragraph', text: 'این تمرین در شرایط خطر فوری یا هنگام شدت بسیار بالای هیجان کافی نیست و باید از حمایت مناسب استفاده کرد.' },
      ] },
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
  assert.match(second.conversationState.lastQuery, /چه محدودیت‌هایی دارد/u);
});

test('topic-specific guidance rejects a short incidental mention as insufficient evidence', () => {
  const sampleBooks = [{
    title: 'کتاب آزمایشی',
    legacyId: 1,
    content: { pages: [
      { page: 1, sourcePage: 1, blocks: [
        { type: 'heading', text: 'برنامه‌ریزی روزانه' },
        { type: 'paragraph', text: 'برنامه‌ریزی روزانه به سامان دادن کارهای معمول کمک می‌کند. در یک مثال کوتاه به عصبانیت اشاره شده است، اما این بخش درباره شناخت یا مدیریت این موضوع نیست و راهکاری در این زمینه ارائه نمی‌کند.' },
      ] },
    ] },
  }];
  const response = answerLibraryBookQuestion({
    books: sampleBooks,
    message: 'در کتاب اول برای مدیریت خشم چه نکته‌ای وجود دارد؟',
  });
  assert.match(response, /شاهد مستقیم و کافی برای خشم و عصبانیت/u);
  assert.doesNotMatch(response, /پیشنهاد عملی دستیار/u);
});

test('book summaries exclude cover and front-matter pages from content evidence', () => {
  const sampleBooks = [{
    title: 'کتاب آزمایشی',
    legacyId: 1,
    content: { pages: [
      { page: 1, sourcePage: 1, blocks: [
        { type: 'paragraph', text: 'عنوان و مشخصات کتاب آزمایشی؛ این متن فقط صفحه روی جلد است و نباید شاهد محتوایی باشد.' },
      ] },
      { page: 2, sourcePage: 2, blocks: [
        { type: 'heading', text: 'پیشگفتار' },
        { type: 'paragraph', text: 'این متن پیشگفتار است و نباید به عنوان محتوای فصل در خلاصه استفاده شود.' },
      ] },
      { page: 9, sourcePage: 9, blocks: [
        { type: 'heading', text: 'فصل اول: شناخت باورها' },
        { type: 'paragraph', text: 'باورها برداشت‌هایی هستند که فرد درباره خود و جهان می‌سازد و می‌توانند بر انتخاب‌ها و رفتارهای روزمره او اثر بگذارند.' },
      ] },
      { page: 10, sourcePage: 10, blocks: [
        { type: 'heading', text: 'فصل دوم: انتخاب آگاهانه' },
        { type: 'paragraph', text: 'انتخاب آگاهانه یعنی پیش از اقدام، گزینه‌ها و پیامدهای احتمالی را بررسی کنیم و یک قدم کوچک متناسب با هدف برداریم.' },
      ] },
    ] },
  }];
  const response = answerLibraryBookQuestion({ books: sampleBooks, message: 'خلاصه کتاب اول' });
  assert.match(response, /فصل اول: شناخت باورها/u);
  assert.match(response, /فصل دوم: انتخاب آگاهانه/u);
  assert.doesNotMatch(response, /صفحه روی جلد/u);
  assert.doesNotMatch(response, /این متن پیشگفتار است/u);
});


test('five-turn book conversation keeps topic, source evidence, and assistant attribution', () => {
  const sampleBooks = [{
    title: 'کتاب احساسات',
    legacyId: 5,
    content: { pages: [
      { page: 20, sourcePage: 20, blocks: [
        { type: 'heading', text: 'چرخه شکل‌گیری احساسات' },
        { type: 'paragraph', text: 'شناخت احساسات با مشاهده موقعیت، تفسیر ذهنی، واکنش بدنی و میل رفتاری آغاز می‌شود. ثبت این چهار بخش کمک می‌کند فرد میان اتفاق و برداشت خود تمایز بگذارد و پیش از واکنش، پاسخ دیگری را انتخاب کند.' },
      ] },
      { page: 21, sourcePage: 21, blocks: [
        { type: 'heading', text: 'تمرین مشاهده احساسات' },
        { type: 'paragraph', text: 'یک موقعیت کم‌تنش را انتخاب کنید و موقعیت، فکر، احساس، نشانه بدنی و رفتار خود را ثبت کنید. این تمرین برای مشاهده است و قرار نیست احساس ناخوشایند را حذف کند.' },
      ] },
      { page: 22, sourcePage: 22, blocks: [
        { type: 'heading', text: 'محدودیت تمرین' },
        { type: 'paragraph', text: 'این تمرین جای ارزیابی تخصصی را نمی‌گیرد و در شرایط خطر فوری یا فشار شدید نباید تنها راه حمایت فرد باشد.' },
      ] },
    ] },
  }];
  const first = answerLibraryBookTurn({ books: sampleBooks, message: 'در کتاب پنجم چرخه شکل‌گیری احساسات چیست؟' });
  const second = answerLibraryBookTurn({ books: sampleBooks, message: 'چه تمرینی برای این موضوع دارم؟', conversationState: first.conversationState });
  const third = answerLibraryBookTurn({ books: sampleBooks, message: 'اگر انجامش برایم سخت بود چه جایگزینی دارم؟', conversationState: second.conversationState });
  const fourth = answerLibraryBookTurn({ books: sampleBooks, message: 'چطور پیشرفتم را بسنجم؟', conversationState: third.conversationState });
  const fifth = answerLibraryBookTurn({ books: sampleBooks, message: 'این توصیه چه محدودیتی دارد؟', conversationState: fourth.conversationState });
  assert.match(first.message, /صفحه 20/u);
  assert.match(second.message, /پیشنهادی دستیار/u);
  assert.match(second.message, /صفحه 21/u);
  assert.match(third.message, /جایگزین ساده پیشنهادی دستیار/u);
  assert.match(fourth.message, /پیشنهاد عمومی دستیار/u);
  assert.match(fifth.message, /محدودیت/u);
  // The fourth turn returns a general progress suggestion because no
  // directly relevant progress evidence was retrieved. It therefore carries
  // no source reference; the fifth turn must ask which recommendation/page
  // is meant rather than inventing page 22 as support for that suggestion.
  assert.match(fifth.message, /لطفاً جمله، عنوان فصل یا صفحه‌ای/u);
  assert.doesNotMatch(fifth.message, /صفحه 22/u);
  assert.equal(fifth.conversationState.bookId, 5);
});


test('five-turn follow-up path stays grounded in each of the five real seeded books', () => {
  const ordinals = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم'];
  for (const book of books) {
    const sourcePage = book.content.pages.find((page) =>
      Number(page.sourcePage || page.page) > 12 &&
      (page.blocks || []).some((block) => block.type !== 'heading' && String(block.text || '').trim().length > 100)
    );
    assert.ok(sourcePage, book.title + ' must contain a substantive source paragraph');
    const sourceBlock = sourcePage.blocks.find((block) =>
      block.type !== 'heading' && String(block.text || '').trim().length > 100
    );
    const queryTerms = String(sourceBlock.text).split(/\s+/u)
      .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
      .filter((word) => word.length >= 4 && !['اگر', 'برای', 'این', 'آنها', 'انسان'].includes(word))
      .slice(0, 5);
    assert.ok(queryTerms.length >= 2, book.title + ' must provide multiple searchable source terms');
    const sourceQuery = queryTerms.join(' ');

    let turn = answerLibraryBookTurn({
      books,
      message: 'در «' + book.title + '» درباره ' + sourceQuery + ' چه نوشته شده؟',
    });
    assert.equal(turn.conversationState.bookId, book.legacyId);
    assert.ok(turn.conversationState.lastSources?.length, book.title + ' first turn must retain source locators');
    assert.match(turn.message, /منبع:/u, book.title + ' first turn must cite a source');

    const followUps = [
      { message: 'این موضوع را به زبان ساده توضیح بده', expected: /شاهدهای خود کتاب|گزیده/u },
      { message: 'برای همین موضوع یک مثال ملموس بزن', expected: /مثال فرضی|پیشنهادی دستیار/u },
      { message: 'اگر انجام این تمرین برایم سخت بود، چه جایگزینی دارم؟', expected: /جایگزین ساده پیشنهادی دستیار/u },
      { message: 'از کجا بفهمم در اجرای این توصیه پیشرفت کرده‌ام؟', expected: /پیشنهاد سنجش دستیار/u },
    ];

    for (const followUp of followUps) {
      turn = answerLibraryBookTurn({
        books,
        message: followUp.message,
        conversationState: turn.conversationState,
      });
      assert.equal(turn.conversationState.bookId, book.legacyId, book.title + ' must remain selected');
      assert.ok(turn.message.includes(book.title), book.title + ' must remain visible in the reply');
      assert.match(turn.message, /منبع:/u, book.title + ' follow-up must preserve cited book evidence');
      assert.ok(turn.conversationState.lastSources?.length, book.title + ' follow-up must preserve source locators');
      assert.match(turn.message, followUp.expected, book.title + ' follow-up must use its requested response mode');
    }
  }
});


test('curated book profile summary and key-point citations resolve to substantive source pages', () => {
  for (const book of books) {
    const profile = getLibraryBookProfile(book);
    assert.ok(profile, book.title + ' must have a reviewed profile');
    for (const [heading, description, pageNumber] of profile.summary) {
      const page = book.content.pages.find((item) => Number(item.sourcePage || item.page) === pageNumber);
      assert.ok(page, book.title + ' summary item "' + heading + '" must cite an existing page');
      const sourceText = (page.blocks || []).map((block) => block.text || '').join(' ').trim();
      assert.ok(sourceText.length >= 90, book.title + ' page ' + pageNumber + ' must contain substantive text');
      assert.ok(description.length >= 30, book.title + ' summary item "' + heading + '" must explain its claim');
    }
    for (const [point, pageNumber] of profile.keyPoints) {
      const page = book.content.pages.find((item) => Number(item.sourcePage || item.page) === pageNumber);
      assert.ok(page, book.title + ' key point "' + point + '" must cite an existing page');
      const sourceText = (page.blocks || []).map((block) => block.text || '').join(' ').trim();
      assert.ok(sourceText.length >= 90, book.title + ' key-point page ' + pageNumber + ' must contain substantive text');
    }
  }
});


test('an unspecified concept comparison selects a grounded core pair for each reviewed book', () => {
  for (const book of books) {
    const profile = getLibraryBookProfile(book);
    assert.ok(profile?.conceptPair?.length === 2, book.title + ' must define two reviewed core concepts');
    const result = answerLibraryBookTurn({
      books,
      message: 'دو مفهوم مهم این کتاب را با هم مقایسه می‌کنی؟',
      conversationState: { bookId: book.legacyId, bookTitle: book.title },
    });
    assert.equal(result.conversationState.bookId, book.legacyId);
    assert.equal(result.conversationState.pendingConceptCompare, false);
    assert.ok(result.message.includes(profile.conceptPair[0]), book.title + ' must name the first selected concept');
    assert.ok(result.message.includes(profile.conceptPair[1]), book.title + ' must name the second selected concept');
    assert.match(result.message, /منبع:/u, book.title + ' comparison must cite book passages');
    assert.match(result.message, /مقایسه/u, book.title + ' must explicitly compare the selected concepts');
  }
});


test('main-theme answers explain the reviewed book thesis rather than only listing metadata', () => {
  for (const book of books) {
    const profile = getLibraryBookProfile(book);
    const response = answerLibraryBookQuestion({
      books,
      message: 'موضوع اصلی کتاب ' + ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم'][book.legacyId - 1] + ' چیست؟',
    });
    assert.ok(profile?.plain && response.includes(profile.plain), book.title + ' must explain its reviewed central thesis');
    assert.match(response, /حوزه‌های اصلی کتاب/u);
    assert.match(response, /بازنویسی دستیار/u);
  }
});


test('book profile and summary responses use real line breaks, never leaked slash-n text', () => {
  for (const book of books) {
    const response = answerLibraryBookQuestion({
      books,
      message: 'خلاصه کتاب ' + ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم'][book.legacyId - 1],
    });
    assert.ok(response.includes('\n'), book.title + ' summary should be readable across lines');
    assert.doesNotMatch(response, /\\n/u, book.title + ' must not leak escaped newline markers');
  }
});


test('curated summaries and key points include short excerpts from their cited source pages', () => {
  for (const book of books) {
    const ordinal = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم'][book.legacyId - 1];
    const summary = answerLibraryBookQuestion({ books, message: 'خلاصه کتاب ' + ordinal });
    const keyPoints = answerLibraryBookQuestion({ books, message: 'مهم‌ترین نکات کتاب ' + ordinal + ' کدام‌اند؟' });
    assert.match(summary, /شاهد کوتاه متن:/u, book.title + ' summary must include a source excerpt');
    assert.match(summary, /منبع:/u, book.title + ' summary must cite its source page');
    assert.match(keyPoints, /شاهد کوتاه متن:/u, book.title + ' key points must include a source excerpt');
    assert.match(keyPoints, /منبع:/u, book.title + ' key points must cite their source pages');
    assert.doesNotMatch(summary, /\\n/u, book.title + ' summary must not leak escaped newline markers');
  }
});


test('book theme and simple explanation include supporting excerpts from the selected book', () => {
  for (const book of books) {
    const ordinal = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم'][book.legacyId - 1];
    const theme = answerLibraryBookQuestion({ books, message: 'موضوع اصلی کتاب ' + ordinal + ' چیست؟' });
    const simple = answerLibraryBookQuestion({ books, message: 'می‌توانی مفهوم اصلی کتاب ' + ordinal + ' را ساده و قابل فهم توضیح بدهی؟' });
    assert.match(theme, /شواهد متنی از کتاب/u, book.title + ' theme must include book evidence');
    assert.match(theme, /منبع:/u, book.title + ' theme must cite source pages');
    assert.match(simple, /شواهد متنی برای این توضیح/u, book.title + ' simple explanation must include book evidence');
    assert.match(simple, /منبع:/u, book.title + ' simple explanation must cite source pages');
  }
});


test('a user can answer a section clarification and continue the original exercise request', () => {
  for (const book of books) {
    const first = answerLibraryBookTurn({
      books,
      message: 'در «' + book.title + '» برای این موضوع یک تمرین عملی بده',
    });
    assert.ok(first.conversationState?.awaitingSection, book.title + ' must request a missing section');
    const second = answerLibraryBookTurn({
      books,
      message: book.legacyId === 4 ? 'پیوست اول' : 'فصل اول',
      conversationState: first.conversationState,
    });
    assert.equal(second.conversationState.bookId, book.legacyId);
    assert.match(second.message, /تمرین|پیشنهاد عملی دستیار/u, book.title + ' must continue the original exercise intent');
    assert.match(second.message, /منبع:/u, book.title + ' must ground the recovered answer in the book');
    assert.doesNotMatch(second.message, /عنوان فصل، شماره صفحه یا چند واژه از همان قسمت را بفرست/u);
  }
});


test('anger guidance refuses weak evidence and uses stronger book-specific passages only', () => {
  const bookThreeResponse = answerLibraryBookQuestion({
    books,
    message: 'در کتاب سوم برای مدیریت خشم چه نکته‌ای وجود دارد؟',
  });
  assert.match(bookThreeResponse, /شاهد مستقیم و کافی برای خشم و عصبانیت پیدا نکردم/u);
  assert.doesNotMatch(bookThreeResponse, /پیشنهاد عملی دستیار/u);

  const bookTwoResponse = answerLibraryBookQuestion({
    books,
    message: 'در کتاب دوم برای مدیریت خشم چه نکته‌ای وجود دارد؟',
  });
  assert.match(bookTwoResponse, /شیوه سالم‌تری برای بیان/u);
  assert.match(bookTwoResponse, /منبع:/u);

  const bookFiveResponse = answerLibraryBookQuestion({
    books,
    message: 'در کتاب پنجم برای مدیریت خشم چه نکته‌ای وجود دارد؟',
  });
  assert.match(bookFiveResponse, /پاسخ جایگزین/u);
  assert.match(bookFiveResponse, /منبع:/u);
});


test('general motivation questions are not misrouted into book recommendations', () => {
  const response = answerLibraryBookTurn({
    books,
    message: 'من چند روز است انگیزه انجام کارهایم را از دست داده‌ام. کمکم کن بفهمم از کجا شروع کنم.',
  });
  assert.equal(response, null, 'a general personal-support request must continue to the stateful page assistant');
});

test('explicit reading-start questions still receive book recommendations', () => {
  const response = answerLibraryBookQuestion({ books, message: 'برای شروع مطالعه از کدام کتاب شروع کنم؟' });
  assert.match(response, /پیشنهاد روشن برای شروع/u);
  assert.match(response, /شاهدهای مرتبط از متن کتاب/u);
});


test('every guided base-mode library prompt returns a grounded supported answer', () => {
  assert.equal(LIBRARY_ASSISTANT_PROMPT_GROUPS.length, 7);
  assert.equal(LIBRARY_ASSISTANT_PROMPTS.length, 44);
  assert.equal(new Set(LIBRARY_ASSISTANT_PROMPTS.map((prompt) => prompt.value)).size, 44, 'guided questions must not be duplicated');
  for (const prompt of LIBRARY_ASSISTANT_PROMPTS) {
    const turn = answerLibraryBookTurn({ books, message: prompt.value });
    assert.ok(turn?.message?.length > 80, 'prompt must receive a substantive response: ' + prompt.value);
    assert.doesNotMatch(turn.message, /نام یکی از کتاب‌ها یا شماره جلد را مشخص کن/u, 'prompt must identify its target book: ' + prompt.value);
    assert.doesNotMatch(turn.message, /متن اشتباهی را به تو نسبت ندهم/u, 'prompt must not fall into a missing-book clarification loop: ' + prompt.value);
  }
});


test('new reader-help prompts explain only controls that exist in the Library reader', () => {
  const toc = answerLibraryBookQuestion({ books, message: 'در کتاب‌خوان چطور فهرست فصل‌ها و صفحه موردنظرم را پیدا کنم؟' });
  assert.match(toc, /فهرست مطالب/u);
  assert.match(toc, /انتخاب عنوان/u);
  const display = answerLibraryBookQuestion({ books, message: 'در کتاب‌خوان چطور اندازه نوشته و زمینه مطالعه را تغییر بدهم؟' });
  assert.match(display, /A\+/u);
  assert.match(display, /A−/u);
  assert.match(display, /تغییر زمینه/u);
  const progress = answerLibraryBookQuestion({ books, message: 'در کتاب‌خوان چطور مطالعه را ادامه بدهم و بین صفحه‌ها جابه‌جا شوم؟' });
  assert.match(progress, /ادامه مطالعه/u);
  assert.match(progress, /پیشرفت مطالعه/u);
});

test('new book-audience prompts return book-specific guidance and source evidence', () => {
  for (const book of books) {
    const ordinal = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم'][book.legacyId - 1];
    const response = answerLibraryBookQuestion({
      books,
      message: 'کتاب ' + ordinal + ' برای چه هدف یا خواننده‌ای مناسب‌تر است؟',
    });
    assert.ok(response.includes(book.title), book.title + ' must be named in its audience guidance');
    assert.match(response, /برای چه هدف و خواننده‌ای مناسب‌تر است/u);
    assert.match(response, /منبع:/u);
    assert.match(response, /بر پایه ساختار و محتوای کتاب/u);
  }
});


test('cross-book guidance explains a practical reading order without asking for a book number', () => {
  const response = answerLibraryBookQuestion({
    books,
    message: 'چطور از کتاب‌ها و کتابچه تمرین در کنار هم استفاده کنم؟',
  });
  assert.match(response, /جلد اول/u);
  assert.match(response, /جلد سوم/u);
  assert.match(response, /کتابچه تکمیلی جلد سوم/u);
  assert.match(response, /جایگزین مطالعه نظری نیست/u);
});

test('a reader stuck in behavior change is directed to the barrier-focused books', () => {
  const response = answerLibraryBookQuestion({
    books,
    message: 'اگر در تغییر رفتارم گیر کرده باشم، از کدام کتاب شروع کنم؟',
  });
  assert.match(response, /پیشنهاد مطالعه/u);
  assert.match(response, /کتاب سوم|جلد سوم/u);
  assert.match(response, /کتابچه تکمیلی جلد سوم/u);
  assert.doesNotMatch(response, /هنر شناخت و دگرگونی احساسات/u);
});


test('local query understanding detects question intent and preserves meaningful Persian focus terms', () => {
  const analysis = analyzeLibraryQuery('چرا تغییر رفتار بعد از شناخت یک باور دشوار است؟');
  assert.equal(analysis.intent, 'why');
  assert.ok(analysis.terms.includes('تغییر'));
  assert.ok(analysis.terms.includes('رفتار'));
  assert.ok(analysis.terms.includes('باور'));
});

test('hybrid local retrieval ranks direct heading and phrase evidence above incidental mentions', () => {
  const passages = [
    { page: 1, heading: 'تغییر عادت و رفتار', text: 'تغییر رفتار با تمرین تدریجی و تکرار آگاهانه آسان‌تر می‌شود.' },
    { page: 2, heading: 'خاطرات روزمره', text: 'در این بخش از یک رفتار روزانه و تجربه‌های عمومی زندگی نام برده می‌شود.' },
    { page: 3, heading: 'آشنایی با کتاب', text: 'این متن درباره موضوع‌های گوناگون است و ارتباط مستقیمی با پرسش ندارد.' },
  ];
  const ranked = rankLibraryPassages(passages, 'چگونه تغییر رفتار را پایدار کنم؟', 3);
  assert.equal(ranked[0].page, 1);
  assert.ok(ranked[0].score > ranked[1].score);
});

test('related but distinct concepts do not displace direct evidence', () => {
  const passages = [
    { page: 1, heading: 'اعتماد به نفس', text: 'اعتمادبه‌نفس به باور فرد درباره توانایی انجام یک کار مشخص مربوط است.' },
    { page: 2, heading: 'عزت نفس', text: 'عزت نفس به احساس ارزشمندی و احترام فرد نسبت به خود اشاره دارد.' },
  ];
  const ranked = rankLibraryPassages(passages, 'اعتماد به نفس', 5);
  assert.deepEqual(ranked.map((item) => item.page), [1]);
  const selfEsteem = rankLibraryPassages(passages, 'عزت نفس', 5);
  assert.deepEqual(selfEsteem.map((item) => item.page), [2]);
});

test('related-only passages never become direct answers without matching source evidence', () => {
  const fearOnly = [
    { page: 3, heading: 'ترس', text: 'ترس می‌تواند واکنشی به خطر ادراک‌شده باشد و با نشانه‌های بدنی همراه شود.' },
  ];
  assert.deepEqual(rankLibraryPassages(fearOnly, 'اضطراب', 5), []);
  // Generic task words must not turn a related concept into direct evidence.
  const fearWithGenericTaskWords = [
    { page: 7, heading: 'مدیریت ترس', text: 'برای مدیریت ترس می‌توان نشانه‌های بدنی را مشاهده کرد و تمرین مکث را انجام داد.' },
  ];
  assert.deepEqual(rankLibraryPassages(fearWithGenericTaskWords, 'برای مدیریت اضطراب چه تمرینی انجام دهم؟', 5), []);
  assert.deepEqual(rankLibraryPassages(fearWithGenericTaskWords, 'اضطراب و ترس را چگونه مدیریت کنم؟', 5), []);

  const selfEsteemOnly = [
    { page: 4, heading: 'عزت نفس', text: 'عزت نفس به احساس ارزشمندی و احترام فرد نسبت به خود اشاره دارد.' },
  ];
  const selfEsteemOnlyRanked = rankLibraryPassages(selfEsteemOnly, 'اعتماد به نفس', 5);
  assert.deepEqual(selfEsteemOnlyRanked, []);
  const selfEsteemWithGenericTaskWords = [
    { page: 8, heading: 'تمرین عزت نفس', text: 'تمرین تقویت عزت نفس می‌تواند با ثبت توانایی‌ها و احترام به خود همراه باشد.' },
  ];
  assert.deepEqual(rankLibraryPassages(selfEsteemWithGenericTaskWords, 'برای تقویت اعتماد به نفس چه تمرینی پیشنهاد می‌شود؟', 5), []);
  assert.equal(formatLocalSynthesis('کتاب آزمایشی', 'اعتماد به نفس', selfEsteemOnlyRanked), null);

  const emotionOnly = [
    { page: 5, heading: 'هیجان', text: 'هیجان می‌تواند با تغییرهای بدنی و رفتاری همراه باشد و شدت‌های متفاوتی داشته باشد.' },
  ];
  assert.deepEqual(rankLibraryPassages(emotionOnly, 'احساس', 5), []);

  const interactionOnly = [
    { page: 6, heading: 'تعامل', text: 'تعامل میان افراد از راه پاسخ متقابل و رفتارهای قابل مشاهده شکل می‌گیرد.' },
  ];
  assert.deepEqual(rankLibraryPassages(interactionOnly, 'رابطه', 5), []);
});

test('why questions synthesize relevant causal sentences without inventing a cloud-generated answer', () => {
  const passages = [
    { page: 12, heading: 'چرا تغییر دشوار است', text: 'تغییر رفتار دشوار می‌شود زیرا عادت‌های قدیمی در کوتاه‌مدت انرژی کمتری می‌گیرند. تجربه تازه با تمرین و تکرار به‌تدریج تقویت می‌شود.' },
    { page: 20, heading: 'انتخاب آگاهانه', text: 'برای انتخاب تازه باید موقعیت را مشاهده کرد و پیامدهای احتمالی را سنجید.' },
  ];
  const synthesis = synthesizeLibraryEvidence(passages, 'چرا تغییر رفتار دشوار است؟');
  assert.equal(synthesis.intent, 'why');
  assert.ok(synthesis.sentences.some((item) => item.sentence.includes('زیرا عادت‌های قدیمی')));
  const response = answerLibraryBookQuestion({
    books: [{ title: 'کتاب آزمایشی', legacyId: 1, content: { pages: passages.map((item) => ({ page: item.page, sourcePage: item.page, blocks: [{ type: 'heading', text: item.heading }, { type: 'paragraph', text: item.text }] })) } }],
    message: 'چرا در کتاب اول تغییر رفتار دشوار است؟',
  });
  assert.match(response, /پاسخ مستند به چرایی پرسش/u);
  assert.match(response, /زیرا عادت‌های قدیمی/u);
  assert.match(response, /منبع:.*صفحه 12/u);
  assert.match(response, /بدون اتصال ابری/u);
});

test('the local reasoning module contains no network or cloud transport dependency', async () => {
  const source = await readFile(new URL('../src/features/assistant/libraryLocalReasoning.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\//u);
});


test('five-book comparison uses book-specific concept distinctions and only available page evidence', () => {
  const response = answerLibraryBookQuestion({ books, message: 'تفاوت موضوعی این پنج کتاب چیست؟' });
  for (const book of books) assert.ok(response.includes(book.title));
  assert.match(response, /نمونه تمایز مفهومی/u);
  assert.match(response, /شاهدهای صفحه‌ای برای دو مفهوم|شاهد صفحه‌ای کافی پیدا نشد/u);
  assert.match(response, /کتابچه چهارم ابزار اجرایی مکمل جلد سوم/u);
  assert.match(response, /نه رتبه‌بندی علمی/u);
});

test('ambiguous author wording never becomes a fabricated section reference', () => {
  const response = answerLibraryBookQuestion({ books, message: 'در کتاب پنجم این بخش دقیقاً چه می‌گوید؟' });
  assert.match(response, /عنوان فصل، شماره صفحه یا چند (?:کلمه|واژه)/u);
  assert.doesNotMatch(response, /منبع:/u);
});
