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
  assert.equal(new Set(days.map((day) => day.title)).size, 28, 'T11 day titles must not repeat');
  assert.equal(new Set(days.map((day) => day.exercise)).size, 28, 'T11 daily exercises must not repeat exactly');
  assert.equal(new Set(days.map((day) => day.actionText)).size, 28, 'T11 dedicated actions must not repeat exactly');
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

test('T11 uses the shared daily page structure while its real approval gate stays closed', async () => {
  const ui = await readFile(new URL('../src/features/journey/JourneyScreens.jsx', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(ui, /getDailySafetyMode\(data\) === 'blocked'/);
  assert.match(ui, /splitDayContent\(data, problem, previousRecord, history\)/);
  assert.match(ui, /id="dailySafetyStatus"/);
  assert.doesNotMatch(ui, /isT11ReviewPreview|t11-owner-review-preview|t11-review-details|t11ReviewNextDayBtn/);
  assert.match(ui, /!isT11SafetyBlocked && !entryOpen/);
  assert.match(ui, /!isT11SafetyBlocked && entryOpen/);
  assert.match(ui, /id="skipDailyReviewBtn"/);
  assert.match(app, /createHumanReviewSkipRecord\(activeDay/);
  assert.match(app, /onSkip=\{skipDayForHumanReview\}/);
  assert.match(app, /guidanceData: splitDayContent\(activeDay, journey\.profileData\?\.problem \|\| '', journey\.daily\?\.\[currentDay - 1\], journey\.daily \|\| \{\}\)/);
  assert.doesNotMatch(app, /guidanceData: activeDay\.topic_id === 'T11'/);
});
