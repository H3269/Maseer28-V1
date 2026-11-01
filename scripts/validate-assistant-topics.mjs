import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'public/assistant/knowledge/topics.v1.json');
const registry = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [];
const expectedIds = Array.from({ length: 34 }, (_, index) => `T${String(index + 1).padStart(2, '0')}`);
const topics = registry.topics;

if (registry.registry_id !== 'maseer28-topic-registry') errors.push('شناسه رجیستری نامعتبر است.');
if (registry.registry_status !== 'draft_requires_expert_review') errors.push('وضعیت رجیستری باید تا بازبینی متخصص draft باقی بماند.');
if (!Array.isArray(topics) || topics.length !== 34) errors.push('رجیستری باید دقیقاً ۳۴ موضوع داشته باشد.');

if (Array.isArray(topics)) {
  const ids = topics.map((topic) => topic.topic_id);
  if (new Set(ids).size !== ids.length) errors.push('شناسه موضوع تکراری است.');
  if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) errors.push('شناسه‌ها باید به ترتیب T01 تا T34 باشند.');

  topics.forEach((topic, index) => {
    if (typeof topic.name !== 'string' || !topic.name.trim()) errors.push(`نام موضوع ${expectedIds[index]} خالی است.`);
    if (topic.display_order !== index + 1) errors.push(`ترتیب نمایشی ${expectedIds[index]} نامعتبر است.`);
    if (!['draft', 'reviewed', 'approved', 'retired'].includes(topic.review_status)) errors.push(`review_status نامعتبر برای ${expectedIds[index]}.`);
    if (topic.definition_status === 'approved' && (!topic.definition || !String(topic.definition).trim())) {
      errors.push(`تعریف تأییدشده برای ${expectedIds[index]} وجود ندارد.`);
    }
    for (const field of ['review_flags', 'subtopic_ids', 'relation_ids', 'evidence_ids', 'content_ids', 'intervention_ids', 'safety_rule_ids']) {
      if (!Array.isArray(topic[field])) errors.push(`فیلد ${field} باید آرایه باشد: ${expectedIds[index]}.`);
    }
  });
}

if (errors.length) {
  console.error('اعتبارسنجی رجیستری موضوعات ناموفق بود:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log('اعتبارسنجی رجیستری موفق: ۳۴ شناسه یکتا از T01 تا T34؛ همه تعریف‌ها تا بازبینی متخصص تأییدنشده باقی مانده‌اند.');
}
