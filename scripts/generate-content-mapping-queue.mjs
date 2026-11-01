import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const normalize = (value) => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();

export function buildContentMappingQueue({ content, topics, existing = null }) {
  const topicByName = new Map((topics.topics ?? []).map((topic) => [normalize(topic.name), topic]));
  const oldMappings = new Map((existing?.mappings ?? []).map((item) => [item.mapping_id, item]));
  const mappings = [];

  for (const [topicName, category] of Object.entries(content.categories ?? {})) {
    const topic = topicByName.get(normalize(topicName));
    if (!topic) throw new Error(`No exact topic registry match for content category: ${topicName}`);
    if (!Array.isArray(category.days) || category.days.length !== 28) {
      throw new Error(`Expected exactly 28 days for category: ${topicName}`);
    }

    category.days.forEach((day, index) => {
      const dayNumber = index + 1;
      const mappingId = `MAP_${topic.topic_id}_D${String(dayNumber).padStart(2, '0')}`;
      if (!day.id) throw new Error(`Missing content day id: ${mappingId}`);
      const previous = oldMappings.get(mappingId);
      if (previous && previous.content_id !== day.id) {
        throw new Error(`Source content changed for ${mappingId}; manual reconciliation required.`);
      }
      mappings.push(previous ?? {
        mapping_id: mappingId,
        source_topic_id: topic.topic_id,
        source_topic_name: topicName,
        day_number: dayNumber,
        content_id: day.id,
        subtopic_ids: [],
        mapping_status: 'pending_review',
        review: { reviewer_id: null, reviewed_at: null, rationale: null, evidence_ids: [] },
        notes: [],
      });
    });
  }

  if (oldMappings.size > mappings.length) throw new Error('Existing mapping ledger contains records not present in the current course registry.');
  return {
    schema_version: '1.0.0',
    mapping_set_id: 'maseer28-course-content-mappings-v1',
    status: 'draft_review_queue_only',
    runtime_eligible: false,
    source: {
      content_registry: 'public/content/path-content.json',
      topic_registry: 'public/assistant/knowledge/topics.v1.json',
      subtopic_registry: 'public/assistant/knowledge/subtopics.v1.json',
    },
    policy: 'Parent topic is assigned only by exact category-name match. Subtopic assignments require human review.',
    mappings,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputPath = path.join(root, 'public/assistant/mappings/course-content-mappings.v1.json');
  const content = readJson('public/content/path-content.json');
  const topics = readJson('public/assistant/knowledge/topics.v1.json');
  const existing = fs.existsSync(outputPath) ? readJson('public/assistant/mappings/course-content-mappings.v1.json') : null;
  const queue = buildContentMappingQueue({ content, topics, existing });
  fs.writeFileSync(outputPath, `${JSON.stringify(queue, null, 2)}\n`);
  process.stdout.write(`Generated ${queue.mappings.length} review records; subtopic assignments remain empty and runtime_eligible=false.\n`);
}
