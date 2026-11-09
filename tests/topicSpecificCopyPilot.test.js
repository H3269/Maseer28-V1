import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pilot = JSON.parse(fs.readFileSync(
  path.join(root, 'public/assistant/content-drafts/topic-specific-copy-pilot-t01-t06-days01-07.v1.json'),
  'utf8'
));

test('six-topic first-week copy pilot is complete, unique, traceable, and non-runtime', () => {
  assert.equal(pilot.status, 'draft_pending_owner_and_expert_review');
  assert.equal(pilot.records.length, 42);
  assert.equal(new Set(pilot.records.map((x) => x.source_content_id)).size, 42);
  assert.equal(new Set(pilot.records.map((x) => x.proposed_title)).size, 42);
  assert.equal(new Set(pilot.records.map((x) => x.proposed_intro)).size, 42);

  const topicDays = new Set();
  for (const record of pilot.records) {
    assert.ok(record.source_content_id);
    assert.ok(record.current_title);
    assert.ok(record.current_intro);
    assert.ok(record.proposed_title);
    assert.ok(record.proposed_intro);
    assert.deepEqual(record.fields_changed, ['title', 'intro']);
    assert.equal(record.runtime_eligible, false);
    assert.equal(record.review_status, 'pending_owner_and_expert_review');
    assert.equal(record.reviewer, null);
    assert.equal(record.reviewed_at, null);
    topicDays.add(record.topic_name + ':' + record.day_number);
  }
  assert.equal(topicDays.size, 42);
  assert.deepEqual([...new Set(pilot.records.map((x) => x.topic_name))].sort(), [
    'خشم', 'اضطراب', 'ترس', 'غم و سوگ', 'حسادت', 'نفرت'
  ].sort());
});

test('T07-T12 day 4-7 copy pilot is traceable, unique, and non-runtime', () => {
  const pilot = JSON.parse(fs.readFileSync(
    path.join(root, 'public/assistant/content-drafts/topic-specific-copy-pilot-t07-t12-days04-07.v1.json'),
    'utf8'
  ));
  assert.equal(pilot.status, 'draft_pending_owner_and_expert_review');
  assert.equal(pilot.records.length, 24);
  assert.equal(new Set(pilot.records.map((x) => x.source_content_id)).size, 24);
  assert.equal(new Set(pilot.records.map((x) => x.proposed_title)).size, 24);
  assert.equal(new Set(pilot.records.map((x) => x.proposed_intro)).size, 24);
  for (const record of pilot.records) {
    assert.ok(record.source_content_id);
    assert.ok(record.source_exercise);
    assert.ok(record.source_action);
    assert.ok(record.current_title);
    assert.ok(record.current_intro);
    assert.deepEqual(record.fields_changed, ['title', 'intro']);
    assert.equal(record.runtime_eligible, false);
    assert.equal(record.review_status, 'pending_owner_and_expert_review');
    assert.equal(record.reviewer, null);
    assert.equal(record.reviewed_at, null);
  }
});

test('T13-T18 day 4-7 copy pilot is traceable, unique, and non-runtime', () => {
  const pilot = JSON.parse(fs.readFileSync(
    path.join(root, 'public/assistant/content-drafts/topic-specific-copy-pilot-t13-t18-days04-07.v1.json'),
    'utf8'
  ));
  assert.equal(pilot.status, 'draft_pending_owner_and_expert_review');
  assert.equal(pilot.records.length, 24);
  assert.equal(new Set(pilot.records.map((x) => x.source_content_id)).size, 24);
  assert.equal(new Set(pilot.records.map((x) => x.proposed_title)).size, 24);
  assert.equal(new Set(pilot.records.map((x) => x.proposed_intro)).size, 24);
  for (const record of pilot.records) {
    assert.ok(record.source_content_id);
    assert.ok(record.source_exercise);
    assert.ok(record.source_action);
    assert.ok(record.current_title);
    assert.ok(record.current_intro);
    assert.deepEqual(record.fields_changed, ['title', 'intro']);
    assert.equal(record.runtime_eligible, false);
    assert.equal(record.review_status, 'pending_owner_and_expert_review');
    assert.equal(record.reviewer, null);
    assert.equal(record.reviewed_at, null);
  }
});

test('T19-T24 day 4-7 copy pilot is traceable, unique, and non-runtime', () => {
  const pilot = JSON.parse(fs.readFileSync(
    path.join(root, 'public/assistant/content-drafts/topic-specific-copy-pilot-t19-t24-days04-07.v1.json'),
    'utf8'
  ));
  assert.equal(pilot.status, 'draft_pending_owner_and_expert_review');
  assert.equal(pilot.records.length, 24);
  assert.equal(new Set(pilot.records.map((x) => x.source_content_id)).size, 24);
  assert.equal(new Set(pilot.records.map((x) => x.proposed_title)).size, 24);
  assert.equal(new Set(pilot.records.map((x) => x.proposed_intro)).size, 24);
  for (const record of pilot.records) {
    assert.ok(record.source_content_id);
    assert.ok(record.source_exercise);
    assert.ok(record.source_action);
    assert.ok(record.current_title);
    assert.ok(record.current_intro);
    assert.deepEqual(record.fields_changed, ['title', 'intro']);
    assert.equal(record.runtime_eligible, false);
    assert.equal(record.review_status, 'pending_owner_and_expert_review');
    assert.equal(record.reviewer, null);
    assert.equal(record.reviewed_at, null);
  }
});

test('T25-T30 day 4-7 copy pilot is traceable, unique, and non-runtime', () => {
  const pilot = JSON.parse(fs.readFileSync(
    path.join(root, 'public/assistant/content-drafts/topic-specific-copy-pilot-t25-t30-days04-07.v1.json'),
    'utf8'
  ));
  assert.equal(pilot.status, 'draft_pending_owner_and_expert_review');
  assert.equal(pilot.records.length, 24);
  assert.equal(new Set(pilot.records.map((x) => x.source_content_id)).size, 24);
  assert.equal(new Set(pilot.records.map((x) => x.proposed_title)).size, 24);
  assert.equal(new Set(pilot.records.map((x) => x.proposed_intro)).size, 24);
  for (const record of pilot.records) {
    assert.ok(record.source_content_id);
    assert.ok(record.source_exercise);
    assert.ok(record.source_action);
    assert.ok(record.current_title);
    assert.ok(record.current_intro);
    assert.deepEqual(record.fields_changed, ['title', 'intro']);
    assert.equal(record.runtime_eligible, false);
    assert.equal(record.review_status, 'pending_owner_and_expert_review');
    assert.equal(record.reviewer, null);
    assert.equal(record.reviewed_at, null);
  }
});

test('T31-T34 day 4-7 copy pilot is traceable, unique, and non-runtime', () => {
  const pilot = JSON.parse(fs.readFileSync(
    path.join(root, 'public/assistant/content-drafts/topic-specific-copy-pilot-t31-t34-days04-07.v1.json'),
    'utf8'
  ));
  assert.equal(pilot.status, 'draft_pending_owner_and_expert_review');
  assert.equal(pilot.records.length, 16);
  assert.equal(new Set(pilot.records.map((x) => x.source_content_id)).size, 16);
  assert.equal(new Set(pilot.records.map((x) => x.proposed_title)).size, 16);
  assert.equal(new Set(pilot.records.map((x) => x.proposed_intro)).size, 16);
  for (const record of pilot.records) {
    assert.ok(record.source_content_id);
    assert.ok(record.source_exercise);
    assert.ok(record.source_action);
    assert.ok(record.current_title);
    assert.ok(record.current_intro);
    assert.deepEqual(record.fields_changed, ['title', 'intro']);
    assert.equal(record.runtime_eligible, false);
    assert.equal(record.review_status, 'pending_owner_and_expert_review');
    assert.equal(record.reviewer, null);
    assert.equal(record.reviewed_at, null);
  }
});

test('day-eight copy pilot covers all 34 topics with traceable unique copy', () => {
  const pilot = JSON.parse(fs.readFileSync(
    path.join(root, 'public/assistant/content-drafts/topic-specific-copy-pilot-all-34-day08.v1.json'),
    'utf8'
  ));
  assert.equal(pilot.status, 'draft_pending_owner_and_expert_review');
  assert.equal(pilot.records.length, 34);
  assert.equal(new Set(pilot.records.map((x) => x.source_content_id)).size, 34);
  assert.equal(new Set(pilot.records.map((x) => x.proposed_title)).size, 34);
  assert.equal(new Set(pilot.records.map((x) => x.proposed_intro)).size, 34);
  for (const record of pilot.records) {
    assert.ok(record.source_content_id);
    assert.ok(record.source_exercise);
    assert.ok(record.source_action);
    assert.ok(record.current_title);
    assert.ok(record.current_intro);
    assert.deepEqual(record.fields_changed, ['title', 'intro']);
    assert.equal(record.runtime_eligible, false);
    assert.equal(record.review_status, 'pending_owner_and_expert_review');
    assert.equal(record.reviewer, null);
    assert.equal(record.reviewed_at, null);
  }
});

test('day-nine copy pilot covers all 34 topics with traceable unique copy', () => {
  const pilot = JSON.parse(fs.readFileSync(
    path.join(root, 'public/assistant/content-drafts/topic-specific-copy-pilot-all-34-day09.v1.json'),
    'utf8'
  ));
  assert.equal(pilot.status, 'draft_pending_owner_and_expert_review');
  assert.equal(pilot.records.length, 34);
  assert.equal(new Set(pilot.records.map((x) => x.source_content_id)).size, 34);
  assert.equal(new Set(pilot.records.map((x) => x.proposed_title)).size, 34);
  assert.equal(new Set(pilot.records.map((x) => x.proposed_intro)).size, 34);
  for (const record of pilot.records) {
    assert.ok(record.source_content_id);
    assert.ok(record.source_exercise);
    assert.ok(record.source_action);
    assert.ok(record.current_title);
    assert.ok(record.current_intro);
    assert.deepEqual(record.fields_changed, ['title', 'intro']);
    assert.equal(record.runtime_eligible, false);
    assert.equal(record.review_status, 'pending_owner_and_expert_review');
    assert.equal(record.reviewer, null);
    assert.equal(record.reviewed_at, null);
  }
});

test('day-ten copy pilot covers all 34 topics with traceable unique copy', () => {
  const pilot = JSON.parse(fs.readFileSync(
    path.join(root, 'public/assistant/content-drafts/topic-specific-copy-pilot-all-34-day10.v1.json'),
    'utf8'
  ));
  assert.equal(pilot.status, 'draft_pending_owner_and_expert_review');
  assert.equal(pilot.records.length, 34);
  assert.equal(new Set(pilot.records.map((x) => x.source_content_id)).size, 34);
  assert.equal(new Set(pilot.records.map((x) => x.proposed_title)).size, 34);
  assert.equal(new Set(pilot.records.map((x) => x.proposed_intro)).size, 34);
  for (const record of pilot.records) {
    assert.ok(record.source_content_id);
    assert.ok(record.source_exercise);
    assert.ok(record.source_action);
    assert.ok(record.current_title);
    assert.ok(record.current_intro);
    assert.deepEqual(record.fields_changed, ['title', 'intro']);
    assert.equal(record.runtime_eligible, false);
    assert.equal(record.review_status, 'pending_owner_and_expert_review');
    assert.equal(record.reviewer, null);
    assert.equal(record.reviewed_at, null);
  }
});


for (const day of [11, 12]) {
  test(`day-${day} copy pilot covers all 34 topics with unique, traceable, non-runtime copy`, () => {
    const pilot = JSON.parse(fs.readFileSync(
      path.join(root, `public/assistant/content-drafts/topic-specific-copy-pilot-all-34-day${day}.v1.json`),
      'utf8'
    ));
    assert.equal(pilot.status, 'draft_pending_owner_and_expert_review');
    assert.equal(pilot.records.length, 34);
    assert.equal(new Set(pilot.records.map((x) => x.source_content_id)).size, 34);
    assert.equal(new Set(pilot.records.map((x) => x.proposed_title)).size, 34);
    assert.equal(new Set(pilot.records.map((x) => x.proposed_intro)).size, 34);
    for (const record of pilot.records) {
      assert.ok(record.current_title);
      assert.ok(record.current_intro);
      assert.ok(record.proposed_title);
      assert.ok(record.proposed_intro);
      assert.equal(record.source_content_id, record.topic_name + '-' + String(day).padStart(2, '0'));
      assert.deepEqual(record.fields_changed, ['title', 'intro']);
      assert.equal(record.runtime_eligible, false);
      assert.equal(record.review_status, 'pending_owner_and_expert_review');
      assert.equal(record.reviewer, null);
      assert.equal(record.reviewed_at, null);
    }
  });
}

for (const day of [13, 14]) {
  test(`day-${day} copy pilot covers all 34 topics with unique, source-matched, non-runtime copy`, () => {
    const pilot = JSON.parse(fs.readFileSync(
      path.join(root, `public/assistant/content-drafts/topic-specific-copy-pilot-all-34-day${day}.v1.json`),
      'utf8'
    ));
    assert.equal(pilot.status, 'draft_pending_owner_and_expert_review');
    assert.equal(pilot.records.length, 34);
    assert.equal(new Set(pilot.records.map((x) => x.source_content_id)).size, 34);
    assert.equal(new Set(pilot.records.map((x) => x.proposed_title)).size, 34);
    assert.equal(new Set(pilot.records.map((x) => x.proposed_intro)).size, 34);
    for (const record of pilot.records) {
      assert.ok(record.source_exercise);
      assert.ok(record.source_action);
      assert.ok(record.current_title);
      assert.ok(record.current_intro);
      assert.equal(record.runtime_eligible, false);
      assert.equal(record.review_status, 'pending_owner_and_expert_review');
      assert.equal(record.reviewer, null);
      assert.equal(record.reviewed_at, null);
    }
  });
}

for (const day of [15, 16]) {
  test(`day-${day} copy pilot covers all 34 topics with unique, source-matched, non-runtime copy`, () => {
    const pilot = JSON.parse(fs.readFileSync(
      path.join(root, `public/assistant/content-drafts/topic-specific-copy-pilot-all-34-day${day}.v1.json`),
      'utf8'
    ));
    assert.equal(pilot.status, 'draft_pending_owner_and_expert_review');
    assert.equal(pilot.records.length, 34);
    assert.equal(new Set(pilot.records.map((x) => x.source_content_id)).size, 34);
    assert.equal(new Set(pilot.records.map((x) => x.proposed_title)).size, 34);
    assert.equal(new Set(pilot.records.map((x) => x.proposed_intro)).size, 34);
    for (const record of pilot.records) {
      assert.ok(record.source_exercise);
      assert.ok(record.source_action);
      assert.ok(record.current_title);
      assert.ok(record.current_intro);
      assert.equal(record.runtime_eligible, false);
      assert.equal(record.review_status, 'pending_owner_and_expert_review');
      assert.equal(record.reviewer, null);
      assert.equal(record.reviewed_at, null);
    }
  });
}

for (const day of [17, 18]) {
  test(`day-${day} copy pilot covers all 34 topics with unique, source-matched, non-runtime copy`, () => {
    const pilot = JSON.parse(fs.readFileSync(
      path.join(root, `public/assistant/content-drafts/topic-specific-copy-pilot-all-34-day${day}.v1.json`),
      'utf8'
    ));
    assert.equal(pilot.status, 'draft_pending_owner_and_expert_review');
    assert.equal(pilot.records.length, 34);
    assert.equal(new Set(pilot.records.map((x) => x.source_content_id)).size, 34);
    assert.equal(new Set(pilot.records.map((x) => x.proposed_title)).size, 34);
    assert.equal(new Set(pilot.records.map((x) => x.proposed_intro)).size, 34);
    for (const record of pilot.records) {
      assert.ok(record.source_exercise);
      assert.ok(record.source_action);
      assert.ok(record.current_title);
      assert.ok(record.current_intro);
      assert.equal(record.runtime_eligible, false);
      assert.equal(record.review_status, 'pending_owner_and_expert_review');
      assert.equal(record.reviewer, null);
      assert.equal(record.reviewed_at, null);
    }
  });
}

for (const day of [19, 20]) {
  test(`day-${day} copy pilot covers all 34 topics with unique, source-matched, non-runtime copy`, () => {
    const pilot = JSON.parse(fs.readFileSync(
      path.join(root, `public/assistant/content-drafts/topic-specific-copy-pilot-all-34-day${day}.v1.json`),
      'utf8'
    ));
    assert.equal(pilot.status, 'draft_pending_owner_and_expert_review');
    assert.equal(pilot.records.length, 34);
    assert.equal(new Set(pilot.records.map((x) => x.source_content_id)).size, 34);
    assert.equal(new Set(pilot.records.map((x) => x.proposed_title)).size, 34);
    assert.equal(new Set(pilot.records.map((x) => x.proposed_intro)).size, 34);
    for (const record of pilot.records) {
      assert.ok(record.source_exercise);
      assert.ok(record.source_action);
      assert.ok(record.current_title);
      assert.ok(record.current_intro);
      assert.equal(record.runtime_eligible, false);
      assert.equal(record.review_status, 'pending_owner_and_expert_review');
      assert.equal(record.reviewer, null);
      assert.equal(record.reviewed_at, null);
    }
  });
}
