import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const topicsRegistry = readJson('public/assistant/knowledge/topics.v1.json');
const subtopicsRegistry = readJson('public/assistant/knowledge/subtopics.v1.json');
const relationsRegistry = readJson('public/assistant/knowledge/relations.v1.json');
const relationTypesRegistry = readJson('public/assistant/knowledge/relation-types.v1.json');
const consentPolicy = readJson('public/assistant/privacy/consent-policy.v1.json');
const assessmentProtocol = readJson('public/assistant/assessment/assessment-protocol.v1.json');
const topicDefinitions = readJson('public/assistant/knowledge/topic-definitions-draft.v1.json');
const errors = [];
const expectedIds = Array.from({ length: 34 }, (_, index) => `T${String(index + 1).padStart(2, '0')}`);
const topics = topicsRegistry.topics || [];
const subtopics = subtopicsRegistry.subtopics || [];
const relations = relationsRegistry.relations || [];
const allowedRelationTypes = new Set((relationTypesRegistry.relation_types || []).map((item) => item.id));
const topicIds = new Set(topics.map((item) => item.topic_id));
const subtopicIds = new Set(subtopics.map((item) => item.subtopic_id));
const relationIds = new Set(relations.map((item) => item.relation_id));
const definitionIds = new Set((topicDefinitions.definitions || []).map((item) => item.topic_id));

if (topicsRegistry.registry_id !== 'maseer28-topic-registry') errors.push('شناسه رجیستری موضوعات نامعتبر است.');
if (topicsRegistry.registry_status !== 'draft_requires_expert_review') errors.push('رجیستری موضوعات باید تا بازبینی متخصص draft باقی بماند.');
if (topics.length !== 34) errors.push('رجیستری باید دقیقاً ۳۴ موضوع داشته باشد.');
if (topicDefinitions.definitions?.length !== 34) errors.push('برای هر ۳۴ موضوع باید یک تعریف کاری اولیه وجود داشته باشد.');
if (topicDefinitions.status !== 'draft_requires_expert_review') errors.push('تعریف‌های کاری باید تا بازبینی متخصص در وضعیت draft باقی بمانند.');
if (new Set(topics.map((item) => item.topic_id)).size !== topics.length) errors.push('شناسه موضوع تکراری است.');
if (JSON.stringify(topics.map((item) => item.topic_id)) !== JSON.stringify(expectedIds)) errors.push('شناسه‌ها باید به ترتیب T01 تا T34 باشند.');

for (const id of expectedIds) if (!definitionIds.has(id)) errors.push(`تعریف کاری ${id} وجود ندارد.`);
(topicDefinitions.definitions || []).forEach((item) => {
  if (!topicIds.has(item.topic_id)) errors.push(`تعریف به موضوع نامعتبر ${item.topic_id} متصل است.`);
  if (item.review_status !== 'pending_expert_review' || item.evidence_ids?.length) errors.push(`تعریف ${item.topic_id} نباید بدون منبع و بازبینی تأیید شود.`);
});

topics.forEach((topic, index) => {
  if (typeof topic.name !== 'string' || !topic.name.trim()) errors.push(`نام موضوع ${expectedIds[index]} خالی است.`);
  if (topic.display_order !== index + 1) errors.push(`ترتیب نمایشی ${expectedIds[index]} نامعتبر است.`);
  if (topic.definition_status !== 'pending_expert_review') errors.push(`تعریف موضوع ${expectedIds[index]} نباید پیش از بازبینی متخصص تأیید شود.`);
  for (const field of ['review_flags', 'subtopic_ids', 'relation_ids', 'evidence_ids', 'content_ids', 'intervention_ids', 'safety_rule_ids']) {
    if (!Array.isArray(topic[field])) errors.push(`فیلد ${field} باید آرایه باشد: ${expectedIds[index]}.`);
  }
  for (const id of topic.relation_ids || []) {
    if (!relationIds.has(id)) errors.push(`رابطه ${id} برای موضوع ${topic.topic_id} وجود ندارد.`);
  }
  for (const id of topic.subtopic_ids || []) {
    const sub = subtopics.find((item) => item.subtopic_id === id);
    if (!sub || sub.topic_id !== topic.topic_id) errors.push(`زیرموضوع ${id} به موضوع اشتباه متصل شده است.`);
  }
});

if (subtopicsRegistry.registry_id !== 'maseer28-subtopic-registry') errors.push('شناسه رجیستری زیرموضوع‌ها نامعتبر است.');
if (subtopics.length !== 102) errors.push('نسخه فعلی باید ۱۰۲ زیرموضوع پیشنهادی داشته باشد.');
if (new Set(subtopics.map((item) => item.subtopic_id)).size !== subtopics.length) errors.push('شناسه زیرموضوع تکراری است.');
subtopics.forEach((item) => {
  if (!topicIds.has(item.topic_id)) errors.push(`موضوع والد برای ${item.subtopic_id} وجود ندارد.`);
  if (item.definition_status !== 'pending_expert_review' || item.review_status !== 'draft') errors.push(`زیرموضوع ${item.subtopic_id} نباید تأییدشده تلقی شود.`);
});
for (const topic of topics) {
  const linked = topic.subtopic_ids || [];
  const actual = subtopics.filter((item) => item.topic_id === topic.topic_id).map((item) => item.subtopic_id);
  if (linked.length !== 3 || actual.some((id) => !linked.includes(id))) errors.push(`سه زیرموضوع و پیوند کامل برای ${topic.topic_id} لازم است.`);
}

if (relationsRegistry.status !== 'candidate_only_not_for_runtime') errors.push('رجیستری روابط کاندیدا نباید وارد runtime شود.');
if (new Set(relations.map((item) => item.relation_id)).size !== relations.length) errors.push('شناسه رابطه تکراری است.');
for (const relation of relations) {
  if (!topicIds.has(relation.source_topic_id) || !topicIds.has(relation.target_topic_id)) errors.push(`موضوع نامعتبر در ${relation.relation_id}.`);
  if (relation.source_topic_id === relation.target_topic_id) errors.push(`رابطه خودارجاعی در ${relation.relation_id}.`);
  if (!allowedRelationTypes.has(relation.relation_type)) errors.push(`نوع رابطه ناشناخته در ${relation.relation_id}.`);
  if (relation.status !== 'candidate_unreviewed' || relation.evidence_grade !== 'not_assessed') errors.push(`رابطه ${relation.relation_id} نباید تأییدشده یا درجه‌بندی‌شده باشد.`);
  if (relation.causal_claim !== false || relation.runtime_eligible !== false) errors.push(`رابطه ${relation.relation_id} نباید ادعای علی یا مجوز runtime داشته باشد.`);
}

if (consentPolicy.status !== 'design_only_not_active') errors.push('سیاست رضایت باید به‌عنوان طراحی غیرفعال علامت‌گذاری شود.');
if (assessmentProtocol.status !== 'design_only_requires_clinical_safety_review') errors.push('پروتکل ارزیابی تا بازبینی ایمنی/بالینی باید غیرفعال بماند.');
if (assessmentProtocol.interaction_rules?.one_question_per_turn !== true) errors.push('قاعده یک پرسش در هر نوبت باید فعال باشد.');
if (assessmentProtocol.interaction_rules?.max_active_topic_hypotheses !== 3) errors.push('تعداد فرضیه‌های هم‌زمان باید حداکثر سه باشد.');
if (!assessmentProtocol.prohibited_outputs?.includes('تشخیص اختلال روان‌پزشکی')) errors.push('ممنوعیت تشخیص بالینی باید در پروتکل ثبت شود.');
for (const [purpose, value] of Object.entries(consentPolicy.default_consent || {})) {
  if (value !== false) errors.push(`رضایت پیش‌فرض ${purpose} باید false باشد.`);
}
if (errors.length) {
  console.error('اعتبارسنجی رجیستری دستیار ناموفق بود:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`رجیستری دستیار معتبر است: ۳۴ موضوع، ${subtopics.length} زیرموضوع، ${relations.length} رابطه کاندیدا (غیرفعال در runtime)، ۳۴ تعریف کاری تأییدنشده، پروتکل ارزیابی غیرتشخیصی و رضایت‌های پیش‌فرض خاموش.`);
}
