import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildRuntimeContentArtifacts } from '../scripts/generate-runtime-content-shards.mjs';
import { mergeDailyTextOverrides } from '../src/features/content/dailyTextOverrides.js';

const readJson = async (relativePath) => JSON.parse(await readFile(new URL(relativePath, import.meta.url), 'utf8'));

test('runtime topic shards preserve the complete merged canonical content for all 34 topics and 952 days', async () => {
  const [content, overrides, topicsRegistry] = await Promise.all([
    readJson('../public/content/path-content.json'),
    readJson('../public/content/daily-text-overrides.v1.json'),
    readJson('../public/assistant/knowledge/topics.v1.json'),
  ]);
  const artifacts = buildRuntimeContentArtifacts({ content, overrides, topicsRegistry });
  const mergedCanonical = mergeDailyTextOverrides(content, overrides);

  assert.equal(artifacts.topicFiles.size, 34);
  assert.equal(artifacts.overrideFiles.size, 34);
  assert.equal(artifacts.index.topics.length, 34);
  assert.equal(Object.hasOwn(artifacts.index, 'categories'), false);
  assert.deepEqual(artifacts.index.metadata, Object.fromEntries(
    Object.entries(content).filter(([key]) => key !== 'categories'),
  ));

  let totalDays = 0;
  const allIds = new Set();
  for (const topic of artifacts.index.topics) {
    const baseCategory = artifacts.topicFiles.get(topic.basePath);
    const overlayCategory = artifacts.overrideFiles.get(topic.overridePath);
    assert.ok(baseCategory, topic.topic_id + ' base shard');
    assert.ok(overlayCategory, topic.topic_id + ' overlay shard');
    assert.equal(baseCategory.days.length, 28, topic.topic_id + ' base day count');
    assert.equal(overlayCategory.days.length, 28, topic.topic_id + ' overlay day count');

    const mergedShard = mergeDailyTextOverrides(
      { categories: { [topic.key]: baseCategory } },
      { categories: { [topic.key]: overlayCategory } },
    );
    assert.deepEqual(
      mergedShard.categories[topic.key],
      mergedCanonical.categories[topic.key],
      topic.topic_id + ' merged shard must exactly match canonical merge',
    );

    for (const day of baseCategory.days) {
      assert.equal(allIds.has(day.id), false, 'unique canonical day id: ' + day.id);
      allIds.add(day.id);
      totalDays += 1;
    }
  }
  assert.equal(totalDays, 952);
  assert.equal(allIds.size, 952);
});
