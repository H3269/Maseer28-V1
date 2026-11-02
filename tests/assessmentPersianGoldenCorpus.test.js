import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ASSESSMENT_CONTEXT_VERSION, extractConservativeAssessmentEvidence } from '../src/features/assistant/assessmentLanguageContext.v1.js';

const corpus = JSON.parse(await readFile(new URL('./fixtures/persian-context-golden-corpus.v1.json', import.meta.url), 'utf8'));

test('Persian context golden corpus metadata is explicitly non-clinical', () => {
  assert.equal(corpus.schema_version, '1.0.0');
  assert.equal(ASSESSMENT_CONTEXT_VERSION, '1.1.0');
  assert.equal(corpus.status, 'synthetic_expert_review_pending');
  assert.match(corpus.purpose, /not a clinical dataset/u);
  assert.equal(new Set(corpus.cases.map((item) => item.id)).size, corpus.cases.length);
});

for (const item of corpus.cases) {
  test(`Persian context corpus ${item.id}: retained clause and exclusion count`, () => {
    const actual = extractConservativeAssessmentEvidence(item.text);
    assert.equal(actual.evidence_text, item.retained, JSON.stringify(actual));
    assert.equal(actual.excluded_clause_count, item.excluded);
  });
}
