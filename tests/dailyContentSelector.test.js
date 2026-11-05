import test from 'node:test';
import assert from 'node:assert/strict';
import { getCanonicalDailyRecordId, isCompleteDailyContentCategory, selectCanonicalDailyRecord, selectDailyContentCategory } from '../src/features/content/dailyContentSelector.js';

const dayOne = { id: 'اضطراب-01', day: 1, exercise: 'تمرین روز اول' };
const dayFour = { id: 'اضطراب-04', day: 4, exercise: 'تمرین روز چهارم' };
const dayFive = { id: 'اضطراب-05', day: 5, exercise: 'تمرین روز پنجم' };
const category = { days: [dayOne, dayFive, dayFour] };

test('selects the exact numbered record even when the source array is unordered', () => {
  assert.equal(selectCanonicalDailyRecord(category, 4), dayFour);
  assert.equal(selectCanonicalDailyRecord(category, '5'), dayFive);
});

test('does not substitute the record at the requested array position when a day is missing', () => {
  const incomplete = { days: [dayOne, dayFive] };
  assert.equal(selectCanonicalDailyRecord(incomplete, 2), null);
  assert.equal(selectCanonicalDailyRecord(incomplete, 4), null);
});

test('fails closed when the requested day is duplicated', () => {
  assert.equal(selectCanonicalDailyRecord({ days: [dayFour, { ...dayFour, id: 'duplicate-day-04' }] }, 4), null);
});

test('rejects malformed, fractional, and out-of-range day values', () => {
  for (const value of [null, undefined, '', '  ', 0, -1, 1.5, 29, 'not-a-day', {}, true]) {
    assert.equal(selectCanonicalDailyRecord(category, value), null, String(value));
  }
});

test('rejects records without a stable source id', () => {
  assert.equal(selectCanonicalDailyRecord({ days: [{ day: 4, exercise: 'unidentified' }] }, 4), null);
});

test('requires a real category and never substitutes another category', () => {
  const categories = {
    'اضطراب': category,
    'مشکل دیگر': { days: [dayOne] },
  };
  assert.equal(selectDailyContentCategory(categories, 'اضطراب'), category);
  assert.equal(selectDailyContentCategory(categories, 'موضوع نامعتبر'), null);
  assert.equal(selectDailyContentCategory(categories, ''), null);
  assert.equal(selectDailyContentCategory(categories, null), null);
});

test('does not resolve inherited object properties as category names', () => {
  const categories = {};
  assert.equal(selectDailyContentCategory(categories, 'toString'), null);
});

test('rejects invalid category containers', () => {
  assert.equal(selectDailyContentCategory(null, 'اضطراب'), null);
  assert.equal(selectDailyContentCategory([], 'اضطراب'), null);
  assert.equal(selectDailyContentCategory({ 'اضطراب': {} }, 'اضطراب'), null);
});


test('accepts only a complete 28-day category with unique stable record identities', () => {
  const topicKey = 'موضوع معتبر';
  const completeDays = Array.from({ length: 28 }, (_, index) => ({
    id: getCanonicalDailyRecordId(topicKey, index + 1), day: index + 1, exercise: 'exercise ' + (index + 1),
  }));
  assert.equal(isCompleteDailyContentCategory({ [topicKey]: { days: completeDays } }, topicKey), true);
  const wrongIdentity = [...completeDays];
  wrongIdentity[9] = { ...wrongIdentity[9], id: 'موضوع معتبر-09' };
  assert.equal(isCompleteDailyContentCategory({ [topicKey]: { days: wrongIdentity } }, topicKey), false,
    'a complete category with a unique but non-canonical day ID must be rejected');
  assert.equal(isCompleteDailyContentCategory({ 'موضوع معتبر': { days: completeDays.slice(0, 27) } }, 'موضوع معتبر'), false);
  assert.equal(isCompleteDailyContentCategory({ 'موضوع معتبر': { days: [...completeDays.slice(0, 27), { ...completeDays[27], id: completeDays[0].id }] } }, 'موضوع معتبر'), false);
  assert.equal(isCompleteDailyContentCategory({ 'موضوع معتبر': { days: [...completeDays.slice(0, 27), { ...completeDays[27], day: 27 }] } }, 'موضوع معتبر'), false);
  assert.equal(isCompleteDailyContentCategory({ 'موضوع نامعتبر': { days: completeDays } }, 'موضوع دیگر'), false);
});


test('builds one canonical category/day ID for both legacy and versioned daily records', () => {
  assert.equal(getCanonicalDailyRecordId('خشم', 1), 'خشم-01');
  assert.equal(getCanonicalDailyRecordId('اضطراب', 10), 'اضطراب-10');
  assert.equal(getCanonicalDailyRecordId('موضوع', 28), 'موضوع-28');
  for (const [category, day] of [['', 1], ['  ', 1], [null, 1], ['خشم', 0], ['خشم', 1.5], ['خشم', 29], ['خشم', '1']]) {
    assert.equal(getCanonicalDailyRecordId(category, day), null);
  }
});
