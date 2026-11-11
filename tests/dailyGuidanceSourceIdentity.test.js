import test from 'node:test';
import assert from 'node:assert/strict';
import { preserveDailyGuidanceSourceIdentity } from '../src/features/assistant/dailyGuidanceSourceIdentity.js';

test('preserves valid numeric and numeric-string day identities', () => {
  for (const day of [1, 28, '1', '28', '7']) {
    const result = preserveDailyGuidanceSourceIdentity(
      { id: 'T01-D07', topic_id: 'T01', day },
      { exercise: 'تمرین معتبر' },
    );
    assert.equal(result.day, Number(day));
  }
});

test('does not coerce missing, null, blank, zero, fractional, or out-of-range days to a valid identity', () => {
  for (const day of [undefined, null, '', '   ', 0, '0', 1.5, '2.5', 29, '29', 'not-a-day']) {
    const result = preserveDailyGuidanceSourceIdentity(
      { id: 'T01-D07', topic_id: 'T01', day },
      { exercise: 'تمرین' },
    );
    assert.equal(result.day, null, `unexpected day identity for ${String(day)}`);
  }
});

test('preserves source identity fields and guidance fields without inventing identity', () => {
  const result = preserveDailyGuidanceSourceIdentity(
    { id: 'T03-D07', topic_id: 'T03', day: 7 },
    { exercise: 'تمرین روز هفتم', actionText: 'راهکار روز هفتم' },
  );

  assert.deepEqual(result, {
    id: 'T03-D07',
    topic_id: 'T03',
    day: 7,
    exercise: 'تمرین روز هفتم',
    actionText: 'راهکار روز هفتم',
  });
});


test('daily guidance preserves all ten runtime text fields for prepared assistants', () => {
  const source = {
    id: 'غم و سوگ-01',
    day: 1,
    title: 'عنوان اختصاصی روز',
    intro: 'هدف و مهارت روز',
    exercise: 'تمرین اختصاصی',
    actionText: 'اقدام اختصاصی',
    closing: 'معیار و شرط توقف',
    lightExerciseText: 'تمرین سبک',
    lightActionText: 'اقدام سبک',
    progressActionText: 'اقدام پیشرفت',
    restExerciseText: 'تمرین استراحت',
    restActionText: 'اقدام استراحت',
  };
  const adapted = preserveDailyGuidanceSourceIdentity(source, {
    title: 'عنوان محاسبه‌شده',
    exercise: 'تمرین متناسب‌شده',
    action: 'اقدام متناسب‌شده',
  });
  assert.equal(adapted.title, 'عنوان محاسبه‌شده');
  assert.equal(adapted.exercise, 'تمرین متناسب‌شده');
  assert.equal(adapted.actionText, 'اقدام اختصاصی');
  assert.equal(adapted.intro, source.intro);
  assert.equal(adapted.closing, source.closing);
  assert.equal(adapted.lightExerciseText, source.lightExerciseText);
  assert.equal(adapted.lightActionText, source.lightActionText);
  assert.equal(adapted.progressActionText, source.progressActionText);
  assert.equal(adapted.restExerciseText, source.restExerciseText);
  assert.equal(adapted.restActionText, source.restActionText);
  assert.equal(adapted.id, source.id);
  assert.equal(adapted.day, source.day);
});
