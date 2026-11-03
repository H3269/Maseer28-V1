import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getRelationshipSafetyGate,
  isRelationshipSafetyConfirmed,
  createRelationshipSafetySkipRecord,
} from '../src/features/journey/relationshipSafetyGate.js';

test('relationship safety gate covers T01 pause and direct communication days only', () => {
  for (const day of [10, 11, 17, 20, 21, 22, 23]) {
    assert.ok(getRelationshipSafetyGate({ id: `T01-D${String(day).padStart(2, '0')}`, topic_id: 'T01', day }));
  }
  assert.equal(getRelationshipSafetyGate({ id: 'T01-D09', topic_id: 'T01', day: 9 }), null);
  assert.equal(getRelationshipSafetyGate({ id: 'T02-D20', topic_id: 'T02', day: 20 }), null);
});

test('relationship safety confirmation fails closed unless the user explicitly chooses safe', () => {
  const day = { id: 'T01-D17', topic_id: 'T01', day: 17 };
  assert.equal(isRelationshipSafetyConfirmed(day, ''), false);
  assert.equal(isRelationshipSafetyConfirmed(day, 'unsafe'), false);
  assert.equal(isRelationshipSafetyConfirmed(day, 'safe'), true);
  assert.equal(isRelationshipSafetyConfirmed({ id: 'T01-D09', topic_id: 'T01', day: 9 }, 'unsafe'), true);
});

test('relationship safety skip records are explicit and never fabricate a score', () => {
  const day = { id: 'T01-D17', topic_id: 'T01', day: 17 };
  const record = createRelationshipSafetySkipRecord(day, '2026-11-03T12:00:00.000Z');
  assert.deepEqual(record, {
    status: 'skipped_safety_gate',
    feedbackText: 'این تمرین به دلیل ملاحظه ایمنی اجرا نشد. هیچ امتیازی ثبت نشده و این ثبت به معنی بهبود یا بدترشدن نیست.',
    exerciseId: 'T01-D17',
    updatedAt: '2026-11-03T12:00:00.000Z',
  });
  assert.equal('score' in record, false);
  assert.equal('feedback' in record, false);
  assert.throws(() => createRelationshipSafetySkipRecord({ id: 'T02-D17', topic_id: 'T02', day: 17 }));
  assert.throws(() => createRelationshipSafetySkipRecord(day, 'not-a-date'));
});

test('relationship gate days in the actual T01 content have stable IDs and topic links', async () => {
  const content = JSON.parse(await readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8'));
  const days = content.categories['خشم'].days;
  for (const dayNumber of [10, 11, 17, 20, 21, 22, 23]) {
    const day = days.find((item) => item.day === dayNumber);
    assert.equal(day.topic_id, 'T01');
    assert.equal(getRelationshipSafetyGate(day)?.gateId, 'relationship-communication-safety-v1');
  }
});

test('day screen and App wire relationship self-check, blocking, and safe skip', async () => {
  const ui = await readFile(new URL('../src/features/journey/JourneyScreens.jsx', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(ui, /getRelationshipSafetyGate\(data\)/);
  assert.match(ui, /relationshipSafetyState\.dayKey === relationshipSafetyDayKey/);
  assert.match(ui, /dayKey: relationshipSafetyDayKey/);
  assert.doesNotMatch(ui, /setRelationshipSafetyResponse/);
  assert.match(ui, /isRelationshipSafetyConfirmed\(data, relationshipSafetyResponse\)/);
  assert.match(ui, /relationshipSafetyGate\.blockedMessage/);
  assert.match(ui, /onSkipRelationshipSafety\?\.\('unsafe'\)/);
  assert.match(app, /skipDayForRelationshipSafety\(response\)/);
  assert.match(app, /isRelationshipSafetyConfirmed\(activeDay, response\)/);
  assert.match(app, /response !== 'unsafe'/);
  assert.match(app, /createRelationshipSafetySkipRecord\(activeDay/);
});
