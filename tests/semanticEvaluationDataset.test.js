import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const schema = JSON.parse(await readFile(new URL('../public/assistant/schemas/semantic-intake.v1.schema.json', import.meta.url), 'utf8'));
const dataset = JSON.parse(await readFile(new URL('../public/assistant/evaluation/semantic-evaluation-cases.v1.json', import.meta.url), 'utf8'));
const registry = JSON.parse(await readFile(new URL('../public/assistant/knowledge/topics.v1.json', import.meta.url), 'utf8'));
const knownTopics = new Set(registry.topics.map((topic) => topic.topic_id));

test('semantic intake schema declares a closed, versioned output contract', () => {
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.properties.schema_version.const, '1.0.0');
  assert.equal(schema.additionalProperties, false);
  for (const key of ['intent', 'semantic_summary', 'situational_facts', 'topic_candidates', 'uncertainties', 'next_question', 'safety_handoff', 'limitations']) {
    assert.ok(schema.required.includes(key), `missing required schema field: ${key}`);
  }
  assert.equal(schema.properties.topic_candidates.maxItems, 3);
});

test('synthetic Persian evaluation dataset has unique cases and valid topic references', () => {
  assert.equal(dataset.status, 'synthetic_seed_not_a_validated_benchmark');
  assert.equal(dataset.language, 'fa-IR');
  assert.ok(dataset.cases.length >= 15);
  const ids = new Set();
  for (const item of dataset.cases) {
    assert.ok(item.id && !ids.has(item.id), `missing or duplicate case id: ${item.id}`);
    ids.add(item.id);
    assert.ok(typeof item.text === 'string' && item.text.trim().length > 0, item.id);
    for (const topicId of item.expected_topics ?? []) assert.ok(knownTopics.has(topicId), `${item.id}: unknown topic ${topicId}`);
    if (item.primary_topic && !['none', 'unknown'].includes(item.primary_topic)) {
      assert.ok(knownTopics.has(item.primary_topic), `${item.id}: unknown primary topic ${item.primary_topic}`);
    }
    if (item.must_handoff_safety) assert.ok(item.notes?.length > 0, `${item.id}: safety case needs rationale`);
  }
});

test('dataset explicitly covers ambiguous, quoted, negated, multi-topic and safety-sensitive language', () => {
  const text = dataset.cases.map((item) => item.text).join('\n');
  assert.match(text, /نمی‌خواهم|نمی‌خواهم/);
  assert.match(text, /گفت|گفتم/);
  assert.match(text, /هم/);
  assert.ok(dataset.cases.some((item) => item.must_handoff_safety));
  assert.ok(dataset.cases.some((item) => item.must_ask_clarification));
  assert.ok(dataset.cases.some((item) => item.expected_topics?.length === 0));
});
