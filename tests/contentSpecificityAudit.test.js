import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { auditContentSpecificity } from '../scripts/audit-content-specificity.mjs';
const source = JSON.parse(await readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8'));
test('content specificity audit covers all topic paths and daily slots', () => {
  const report = auditContentSpecificity(source);
  assert.equal(report.topic_count, 34);
  assert.equal(report.expected_days, 28);
  for (const field of Object.values(report.fields)) assert.equal(field.per_day.length, 28);
});
test('content audit exposes repeated templates without treating similarity as a build failure', () => {
  const report = auditContentSpecificity(source);
  assert.ok(Object.values(report.fields).some((field) => field.days_with_one_shared_template > 0));
  assert.ok(report.limitations.some((item) => item.includes('کیفیت علمی')));
});


test('normalization replaces standalone topic tokens but preserves topic-name prefixes inside words',()=>{
 const exact={
  categories:{
   'اضطراب':{days:[{exercise:'تمرین اضطراب'}]},
   'خشم':{days:[{exercise:'تمرین خشم'}]},
  },
 };
 const exactReport=auditContentSpecificity(exact);
 assert.equal(exactReport.fields.exercise.per_day[0].unique_variants,1);
 const suffix={
  categories:{
   'اضطراب':{days:[{exercise:'تمرین اضطرابی'}]},
   'خشم':{days:[{exercise:'تمرین خشم'}]},
  },
 };
 const suffixReport=auditContentSpecificity(suffix);
 assert.equal(suffixReport.fields.exercise.per_day[0].unique_variants,2);
});
