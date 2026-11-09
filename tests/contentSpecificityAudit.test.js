import test from 'node:test';
import assert from 'node:assert/strict';
import { auditContentSpecificity } from '../scripts/audit-content-specificity.mjs';

test('content specificity audit covers all topics, days and required text fields', () => {
  const source = {
    categories: Object.fromEntries(Array.from({ length: 34 }, (_, index) => [
      `موضوع ${index + 1}`,
      { days: Array.from({ length: 28 }, (_, day) => ({
        day: day + 1,
        title: `عنوان ${index + 1} روز ${day + 1}`,
        intro: `مقدمه ${index + 1} روز ${day + 1}`,
        exercise: `تمرین ${index + 1} روز ${day + 1}`,
        actionText: `اقدام ${index + 1} روز ${day + 1}`,
        closing: `جمع‌بندی ${index + 1} روز ${day + 1}`,
        lightExerciseText: `تمرین سبک ${index + 1} روز ${day + 1}`,
        lightActionText: `اقدام سبک ${index + 1} روز ${day + 1}`,
        progressActionText: `اقدام پیشرفت ${index + 1} روز ${day + 1}`,
        restExerciseText: `تمرین استراحت ${index + 1} روز ${day + 1}`,
        restActionText: `اقدام استراحت ${index + 1} روز ${day + 1}`,
      })) },
    ])),
  };
  const report = auditContentSpecificity(source);
  assert.equal(report.topic_count, 34);
  assert.equal(report.expected_days, 28);
  assert.equal(report.source, 'runtime_merged_content_with_daily_text_overrides');
  assert.deepEqual(Object.keys(report.fields), [
    'title', 'intro', 'exercise', 'actionText', 'closing',
    'lightExerciseText', 'lightActionText', 'progressActionText',
    'restExerciseText', 'restActionText',
  ]);
  for (const field of Object.values(report.fields)) {
    assert.equal(field.per_day.length, 28);
    assert.equal(field.global_duplicates.duplicate_groups, 0);
  }
});

test('audit detects cross-topic title repeats and within-topic text repeats globally', () => {
  const source = {
    categories: {
      'اضطراب': { days: [
        { day: 1, title: 'عنوان مشترک', intro: 'مقدمه ثابت', exercise: 'تمرین اضطراب' },
        { day: 2, title: 'عنوان دوم', intro: 'مقدمه ثابت', exercise: 'تمرین دوم' },
      ] },
      'خشم': { days: [
        { day: 1, title: 'عنوان مشترک', intro: 'مقدمه دیگر', exercise: 'تمرین خشم' },
        { day: 2, title: 'عنوان چهارم', intro: 'مقدمه چهارم', exercise: 'تمرین چهارم' },
      ] },
    },
  };
  const report = auditContentSpecificity(source);
  assert.equal(report.fields.title.global_duplicates.cross_topic_duplicate_groups, 1);
  assert.equal(report.fields.title.global_duplicates.cross_topic_repeated_occurrences, 1);
  assert.equal(report.fields.intro.global_duplicates.within_topic_duplicate_groups, 1);
  assert.equal(report.fields.intro.global_duplicates.within_topic_repeated_occurrences, 1);
});

test('normalization replaces standalone topic tokens but preserves topic-name prefixes inside words', () => {
  const exact = {
    categories: {
      'اضطراب': { days: [{ day: 1, exercise: 'تمرین اضطراب' }] },
      'خشم': { days: [{ day: 1, exercise: 'تمرین خشم' }] },
    },
  };
  const exactReport = auditContentSpecificity(exact);
  assert.equal(exactReport.fields.exercise.per_day[0].unique_variants, 1);
  const suffix = {
    categories: {
      'اضطراب': { days: [{ day: 1, exercise: 'تمرین اضطرابی' }] },
      'خشم': { days: [{ day: 1, exercise: 'تمرین خشم' }] },
    },
  };
  const suffixReport = auditContentSpecificity(suffix);
  assert.equal(suffixReport.fields.exercise.per_day[0].unique_variants, 2);
});
