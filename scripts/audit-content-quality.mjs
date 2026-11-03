import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const content = readJson('public/content/path-content.json');
const topicsRegistry = readJson('public/assistant/knowledge/topics.v1.json');
const subtopicsRegistry = readJson('public/assistant/knowledge/subtopics.v1.json');
const definitionsRegistry = readJson('public/assistant/knowledge/topic-definitions-draft.v1.json');

const categories = Object.entries(content.categories || {});
const topicNames = new Map((topicsRegistry.topics || []).map((topic) => [topic.topic_id, topic.name]));
const topicDefinitions = new Map((definitionsRegistry.definitions || []).map((item) => [item.topic_id, item]));
const subtopicsByTopic = new Map();
for (const item of subtopicsRegistry.subtopics || []) {
  if (!subtopicsByTopic.has(item.topic_id)) subtopicsByTopic.set(item.topic_id, []);
  subtopicsByTopic.get(item.topic_id).push(item.subtopic_id);
}

const expectedTopics = 34;
const expectedDays = 28;
const expectedTotalDays = expectedTopics * expectedDays;
const templateFields = [
  'title',
  'intro',
  'exercise',
  'actionText',
  'closing',
  'lightExerciseText',
  'lightActionText',
  'progressActionText',
];
const futureMetadataFields = [
  'learning_objective',
  'target_skill',
  'subtopic_ids',
  'mechanism',
  'exercise_type',
  'duration_minutes',
  'contraindications',
  'stop_conditions',
  'source_ids',
  'evidence_grade',
  'review_status',
  'review_record_id',
];

function normalizeText(value, topicName) {
  let text = String(value ?? '').normalize('NFKC');
  if (topicName) {
    text = text.split(`«${topicName}»`).join('«[TOPIC]»');
    text = text.split(topicName).join('[TOPIC]');
  }
  return text
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u200c\u200f\u202a-\u202e]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueCount(values) {
  return new Set(values.filter((value) => value !== '')).size;
}

const topicRows = categories.map(([categoryKey, category], index) => {
  const registryTopic = (topicsRegistry.topics || []).find((item) => item.name === categoryKey);
  const topicId = registryTopic?.topic_id || `UNMAPPED-${index + 1}`;
  const topicName = topicNames.get(topicId) || categoryKey;
  const days = Array.isArray(category.days) ? category.days : [];
  const fieldStats = {};
  for (const field of templateFields) {
    const values = days.map((day) => normalizeText(day[field], topicName));
    fieldStats[field] = {
      populated_days: values.filter(Boolean).length,
      unique_values_within_topic: uniqueCount(values),
      repeated_value_days: values.length - uniqueCount(values),
    };
  }
  const metadataCoverage = {};
  for (const field of futureMetadataFields) {
    metadataCoverage[field] = days.filter((day) => {
      const value = day[field];
      return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '';
    }).length;
  }
  const familyCounts = {};
  for (const day of days) {
    const family = String(day.scientific_family || '(missing)');
    familyCounts[family] = (familyCounts[family] || 0) + 1;
  }
  return {
    category_key: categoryKey,
    topic_id: topicId,
    topic_name: topicName,
    day_count: days.length,
    expected_subtopic_ids: subtopicsByTopic.get(topicId) || [],
    working_definition_present: Boolean(topicDefinitions.get(topicId)?.working_definition),
    scope_limit_present: Boolean(topicDefinitions.get(topicId)?.scope_limit),
    field_stats: fieldStats,
    future_metadata_coverage: metadataCoverage,
    scientific_family_counts: familyCounts,
  };
});

const crossTopicSimilarity = {};
for (const field of templateFields) {
  let fullySharedDays = 0;
  let majoritySharedDays = 0;
  const distinctByDay = [];
  const largestClusterByDay = [];
  const largestClusterTopicIdsByDay = [];
  for (let dayIndex = 0; dayIndex < expectedDays; dayIndex += 1) {
    const groups = new Map();
    const values = topicRows.map((row) => {
      const category = content.categories?.[row.category_key];
      const normalized = normalizeText(category?.days?.[dayIndex]?.[field], row.topic_name);
      if (normalized) {
        if (!groups.has(normalized)) groups.set(normalized, []);
        groups.get(normalized).push(row.topic_id);
      }
      return normalized;
    });
    const distinct = uniqueCount(values);
    const largestGroup = [...groups.values()].sort((left, right) => right.length - left.length)[0] || [];
    distinctByDay.push(distinct);
    largestClusterByDay.push(largestGroup.length);
    largestClusterTopicIdsByDay.push(largestGroup);
    if (values.length === expectedTopics && values.every(Boolean) && distinct === 1) fullySharedDays += 1;
    if (largestGroup.length >= Math.ceil(expectedTopics / 2)) majoritySharedDays += 1;
  }
  crossTopicSimilarity[field] = {
    fully_shared_days_across_all_topics: fullySharedDays,
    days_with_majority_shared_template: majoritySharedDays,
    largest_shared_topic_count_by_day: largestClusterByDay,
    largest_shared_topic_ids_by_day: largestClusterTopicIdsByDay,
    expected_days: expectedDays,
    distinct_topic_variants_by_day: distinctByDay,
  };
}

const allDays = categories.flatMap(([, category]) => Array.isArray(category.days) ? category.days : []);
const familyDistribution = {};
for (const day of allDays) {
  const family = String(day.scientific_family || '(missing)');
  familyDistribution[family] = (familyDistribution[family] || 0) + 1;
}
const metadataCoverage = {};
for (const field of futureMetadataFields) {
  metadataCoverage[field] = allDays.filter((day) => {
    const value = day[field];
    return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '';
  }).length;
}

const candidateSupportSeekingReviewQueue = topicRows.flatMap((row) => {
  // T02 day 24 explicitly drafts a message to a trusted person and needs the
  // same privacy/device-monitoring review as the common support-seeking days.
  const reviewDays = [...new Set([12, 18, ...(row.topic_id === 'T02' ? [24] : [])])];
  return reviewDays.map((dayNumber) => {
  const category = content.categories?.[row.category_key];
  const day = category?.days?.find((item) => Number(item.day) === dayNumber);
  if (!day) return null;
  return {
    topic_id: row.topic_id,
    topic_name: row.topic_name,
    day: dayNumber,
    content_id: day.id || null,
    is_legacy_record: day.topic_id === undefined && day.review_status === undefined,
    review_status: day.review_status ?? null,
    risk_level: day.risk_level ?? null,
    title: day.title || '',
    exercise: day.exercise || '',
    action: day.actionText || '',
    light_exercise: day.lightExerciseText || '',
    light_action: day.lightActionText || '',
    progress_action: day.progressActionText || '',
    closing: day.closing || '',
    stop_conditions: day.stop_conditions || [],
    contraindications: day.contraindications || [],
    when_to_seek_human_support: day.when_to_seek_human_support || '',
    source_ids: day.source_ids || [],
  };
  }).filter(Boolean);
});

const report = {
  report_schema_version: '1.0.0',
  audit_id: 'maseer28-daily-content-quality-audit',
  status: 'static_content_audit_not_expert_or_clinical_validation',
  content_version: content.version || content.content_version || null,
  generated_at: new Date().toISOString(),
  expected: { topics: expectedTopics, days_per_topic: expectedDays, total_days: expectedTotalDays },
  observed: {
    topics: categories.length,
    total_days: allDays.length,
    topic_registry_entries: (topicsRegistry.topics || []).length,
    subtopic_registry_entries: (subtopicsRegistry.subtopics || []).length,
    topic_definitions: (definitionsRegistry.definitions || []).length,
  },
  topic_rows: topicRows,
  candidate_support_seeking_review_queue: candidateSupportSeekingReviewQueue,
  cross_topic_similarity: crossTopicSimilarity,
  scientific_family_distribution: familyDistribution,
  future_metadata_coverage: metadataCoverage,
  interpretation: [
    'Similarity is a review signal, not proof that an exercise is ineffective.',
    'Structural validity does not establish clinical validity, safety, efficacy, originality, or suitability.',
    'Draft topic definitions and subtopics must not be presented as expert-approved knowledge.',
    'Candidate topic relations are not causal evidence and are not eligible for runtime use.',
    'Future content metadata requirements are a design target; existing days are not silently upgraded to approved status.',
  ],
};

const outputDir = path.join(root, 'reports', 'generated');
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, 'path28-content-quality-audit.json');
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(`ممیزی ایستای محتوا: ${report.observed.topics} موضوع، ${report.observed.total_days} روز، ${report.observed.subtopic_registry_entries} زیرموضوع.`);
for (const [field, stats] of Object.entries(crossTopicSimilarity)) {
  const largest = Math.max(...stats.largest_shared_topic_count_by_day);
  console.log(`- ${field}: ${stats.fully_shared_days_across_all_topics}/${expectedDays} روز کاملاً مشترک؛ بیشترین خوشه تکراری ${largest}/${expectedTopics} موضوع.`);
}
console.log(`گزارش ماشین‌خوان: ${path.relative(root, outputPath)}`);
