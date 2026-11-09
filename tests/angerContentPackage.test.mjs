import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const persianDigits = (value) => value.replace(/[۰-۹]/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit).toString());
const fields = [
  'هدف', 'مهارت', 'سازوکار', 'تمرین', 'اقدام',
  'نسخه سبک', 'نسخه پیشرفت', 'نسخه استراحت',
  'معیار موفقیت', 'پرسش بازتاب', 'شرط توقف/احتیاط',
];

function parseDraft(markdown) {
  const headings = [...markdown.matchAll(/^### روز ([۰-۹0-9]+) — (.+)$/gm)];
  return headings.map((heading, index) => {
    const start = heading.index;
    const end = headings[index + 1]?.index ?? markdown.length;
    const block = markdown.slice(start, end);
    const values = Object.fromEntries(fields.map((field) => {
      const line = block.split('\n').find((item) => item.startsWith('- **' + field + ':** '));
      return [field, line ? line.slice(('- **' + field + ':** ').length).trim() : ''];
    }));
    return { day: Number(persianDigits(heading[1])), title: heading[2].trim(), values };
  });
}

test('T01 anger package contains 28 complete, unique daily learning units', async () => {
  const markdown = await read('docs/CONTENT_T01_ANGER_28_DAY_REDESIGN_DRAFT_B2Z_FA.md');
  const days = parseDraft(markdown);
  assert.equal(days.length, 28);
  assert.deepEqual(days.map((day) => day.day), Array.from({ length: 28 }, (_, index) => index + 1));
  for (const field of fields) {
    const values = days.map((day) => day.values[field]);
    assert.ok(values.every(Boolean), `missing ${field}`);
    assert.equal(new Set(values).size, 28, `${field} must be unique across T01 days`);
  }
});

test('T01 anger runtime exercise/action overrides match the reviewed source draft', async () => {
  const markdown = await read('docs/CONTENT_T01_ANGER_28_DAY_REDESIGN_DRAFT_B2Z_FA.md');
  const draft = parseDraft(markdown);
  const overlay = JSON.parse(await read('public/content/daily-text-overrides.v1.json'));
  const runtime = overlay.categories['خشم']?.days ?? [];
  assert.equal(runtime.length, 28);
  for (const day of draft) {
    const item = runtime.find((entry) => entry.day === day.day);
    assert.ok(item, `missing runtime day ${day.day}`);
    assert.equal(item.exercise, day.values['تمرین'], `exercise mismatch day ${day.day}`);
    assert.equal(item.actionText, day.values['اقدام'], `action mismatch day ${day.day}`);
  }
});

test('T01 anger exercises and actions have no exact duplicates across the other 33 topics', async () => {
  const overlay = JSON.parse(await read('public/content/daily-text-overrides.v1.json'));
  const categories = overlay.categories;
  const anger = categories['خشم'].days;
  const normalize = (value) => value.normalize('NFKC').replace(/\\s+/g, ' ').trim();
  for (const field of ['exercise', 'actionText']) {
    const angerValues = new Set(anger.map((day) => normalize(day[field])));
    for (const [topic, category] of Object.entries(categories)) {
      if (topic === 'خشم') continue;
      for (const day of category.days ?? []) {
        assert.ok(!angerValues.has(normalize(day[field])), `exact ${field} duplicate: T01 day vs ${topic} day ${day.day}`);
      }
    }
  }
});

test('all 28 T01 days have valid source references in the evidence registry', async () => {
  const csv = await read('docs/CONTENT_952_DAILY_AUDIT_INDEX_B2V.csv');
  const registry = JSON.parse(await read('public/assistant/evidence/sources.v1.json'));
  const validIds = new Set(registry.sources.map((source) => source.source_id));
  const rows = csv.split(/\\r?\\n/).filter((line) => /^"خشم-\\d+"/.test(line));
  assert.equal(rows.length, 28);
  for (const row of rows) {
    const ids = [...row.matchAll(/SRC-[A-Z0-9-]+/g)].map((match) => match[0]);
    assert.ok(ids.length > 0, 'each T01 day must have at least one source reference');
    for (const id of ids) assert.ok(validIds.has(id), `unknown source id ${id}`);
  }
});

test('T01 day 9 title is synchronized across the audit index and design worksheet', async () => {
  const [daily, worksheet, markdown] = await Promise.all([
    read('docs/CONTENT_952_DAILY_AUDIT_INDEX_B2V.csv'),
    read('docs/CONTENT_952_TOPIC_DAY_DESIGN_WORKSHEET_B2W.csv'),
    read('docs/CONTENT_T01_ANGER_28_DAY_REDESIGN_DRAFT_B2Z_FA.md'),
  ]);
  const title = 'بازگرداندن توجه به انتخاب رفتاری';
  assert.ok(daily.includes(title));
  assert.ok(worksheet.includes(title));
  assert.ok(markdown.includes('### روز ۹ — ' + title));
});
