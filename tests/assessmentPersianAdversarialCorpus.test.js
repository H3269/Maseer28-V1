import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractConservativeAssessmentEvidence } from '../src/features/assistant/assessmentLanguageContext.v1.js';

const corpus = JSON.parse(await readFile(new URL('./fixtures/persian-context-adversarial-corpus.v1.json', import.meta.url), 'utf8'));

test('Persian adversarial corpus is synthetic and non-clinical', () => {
  assert.equal(corpus.schema_version, '1.0.0');
  assert.equal(corpus.status, 'synthetic_expert_review_pending');
  assert.match(corpus.purpose, /not a clinical dataset/u);
  assert.equal(new Set(corpus.cases.map((item) => item.id)).size, corpus.cases.length);
});

for (const item of corpus.cases) {
  test(`Persian adversarial case ${item.id}: conservative evidence extraction`, () => {
    const actual = extractConservativeAssessmentEvidence(item.text);
    assert.equal(actual.evidence_text, item.retained, JSON.stringify(actual));
    assert.equal(actual.excluded_clause_count, item.excluded);
  });
}
