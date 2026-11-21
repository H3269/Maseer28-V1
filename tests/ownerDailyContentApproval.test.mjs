import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('daily content and assistant for T01-T14 have no specialist-approval release gate', async () => {
  const [ui, assistant, launcher] = await Promise.all([
    readFile(new URL('../src/features/journey/JourneyScreens.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/assistant/pageAssistantTurn.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/assistant/GlobalAssistantLauncher.jsx', import.meta.url), 'utf8'),
  ]);
  for (const source of [ui, assistant, launcher]) {
    assert.doesNotMatch(source, /ownerDailyContentApproval|isOwnerApprovedDailyRecord|requiresOwnerApproval|dailyOwnerApprovalPending|ownerApprovalPending|تأیید مستقیم دکتر عابدی/u);
  }
  assert.match(assistant, /daily_guidance_available/u);
  assert.match(ui, /id="dayExercise"/u);
  assert.match(ui, /id="dayAction"/u);
  assert.match(launcher, /activePromptGroups/u);
});
