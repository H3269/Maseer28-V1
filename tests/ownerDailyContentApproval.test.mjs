import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isOwnerApprovedDailyRecord, requiresOwnerApproval } from '../src/features/content/ownerDailyContentApproval.js';

const TOPICS = Array.from({ length: 14 }, (_, index) => 'T' + String(index + 1).padStart(2, '0'));

test('T01-T14 remain hidden unless the exact daily record is explicitly owner-approved', () => {
  for (const topicId of TOPICS) {
    assert.equal(requiresOwnerApproval(topicId), true, topicId + ' must require owner approval');
    assert.equal(isOwnerApprovedDailyRecord({ topicId, recordId: topicId + '-D01' }), false,
      topicId + ' must fail closed with the default empty approval allowlist');
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
  const [ui, assistant, gate] = await Promise.all([
    readFile(new URL('../src/features/journey/JourneyScreens.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/assistant/pageAssistantTurn.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/content/ownerDailyContentApproval.js', import.meta.url), 'utf8'),
  ]);
  assert.match(ui, /data\.topic_id \|\| getCanonicalTopicIdForCategory\(problem\)/);
  assert.match(ui, /if \(ownerApprovalRequired && !isOwnerApprovedDailyRecord/);
  assert.match(ui, /ownerApprovalPending/);
  assert.match(assistant, /isOwnerApprovedDailyRecord\(\{ topicId: preparedTopicId, recordId: preparedSource\?\.id \}\)/);
  assert.match(assistant, /محتوای این روز هنوز به تأیید مستقیم دکتر عابدی نرسیده است/);
  assert.match(gate, /const OWNER_APPROVED_DAILY_RECORD_IDS = new Set\(\[\s*\/\/ Add canonical IDs/);
});
