import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildRuntimeContentArtifacts } from '../../../scripts/generate-runtime-content-shards.mjs';
import { mergeDailyTextOverrides } from './dailyTextOverrides.js';
import { createRuntimeContentRepository } from './runtimeContentRepository.js';

const readJson = async (relativePath) => JSON.parse(await readFile(new URL(relativePath, import.meta.url), 'utf8'));

async function makeFixture() {
  const [content, overrides, topicsRegistry] = await Promise.all([
    readJson('../../../public/content/path-content.json'),
    readJson('../../../public/content/daily-text-overrides.v1.json'),
    readJson('../../../public/assistant/knowledge/topics.v1.json'),
  ]);
  return { content, overrides, artifacts: buildRuntimeContentArtifacts({ content, overrides, topicsRegistry }) };
}

function makeFetch(files, calls = []) {
  return async (url, options) => {
    const path = String(url).split('/content/runtime-v1/')[1];
    calls.push({ path, options });
    if (!files.has(path)) return { ok: false, status: 404, json: async () => null };
    const value = files.get(path);
    return { ok: true, status: 200, json: async () => structuredClone(value) };
  };
}

function toFiles(artifacts) {
  const files = new Map([['index.json', artifacts.index]]);
  for (const [path, value] of artifacts.topicFiles) files.set(path, value);
  for (const [path, value] of artifacts.overrideFiles) files.set(path, value);
  return files;
}

test('runtime repository loads and merges all topic shards with canonical parity', async () => {
  const { content, overrides, artifacts } = await makeFixture();
  const calls = [];
  const repository = createRuntimeContentRepository({
    baseUrl: '/Maseer28/',
    fetchImpl: makeFetch(toFiles(artifacts), calls),
  });
  const index = await repository.loadContentIndex();
  assert.equal(index.topics.length, 34);
  assert.equal(calls.filter((call) => call.path === 'index.json').length, 1);

  const keys = index.topics.map((topic) => topic.key);
  const [first, second] = await Promise.all([
    repository.loadTopicsContent(keys),
    repository.loadTopicsContent(keys),
  ]);
  assert.deepEqual(Object.keys(first.categories).sort(), Object.keys(content.categories).sort());
  assert.deepEqual(second, first);
  const canonical = mergeDailyTextOverrides(content, overrides);
  for (const key of keys) assert.deepEqual(first.categories[key], canonical.categories[key], key);
  assert.equal(calls.filter((call) => call.path === 'index.json').length, 1);
  assert.equal(calls.filter((call) => call.path.startsWith('topics/')).length, 34);
  assert.equal(calls.filter((call) => call.path.startsWith('overrides/')).length, 34);
  assert.ok(calls.every((call) => call.options?.priority === 'high' || call.options?.priority === 'low'));
});

test('runtime repository rejects unknown topics without requesting a topic shard', async () => {
  const { artifacts } = await makeFixture();
  const calls = [];
  const repository = createRuntimeContentRepository({ fetchImpl: makeFetch(toFiles(artifacts), calls) });
  await assert.rejects(repository.loadTopicContent('موضوع ناشناخته'), /موجود نیست/);
  assert.equal(calls.filter((call) => call.path.startsWith('topics/')).length, 0);
});

test('runtime repository retries server failures and does not cache failed topic requests', async () => {
  const { artifacts } = await makeFixture();
  const files = toFiles(artifacts);
  const calls = [];
  let failures = 0;
  const fetchImpl = async (url, options) => {
    const path = String(url).split('/content/runtime-v1/')[1];
    if (path === 'topics/T01.json' && failures++ === 0) {
      calls.push({ path, options });
      return { ok: false, status: 503, json: async () => null };
    }
    return makeFetch(files, calls)(url, options);
  };
  const repository = createRuntimeContentRepository({ fetchImpl, retries: 1 });
  const topic = artifacts.index.topics.find((item) => item.topic_id === 'T01');
  const result = await repository.loadTopicContent(topic.key);
  assert.equal(result.days.length, 28);
  assert.equal(calls.filter((call) => call.path === 'topics/T01.json').length, 2);
});

test('runtime repository rejects invalid index and retries loading it on a later call', async () => {
  const { artifacts } = await makeFixture();
  let attempts = 0;
  const files = toFiles(artifacts);
  const fetchImpl = async (url, options) => {
    if (String(url).endsWith('/index.json') && attempts++ === 0) {
      return { ok: true, status: 200, json: async () => ({ schema_version: 'broken', topics: [] }) };
    }
    return makeFetch(files)(url, options);
  };
  const repository = createRuntimeContentRepository({ fetchImpl, retries: 0 });
  await assert.rejects(repository.loadContentIndex(), /معتبر نیست/);
  const index = await repository.loadContentIndex();
  assert.equal(index.topics.length, 34);
});
