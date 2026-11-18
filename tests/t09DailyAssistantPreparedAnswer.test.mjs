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


test('T09 q11 uses 28 distinct day-specific distress responses instead of one generic template', () => {
  const answers = T09_DAILY_ASSISTANT_GUIDES.map((guide) => {
    const question = guide.questions.find((item) => item.kind === 'procrastination_increased');
    assert.ok(question?.answer, 'day ' + guide.day + ' must have a prepared q11 answer');
    const rendered = answerT09DailyPreparedQuestion({
      day: guide.day,
      message: question.value,
      dailyContent: dailyContent(guide),
    });
    assert.ok(rendered.includes(question.answer), 'day ' + guide.day + ' must render its own q11 answer');
    assert.equal((rendered.match(/شرط توقف اصلی امروز:/gu) || []).length, 1, 'one primary stop condition on day ' + guide.day);
    assert.equal((rendered.match(/زمان حمایت انسانی:/gu) || []).length, 1, 'one human-support threshold on day ' + guide.day);
    return question.answer;
  });
  assert.equal(new Set(answers).size, 28, 'all 28 daily distress answers must be distinct');
  assert.ok(new Set(answers.map((answer) => answer.slice(0, 70))).size >= 24,
    'daily distress answers must not share a generic opening');
});


test('T09 q12 contact guidance is tailored to each daily action', () => {
  const answers = T09_DAILY_ASSISTANT_GUIDES.map((guide) => {
    const question = guide.questions.find((item) => item.kind === 'talk_other');
    assert.ok(question?.answer, 'day ' + guide.day + ' must have a prepared q12 answer');
    const rendered = answerT09DailyPreparedQuestion({
      day: guide.day,
      message: question.value,
      dailyContent: dailyContent(guide),
    });
    assert.ok(rendered.includes(question.answer), 'day ' + guide.day + ' must render its own q12 guidance');
    assert.match(question.answer, /خیر/u);
    return question.answer;
  });
  assert.equal(new Set(answers).size, 28, 'all 28 q12 answers must be distinct');
  assert.ok(new Set(answers.map((answer) => answer.slice(0, 75))).size >= 24,
    'q12 must not reuse a generic daily preamble');
});
