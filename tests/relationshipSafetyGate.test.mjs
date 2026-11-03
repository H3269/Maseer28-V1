import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getInterpersonalPrivacyNotice,
  getRelationshipSafetyGate,
  isRelationshipSafetyConfirmed,
  createRelationshipSafetySkipRecord,
} from '../src/features/journey/relationshipSafetyGate.js';

test('relationship safety gate covers T01 and shared interpersonal days across T03-T34', async () => {
  const registry = JSON.parse(await readFile(new URL('../public/assistant/knowledge/topics.v1.json', import.meta.url), 'utf8'));
  const sharedTopics = registry.topics.filter((topic) => Number(topic.topic_id.slice(1)) >= 3);
  assert.equal(sharedTopics.length, 32);
  for (const topic of sharedTopics) {
    for (const day of [6, 11, 15, 24]) {
      const canonicalId = topic.topic_id + '-D' + String(day).padStart(2, '0');
      assert.ok(getRelationshipSafetyGate({ id: canonicalId, topic_id: topic.topic_id, day }),
        topic.topic_id + ' day ' + day + ' must gate the shared interpersonal prompt');
    }
  }
  for (const day of [10, 11, 17, 18, 19, 20, 21, 22, 23]) {
    assert.ok(getRelationshipSafetyGate({ id: 'T01-D' + String(day).padStart(2, '0'), topic_id: 'T01', day }));
  }
  assert.equal(getRelationshipSafetyGate({ id: 'T02-D25', topic_id: 'T02', day: 25 }), null);
  assert.equal(getRelationshipSafetyGate({ id: 'T03-D07', topic_id: 'T03', day: 7 }), null);
  assert.equal(getRelationshipSafetyGate({ id: 'T03-D12', topic_id: 'T03', day: 12 }), null);
  assert.equal(getRelationshipSafetyGate({ id: 'T02-D20', topic_id: 'T02', day: 20 }), null);
});

test('legacy and canonical identifiers preserve shared-topic gates and fail closed on conflicts', async () => {
  const registry = JSON.parse(await readFile(new URL('../public/assistant/knowledge/topics.v1.json', import.meta.url), 'utf8'));
  const sharedTopics = registry.topics.filter((topic) => Number(topic.topic_id.slice(1)) >= 3);
  for (const topic of sharedTopics) {
    for (const day of [6, 11, 15, 24]) {
      const legacyId = topic.name + '-' + day;
      const canonicalId = topic.topic_id + '-D' + String(day).padStart(2, '0');
      assert.ok(getRelationshipSafetyGate({ id: legacyId }), legacyId + ' must remain gated');
      assert.ok(getRelationshipSafetyGate({ id: canonicalId }), canonicalId + ' must remain gated');
    }
  }
  assert.equal(getRelationshipSafetyGate({ id: 'غم و سوگ-10' }), null);
  assert.equal(getRelationshipSafetyGate({ id: 'T02-D25', topic_id: 'T02', day: 25 }), null);
  assert.ok(getRelationshipSafetyGate({ id: 'خشم-10', day: 9 }), 'a conflicting day identifier must not bypass a gate');
  assert.ok(getRelationshipSafetyGate({ id: 'مشکلات رابطه-15', topic_id: 'T02', day: 15 }),
    'a conflicting topic identifier must not bypass a gated interaction');
});

test('relationship safety check requires mutual freedom to refuse or stop communication', () => {
  const gate = getRelationshipSafetyGate({ id: 'T03-D06', topic_id: 'T03', day: 6 });
  assert.ok(gate);
  assert.match(gate.question, /هر دو نفر/);
  assert.match(gate.safeOption, /هر دو نفر/);
  assert.match(gate.unsafeOption, /هرکدام از ما/);
  assert.match(gate.disclaimer, /آزادی انتخاب هر یک از دو نفر/);
  assert.match(gate.disclaimer, /حافظه محلی مرورگر/);
  assert.match(gate.disclaimer, /رمزگذاری نمی‌کند/);
  assert.match(gate.blockedMessage, /هیچ‌یک از دو نفر/);
  assert.match(gate.safeReminder, /هرکدام از دو نفر/);
});

test('relationship safety confirmation fails closed unless the user explicitly chooses safe', () => {
  const day = { id: 'T01-D17', topic_id: 'T01', day: 17 };
  assert.equal(isRelationshipSafetyConfirmed(day, ''), false);
  assert.equal(isRelationshipSafetyConfirmed(day, 'unsafe'), false);
  assert.equal(isRelationshipSafetyConfirmed(day, 'safe'), true);
  assert.equal(isRelationshipSafetyConfirmed({ id: 'T01-D09', topic_id: 'T01', day: 9 }, 'unsafe'), true);
});

test('relationship safety skip records are explicit and never fabricate a score', () => {
  const day = {
    id: 'T01-D17', topic_id: 'T01', day: 17,
    risk_level: 'caution', review_status: 'approved',
  };
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
  assert.throws(() => createRelationshipSafetySkipRecord({
    ...day, review_status: 'pending_expert_review',
  }), /approved or legacy routine/);
  assert.throws(() => createRelationshipSafetySkipRecord(day, 'not-a-date'));
  const boundaryRecord = createRelationshipSafetySkipRecord(
    { id: 'مرزبندی و نه گفتن-11', day: 11 },
    '2026-11-03T12:00:00.000Z'
  );
  assert.equal(boundaryRecord.status, 'skipped_safety_gate');
  assert.equal('score' in boundaryRecord, false);

  const sharedPromptRecord = createRelationshipSafetySkipRecord(
    { id: 'ترس-6', day: 6 },
    '2026-11-03T12:00:00.000Z'
  );
  assert.equal(sharedPromptRecord.status, 'skipped_safety_gate');
  assert.equal('score' in sharedPromptRecord, false);
  assert.throws(
    () => createRelationshipSafetySkipRecord({ id: 'کنترل‌گری-06', day: 6 }),
    /approved or legacy routine/
  );
});

test('actual shared interpersonal prompts across T03-T34 are gated', async () => {
  const [content, registry] = await Promise.all([
    readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../public/assistant/knowledge/topics.v1.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  const topicByName = new Map(registry.topics.map((topic) => [topic.name, topic]));
  for (const [categoryName, category] of Object.entries(content.categories)) {
    const topic = topicByName.get(categoryName);
    if (!topic) continue;
    const topicNumber = Number(topic.topic_id.slice(1));
    if (topicNumber >= 3) {
      for (const dayNumber of [6, 11, 15, 24]) {
        const day = category.days.find((candidate) => candidate.day === dayNumber);
        assert.ok(day, 'missing ' + categoryName + ' day ' + dayNumber);
        assert.equal(getRelationshipSafetyGate(day)?.gateId, 'relationship-communication-safety-v1');
        assert.match(String(day.exercise || '') + '\n' + String(day.actionText || ''),
          /درخواست|گفت.?وگو|مرز|مذاکره|بیان کن|مطرح کن|عذرخواهی|اقدام جبرانی|تقسیم وظیفه|راه.?حل|مسئله|مکث|ترمیم/u);
      }
    }
    if (topic.topic_id === 'T01') {
      for (const dayNumber of [10, 11, 17, 18, 19, 20, 21, 22, 23]) {
        const day = category.days.find((candidate) => candidate.day === dayNumber);
        assert.ok(day, 'missing T01 day ' + dayNumber);
        assert.equal(day.topic_id, 'T01');
        assert.equal(day.risk_level, 'caution');
        assert.equal(getRelationshipSafetyGate(day)?.gateId, 'relationship-communication-safety-v1');
      }
    }
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
    ['SRC-WHO-PSYCH-SELFHELP-2026-001', '2026-06-01', /do not demonstrate the effectiveness of this app/i],
    ['SRC-ER-REENTS-2026-001', '2026-04', /does not validate this app/i],
    ['SRC-AGGRESSION-AWMF-2026-001', '2026-06-25', /not a self-help protocol/i],
    ['SRC-ER-IMPAIRMENT-SLOAN-2026-001', '2026-05-29', /not an intervention meta-analysis/i],
  ];
  const ids = new Set(registry.sources.map((source) => source.source_id));
  for (const [id, date, limitation] of expected) {
    const source = registry.sources.find((item) => item.source_id === id);
    assert.ok(source, `missing source ${id}`);
    assert.equal(source.publication_date, date);
    assert.match(source.limitations, limitation);
    assert.ok(source.url.startsWith('https://'));
  }
  const violenceCare = registry.sources.find((item) => item.source_id === 'SRC-VIOLENCE-PSYCHOSOCIAL-LANCET-2026-001');
  assert.ok(violenceCare.authors?.includes('Anushka R. Patel'));
  assert.equal(violenceCare.pmid, '42309105');
  assert.match(violenceCare.limitations, /interpersonal-violence survivors/i);
  assert.match(violenceCare.limitations, /I² 77–84%/u);
  assert.match(violenceCare.limitations, /98% of included studies/i);
  for (const category of Object.values(content.categories || {})) {
    for (const day of category.days || []) {
      assert.equal((day.source_ids || []).some((id) => expected.some(([sourceId]) => sourceId === id)), false,
        'contextual sources must not be attached to a specific daily exercise before claim-level review');
    }
  }
  assert.equal(ids.size, registry.sources.length, 'evidence source identifiers must be unique');
});

test('support-seeking privacy notice covers shared legacy days and T02 message day only', () => {
  const day12Notice = getInterpersonalPrivacyNotice({ id: 'ترس-12', day: 12 });
  assert.match(day12Notice, /حافظه محلی مرورگر/);
  assert.match(day12Notice, /رمزگذاری نمی‌کند/);
  assert.match(getInterpersonalPrivacyNotice({ id: 'مشکلات رابطه-18', day: 18 }), /نظارت/);
  assert.match(getInterpersonalPrivacyNotice({ id: 'T02-D24', topic_id: 'T02', day: 24 }), /اعلان‌ها/);
  assert.equal(getInterpersonalPrivacyNotice({ id: 'خشم-12', topic_id: 'T01', day: 12 }), null);
  assert.equal(getInterpersonalPrivacyNotice({ id: 'اضطراب-18', topic_id: 'T02', day: 18 }), null);
  assert.equal(getInterpersonalPrivacyNotice({ id: 'ترس-15', day: 15 }), null);
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
  assert.match(app, /getDailySafetyMode\(activeDay\) === 'blocked'/);
  assert.match(ui, /relationshipSafetyConfirmed/);
  assert.match(app, /relationshipSafetyConfirmed !== true/);
  const humanReviewGateIndex = ui.indexOf('if (requiresHumanReview) return');
  const relationshipGateIndex = ui.indexOf('if (relationshipSafetyGate && !relationshipSafetyConfirmed) return');
  assert.ok(humanReviewGateIndex >= 0 && relationshipGateIndex >= 0 && humanReviewGateIndex < relationshipGateIndex, 'human-review blocking must precede the relationship self-check');
});
