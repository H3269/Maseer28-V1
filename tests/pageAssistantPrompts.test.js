import test from 'node:test';
import assert from 'node:assert/strict';
import {
  answerPageSpecificQuestion,
  getPageSpecificPromptGroups,
  PAGE_SPECIFIC_GUIDE_SCREENS,
} from '../src/features/assistant/pageAssistantPrompts.js';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';

const expectedScreens = [
  'home', 'howWorks', 'about', 'profile', 'pathSetup', 'assessment',
  'dashboard', 'dailyResult', 'support', 'final', 'done', 'report', 'archive',
];

test('every eligible non-library, non-daily page has its own prepared FAQ set', () => {
  assert.deepEqual([...PAGE_SPECIFIC_GUIDE_SCREENS], expectedScreens);
  for (const screen of expectedScreens) {
    const groups = getPageSpecificPromptGroups(screen);
    assert.equal(groups.length, 1, screen);
    assert.ok(groups[0].questions.length >= 4, screen);
    const labels = groups[0].questions.map((item) => item.label);
    assert.equal(new Set(labels).size, labels.length, screen);
    for (const item of groups[0].questions) {
      assert.equal(item.value, item.label);
      const answer = answerPageSpecificQuestion({ screen, message: item.value });
      assert.ok(answer && answer.length >= 100, `${screen}: ${item.label}`);
      const turn = makePageAssistantTurn({ screen, text: item.value });
      assert.equal(turn.status, 'page_guidance_available', `${screen}: ${item.label}`);
      assert.ok(turn.message.length >= 100, `${screen}: ${item.label}`);
    }
  }
});

test('daily exercise and library FAQ catalogues are not replaced by page-specific guides', () => {
  assert.equal(getPageSpecificPromptGroups('day'), null);
  assert.equal(getPageSpecificPromptGroups('books'), null);
  assert.equal(getPageSpecificPromptGroups('bookReader'), null);
  assert.equal(answerPageSpecificQuestion({ screen: 'day', message: 'هر سؤال' }), null);
  assert.equal(answerPageSpecificQuestion({ screen: 'books', message: 'هر سؤال' }), null);
});

test('existing library page guidance remains available and unchanged', () => {
  const legacyQuestion = 'اینجا چه کارهایی می‌توانم انجام بدهم؟';
  const result = makePageAssistantTurn({ screen: 'books', text: legacyQuestion });
  assert.equal(result.status, 'page_guidance_available');
  assert.match(result.message, /کتابخانه/);
  assert.match(result.message, /بازکردن کتاب/);
});

test('questions from one page cannot be used as prepared questions on another page', () => {
  const homeQuestion = getPageSpecificPromptGroups('home')[0].questions[0].value;
  const result = makePageAssistantTurn({ screen: 'archive', text: homeQuestion });
  assert.equal(result.status, 'prepared_question_required');
});
