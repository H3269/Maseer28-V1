import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mergeDailyTextOverrides } from '../src/features/content/dailyTextOverrides.js';

const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const T06_FIELDS = [
  'title', 'intro', 'exercise', 'actionText', 'closing',
  'lightExerciseText', 'lightActionText', 'progressActionText',
  'restExerciseText', 'restActionText',
];

test('T06 connects all ten visible daily text fields to 28 unique topic-specific overrides', async () => {
  const [base, overrides] = await Promise.all([
    readJson('../public/content/path-content.json'),
    readJson('../public/content/daily-text-overrides.v1.json'),
  ]);
  const merged = mergeDailyTextOverrides(base, overrides);
  const sourceDays = base.categories['غم و سوگ'].days;
  const overrideDays = overrides.categories['غم و سوگ'].days;
  const actualDays = merged.categories['غم و سوگ'].days;

  assert.equal(sourceDays.length, 28);
  assert.equal(overrideDays.length, 28);
  assert.equal(actualDays.length, 28);

  for (const field of T06_FIELDS) {
    const values = overrideDays.map(day => String(day[field] || '').normalize('NFKC').trim());
    assert.equal(values.filter(Boolean).length, 28, field + ' coverage');
    assert.equal(new Set(values).size, 28, field + ' uniqueness within T06');
  }

  for (let index = 0; index < 28; index += 1) {
    const source = sourceDays[index];
    const replacement = overrideDays[index];
    const actual = actualDays[index];
    assert.equal(replacement.day, index + 1);
    assert.equal(actual.id, source.id, 'canonical identity must remain unchanged');
    for (const field of T06_FIELDS) {
      assert.equal(actual[field], replacement[field], 'T06 day ' + (index + 1) + ' ' + field);
    }
    assert.doesNotMatch(actual.title, /نقشه شروع|روز\s*\d+$/u);
    assert.doesNotMatch(actual.intro, /یک قدم کوچک و قابل انجام برای کار روی/u);
    assert.match(actual.closing, /معیار پایان:/u);
    assert.match(actual.closing, /شرط توقف:/u);
  }
});

test('T06 override leaves canonical identity and non-text metadata untouched', async () => {
  const [base, overrides] = await Promise.all([
    readJson('../public/content/path-content.json'),
    readJson('../public/content/daily-text-overrides.v1.json'),
  ]);
  const merged = mergeDailyTextOverrides(base, overrides);
  for (let index = 0; index < 28; index += 1) {
    const before = base.categories['غم و سوگ'].days[index];
    const after = merged.categories['غم و سوگ'].days[index];
    assert.equal(after.id, before.id);
    assert.equal(after.day, before.day);
    assert.deepEqual(after.legacyBookRec, before.legacyBookRec);
    assert.equal(after.scientific_family, before.scientific_family);
  }
});
