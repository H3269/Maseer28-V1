import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { ANGER_DAILY_ASSISTANT_GUIDES, getAngerDailyAssistantPromptGroups } from '../src/features/assistant/angerDailyAssistantPrompts.js';
import { ANXIETY_DAILY_ASSISTANT_GUIDES, getAnxietyDailyAssistantPromptGroups } from '../src/features/assistant/anxietyDailyAssistantPrompts.js';
import { FEAR_DAILY_ASSISTANT_GUIDES, getFearDailyAssistantPromptGroups } from '../src/features/assistant/fearDailyAssistantPrompts.js';
import { HATRED_DAILY_ASSISTANT_GUIDES, getHatredDailyAssistantPromptGroups } from '../src/features/assistant/hatredDailyAssistantPrompts.js';
import { JEALOUSY_DAILY_ASSISTANT_GUIDES, getJealousyDailyAssistantPromptGroups } from '../src/features/assistant/jealousyDailyAssistantPrompts.js';
import { GRIEF_DAILY_ASSISTANT_GUIDES, getGriefDailyAssistantPromptGroups } from '../src/features/assistant/griefDailyAssistantPrompts.js';
import { GUILT_DAILY_ASSISTANT_GUIDES, getGuiltDailyAssistantPromptGroups } from '../src/features/assistant/guiltDailyAssistantPrompts.js';
import { EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES, getEmotionalDependencyDailyAssistantPromptGroups } from '../src/features/assistant/emotionalDependencyDailyAssistantPrompts.js';
import { T09_DAILY_ASSISTANT_GUIDES, getT09DailyAssistantPromptGroups } from '../src/features/assistant/t09DailyAssistantPrompts.js';

const topics = [
  ['T01', ANGER_DAILY_ASSISTANT_GUIDES, getAngerDailyAssistantPromptGroups],
  ['T02', ANXIETY_DAILY_ASSISTANT_GUIDES, getAnxietyDailyAssistantPromptGroups],
  ['T03', FEAR_DAILY_ASSISTANT_GUIDES, getFearDailyAssistantPromptGroups],
  ['T04', HATRED_DAILY_ASSISTANT_GUIDES, getHatredDailyAssistantPromptGroups],
  ['T05', JEALOUSY_DAILY_ASSISTANT_GUIDES, getJealousyDailyAssistantPromptGroups],
  ['T06', GRIEF_DAILY_ASSISTANT_GUIDES, getGriefDailyAssistantPromptGroups],
  ['T07', GUILT_DAILY_ASSISTANT_GUIDES, getGuiltDailyAssistantPromptGroups],
  ['T08', EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES, getEmotionalDependencyDailyAssistantPromptGroups],
  ['T09', T09_DAILY_ASSISTANT_GUIDES, getT09DailyAssistantPromptGroups],
];
const expectedIds = Array.from({ length: 14 }, (_, i) => 'q' + String(i + 1).padStart(2, '0'));
const expectedValues = [
  'منظور از تمرین امروز چیست؟',
  'برای تمرین امروز یک مثال می‌زنی؟',
  'منظور از اقدام اختصاصی امروز چیست؟',
  'برای اقدام امروز یک مثال می‌زنی؟',
  'اگر انجام کاملش برایم سخت بود چه کنم؟',
  'از کجا بفهمم درست انجامش داده‌ام؟',
  'چه زمانی باید تمرین امروز را متوقف کنم؟',
  'اگر امروز نمونه یا آمادگی انجام تمرین را نداشتم چه کنم؟',
  'تمرین و اقدام امروز چه تفاوتی دارند؟',
  'اگر تمرین را انجام ندادم یا فراموش کردم چه کنم؟',
  'اگر هنگام تمرین فشار یا ناراحتی‌ام بیشتر شد چه کنم؟',
  'آیا لازم است حتماً با فرد دیگری صحبت کنم؟',
  'می‌توانم تمرین را تغییر بدهم یا به روش خودم انجام بدهم؟',
  'این تمرین چقدر زمان می‌برد؟',
];

test('T01-T09 share the exact same 14 prepared question IDs, wording, and order on all 28 days', () => {
  for (const [topicId, guides] of topics) {
    assert.equal(guides.length, 28, topicId + ' day coverage');
    for (const guide of guides) {
      assert.equal(guide.day >= 1 && guide.day <= 28, true, topicId + ' day range');
      assert.equal(guide.questions.length, 14, topicId + ' day ' + guide.day);
      assert.deepEqual(guide.questions.map(q => q.id), expectedIds, topicId + ' question IDs day ' + guide.day);
      assert.deepEqual(guide.questions.map(q => q.value), expectedValues, topicId + ' question wording day ' + guide.day);
      assert.deepEqual(guide.questions.map(q => q.label), expectedValues, topicId + ' question labels day ' + guide.day);
    }
  }
});

test('T01-T09 use the same five prompt groups and question distribution on every day', () => {
  for (const [topicId, guides, getGroups] of topics) {
    for (let day = 1; day <= 28; day += 1) {
      const groups = getGroups(day);
      assert.equal(groups.length, 5, topicId + ' day ' + day + ' group count');
      assert.deepEqual(groups.map(group => group.questions.length), [2, 2, 1, 5, 4], topicId + ' day ' + day + ' group distribution');
      assert.deepEqual(groups.flatMap(group => group.questions.map(q => q.value)), expectedValues, topicId + ' day ' + day + ' question coverage/order');
    }
    assert.deepEqual(getGroups(0), [], topicId + ' invalid day lower bound');
    assert.deepEqual(getGroups(29), [], topicId + ' invalid day upper bound');
  }
});

test('T09 shared question contract is documented in its canonical guide metadata', async () => {
  const guide = JSON.parse(await readFile(new URL('../src/features/assistant/t09DailyAssistantGuide.v1.json', import.meta.url), 'utf8'));
  assert.match(guide.questionPolicy, /identical question IDs, labels, values, and positions across all topics/);
});
