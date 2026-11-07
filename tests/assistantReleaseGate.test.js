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
const pagesDeployWorkflow = await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
const productionContentGate = await readFile(new URL('../scripts/assert-production-content-approved.mjs', import.meta.url), 'utf8');

test('global assistant launcher is mounted across navigable screens, including support', async () => {
  const appUi = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const launcherUi = await readFile(new URL('../src/features/assistant/GlobalAssistantLauncher.jsx', import.meta.url), 'utf8');
  const readerUi = await readFile(new URL('../src/features/library/Reader.jsx', import.meta.url), 'utf8');
  const supportStart = journeyUi.indexOf('export function Support');
  const supportEnd = journeyUi.indexOf('function reflectionValues', supportStart);
  assert.ok(supportStart >= 0 && supportEnd > supportStart, 'support screen source must be identifiable');
  const supportUi = journeyUi.slice(supportStart, supportEnd);

  assert.match(appUi, /import GlobalAssistantLauncher from ['"].*GlobalAssistantLauncher\.jsx['"]/);
  assert.match(appUi, /<GlobalAssistantLauncher/);
  assert.match(appUi, /dailyContext=\{screen === 'day'/);
  assert.match(appUi, /libraryContext=\{screen === 'books'/);
  assert.doesNotMatch(appUi, /DailyExerciseAssistant/);
  assert.doesNotMatch(readerUi, /GlobalAssistantLauncher/);
  assert.match(appUi, /screen === 'bookReader' && readerState/);
  assert.match(appUi, /return <Reader book=/);
  assert.doesNotMatch(launcherUi, /support:\s*'پشتیبانی'/, 'launcher must not reintroduce screen-context helper labels');
  assert.match(launcherUi, /maxLength=\{dailyContext \? 2000 : 3000\}/, 'assistant composer must render without removed context state');
  assert.doesNotMatch(launcherUi, /isDailyExercise/, 'assistant launcher must not reference removed daily-context state');
  assert.match(launcherUi, /className="globalAssistantLauncher"/);
  assert.match(launcherUi, /aria-label="باز کردن دستیار مسیر۲۸"/);
  assert.match(launcherUi, /if \(!visible \|\| screen === 'bookReader'\) return null/);
  assert.doesNotMatch(supportUi, /AssessmentAssistant|حریم خصوصی|بازیابی فایل پشتیبان|دستیار آزمایشی/);
});

test('assistant runtime does not claim clinical validation or diagnostic capability', () => {
  assert.match(engine, /diagnostic_use:\s*false/);
  assert.match(engine, /validated_screening_tool:\s*false/);
  assert.match(engine, /safety_triage_validated:\s*false/);
  assert.match(engine, /clinical_review_complete:\s*false/);
  assert.match(engine, /cloud_processing:\s*false/);
});

test('production publication requires expert approval for every daily unit', () => {
  assert.match(productionContentGate, /validateProductionContent/);
  assert.match(publishWorkflow, /npm run assert:production-content/);
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



test('global digit localization is installed at the app root without changing editable input values', async () => {
  const mainEntry = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
  const digitDisplay = await readFile(new URL('../src/shared/persianDigitDisplay.js', import.meta.url), 'utf8');
  assert.match(mainEntry, /installPersianDigitDisplay\(appRoot\)/);
  assert.match(digitDisplay, /characterData:\s*true/);
  assert.match(digitDisplay, /attributeFilter:\s*\['placeholder', 'title', 'aria-label', 'aria-valuetext', 'alt'\]/);
  assert.match(digitDisplay, /textarea, input, select/);
});

test('global assistant conversation is one right-to-left transcript', async () => {
  const launcher = await readFile(new URL('../src/features/assistant/GlobalAssistantLauncher.jsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/styles/original-v72.css', import.meta.url), 'utf8');
  assert.equal((launcher.match(/className="assistantChatShell globalAssistantChat"/g) || []).length, 1);
  assert.match(launcher, /className="assistantTranscript" dir="rtl"/);
  assert.match(launcher, /className="assistantComposer" dir="rtl"/);
  assert.match(css, /\.globalAssistantChat \.assistantMessage,\s*\.globalAssistantChat \.userMessage\s*\{[^}]*align-self:\s*flex-start/);
  assert.match(css, /direction:\s*rtl !important;\s*text-align:\s*right !important;/);
});

test('GitHub Pages tracks main as a test app without production-release gates', async () => {
  const journeyStore = await readFile(new URL('../src/features/journey/journeyStore.js', import.meta.url), 'utf8');
  assert.match(pagesDeployWorkflow, /on:\s+push:\s+branches:\s+\[main\]/);
  assert.doesNotMatch(pagesDeployWorkflow, /workflow_dispatch|confirm_public_release/);
  assert.doesNotMatch(pagesDeployWorkflow, /run:\s*npm run (?:prepare:production|assert:production-content)/);
  assert.ok(pagesDeployWorkflow.includes('npm run build -- --base=/Maseer28-V1/'));
  assert.match(journeyStore, /TEST_MODE:\s*true/);
  assert.match(journeyStore, /TIME_LOCK_ENABLED:\s*false/);
});
