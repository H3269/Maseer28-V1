import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) throw new Error(`فایل پیدا نشد: ${relativePath}`);
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    throw new Error(`JSON نامعتبر در ${relativePath}: ${error.message}`);
  }
};

const fail = [];
const warn = [];
const content = readJson('public/content/path-content.json');
const library = readJson('public/content/library.seed.json');
const categories = Object.entries(content.categories || {});
const expectedCategoryCount = 34;
const expectedDays = 28;
const requiredTextFields = ['title', 'intro', 'exercise', 'actionText', 'closing'];
const allIds = new Set();
const booksById = new Map();

if (categories.length !== expectedCategoryCount) {
  fail.push(`تعداد موضوع‌ها ${categories.length} است؛ انتظار ${expectedCategoryCount} بود.`);
}

for (const book of library.books || []) {
  if (!Number.isInteger(Number(book.legacyId))) {
    fail.push(`legacyId نامعتبر برای کتاب ${book.id || '(بدون شناسه)'}`);
    continue;
  }
  const bookPath = path.posix.join('public', book.file || '');
  const parsedBook = readJson(bookPath);
  booksById.set(Number(book.legacyId), parsedBook);
  if (!Array.isArray(parsedBook.pages) || !Array.isArray(parsedBook.chapters)) {
    fail.push(`ساختار pages/chapters کتاب ${book.legacyId} ناقص است.`);
  }
}

if (library.books?.length !== 5) {
  warn.push(`تعداد کتاب‌های seed برابر ${library.books?.length ?? 0} است؛ فهرست پنج کتاب فعلی باید هنگام تغییر نسخه بازبینی شود.`);
}

let totalDays = 0;
let recommendations = 0;
const topicRows = categories.map(([topic, category]) => ({ topic, category }));

for (const { topic, category } of topicRows) {
  if (!Array.isArray(category.days) || category.days.length !== expectedDays) {
    fail.push(`موضوع «${topic}» باید دقیقاً ${expectedDays} روز داشته باشد.`);
    continue;
  }

  for (let index = 0; index < expectedDays; index += 1) {
    const day = category.days[index];
    totalDays += 1;

    if (Number(day.day) !== index + 1) {
      fail.push(`شماره روز نامرتب در «${topic}»: موقعیت ${index + 1}، مقدار ${day.day}`);
    }
    if (!day.id || allIds.has(day.id)) {
      fail.push(`شناسه روز خالی یا تکراری در «${topic}»، روز ${index + 1}: ${day.id || '(خالی)'}`);
    } else {
      allIds.add(day.id);
    }

    for (const field of requiredTextFields) {
      if (typeof day[field] !== 'string' || !day[field].trim()) {
        fail.push(`فیلد ${field} خالی/نامعتبر در «${topic}»، روز ${index + 1}`);
      }
    }

    const rec = day.legacyBookRec;
    if (rec) {
      recommendations += 1;
      const book = booksById.get(Number(rec.bookId));
      if (!book) {
        fail.push(`کتاب ${rec.bookId} در seed نیست؛ موضوع «${topic}»، روز ${index + 1}`);
      } else {
        if (!Number.isInteger(Number(rec.page)) || Number(rec.page) < 1 || Number(rec.page) > book.pages.length) {
          fail.push(`صفحه نامعتبر برای کتاب ${rec.bookId}؛ موضوع «${topic}»، روز ${index + 1}`);
        }
        if (!Number.isInteger(Number(rec.chapter)) || Number(rec.chapter) < 1 || Number(rec.chapter) > book.chapters.length) {
          fail.push(`فصل نامعتبر برای کتاب ${rec.bookId}؛ موضوع «${topic}»، روز ${index + 1}`);
        }
      }
    }
  }
}

// Similarity is reported as a content-review warning, not a schema failure.
const templateFields = ['exercise', 'actionText', 'lightExerciseText', 'lightActionText', 'progressActionText'];
const normalizeForTopic = (value, topic) => String(value || '')
  .split(`«${topic}»`).join('«[TOPIC]»')
  .split(topic).join('[TOPIC]');

for (const field of templateFields) {
  let sharedDays = 0;
  for (let index = 0; index < expectedDays; index += 1) {
    const normalized = topicRows.map(({ topic, category }) => normalizeForTopic(category.days?.[index]?.[field], topic));
    if (normalized.every(Boolean) && new Set(normalized).size === 1) sharedDays += 1;
  }
  if (sharedDays >= 20) {
    warn.push(`فیلد ${field} در ${sharedDays} روز از ${expectedDays} روز، پس از جایگزینی نام موضوع، بین تمام موضوع‌ها یکسان است؛ بازبینی اختصاصی محتوایی لازم است.`);
  }
}

const families = new Set(
  topicRows.flatMap(({ category }) => category.days.map((day) => day.scientific_family || '(بدون مقدار)'))
);
if (families.size === 1 && families.has('general')) {
  warn.push('scientific_family در تمام روزها فقط مقدار general دارد؛ این برچسب فعلاً برای بازیابی/انتخاب مداخله به اندازه کافی تفکیک‌کننده نیست.');
}

if (fail.length) {
  console.error('اعتبارسنجی محتوای مسیر۲۸ ناموفق بود:');
  for (const item of fail) console.error(`- ${item}`);
  process.exitCode = 1;
} else {
  console.log(`اعتبارسنجی ساختاری موفق: ${categories.length} موضوع، ${totalDays} روز، ${allIds.size} شناسه یکتا، ${recommendations} ارجاع کتاب معتبر.`);
}

if (warn.length) {
  console.warn('\nهشدارهای بازبینی محتوایی (مانع ساخت نیستند):');
  for (const item of warn) console.warn(`- ${item}`);
}
