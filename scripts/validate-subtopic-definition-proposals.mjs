import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const registry = readJson('public/assistant/knowledge/subtopics.v1.json');
const canonical = new Map((registry.subtopics || []).map((item) => [item.subtopic_id, item]));
const batches = [
  { file: 'public/assistant/knowledge/subtopic-operational-definitions-batch01.v1.json', topics: new Set(['T01','T02','T03','T04','T05','T06']), count: 18 },
  { file: 'public/assistant/knowledge/subtopic-operational-definitions-batch02.v1.json', topics: new Set(['T07','T08','T09','T10','T11','T12']), count: 18 },
  { file: 'public/assistant/knowledge/subtopic-operational-definitions-batch03.v1.json', topics: new Set(['T13','T14','T15','T16','T17','T18']), count: 18 },
  { file: 'public/assistant/knowledge/subtopic-operational-definitions-batch04.v1.json', topics: new Set(['T19','T20','T21','T22','T23','T24']), count: 18 },
  { file: 'public/assistant/knowledge/subtopic-operational-definitions-batch05.v1.json', topics: new Set(['T25','T26','T27','T28','T29','T30']), count: 18 }
];
const errors = [];
const allSeen = new Set();

for (const batchSpec of batches) {
  const batch = readJson(batchSpec.file);
  const label = batch.batch_id || batchSpec.file;
  if (batch.status !== 'proposal_only_not_runtime') errors.push(`${label}: بسته باید خارج از runtime باقی بماند.`);
  if (batch.coverage?.subtopic_count !== batchSpec.count || batch.definitions?.length !== batchSpec.count) errors.push(`${label}: تعداد تعریف‌ها باید دقیقاً ${batchSpec.count} باشد.`);
  if (JSON.stringify([...(batch.coverage?.topic_ids || [])].sort()) !== JSON.stringify([...batchSpec.topics].sort())) errors.push(`${label}: فهرست موضوع‌های پوشش‌داده‌شده نادرست است.`);
  const batchSeen = new Set();
  for (const item of batch.definitions || []) {
    if (batchSeen.has(item.subtopic_id) || allSeen.has(item.subtopic_id)) errors.push(`${label}: شناسه تکراری: ${item.subtopic_id}`);
    batchSeen.add(item.subtopic_id);
    allSeen.add(item.subtopic_id);
    const source = canonical.get(item.subtopic_id);
    if (!source) errors.push(`${label}: زیرموضوع ناشناخته: ${item.subtopic_id}`);
    else if (source.topic_id !== item.topic_id || source.name !== item.name) errors.push(`${label}: تطبیق شناسه/والد/نام نامعتبر: ${item.subtopic_id}`);
    if (!batchSpec.topics.has(item.topic_id)) errors.push(`${label}: موضوع خارج از محدوده بسته: ${item.topic_id}`);
    for (const field of ['operational_definition', 'scope_limit', 'discriminating_question', 'overlap_and_differential', 'safety_boundary']) {
      if (typeof item[field] !== 'string' || !item[field].trim()) errors.push(`${label}: فیلد ${field} خالی است: ${item.subtopic_id}`);
    }
    if (item.definition_status !== 'proposed_not_canonical') errors.push(`${label}: تعریف نباید canonical باشد: ${item.subtopic_id}`);
    if (item.review_status !== 'pending_independent_expert_review') errors.push(`${label}: بازبینی مستقل هنوز لازم است: ${item.subtopic_id}`);
    if (!Array.isArray(item.evidence_ids) || item.evidence_ids.length) errors.push(`${label}: evidence_ids باید آرایه خالی بماند تا منابع ممیزی شوند: ${item.subtopic_id}`);
  }
}
if (allSeen.size !== 90) errors.push(`مجموع شناسه‌های یکتا باید ۹۰ باشد؛ مقدار فعلی: ${allSeen.size}`);
if (errors.length) {
  console.error('اعتبارسنجی پیشنهاد تعریف زیرموضوع ناموفق بود:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log('پنج بسته معتبرند: ۹۰ تعریف پیشنهادی برای T01 تا T30، تطبیق با رجیستری، شناسه‌های یکتا، خارج از runtime و در انتظار بازبینی مستقل.');
}
