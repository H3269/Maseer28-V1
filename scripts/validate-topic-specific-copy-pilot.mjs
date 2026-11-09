import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const source = read('reports/generated/content-rewrite-source-952.json');
if (source.records.length !== 952) throw new Error('Expected exactly 952 source records');
const sourceByKey = new Map(source.records.map((r) => [r.topic_name + ':' + r.day, r]));
const pilots = [
  { file: 'public/assistant/content-drafts/topic-specific-copy-pilot-t01-t06-days01-07.v1.json', expected: 42 },
  { file: 'public/assistant/content-drafts/topic-specific-copy-pilot-t07-t12-days04-07.v1.json', expected: 24 },
  { file: 'public/assistant/content-drafts/topic-specific-copy-pilot-t13-t18-days04-07.v1.json', expected: 24 },
  { file: 'public/assistant/content-drafts/topic-specific-copy-pilot-t19-t24-days04-07.v1.json', expected: 24 },
  { file: 'public/assistant/content-drafts/topic-specific-copy-pilot-t25-t30-days04-07.v1.json', expected: 24 },
  { file: 'public/assistant/content-drafts/topic-specific-copy-pilot-t31-t34-days04-07.v1.json', expected: 16 },
  { file: 'public/assistant/content-drafts/topic-specific-copy-pilot-all-34-day08.v1.json', expected: 34 },
  { file: 'public/assistant/content-drafts/topic-specific-copy-pilot-all-34-day09.v1.json', expected: 34 },
  { file: 'public/assistant/content-drafts/topic-specific-copy-pilot-all-34-day10.v1.json', expected: 34 },
  { file: 'public/assistant/content-drafts/topic-specific-copy-pilot-all-34-day11.v1.json', expected: 34 },
  { file: 'public/assistant/content-drafts/topic-specific-copy-pilot-all-34-day12.v1.json', expected: 34 },
  { file: 'public/assistant/content-drafts/topic-specific-copy-pilot-all-34-day13.v1.json', expected: 34 },
  { file: 'public/assistant/content-drafts/topic-specific-copy-pilot-all-34-day14.v1.json', expected: 34 },
];
const copyRecords = [];
let pilotRecordCount = 0;
for (const item of pilots) {
  const pilot = read(item.file);
  if (pilot.records.length !== item.expected) throw new Error(`Expected ${item.expected} records in ${item.file}`);
  if (pilot.status !== 'draft_pending_owner_and_expert_review') throw new Error('Pilot must remain a draft: ' + item.file);
  const keys = new Set();
  const titles = new Set();
  const intros = new Set();
  for (const r of pilot.records) {
    const key = r.topic_name + ':' + r.day_number;
    if (keys.has(key)) throw new Error('Duplicate topic/day: ' + key);
    keys.add(key);
    const original = sourceByKey.get(key);
    if (!original) throw new Error('Missing source record: ' + key);
    if (r.current_title !== original.title || r.current_intro !== original.intro) {
      throw new Error('Source title/intro mismatch: ' + key);
    }
    if (r.source_exercise !== undefined && r.source_exercise !== original.exercise) {
      throw new Error('Source exercise mismatch: ' + key);
    }
    if (r.source_action !== undefined && r.source_action !== original.actionText) {
      throw new Error('Source action mismatch: ' + key);
    }
    if (!r.proposed_title?.trim() || !r.proposed_intro?.trim()) throw new Error('Empty proposed copy: ' + key);
    if (titles.has(r.proposed_title)) throw new Error('Duplicate proposed title in batch: ' + key);
    if (intros.has(r.proposed_intro)) throw new Error('Duplicate proposed intro in batch: ' + key);
    titles.add(r.proposed_title);
    intros.add(r.proposed_intro);
    if (r.runtime_eligible !== false || r.reviewer !== null || r.reviewed_at !== null) {
      throw new Error('Unapproved pilot record must never be runtime eligible: ' + key);
    }
    if (r.review_status !== 'pending_owner_and_expert_review') throw new Error('Unexpected review status: ' + key);
    if (JSON.stringify(r.fields_changed) !== JSON.stringify(['title', 'intro'])) {
      throw new Error('Unexpected fields_changed: ' + key);
    }
    copyRecords.push(r);
  }
  if (keys.size !== item.expected) throw new Error('Incomplete topic/day coverage: ' + item.file);
  pilotRecordCount += keys.size;
}
const fullCoverageFiles = [
  'public/assistant/content-drafts/day01-shared-copy-proposals-34-topics.v1.json',
  'public/assistant/content-drafts/day02-shared-copy-proposals-34-topics.v1.json',
  'public/assistant/content-drafts/day03-shared-copy-proposals-34-topics.v1.json',
];
for (const file of fullCoverageFiles) {
  const batch = read(file);
  if (batch.records.length !== 34) throw new Error('Expected 34 records in ' + file);
  for (const r of batch.records) {
    const key = r.topic_name + ':' + (r.day_number ?? r.day);
    const original = sourceByKey.get(key);
    if (!original || r.source_content_id !== original.content_id) throw new Error('Full-coverage source reference mismatch: ' + key);
    if (r.runtime_eligible !== false) throw new Error('Full-coverage proposal must remain non-runtime: ' + key);
    copyRecords.push(r);
  }
}
const byTopicDay = new Map();
for (const r of copyRecords) {
  const key = r.topic_name + ':' + (r.day_number ?? r.day);
  const existing = byTopicDay.get(key);
  if (existing && (existing.proposed_title !== r.proposed_title || existing.proposed_intro !== r.proposed_intro)) {
    throw new Error('Conflicting title/intro proposals for ' + key);
  }
  if (!existing) byTopicDay.set(key, { topic_name: r.topic_name, day: r.day_number ?? r.day, proposed_title: r.proposed_title, proposed_intro: r.proposed_intro });
}
if (byTopicDay.size !== 476) throw new Error('Expected 476 unique topic/day title-intro pairs, found ' + byTopicDay.size);
for (let day = 1; day <= 14; day += 1) {
  const records = [...byTopicDay.values()].filter((r) => r.day === day);
  if (records.length !== 34) throw new Error(`Expected all 34 topics on day ${day}, found ${records.length}`);
  if (new Set(records.map((r) => r.proposed_title)).size !== 34) throw new Error('Duplicate title across topics on day ' + day);
  if (new Set(records.map((r) => r.proposed_intro)).size !== 34) throw new Error('Duplicate intro across topics on day ' + day);
}
process.stdout.write(`Validated ${pilotRecordCount} traceable, unique, non-runtime pilot records and 476 complete first-fourteen-day topic/day title-intro pairs.\\n`);
