import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const guide = JSON.parse(await readFile(new URL('../src/features/assistant/t10DailyAssistantGuide.v1.json', import.meta.url), 'utf8'));
const sources = JSON.parse(await readFile(new URL('../public/assistant/evidence/sources.v1.json', import.meta.url), 'utf8'));
const sourceIds = new Set(sources.sources.map((source) => source.source_id));
const answer = (record, id) => record.questions.find((question) => question.id === id)?.answer || '';

test('T10 guide is available for owner live review and covers 28 days with 392 prepared answers', () => {
  assert.equal(guide.topicId, 'T10');
  assert.equal(guide.status, 'ready_for_owner_live_test');
  assert.equal(guide.expectedDays, 28);
  assert.equal(guide.questionsPerDay, 14);
  assert.equal(guide.records.length, 28);
  const allAnswers = [];
  for (const record of guide.records) {
    assert.equal(record.topicId, 'T10');
    assert.equal(record.questions.length, 14);
    assert.equal(record.evidenceGrade, 'not_assessed');
    assert.equal(record.durationStatus, 'provisional_estimate');
    assert.ok(record.sourceIds.every((id) => sourceIds.has(id)), 'day ' + record.day + ': source IDs must resolve');
    assert.ok(record.stopConditions.length > 0);
    assert.ok(record.contraindications.length > 0);
    assert.ok(record.whenToSeekHumanSupport);
    assert.ok(answer(record, 'q01').includes(record.exercise));
    assert.ok(answer(record, 'q03').includes(record.action));
    assert.ok(answer(record, 'q07').includes(record.stopCondition));
    assert.ok(record.stopConditions.every((condition) => answer(record, 'q07').includes(condition)));
    assert.ok(answer(record, 'q11').includes(record.stopCondition));
    assert.ok(answer(record, 'q11').includes('خواب') || answer(record, 'q11').includes('خواب‌آلودگی') || answer(record, 'q11').includes('بیدار'));
    assert.match(answer(record, 'q14'), /[۰-۹0-9]+\s*(?:دقیقه|دقیقهٔ)/u);
    assert.ok(answer(record, 'q14').includes('برآورد اولیه') && answer(record, 'q14').includes('مهلت انجام نیست'));
    allAnswers.push(...record.questions.map((question) => question.answer));
  }
  assert.equal(allAnswers.length, 392);
  assert.ok(allAnswers.every((value) => typeof value === 'string' && value.trim()));
  assert.equal(new Set(allAnswers).size, 392);
});

test('T10 guide makes no unsupported claim of clinical or expert approval', () => {
  assert.match(guide.questionPolicy, /Dr Abedi/u);
  assert.match(guide.questionPolicy, /not_assessed/u);
  assert.ok(guide.records.every((record) => record.evidenceGrade === 'not_assessed'));
  assert.ok(guide.records.every((record) => record.sourceIds.every((id) => sourceIds.has(id))));
});
