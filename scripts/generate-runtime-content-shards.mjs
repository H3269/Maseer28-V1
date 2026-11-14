import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\\n`, 'utf8');
};

export function buildRuntimeContentArtifacts({ content, overrides, topicsRegistry }) {
  if (!content?.categories || !overrides?.categories || !Array.isArray(topicsRegistry?.topics)) {
    throw new Error('Runtime content generation requires canonical content, overlays, and topic registry.');
  }

  const topicByName = new Map(topicsRegistry.topics.map((topic) => [topic.name, topic]));
  const categoryEntries = Object.entries(content.categories);
  if (categoryEntries.length !== 34 || topicsRegistry.topics.length !== 34) {
    throw new Error(`Expected exactly 34 categories and topic records; found ${categoryEntries.length} and ${topicsRegistry.topics.length}.`);
  }

  const topics = [];
  const topicFiles = new Map();
  const overrideFiles = new Map();
  const seenIds = new Set();

  for (const [key, category] of categoryEntries) {
    const topic = topicByName.get(key);
    if (!topic?.topic_id || !/^[A-Z0-9]+$/.test(topic.topic_id)) {
      throw new Error(`Missing or invalid topic registry mapping for category: ${key}`);
    }
    if (!Array.isArray(category?.days) || category.days.length !== 28) {
      throw new Error(`Category ${key} must contain exactly 28 days.`);
    }
    for (let index = 0; index < category.days.length; index += 1) {
      const day = category.days[index];
      if (Number(day?.day) !== index + 1 || typeof day?.id !== 'string' || !day.id.trim() || seenIds.has(day.id)) {
        throw new Error(`Invalid sequence or duplicate/missing day ID in ${key}, day ${index + 1}.`);
      }
      seenIds.add(day.id);
    }

    const basePath = `topics/${topic.topic_id}.json`;
    const overridePath = `overrides/${topic.topic_id}.json`;
    const overlayCategory = overrides.categories[key];
    if (!Array.isArray(overlayCategory?.days) || overlayCategory.days.length !== 28) {
      throw new Error(`Overlay category ${key} must contain exactly 28 days.`);
    }
    topics.push({ topic_id: topic.topic_id, key, name: topic.name, basePath, overridePath });
    topicFiles.set(basePath, category);
    overrideFiles.set(overridePath, overlayCategory);
  }

  for (const topic of topicsRegistry.topics) {
    if (!content.categories[topic.name]) {
      throw new Error(`Topic registry category is missing from canonical content: ${topic.name}`);
    }
  }

  const metadata = Object.fromEntries(
    Object.entries(content).filter(([key]) => key !== 'categories'),
  );
  const index = {
    schema_version: '1.0.0',
    content_version: String(content.version || 'legacy'),
    metadata,
    topics,
  };

  return { index, topicFiles, overrideFiles };
}

export function writeRuntimeContentArtifacts(artifacts, outputDirectory = path.join(root, 'public/content/runtime-v1')) {
  writeJson(path.join(outputDirectory, 'index.json'), artifacts.index);
  for (const [relativePath, category] of artifacts.topicFiles) {
    writeJson(path.join(outputDirectory, relativePath), category);
  }
  for (const [relativePath, category] of artifacts.overrideFiles) {
    writeJson(path.join(outputDirectory, relativePath), category);
  }
  return {
    topics: artifacts.topicFiles.size,
    overlays: artifacts.overrideFiles.size,
    outputDirectory,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const artifacts = buildRuntimeContentArtifacts({
    content: readJson('public/content/path-content.json'),
    overrides: readJson('public/content/daily-text-overrides.v1.json'),
    topicsRegistry: readJson('public/assistant/knowledge/topics.v1.json'),
  });
  const result = writeRuntimeContentArtifacts(artifacts);
  process.stdout.write(`Generated index and ${result.topics} topic shards plus ${result.overlays} overlay shards in ${result.outputDirectory}.\\n`);
}
