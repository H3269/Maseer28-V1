import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeDailyTextOverrides } from '../src/features/content/dailyTextOverrides.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseContent = JSON.parse(fs.readFileSync(path.join(root, 'public/content/path-content.json'), 'utf8'));
const dailyTextOverrides = JSON.parse(fs.readFileSync(path.join(root, 'public/content/daily-text-overrides.v1.json'), 'utf8'));
const source = mergeDailyTextOverrides(baseContent, dailyTextOverrides);
const fields = [
  'title',
  'intro',
  'exercise',
  'actionText',
  'closing',
  'lightExerciseText',
  'lightActionText',
  'progressActionText',
  'restExerciseText',
  'restActionText',
];

function normalize(value, topic) {
  const text = String(value ?? '').normalize('NFKC');
  const quoted = text.split('«' + topic + '»').join('«[TOPIC]»');
  const regexSpecials = new Set(['.', '*', '+', '?', '^', '$', '(', ')', '|', '[', ']', '{', '}']);
  const escapedTopic = [...topic].map((char) => regexSpecials.has(char) ? String.fromCharCode(92) + char : char).join('');
  const tokenPattern = new RegExp('(^|[^\\p{L}\\p{N}_])' + escapedTopic + '(?=$|[^\\p{L}\\p{N}_])', 'gu');
  return quoted.replace(tokenPattern, '$1[TOPIC]').replace(/\s+/g, ' ').trim();
}

function duplicateStats(entries) {
  const groups = new Map();
  for (const entry of entries) {
    if (!entry.value) continue;
    const group = groups.get(entry.value) ?? [];
    group.push(entry);
    groups.set(entry.value, group);
  }
  const duplicates = [...groups.entries()].filter(([, rows]) => rows.length > 1);
  const crossTopic = duplicates.filter(([, rows]) => new Set(rows.map((row) => row.topic)).size > 1);
  const withinTopic = duplicates.filter(([, rows]) => new Set(rows.map((row) => row.topic)).size === 1);
  const repeatedOccurrences = (rows) => rows.reduce((sum, [, group]) => sum + group.length - 1, 0);
  return {
    duplicate_groups: duplicates.length,
    duplicate_cells: duplicates.reduce((sum, [, group]) => sum + group.length, 0),
    repeated_occurrences: repeatedOccurrences(duplicates),
    cross_topic_duplicate_groups: crossTopic.length,
    cross_topic_repeated_occurrences: repeatedOccurrences(crossTopic),
    within_topic_duplicate_groups: withinTopic.length,
    within_topic_repeated_occurrences: repeatedOccurrences(withinTopic),
    examples: duplicates.slice(0, 12).map(([value, rows]) => ({
      normalized_text: value,
      count: rows.length,
      locations: rows.slice(0, 8).map(({ topic, day }) => ({ topic, day })),
    })),
  };
}

export function auditContentSpecificity(data) {
  const categories = Object.entries(data.categories ?? {});
  const days = Math.max(0, ...categories.map(([, category]) => category.days?.length ?? 0));
  const results = {};

  for (const field of fields) {
    const perDay = [];
    const allEntries = [];

    for (let index = 0; index < days; index += 1) {
      const values = categories.map(([topic, category]) => normalize(category.days?.[index]?.[field], topic));
      const counts = new Map();
      for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
      perDay.push({
        day: index + 1,
        unique_variants: counts.size,
        empty_count: values.filter((value) => !value).length,
        fully_shared_across_topics: values.length > 0 && counts.size === 1 && values.every(Boolean),
      });
    }

    for (const [topic, category] of categories) {
      for (const day of category.days ?? []) {
        allEntries.push({
          topic,
          day: Number(day.day),
          value: normalize(day[field], topic),
        });
      }
    }

    results[field] = {
      days_with_one_shared_template: perDay.filter((item) => item.fully_shared_across_topics).length,
      days_with_two_or_fewer_variants: perDay.filter((item) => item.unique_variants <= 2).length,
      per_day: perDay,
      global_duplicates: duplicateStats(allEntries),
    };
  }

  return {
    topic_count: categories.length,
    expected_days: days,
    source: 'runtime_merged_content_with_daily_text_overrides',
    fields: results,
    limitations: [
      'این ممیزی تکرار متنی دقیق پس از نرمال‌سازی نام موضوع را می‌سنجد؛ شباهت معنایی را به‌طور قطعی تشخیص نمی‌دهد.',
      'تفاوت متنی به‌تنهایی کیفیت علمی، تناسب تمرین، ایمنی یا اثربخشی را ثابت نمی‌کند.',
      'گزارش فقط اولویت‌های بازبینی را نشان می‌دهد و محتوا را تغییر نمی‌دهد.',
    ],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(JSON.stringify(auditContentSpecificity(source), null, 2) + '\n');
}
