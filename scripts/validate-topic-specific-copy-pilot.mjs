import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const source = read('reports/generated/content-rewrite-source-952.json');
const pilot = read('public/assistant/content-drafts/topic-specific-copy-pilot-t01-t06-days01-07.v1.json');

if (source.records.length !== 952) throw new Error('Expected exactly 952 source records');
if (pilot.records.length !== 42) throw new Error('Expected exactly 42 pilot records');
if (pilot.status !== 'draft_pending_owner_and_expert_review') throw new Error('Pilot must remain a draft');
const sourceByKey = new Map(source.records.map((r) => [r.topic_name + ':' + r.day, r]));
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
    throw new Error('Source traceability mismatch: ' + key);
  }
  if (!r.proposed_title?.trim() || !r.proposed_intro?.trim()) throw new Error('Empty proposed copy: ' + key);
  if (titles.has(r.proposed_title)) throw new Error('Duplicate proposed title: ' + r.proposed_title);
  if (intros.has(r.proposed_intro)) throw new Error('Duplicate proposed intro: ' + r.proposed_intro);
  titles.add(r.proposed_title);
  intros.add(r.proposed_intro);
  if (r.runtime_eligible !== false || r.reviewer !== null || r.reviewed_at !== null) {
    throw new Error('Unapproved pilot record must never be runtime eligible: ' + key);
  }
  if (r.review_status !== 'pending_owner_and_expert_review') throw new Error('Unexpected review status: ' + key);
}
if (keys.size !== 42) throw new Error('Expected 42 unique topic/day pairs');
process.stdout.write('Validated 42 source-traceable, unique, non-runtime pilot records.\n');
