import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mergeDailyTextOverrides } from '../src/features/content/dailyTextOverrides.js';
import { getDailySafetyMode } from '../src/features/content/dailySafety.js';

const readJson = (relative) => readFile(new URL(relative, import.meta.url), 'utf8').then(JSON.parse);

test('T11 overlay connects all 28 redesigned days and complete owner-review metadata', async () => {
  const [base, overrides, guide, registry] = await Promise.all([
    readJson('../public/content/path-content.json'),
    readJson('../public/content/daily-text-overrides.v1.json'),
    readJson('../src/features/assistant/t11DailyAssistantGuide.v1.json'),
    readJson('../public/assistant/evidence/sources.v1.json'),
  ]);
  const merged = mergeDailyTextOverrides(base, overrides);
  const days = merged.categories['عادت‌های تکراری'].days;
  const guideByDay = new Map(guide.records.map((record) => [record.day, record]));
  const sourceIds = new Set(registry.sources.map((source) => source.source_id));

  assert.equal(days.length, 28);
  assert.equal(guide.records.length, 28);
  for (const day of days) {
    const expected = guideByDay.get(Number(day.day));
    assert.ok(expected, 'guide exists for day ' + day.day);
    assert.equal(day.title, expected.title);
    assert.equal(day.exercise, expected.exercise);
    assert.ok(day.actionText.endsWith(expected.action));
    assert.ok(day.objective && day.skill && day.mechanism);
    assert.ok(day.lightVersion && day.progressVersion && day.restVersion);
    assert.ok(day.successCriterion && day.reflectionQuestion && day.stopCondition);
    assert.ok(Array.isArray(day.contraindications) && day.contraindications.length > 0);
    assert.ok(day.whenToSeekHumanSupport);
    assert.equal(day.review_status, 'pending_owner_review');
    assert.equal(day.evidence_grade, 'not_assessed');
    assert.equal(day.risk_level, 'pending_owner_review');
    assert.deepEqual(day.subtopic_ids, []);
    assert.equal(day.review_record_id, null);
    assert.ok(Array.isArray(day.source_ids));
    assert.ok(day.source_ids.every((id) => sourceIds.has(id)), 'all source IDs resolve for day ' + day.day);
    assert.equal(getDailySafetyMode(day), 'blocked', 'T11 day ' + day.day + ' remains ineligible for completion');
  }
});

test('T11 review preview shows the full package but disables score and completion controls', async () => {
  const ui = await readFile(new URL('../src/features/journey/JourneyScreens.jsx', import.meta.url), 'utf8');
  assert.match(ui, /data-testid="t11-owner-review-preview"/);
  assert.match(ui, /data-testid="t11-review-details"/);
  assert.match(ui, /!isT11ReviewPreview && !entryOpen/);
  assert.match(ui, /!isT11ReviewPreview && entryOpen/);
  assert.match(ui, /id="t11ReviewNextDayBtn"/);
  assert.match(ui, /data\.successCriterion/);
  assert.match(ui, /data\.contraindications/);
});
