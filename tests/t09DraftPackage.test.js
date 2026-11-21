import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const guide = JSON.parse(await readFile(new URL('../src/features/assistant/t09DailyAssistantGuide.v1.json', import.meta.url), 'utf8'));
const answer = (record, id) => record.questions.find((question) => question.id === id)?.answer || '';

test('T09 active guide contains 28 complete days and 392 prepared question answers', () => {
  assert.equal(guide.topicId, 'T09');
  assert.equal(guide.records.length, 28);
  assert.equal(guide.expectedDays, 28);
  assert.equal(guide.questionsPerDay, 14);
  for (let index = 0; index < 28; index += 1) {
    const record = guide.records[index];
    assert.equal(record.day, index + 1);
    assert.equal(record.questions.length, 14);
    assert.deepEqual(record.questions.map((item) => item.id), Array.from({ length: 14 }, (_, i) => 'q' + String(i + 1).padStart(2, '0')));
  }
  assert.equal(guide.records.reduce((sum, record) => sum + record.questions.length, 0), 392);
});

test('T09 daily answers remain anchored to their own exercise, action, examples and safety limits', () => {
  const allAnswers = [];
  for (const record of guide.records) {
    for (const field of ['title', 'objective', 'skill', 'mechanism', 'exercise', 'action', 'lightVersion', 'progressVersion', 'restVersion', 'successCriterion', 'stopCondition', 'exerciseExample', 'actionExample', 'whenToSeekHumanSupport']) {
      assert.ok(typeof record[field] === 'string' && record[field].trim(), 'day ' + record.day + ' missing ' + field);
    }
    assert.equal(record.evidenceGrade, 'not_assessed');
    assert.ok(Array.isArray(record.sourceIds));
    assert.ok(Array.isArray(record.stopConditions));
    assert.ok(Array.isArray(record.contraindications));
    assert.ok(record.whenToSeekHumanSupport);
    assert.ok(answer(record, 'q01').includes(record.exercise), 'day ' + record.day + ': q01 exercise');
    assert.ok(answer(record, 'q01').includes(record.objective), 'day ' + record.day + ': q01 objective');
    assert.ok(answer(record, 'q03').includes(record.action), 'day ' + record.day + ': q03 action');
    assert.ok(answer(record, 'q02').includes(record.exerciseExample), 'day ' + record.day + ': q02 example');
    assert.ok(answer(record, 'q04').includes(record.actionExample), 'day ' + record.day + ': q04 example');
    assert.ok(answer(record, 'q05').includes(record.lightVersion), 'day ' + record.day + ': q05 light version');
    assert.ok(answer(record, 'q06').includes(record.successCriterion), 'day ' + record.day + ': q06 success');
    assert.ok(answer(record, 'q07').includes(record.stopCondition), 'day ' + record.day + ': q07 stop');
    assert.ok(record.stopConditions.every((condition) => answer(record, 'q07').includes(condition)), 'day ' + record.day + ': q07 safety conditions');
    assert.ok(answer(record, 'q09').includes(record.exercise) && answer(record, 'q09').includes(record.action), 'day ' + record.day + ': q09 distinction');
    assert.ok(answer(record, 'q10').includes(record.lightVersion) && answer(record, 'q10').includes(record.restVersion), 'day ' + record.day + ': q10 recovery');
    assert.ok(answer(record, 'q11').includes(record.stopCondition) && answer(record, 'q11').includes(record.whenToSeekHumanSupport), 'day ' + record.day + ': q11 safety');
    assert.ok(answer(record, 'q14').includes(String(record.durationMinutes)), 'day ' + record.day + ': q14 duration');
    assert.ok(answer(record, 'q14').includes('تخمینی') || answer(record, 'q14').includes('غیرالزامی'), 'day ' + record.day + ': q14 estimate scope');
    allAnswers.push(...record.questions.map((question) => question.answer));
  }
  assert.equal(allAnswers.length, 392);
  assert.equal(new Set(allAnswers).size, 392);
});
