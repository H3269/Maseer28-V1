import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateDataset } from '../scripts/evaluate-semantic-understanding.mjs';

const dataset = JSON.parse(await readFile(new URL('../public/assistant/evaluation/semantic-evaluation-cases.v1.json', import.meta.url), 'utf8'));

test('semantic evaluator returns reproducible metrics for every synthetic case', () => {
  const report = evaluateDataset(dataset);
  assert.equal(report.case_count, dataset.cases.length);
  assert.equal(report.dataset_status, 'synthetic_seed_not_a_validated_benchmark');
  assert.ok(report.topic_metrics.precision >= 0 && report.topic_metrics.precision <= 1);
  assert.ok(report.topic_metrics.recall >= 0 && report.topic_metrics.recall <= 1);
  assert.equal(report.cases.length, dataset.cases.length);
});

test('safety probe is explicitly lexical and never presented as clinical validation', () => {
  const report = evaluateDataset(dataset);
  assert.ok(report.safety_lexical_probe.interpretation.includes('عدم کشف عبارت به معنی ایمن‌بودن نیست'));
  assert.ok(report.limitations.some((item) => item.includes('اعتبارسنجی نمی‌کنند')));
});

test('evaluator reports per-case topic mismatches instead of hiding them in an aggregate', () => {
  const report = evaluateDataset(dataset);
  assert.ok(report.cases.every((item) => Array.isArray(item.expected) && Array.isArray(item.predicted)));
  assert.ok(Object.keys(report.per_topic).length > 0);
});

test('priority safety cases are excluded from topic scoring', () => {
  const report = evaluateDataset(dataset);
  const safetyCases = report.cases.filter((item) => item.expectedSafetyHandoff);
  assert.ok(safetyCases.length > 0);
  assert.ok(safetyCases.every((item) => item.topic_scoring_excluded === true));
  assert.equal(report.topic_scoring_case_count, report.case_count - safetyCases.length);
});


test('evaluator reports clarification false positives and false negatives separately',()=>{
 const report=evaluateDataset(dataset);
 assert.equal(report.clarification_metrics.evaluated_case_count,report.topic_scoring_case_count);
 assert.ok(report.clarification_metrics.false_positive>=0);
 assert.ok(report.clarification_metrics.false_negative>=0);
 assert.ok(report.cases.filter(item=>!item.clarification_scoring_excluded).every(item=>
  typeof item.expectedClarification==='boolean' && typeof item.clarificationRequested==='boolean'
 ));
 assert.ok(report.clarification_metrics.interpretation.includes('کیفیت بالینی'));
});
