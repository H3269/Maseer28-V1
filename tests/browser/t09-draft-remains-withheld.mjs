import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173/Maseer28/';
const previewBaseURL = baseURL.endsWith('/') ? baseURL : `${baseURL}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.goto(previewBaseURL, { waitUntil: 'domcontentloaded' });
  const registryResponse = await page.evaluate(async () => {
    const url = new URL('assistant/knowledge/topics.v1.json', location.href);
    const response = await fetch(url);
    return { status: response.status, registry: response.ok ? await response.json() : null };
  });
  assert.equal(registryResponse.status, 200, 'production preview must serve the topic registry');
  const topic = registryResponse.registry.topics.find((item) => item.topic_id === 'T09');
  assert.ok(topic, 'T09 must remain represented in the topic taxonomy');
  assert.equal(topic.review_status, 'draft');
  assert.equal(topic.definition_status, 'pending_expert_review');
  assert.deepEqual(topic.content_ids, [], 'draft T09 must not be linked as production-approved content');
  assert.deepEqual(topic.evidence_ids, [], 'draft T09 must not be linked as approved evidence');
  assert.deepEqual(topic.intervention_ids, [], 'draft T09 must not be linked as approved interventions');
  assert.deepEqual(topic.safety_rule_ids, [], 'draft T09 must not be linked as approved safety rules');
  console.log('T09 draft remains withheld from production-approved topic links.');
} finally {
  await browser.close();
}
