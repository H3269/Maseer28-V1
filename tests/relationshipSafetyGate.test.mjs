import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getRelationshipSafetyGate,
  isRelationshipSafetyConfirmed,
  createRelationshipSafetySkipRecord,
} from '../src/features/journey/relationshipSafetyGate.js';

test('relationship safety gate covers T01 pause and direct communication days only', () => {
  for (const day of [10, 11, 17, 18, 19, 20, 21, 22, 23]) {
    assert.ok(getRelationshipSafetyGate({ id: `T01-D${String(day).padStart(2, '0')}`, topic_id: 'T01', day }));
  }
  assert.equal(getRelationshipSafetyGate({ id: 'T01-D09', topic_id: 'T01', day: 9 }), null);
  assert.equal(getRelationshipSafetyGate({ id: 'T02-D20', topic_id: 'T02', day: 20 }), null);
});

test('stable T01 identifiers preserve relationship gates when optional day metadata is absent', () => {
  for (const day of [10, 11, 17, 18, 19, 20, 21, 22, 23]) {
    assert.ok(getRelationshipSafetyGate({ id: `خشم-${day}` }), `anger ID day ${day} must remain gated`);
    assert.ok(getRelationshipSafetyGate({ id: `T01-D${String(day).padStart(2, '0')}` }), `canonical ID day ${day} must remain gated`);
  }
  assert.equal(getRelationshipSafetyGate({ id: 'خشم-09' }), null);
  assert.equal(getRelationshipSafetyGate({ id: 'غم-10' }), null);
  assert.equal(getRelationshipSafetyGate({ id: 'T02-D10' }), null);
  assert.ok(getRelationshipSafetyGate({ id: 'خشم-10', day: 9 }), 'a conflicting identifier must not bypass a gated day');
  assert.ok(getRelationshipSafetyGate({ id: 'T01-D09', topic_id: 'T01', day: 10 }), 'a conflicting topic day must retain the gate');
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
  for (const dayNumber of [10, 11, 17, 18, 19, 20, 21, 22, 23]) {
    const day = days.find((item) => item.day === dayNumber);
    assert.equal(day.topic_id, 'T01');
    assert.equal(day.risk_level, 'caution', `gated communication day ${dayNumber} must retain caution metadata`);
    assert.equal(getRelationshipSafetyGate(day)?.gateId, 'relationship-communication-safety-v1');
  }
});

test('T01 days explicitly mapped to the limited WHO safety source retain that reference', async () => {
  const content = JSON.parse(await readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8'));
  const sources = JSON.parse(await readFile(new URL('../public/assistant/evidence/sources.v1.json', import.meta.url), 'utf8'));
  const sourceId = 'SRC-ANGER-WHO-IPV-2013-001';
  assert.ok(sources.sources.some((source) => source.source_id === sourceId));
  for (const dayNumber of [10, 11, 17, 20, 21, 22, 23, 27]) {
    const day = content.categories['خشم'].days.find((item) => item.day === dayNumber);
    assert.ok(day.source_ids.includes(sourceId), `day ${dayNumber} must reference the safety source`);
  }
});

test('current violence and relationship safety sources remain contextual, not day-level approval', async () => {
  const content = JSON.parse(await readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8'));
  const registry = JSON.parse(await readFile(new URL('../public/assistant/evidence/sources.v1.json', import.meta.url), 'utf8'));
  const expected = [
    ['SRC-RELATIONSHIP-WHO-RESPECT-2025-001', '2025-11-19', /women and girls/i],
    ['SRC-RELATIONSHIP-NHSE-SAFETY-2026-001', '2026-07-17', /does not establish/i],
    ['SRC-VIOLENCE-PSYCHOSOCIAL-LANCET-2026-001', '2026-07', /does not validate/i],
  ];
  const ids = new Set(registry.sources.map((source) => source.source_id));
  for (const [id, date, limitation] of expected) {
    const source = registry.sources.find((item) => item.source_id === id);
    assert.ok(source, `missing source ${id}`);
    assert.equal(source.publication_date, date);
    assert.match(source.limitations, limitation);
    assert.ok(source.url.startsWith('https://'));
  }
  for (const category of Object.values(content.categories || {})) {
    for (const day of category.days || []) {
      assert.equal((day.source_ids || []).some((id) => expected.some(([sourceId]) => sourceId === id)), false,
        'contextual sources must not be attached to a specific daily exercise before claim-level review');
    }
  }
  assert.equal(ids.size, registry.sources.length, 'evidence source identifiers must be unique');
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
  assert.match(ui, /relationshipSafetyConfirmed/);
  assert.match(app, /relationshipSafetyConfirmed !== true/);
  const humanReviewGateIndex = ui.indexOf('if (requiresHumanReview) return');
  const relationshipGateIndex = ui.indexOf('if (relationshipSafetyGate && !relationshipSafetyConfirmed) return');
  assert.ok(humanReviewGateIndex >= 0 && relationshipGateIndex >= 0 && humanReviewGateIndex < relationshipGateIndex, 'human-review blocking must precede the relationship self-check');
});
