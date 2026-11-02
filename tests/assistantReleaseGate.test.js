import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const journeyUi = await readFile(new URL('../src/features/journey/JourneyScreens.jsx', import.meta.url), 'utf8');
const assistantUi = await readFile(new URL('../src/features/assistant/AssessmentAssistant.jsx', import.meta.url), 'utf8');
const engine = await readFile(new URL('../src/features/assistant/assessmentEngine.js', import.meta.url), 'utf8');
const turnEngine = await readFile(new URL('../src/features/assistant/assistantTurnEngine.js', import.meta.url), 'utf8');
const knowledgeGateway = await readFile(new URL('../src/features/assistant/knowledgeGateway.js', import.meta.url), 'utf8');
const publishWorkflow = await readFile(new URL('../.github/workflows/publish-tested-version.yml', import.meta.url), 'utf8');

test('experimental assistant remains disabled unless explicitly enabled in a build', () => {
  assert.match(journeyUi, /VITE_ENABLE_EXPERIMENTAL_ASSISTANT\s*===\s*'true'/);
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

test('production publish workflow cannot enable the experimental assistant accidentally', () => {
  assert.match(publishWorkflow, /github\.ref\s*==\s*'refs\/heads\/main'/);
  assert.doesNotMatch(publishWorkflow, /VITE_ENABLE_EXPERIMENTAL_ASSISTANT\s*:\s*['"]true['"]/);
});

test('assistant conversation remains in-memory only in this prototype', () => {
  assert.doesNotMatch(assistantUi, /localStorage|sessionStorage|indexedDB|fetch\s*\(|XMLHttpRequest/);
  assert.doesNotMatch(engine, /localStorage|sessionStorage|indexedDB|fetch\s*\(|XMLHttpRequest/);
});
