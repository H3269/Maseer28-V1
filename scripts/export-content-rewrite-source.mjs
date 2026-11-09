import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeDailyTextOverrides } from '../src/features/content/dailyTextOverrides.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const base = readJson('public/content/path-content.json');
const overrides = readJson('public/content/daily-text-overrides.v1.json');
const content = mergeDailyTextOverrides(base, overrides);
const fields = [
  'title', 'intro', 'exercise', 'actionText', 'closing',
  'lightExerciseText', 'lightActionText', 'progressActionText',
  'restExerciseText', 'restActionText',
];
const records = Object.entries(content.categories ?? {}).flatMap(([topicName, category]) =>
  (category.days ?? []).map((day) => ({
    topic_name: topicName,
    day: Number(day.day),
    content_id: day.id ?? day.contentId ?? null,
    ...Object.fromEntries(fields.map((field) => [field, String(day[field] ?? '')])),
  }))
);
if (records.length !== 952) {
  throw new Error(`Expected 952 runtime content records, found ${records.length}`);
}
const output = {
  schema_version: '1.0.0',
  report_type: 'runtime_content_rewrite_source',
  status: 'source_snapshot_for_manual_redesign_not_approval',
  source: 'path-content.json merged with daily-text-overrides.v1.json',
  expected_records: 952,
  observed_records: records.length,
  fields,
  records,
  limitations: [
    'This is a source snapshot for content redesign, not expert or clinical approval.',
    'Textual uniqueness does not establish scientific validity, suitability, or safety.',
    'Do not activate rewritten content until the owner and qualified reviewers complete their respective gates.',
  ],
};
const outDir = path.join(root, 'reports/generated');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'content-rewrite-source-952.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
process.stdout.write(`Exported ${records.length} runtime content records to ${path.relative(root, outPath)}\n`);
