import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionContent } from '../src/features/content/productionContentGate.js';

function fixture() {
  const day = {
    id: 'T01-D01',
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
        content_ids: ['T01-D01'], draft_content_ids: [],
      }],
    },
    subtopicsRegistry: {
      subtopics: [{
        subtopic_id: 'T01-S01', topic_id: 'T01',
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
