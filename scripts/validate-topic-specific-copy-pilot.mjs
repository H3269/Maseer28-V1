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
];
let total = 0;
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
  }
  if (keys.size !== item.expected) throw new Error('Incomplete topic/day coverage: ' + item.file);
  total += keys.size;
}
process.stdout.write(`Validated ${total} source-traceable, unique, non-runtime pilot records across six batches.\\n`);
