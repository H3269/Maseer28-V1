import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'public/content/path-content.json'), 'utf8'));
const fields = ['exercise', 'actionText', 'lightExerciseText', 'lightActionText', 'progressActionText'];
function normalize(value, topic) {
  const text = String(value ?? '').normalize('NFKC');
  const quoted = text.split(`«${topic}»`).join('«[TOPIC]»');
  const escapedTopic = [...topic].map((char) => /[.*+?^$()|[\\]\\]/.test(char) || char === '{' || char === '}' ? `\\${char}` : char).join('');
  const tokenPattern = new RegExp('(^|[^\\p{L}\\p{N}_])' + escapedTopic + '(?=$|[^\\p{L}\\p{N}_])', 'gu');
  return quoted.replace(tokenPattern, '$1[TOPIC]').replace(/\\s+/g, ' ').trim();
}
export function auditContentSpecificity(data) {
  const categories = Object.entries(data.categories ?? []);
  const days = Math.max(0, ...categories.map(([, category]) => category.days?.length ?? 0));
  const results = {};
  for (const field of fields) {
    const perDay = [];
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
    results[field] = {
      days_with_one_shared_template: perDay.filter((item) => item.fully_shared_across_topics).length,
      days_with_two_or_fewer_variants: perDay.filter((item) => item.unique_variants <= 2).length,
      per_day: perDay,
    };
  }
  return {
    topic_count: categories.length,
    expected_days: days,
    fields: results,
    limitations: [
      'تفاوت متنی به‌تنهایی کیفیت علمی یا تناسب تمرین را ثابت نمی‌کند.',
      'شباهت معنایی بدون بازبینی انسانی قابل سنجش قطعی نیست.',
      'این گزارش محتوا را تغییر نمی‌دهد و فقط اولویت‌های بازبینی را نشان می‌دهد.',
    ],
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(auditContentSpecificity(source), null, 2)}\\n`);
}
