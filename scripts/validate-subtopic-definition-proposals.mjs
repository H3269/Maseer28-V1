import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const registry = readJson('public/assistant/knowledge/subtopics.v1.json');
const batch = readJson('public/assistant/knowledge/subtopic-operational-definitions-batch01.v1.json');
const errors = [];
const canonical = new Map((registry.subtopics || []).map((item) => [item.subtopic_id, item]));
const expectedTopics = new Set(['T01', 'T02', 'T03', 'T04', 'T05', 'T06']);
const seen = new Set();

if (batch.status !== 'proposal_only_not_runtime') errors.push('تعریف‌های پیشنهادی باید خارج از runtime باقی بمانند.');
if (batch.coverage?.subtopic_count !== 18 || batch.definitions?.length !== 18) errors.push('بسته اول باید دقیقاً ۱۸ تعریف داشته باشد.');
for (const item of batch.definitions || []) {
  if (seen.has(item.subtopic_id)) errors.push(`شناسه تکراری: ${item.subtopic_id}`);
  seen.add(item.subtopic_id);
  const source = canonical.get(item.subtopic_id);
  if (!source) errors.push(`زیرموضوع ناشناخته: ${item.subtopic_id}`);
  else if (source.topic_id !== item.topic_id || source.name !== item.name) errors.push(`تطبیق شناسه/والد/نام نامعتبر: ${item.subtopic_id}`);
  if (!expectedTopics.has(item.topic_id)) errors.push(`موضوع خارج از بسته اول: ${item.topic_id}`);
  for (const field of ['operational_definition', 'scope_limit', 'discriminating_question', 'overlap_and_differential', 'safety_boundary']) {
    if (typeof item[field] !== 'string' || !item[field].trim()) errors.push(`فیلد ${field} خالی است: ${item.subtopic_id}`);
  }
  if (item.definition_status !== 'proposed_not_canonical') errors.push(`تعریف نباید canonical باشد: ${item.subtopic_id}`);
  if (item.review_status !== 'pending_independent_expert_review') errors.push(`بازبینی مستقل هنوز لازم است: ${item.subtopic_id}`);
  if ((item.evidence_ids || []).length) errors.push(`منبع بدون ممیزی نباید ثبت شود: ${item.subtopic_id}`);
}
if (errors.length) {
  console.error('اعتبارسنجی پیشنهاد تعریف زیرموضوع ناموفق بود:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log('بسته اول معتبر است: ۱۸ تعریف پیشنهادی، تطبیق کامل با رجیستری، خارج از runtime و در انتظار بازبینی مستقل.');
}
