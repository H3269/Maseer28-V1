import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const journeyUi = await readFile(new URL('../src/features/journey/JourneyScreens.jsx', import.meta.url), 'utf8');
const assistantUi = await readFile(new URL('../src/features/assistant/AssessmentAssistant.jsx', import.meta.url), 'utf8');
const engine = await readFile(new URL('../src/features/assistant/assessmentEngine.js', import.meta.url), 'utf8');
const turnEngine = await readFile(new URL('../src/features/assistant/assistantTurnEngine.js', import.meta.url), 'utf8');
const knowledgeGateway = await readFile(new URL('../src/features/assistant/knowledgeGateway.js', import.meta.url), 'utf8');
const topicRegistry = JSON.parse(await readFile(new URL('../public/assistant/knowledge/topics.v1.json', import.meta.url), 'utf8'));
const catalogSchema = JSON.parse(await readFile(new URL('../public/assistant/schemas/knowledge-catalog.v1.schema.json', import.meta.url), 'utf8'));
const approvalManifestSchema = JSON.parse(await readFile(new URL('../public/assistant/schemas/knowledge-approval-manifest.v1.schema.json', import.meta.url), 'utf8'));
const knowledgeCatalog = JSON.parse(await readFile(new URL('../public/assistant/knowledge/items.v1.json', import.meta.url), 'utf8'));
const approvalManifest = JSON.parse(await readFile(new URL('../public/assistant/knowledge/approved-items.v1.json', import.meta.url), 'utf8'));
const publishWorkflow = await readFile(new URL('../.github/workflows/publish-tested-version.yml', import.meta.url), 'utf8');
const productionPreparation = await readFile(new URL('../scripts/prepare-production-build.mjs', import.meta.url), 'utf8');

test('experimental assistant remains disabled unless explicitly enabled in a build', () => {
  assert.match(journeyUi, /APP_CONFIG\.TEST_MODE\s*\|\|\s*import\.meta\.env\.VITE_ENABLE_EXPERIMENTAL_ASSISTANT\s*===\s*'true'/);
  assert.match(journeyUi, /EXPERIMENTAL_ASSISTANT_ENABLED\s*&&\s*<AssessmentAssistant\s*\/>/);
  assert.match(assistantUi, /نسخه آزمایشی/);
});

test('assistant runtime does not claim clinical validation or diagnostic capability', () => {
  assert.match(engine, /diagnostic_use:\s*false/);
  assert.match(engine, /validated_screening_tool:\s*false/);
  assert.match(engine, /safety_triage_validated:\s*false/);
  assert.match(engine, /clinical_review_complete:\s*false/);
  assert.match(engine, /cloud_processing:\s*false/);
});

test('production publication is blocked until every daily unit has expert approval', () => {
  assert.match(productionPreparation, /validateProductionContent/);
  assert.match(productionPreparation, /Production publication blocked/);
  assert.match(publishWorkflow, /npm run prepare:production/);
});

test('production publish workflow cannot enable the experimental assistant accidentally', () => {
  assert.match(publishWorkflow, /github\.ref\s*==\s*'refs\/heads\/main'/);
  assert.doesNotMatch(publishWorkflow, /VITE_ENABLE_EXPERIMENTAL_ASSISTANT\s*:\s*['"]true['"]/);
});

test('assistant conversation remains in-memory only in this prototype', () => {
  assert.doesNotMatch(assistantUi, /localStorage|sessionStorage|indexedDB|fetch\s*\(|XMLHttpRequest/);
  assert.doesNotMatch(engine, /localStorage|sessionStorage|indexedDB|fetch\s*\(|XMLHttpRequest/);
});


test('new orchestration and retrieval modules remain local-only', () => {
  for (const source of [turnEngine, knowledgeGateway]) {
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|fetch\s*\(|XMLHttpRequest/);
  }
});


test('repository contains no approved knowledge items before external review', () => {
  assert.equal(approvalManifest.status, 'empty_pending_external_review');
  assert.deepEqual(approvalManifest.approved_items, []);
});


test('draft topic registry cannot be treated as reviewed assistant knowledge', () => {
  assert.equal(topicRegistry.topics.length, 34);
  assert.ok(topicRegistry.topics.every((topic) => topic.review_status === 'draft'));
  assert.ok(topicRegistry.topics.every((topic) => topic.content_ids.length === 0));
  assert.ok(topicRegistry.topics.every((topic) => topic.evidence_ids.length === 0));
});


test('runtime knowledge catalog and approval manifest remain empty until human review', () => {
  assert.equal(knowledgeCatalog.status, 'empty_pending_external_review');
  assert.deepEqual(knowledgeCatalog.items, []);
  assert.equal(approvalManifest.status, 'empty_pending_external_review');
  assert.deepEqual(approvalManifest.approved_items, []);
});


test('knowledge catalog and approval manifest schemas are versioned and closed', () => {
  assert.equal(catalogSchema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(catalogSchema.additionalProperties, false);
  assert.equal(catalogSchema.properties.schema_version.const, '1.0.0');
  assert.equal(approvalManifestSchema.additionalProperties, false);
  assert.equal(approvalManifestSchema.properties.schema_version.const, '1.0.0');
  assert.ok(catalogSchema.properties.items.items.$ref.endsWith('approved-knowledge-item.v1.schema.json'));
});


test('knowledge UI displays only returned excerpts with source and review attribution', () => {
  assert.match(assistantUi, /knowledgeResponse\.results\.map/);
  assert.match(assistantUi, /item\.source\.source_id/);
  assert.match(assistantUi, /item\.source\.locator/);
  assert.match(assistantUi, /item\.approval\.review_record_id/);
});


test('assistant uses one chat surface with the composer send action inside and end action outside', () => {
  assert.match(assistantUi, /className="assistantChatShell"/);
  assert.match(assistantUi, /className="assistantTranscript"/);
  assert.match(assistantUi, /className="assistantComposer"/);
  assert.match(assistantUi, /assistantSendButton/);
  assert.match(assistantUi, /onClick=\{stop\}>پایان گفتگو/);
  assert.doesNotMatch(assistantUi, /پایان و پاک‌کردن گفتگو|بستن و پاک‌کردن گفتگو/);
  assert.match(assistantUi, /scrollIntoView/);
});

test('assistant chat styling distinguishes speaker bubbles and keeps composer integrated', async () => {
  const css = await readFile(new URL('../src/styles/original-v72.css', import.meta.url), 'utf8');
  assert.match(css, /\.assistantChatShell\s*\{/);
  assert.match(css, /\.assistantMessage\s*\{/);
  assert.match(css, /\.userMessage\s*\{/);
  assert.match(css, /\.assistantComposer\s*\{/);
  assert.match(css, /\.assistantSendButton\s*\{/);
});
