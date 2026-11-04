import test from 'node:test';
import assert from 'node:assert/strict';
import { routeSemanticIntake } from '../src/features/assistant/intentContextRouter.js';

test('negative prefix «نمی» is not mistaken for a positive fear disclosure', () => {
  const result = routeSemanticIntake({ text: 'من از آینده نمی‌ترسم.' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T03'), false);
});

test('negation after a short topic modifier is recognized', () => {
  const result = routeSemanticIntake({ text: 'من از قضاوت دیگران نمی‌ترسم.' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T27'), false);
});

test('a negated behavior topic is not routed as a current problem', () => {
  const result = routeSemanticIntake({ text: 'من دیگر حسادت نمی‌کنم.' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T05'), false);
});

test('affirmative fear remains a topic candidate', () => {
  const result = routeSemanticIntake({ text: 'من از آینده می‌ترسم.' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T03'), true);
});

test('a later affirmative occurrence is preserved after an earlier negated occurrence', () => {
  const result = routeSemanticIntake({ text: 'من از آینده نمی‌ترسم، اما از شکست می‌ترسم.' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T03'), true);
});

test('attributed third-party negation does not become the user topic', () => {
  const result = routeSemanticIntake({ text: 'دوستم گفت «من از آینده نمی‌ترسم».' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T03'), false);
});

test('a separate «نمی‌دانم» clause does not negate a stated fear', () => {
  const result = routeSemanticIntake({ text: 'من می‌ترسم و نمی‌دانم چه کار کنم.' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T03'), true);
});


test('an attributed quote from a teacher is not treated as the user self-report', () => {
  const result = routeSemanticIntake({ text: 'استادم گفت که «من از آینده می‌ترسم».' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T03'), false);
});

test('an attributed quote from a therapist is not treated as the user self-report', () => {
  const result = routeSemanticIntake({ text: 'درمانگرم گفت: «تو اضطراب داری».' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T02'), false);
});

test('the user own quoted self-report remains evidence when speaking to a therapist', () => {
  const result = routeSemanticIntake({ text: 'من به درمانگرم گفتم «از قضاوت دیگران می‌ترسم» و هنوز همین حس را دارم.' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T27'), true);
});

test('the correction phrase «منظورم این نیست که» excludes the explicitly rejected topic', () => {
  const result = routeSemanticIntake({ text: 'من اضطراب دارم. منظورم این نیست که اضطراب دارم؛ مسئله اصلی من اهمال‌کاری است.' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T02'), false);
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T09'), true);
});

test('additive wording with «در واقع» preserves both distinct topic hypotheses', () => {
  const result = routeSemanticIntake({ text: 'اضطراب دارم. در واقع در محل کار هم به‌خاطر خشم و عصبانیت با همکارم درگیر می‌شوم.' });
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T02'), true);
  assert.equal(result.topic_candidates.some((item) => item.topic_id === 'T01'), true);
});
