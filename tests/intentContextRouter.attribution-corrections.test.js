import test from 'node:test';
import assert from 'node:assert/strict';
import { routeSemanticIntake } from '../src/features/assistant/intentContextRouter.js';

test('quoted speech attributed to a colleague is not routed as the user topic', () => {
  const result = routeSemanticIntake({ text: 'همکارم گفت: «من بی‌ارزشم»، اما من با او موافق نیستم.' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T23'), false);
});

test('quoted speech introduced by «گفت که» is attributed to a third party', () => {
  const result = routeSemanticIntake({ text: 'پزشکم گفت که «من اضطراب دارم».' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T02'), false);
});

test('an unquoted third-party report does not become the user topic', () => {
  const result = routeSemanticIntake({ text: 'همکارم گفت که من بی‌ارزشم، اما من چنین احساسی ندارم.' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T23'), false);
});

test('the user own quoted words remain evidence when the user attributes them to themself', () => {
  const result = routeSemanticIntake({ text: 'من گفتم «من اضطراب دارم» و هنوز همین تجربه را دارم.' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T02'), true);
});

test('the latest correction marker supersedes an earlier rejected topic label', () => {
  const result = routeSemanticIntake({
    text: 'من اضطراب دارم. منظورم این نبود که اضطراب دارم؛ منظورم این است که اهمال‌کاری می‌کنم.',
  });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T02'), false);
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T09'), true);
});

test('a single «منظورم این نبود که» correction removes its rejected clause', () => {
  const result = routeSemanticIntake({
    text: 'من اضطراب دارم. منظورم این نبود که اضطراب دارم؛ مسئله اصلی من اهمال‌کاری است.',
  });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T02'), false);
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T09'), true);
});

test('a bare denial marker does not erase the positive correction that follows', () => {
  const result = routeSemanticIntake({
    text: 'من از خودم متنفرم. منظورم این نبود؛ من از رفتار دیروزم خجالت می‌کشم.',
  });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T18'), false);
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T26'), true);
});
