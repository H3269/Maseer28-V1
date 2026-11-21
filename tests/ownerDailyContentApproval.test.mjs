import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isOwnerApprovedDailyRecord, requiresOwnerApproval } from '../src/features/content/ownerDailyContentApproval.js';
import { getCanonicalDailyRecordId } from '../src/features/content/dailyContentSelector.js';

const TOPICS = [
  ['T01', 'خشم'], ['T02', 'اضطراب'], ['T03', 'ترس'], ['T04', 'نفرت'],
  ['T05', 'حسادت'], ['T06', 'غم و سوگ'], ['T07', 'احساس گناه'], ['T08', 'وابستگی عاطفی'],
  ['T09', 'اهمال‌کاری'], ['T10', 'بی‌خوابی و مشکلات خواب'], ['T11', 'عادت‌های تکراری'],
  ['T12', 'مرزبندی و نه گفتن'], ['T13', 'تنهایی'], ['T14', 'کمبود انگیزه'],
];

test('T01-T14 remain hidden unless the exact daily record is explicitly owner-approved', () => {
  for (const [topicId, category] of TOPICS) {
    assert.equal(requiresOwnerApproval(topicId), true, topicId + ' must require owner approval');
    for (let day = 1; day <= 28; day += 1) {
      const recordId = getCanonicalDailyRecordId(category, day);
      assert.equal(isOwnerApprovedDailyRecord({ topicId, recordId }), false,
        topicId + ' day ' + day + ' must fail closed with the default empty approval allowlist');
    }
    assert.equal(isOwnerApprovedDailyRecord({ topicId, recordId: null }), false);
  }
});

test('topics outside T01-T14 are not changed by this approval gate', () => {
  for (const topicId of ['T15', 'T34', 'OTHER', null, undefined]) {
    assert.equal(requiresOwnerApproval(topicId), false);
    assert.equal(isOwnerApprovedDailyRecord({ topicId, recordId: 'anything' }), true);
  }
});

test('runtime daily page and prepared assistant both enforce the owner gate, including legacy topic identity', async () => {
  const [ui, assistant, launcher, gate, app] = await Promise.all([
    readFile(new URL('../src/features/journey/JourneyScreens.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/assistant/pageAssistantTurn.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/assistant/GlobalAssistantLauncher.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/content/ownerDailyContentApproval.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
  ]);
  assert.match(ui, /getCanonicalTopicIdForCategory\(problem\) \|\| data\.topic_id/);
  assert.match(ui, /if \(ownerApprovalRequired && !isOwnerApprovedDailyRecord/);
  assert.match(ui, /ownerApprovalPending/);
  const ownerGateIndex = ui.indexOf('if (ownerApprovalRequired && !isOwnerApprovedDailyRecord');
  const dailyTitleIndex = ui.indexOf('<h2 id="dayTitle">{parts.title}</h2>');
  assert.ok(ownerGateIndex >= 0 && dailyTitleIndex > ownerGateIndex,
    'the owner gate must return before any daily title, exercise, action, or example is rendered');
  assert.doesNotMatch(app, /DailyExerciseAssistant/,
    'the legacy daily assistant component must not be mounted as an alternate path');
  assert.match(assistant, /isOwnerApprovedDailyRecord\(\{ topicId: preparedTopicId, recordId: preparedSource\?\.id \}\)/);
  assert.match(assistant, /محتوای این روز هنوز به تأیید مستقیم دکتر عابدی نرسیده است/);
  assert.match(launcher, /const dailyOwnerApprovalPending = Boolean\(dailyContext && dailyOwnerApprovalRequired && !dailyOwnerApproved\)/);
  assert.match(launcher, /const activePromptGroups = dailyOwnerApprovalPending \? \[\] : screen === 'books'/);
  assert.match(launcher, /\(dailyOwnerApprovalPending \? \[\] : messages\)\.map/);
  assert.match(launcher, /conversationStateRef\.current = null/);
  assert.match(gate, /const OWNER_APPROVED_DAILY_RECORD_IDS = new Set\(\[\s*\/\/ Add canonical IDs/);
});
