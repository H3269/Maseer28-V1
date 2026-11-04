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
const dayById = new Map();
const booksById = new Map();
const topicsRegistry = readJson('public/assistant/knowledge/topics.v1.json');
const subtopicsRegistry = readJson('public/assistant/knowledge/subtopics.v1.json');
const evidenceRegistry = readJson('public/assistant/evidence/sources.v1.json');
const topicIdByName = new Map((topicsRegistry.topics || []).map((item) => [item.name, item.topic_id]));
const topicRecordById = new Map((topicsRegistry.topics || []).map((item) => [item.topic_id, item]));
const subtopicRecordById = new Map((subtopicsRegistry.subtopics || []).map((item) => [item.subtopic_id, item]));
const subtopicById = new Map((subtopicsRegistry.subtopics || []).map((item) => [item.subtopic_id, item.topic_id]));
const evidenceSourceIds = new Set((evidenceRegistry.sources || []).map((item) => item.source_id));
const validReviewStatuses = new Set(['draft', 'pending_expert_review', 'approved', 'rejected', 'retired']);
const validEvidenceGrades = new Set(['not_assessed', 'very_low', 'low', 'moderate', 'high']);
const validRiskLevels = new Set(['routine', 'caution', 'human_review_required']);


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
      dayById.set(day.id, { topic, day });
    }

    for (const field of requiredTextFields) {
      if (typeof day[field] !== 'string' || !day[field].trim()) {
        fail.push(`فیلد ${field} خالی/نامعتبر در «${topic}»، روز ${index + 1}`);
      }
    }

    // New or rewritten days opt into the versioned daily-unit contract.
    // Legacy days remain readable until their own reviewed migration.
    if (day.topic_id !== undefined || day.review_status !== undefined) {
      const requiredV2 = [
        'topic_id', 'subtopic_ids', 'learning_objective', 'target_skill',
        'teaching_point', 'exercise_type', 'instructions', 'duration_minutes',
        'reflection_prompt', 'success_criterion', 'stop_conditions',
        'risk_level', 'when_to_seek_human_support', 'source_ids',
        'evidence_grade', 'review_status',
      ];
      for (const field of requiredV2) {
        const value = day[field];
        const present = Array.isArray(value) ? value.length > 0
          : typeof value === 'number' ? Number.isFinite(value)
            : typeof value === 'string' ? Boolean(value.trim())
              : false;
        if (!present) fail.push(`قرارداد روز جدید: فیلد ${field} ناقص در «${topic}»، روز ${index + 1}`);
      }
      const expectedTopicId = topicIdByName.get(topic);
      if (!expectedTopicId || day.topic_id !== expectedTopicId) {
        fail.push(`topic_id روز ${index + 1} در «${topic}» با رجیستری موضوع سازگار نیست.`);
      }
      if (!Array.isArray(day.subtopic_ids) || day.subtopic_ids.some((id) => subtopicById.get(id) !== day.topic_id)) {
        fail.push(`زیرموضوع نامعتبر یا متعلق به موضوع دیگر در «${topic}»، روز ${index + 1}`);
      }
      const approvedForRuntime = day.review_status === 'approved';
      const topicLinkField = approvedForRuntime ? 'content_ids' : 'draft_content_ids';
      const topicRecord = topicRecordById.get(day.topic_id);
      if (!Array.isArray(topicRecord?.[topicLinkField]) || !topicRecord[topicLinkField].includes(day.id)) {
        fail.push(`پیوند دوطرفه topic.${topicLinkField} برای روز ${index + 1} در «${topic}» ناقص است.`);
      }
      for (const subtopicId of day.subtopic_ids || []) {
        const subtopicRecord = subtopicRecordById.get(subtopicId);
        if (!Array.isArray(subtopicRecord?.[topicLinkField]) || !subtopicRecord[topicLinkField].includes(day.id)) {
          fail.push(`پیوند دوطرفه subtopic.${topicLinkField} برای ${subtopicId} و روز ${index + 1} در «${topic}» ناقص است.`);
        }
      }
      if (!Number.isInteger(day.duration_minutes) || day.duration_minutes < 1 || day.duration_minutes > 60) {
        fail.push(`duration_minutes نامعتبر در «${topic}»، روز ${index + 1}`);
      }
      if (!validReviewStatuses.has(day.review_status)) {
        fail.push(`review_status نامعتبر در «${topic}»، روز ${index + 1}`);
      }
      if (!validEvidenceGrades.has(day.evidence_grade)) {
        fail.push(`evidence_grade نامعتبر در «${topic}»، روز ${index + 1}`);
      }
      if (!validRiskLevels.has(day.risk_level)) {
        fail.push(`risk_level نامعتبر در «${topic}»، روز ${index + 1}`);
      }
      if (!Array.isArray(day.source_ids) || day.source_ids.some((id) => !evidenceSourceIds.has(id))) {
        fail.push(`source_ids ناموجود در رجیستری شواهد برای «${topic}»، روز ${index + 1}`);
      }
      if (!Array.isArray(day.stop_conditions) || day.stop_conditions.length === 0
        || !Array.isArray(day.contraindications) || day.contraindications.length === 0) {
        fail.push(`قواعد توقف/موارد احتیاط ناقص در «${topic}»، روز ${index + 1}`);
      }
      if (day.review_status === 'approved') {
        if (day.topic_id === 'T17') {
          if (day.reviewer_role !== 'relationship_safety_reviewer') {
            fail.push(`بازبین محتوای T17 باید متخصص روابط و ایمنی باشد: «${topic}»، روز ${index + 1}`);
          }
          if (!Array.isArray(day.subtopic_ids) || day.subtopic_ids.length !== 1) {
            fail.push(`هر روز T17 باید دقیقاً به یک زیرموضوع نگاشت شود: «${topic}»، روز ${index + 1}`);
          } else if (day.subtopic_ids[0] === 'T17-S03'
            && (day.risk_level !== 'caution'
              || !Array.isArray(day.safety_rule_ids)
              || day.safety_rule_ids.length === 0)) {
            fail.push(`T17-S03 به طبقه‌بندی caution و قاعده ایمنی صریح نیاز دارد: «${topic}»، روز ${index + 1}`);
          }
        }
        if (!day.review_record_id || !day.reviewer_name
          || !['qualified_clinician', 'evidence_reviewer', 'safety_reviewer', 'relationship_safety_reviewer'].includes(day.reviewer_role)
          || !day.reviewed_at || Number.isNaN(Date.parse(day.reviewed_at))) {
          fail.push(`محتوای approved بدون بازبین واجد صلاحیت و رکورد بازبینی در «${topic}»، روز ${index + 1}`);
        }
      } else if (day.review_record_id || day.reviewer_name || day.reviewed_at) {
        fail.push(`محتوای تأییدنشده نباید اطلاعات تأیید انسانی داشته باشد: «${topic}»، روز ${index + 1}`);
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

// Keep draft daily links separate from runtime-approved content links.
for (const topicRecord of topicsRegistry.topics || []) {
  for (const [field, approved] of [['content_ids', true], ['draft_content_ids', false]]) {
    for (const contentId of topicRecord[field] || []) {
      const linked = dayById.get(contentId);
      if (!linked || linked.day.topic_id !== topicRecord.topic_id || (linked.day.review_status === 'approved') !== approved) {
        fail.push(`پیوند ${field} یتیم یا ناسازگار در ${topicRecord.topic_id}: ${contentId}`);
      }
    }
  }
}
for (const subtopicRecord of subtopicsRegistry.subtopics || []) {
  for (const [field, approved] of [['content_ids', true], ['draft_content_ids', false]]) {
    for (const contentId of subtopicRecord[field] || []) {
      const linked = dayById.get(contentId);
      if (!linked || !Array.isArray(linked.day.subtopic_ids) || !linked.day.subtopic_ids.includes(subtopicRecord.subtopic_id)
        || (linked.day.review_status === 'approved') !== approved) {
        fail.push(`پیوند ${field} یتیم یا ناسازگار در ${subtopicRecord.subtopic_id}: ${contentId}`);
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
