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
