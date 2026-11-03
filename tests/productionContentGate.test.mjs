import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionContent } from '../src/features/content/productionContentGate.js';

function fixture() {
  const day = {
    id: 'T01-D01',
    day: 1,
    topic_id: 'T01',
    subtopic_ids: ['T01-S01'],
    learning_objective: 'شناخت یک الگوی مشخص',
    target_skill: 'خودمشاهده‌گری',
    teaching_point: 'یک نکته آموزشی محدود و روشن',
    exercise_type: 'self_monitoring',
    instructions: 'یک نمونه امن را ثبت کن.',
    duration_minutes: 5,
    reflection_prompt: 'چه چیزی آموختی؟',
    success_criterion: 'یک نمونه واقعی ثبت شود.',
    stop_conditions: ['در صورت ناراحتی تمرین متوقف شود.'],
    contraindications: ['در موقعیت ناامن انجام نشود.'],
    risk_level: 'routine',
    when_to_seek_human_support: 'در اختلال عملکرد از متخصص کمک بگیر.',
    source_ids: ['SRC-TEST-001'],
    evidence_grade: 'moderate',
    review_status: 'approved',
    review_record_id: 'REV-T01-D01',
    reviewer_name: 'بازبین واجد صلاحیت',
    reviewer_role: 'qualified_clinician',
    reviewed_at: '2026-11-03T12:00:00.000Z',
  };
  return {
    content: { categories: { 'موضوع آزمایشی': { days: [day] } } },
    topicsRegistry: {
      topics: [{
        topic_id: 'T01', name: 'موضوع آزمایشی',
        definition: 'تعریف آزمایشیِ تأییدشده',
        definition_status: 'approved', review_status: 'approved',
        content_ids: ['T01-D01'], draft_content_ids: [],
      }],
    },
    subtopicsRegistry: {
      subtopics: [{
        subtopic_id: 'T01-S01', topic_id: 'T01',
        definition: 'تعریف زیرموضوع آزمایشیِ تأییدشده',
        definition_status: 'approved', review_status: 'approved',
        content_ids: ['T01-D01'], draft_content_ids: [],
      }],
    },
    evidenceRegistry: { sources: [{ source_id: 'SRC-TEST-001' }] },
    expectedTopics: 1,
    expectedDays: 1,
  };
}

test('production content gate accepts only fully reviewed and linked daily units', () => {
  assert.deepEqual(validateProductionContent(fixture()), []);
});

test('production content gate blocks draft daily units even when they are linked', () => {
  const data = fixture();
  data.content.categories['موضوع آزمایشی'].days[0].review_status = 'pending_expert_review';
  data.topicsRegistry.topics[0].content_ids = [];
  data.topicsRegistry.topics[0].draft_content_ids = ['T01-D01'];
  data.subtopicsRegistry.subtopics[0].content_ids = [];
  data.subtopicsRegistry.subtopics[0].draft_content_ids = ['T01-D01'];
  const errors = validateProductionContent(data);
  assert.ok(errors.some((item) => item.includes('not expert-approved')));
});

test('production content gate rejects approved days with unapproved topic definitions', () => {
  const data = fixture();
  const topic = data.topicsRegistry.topics[0];
  topic.review_status = 'draft';
  topic.definition_status = 'pending_expert_review';
  topic.definition = null;
  const errors = validateProductionContent(data);
  assert.ok(errors.some((item) => item.includes('topic definition is not expert-approved')));
});

test('production content gate rejects approved days with unapproved subtopic definitions', () => {
  const data = fixture();
  const subtopic = data.subtopicsRegistry.subtopics[0];
  subtopic.review_status = 'draft';
  subtopic.definition_status = 'pending_expert_review';
  subtopic.definition = null;
  const errors = validateProductionContent(data);
  assert.ok(errors.some((item) => item.includes('subtopic T01-S01 definition is not expert-approved')));
});

test('production content gate requires T31 subtype and matching approved context', () => {
  const data = fixture();
  const day = data.content.categories['موضوع آزمایشی'].days[0];
  const topic = data.topicsRegistry.topics[0];
  const subtopic = data.subtopicsRegistry.subtopics[0];
  day.id = 'T31-D01';
  day.topic_id = 'T31';
  day.subtopic_ids = ['T31-S01'];
  day.control_context = 'self_control_need';
  day.review_record_id = 'REV-T31-D01';
  topic.topic_id = 'T31';
  topic.content_ids = ['T31-D01'];
  subtopic.subtopic_id = 'T31-S01';
  subtopic.topic_id = 'T31';
  subtopic.content_ids = ['T31-D01'];

  assert.deepEqual(validateProductionContent(data), []);

  day.control_context = 'interpersonal_coercive_control';
  const mismatchErrors = validateProductionContent(data);
  assert.ok(mismatchErrors.some((item) => item.includes('control topic subtype and context are not explicitly classified')));

  day.control_context = 'self_control_need';
  subtopic.review_status = 'draft';
  const draftSubtypeErrors = validateProductionContent(data);
  assert.ok(draftSubtypeErrors.some((item) => item.includes('subtopic T31-S01 definition is not expert-approved')));

  subtopic.review_status = 'approved';
  day.id = 'کنترل‌گری-01';
  topic.content_ids = ['کنترل‌گری-01'];
  subtopic.content_ids = ['کنترل‌گری-01'];
  assert.deepEqual(validateProductionContent(data), [],
    'legacy T31 identifiers must use the same shared subtype policy');
});

test('production content gate rejects missing evidence and reviewer attribution', () => {
  const data = fixture();
  const day = data.content.categories['موضوع آزمایشی'].days[0];
  day.source_ids = ['SRC-MISSING'];
  day.review_record_id = '';
  day.reviewer_role = 'unknown';
  day.evidence_grade = 'not_assessed';
  const errors = validateProductionContent(data);
  assert.ok(errors.some((item) => item.includes('source_ids')));
  assert.ok(errors.some((item) => item.includes('review_record_id')));
  assert.ok(errors.some((item) => item.includes('reviewer_role')));
  assert.ok(errors.some((item) => item.includes('evidence_grade')));
});

test('production content gate rejects orphaned approval links', () => {
  const data = fixture();
  data.subtopicsRegistry.subtopics[0].content_ids = [];
  const errors = validateProductionContent(data);
  assert.ok(errors.some((item) => item.includes('approved subtopic content link is missing')));
});

test('production content gate rejects missing or duplicate daily identifiers', () => {
  const missing = fixture();
  missing.content.categories['موضوع آزمایشی'].days[0].id = '';
  const missingErrors = validateProductionContent(missing);
  assert.ok(missingErrors.some((item) => item.includes('stable daily content id is missing')));

  const duplicate = fixture();
  const second = { ...duplicate.content.categories['موضوع آزمایشی'].days[0], day: 2 };
  duplicate.content.categories['موضوع آزمایشی'].days.push(second);
  duplicate.expectedDays = 2;
  const duplicateErrors = validateProductionContent(duplicate);
  assert.ok(duplicateErrors.some((item) => item.includes('duplicate daily content id')));
});

test('production content gate rejects invalid day sequencing', () => {
  const data = fixture();
  data.content.categories['موضوع آزمایشی'].days[0].day = 2;
  const errors = validateProductionContent(data);
  assert.ok(errors.some((item) => item.includes('day sequence is invalid')));
});

test('evidence registry records are unique, traceable, and explicitly limited', async () => {
  const registry = JSON.parse(await (await import('node:fs/promises')).readFile(
    new URL('../public/assistant/evidence/sources.v1.json', import.meta.url), 'utf8'
  ));
  assert.ok(Array.isArray(registry.sources));
  const ids = registry.sources.map((source) => source.source_id);
  assert.ok(ids.every((id) => typeof id === 'string' && id.trim()));
  assert.equal(new Set(ids).size, ids.length, 'evidence source IDs must be unique');
  for (const source of registry.sources) {
    assert.ok(source.title && source.url && source.limitations, `${source.source_id} needs title, URL, and limitations`);
    assert.ok(Array.isArray(source.relevant_claims) && source.relevant_claims.length > 0, `${source.source_id} needs claim-level mapping`);
  }
  for (const id of [
    'SRC-ER-SACCARO-2024-001',
    'SRC-ER-REENTS-2026-001',
    'SRC-AGGRESSION-AWMF-2026-001',
    'SRC-ER-IMPAIRMENT-SLOAN-2026-001',
    'SRC-ANGER-MINDFULNESS-ER-2026-001',
    'SRC-DMHI-SAFETY-TAHER-2023-001',
    'SRC-DMHI-NSQDMH-2026-001',
  ]) assert.ok(ids.includes(id), `missing curated source ${id}`);
});

test('public deployment and Telegram publication retain expert approval gates', async () => {
  const [deploy, publish] = await Promise.all([
    (await import('node:fs/promises')).readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8'),
    (await import('node:fs/promises')).readFile(new URL('../.github/workflows/publish-tested-version.yml', import.meta.url), 'utf8'),
  ]);
  assert.match(deploy, /confirm_public_release == 'yes'/);
  assert.match(deploy, /actions: read/);
  assert.match(deploy, /head_sha=\$\{GITHUB_SHA\}/);
  assert.match(deploy, /assert-validation-run\.mjs/);
  assert.match(deploy, /npm run assert:production-content/);
  assert.match(publish, /inputs\.publish == 'publish'/);
  assert.match(publish, /github\.ref == 'refs\/heads\/main'/);
  assert.match(publish, /assert-validation-run\.mjs/);
  assert.match(publish, /npm run assert:production-content/);
});

test('current repository content remains blocked from production until all 952 units are reviewed', async () => {
  const readJson = async (relative) => JSON.parse(
    await (await import('node:fs/promises')).readFile(new URL(relative, import.meta.url), 'utf8')
  );
  const [content, topicsRegistry, subtopicsRegistry, evidenceRegistry] = await Promise.all([
    readJson('../public/content/path-content.json'),
    readJson('../public/assistant/knowledge/topics.v1.json'),
    readJson('../public/assistant/knowledge/subtopics.v1.json'),
    readJson('../public/assistant/evidence/sources.v1.json'),
  ]);
  const errors = validateProductionContent({ content, topicsRegistry, subtopicsRegistry, evidenceRegistry });
  assert.ok(errors.length > 0);
  assert.ok(errors.some((item) => item.includes('not expert-approved')));
});
