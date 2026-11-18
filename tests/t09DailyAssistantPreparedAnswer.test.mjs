import assert from 'node:assert/strict';
import test from 'node:test';
import { T09_DAILY_ASSISTANT_GUIDES, answerT09DailyPreparedQuestion } from '../src/features/assistant/t09DailyAssistantPrompts.js';

function dailyContent(guide) {
  return {
    id: 'اهمال‌کاری-' + String(guide.day).padStart(2, '0'),
    day: guide.day,
    topic_id: 'T09',
    exercise: guide.exercise,
    actionText: guide.action
  };
}

test('T09 q11 has no duplicate canonical stop condition and renders each support boundary once', () => {
  assert.equal(T09_DAILY_ASSISTANT_GUIDES.length, 28);
  for (const guide of T09_DAILY_ASSISTANT_GUIDES) {
    assert.equal((guide.stopConditions || []).includes(guide.stopCondition), false, 'duplicate stop condition in day ' + guide.day);
    const question = guide.questions.find((item) => item.kind === 'procrastination_increased');
    const answer = answerT09DailyPreparedQuestion({ day: guide.day, message: question.value, dailyContent: dailyContent(guide) });
    assert.equal(typeof answer, 'string');
    assert.equal((answer.match(/شرط توقف اصلی امروز:/gu) || []).length, 1, 'main stop condition count on day ' + guide.day);
    assert.equal((answer.match(/شرط‌های توقف تکمیلی:/gu) || []).length, 1, 'additional stop section count on day ' + guide.day);
    assert.equal(answer.includes(guide.stopCondition + '\n\n' + guide.stopCondition), false, 'duplicated stop text on day ' + guide.day);
    assert.equal((answer.split(guide.whenToSeekHumanSupport).length - 1), 1, 'support statement count on day ' + guide.day);
  }
});


test('T09 day 26 action example uses a distinct dependency scenario from the exercise example',()=>{
  const guide=T09_DAILY_ASSISTANT_GUIDES.find(item=>item.day===26);
  const question=guide.questions.find(item=>item.kind==='action_example');
  const answer=answerT09DailyPreparedQuestion({day:26,message:question.value,dailyContent:dailyContent(guide)});
  assert.match(answer,/منتظر دریافت فایل داده از همکارت هستی/u);
  assert.match(answer,/بررسی ستون‌های ضروری/u);
  assert.notEqual(question.answer,guide.questions.find(item=>item.kind==='exercise_example').answer);
});
