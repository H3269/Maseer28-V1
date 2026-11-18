import test from 'node:test';
import assert from 'node:assert/strict';
import { answerT10DailyPreparedQuestion, getT10DailyAssistantPromptGroups, T10_DAILY_ASSISTANT_GUIDES } from '../src/features/assistant/t10DailyAssistantPrompts.js';

test('T10 exposes all 28 daily prompt groups with 14 prepared questions per day', () => {
  assert.equal(T10_DAILY_ASSISTANT_GUIDES.length, 28);
  for (let day = 1; day <= 28; day += 1) {
    const groups = getT10DailyAssistantPromptGroups(day);
    const questions = groups.flatMap((group) => group.questions);
    assert.equal(questions.length, 14, `day ${day}`);
    assert.ok(questions.every((question) => question.value.trim() && question.answer.trim()));
  }
});

test('T10 prepared answer requires exact canonical day identity and matching topic', () => {
  const guide = T10_DAILY_ASSISTANT_GUIDES[0];
  const question = guide.questions[0];
  const dailyContent = {
    id: 'بی‌خوابی و مشکلات خواب-01',
    day: 1,
    topic_id: 'T10',
    exercise: guide.exercise,
    action: guide.action,
  };
  const answer = answerT10DailyPreparedQuestion({ day: 1, message: question.value, dailyContent });
  assert.ok(answer?.includes(guide.exercise));
  assert.equal(answerT10DailyPreparedQuestion({ day: 1, message: question.value, dailyContent: { ...dailyContent, id: 'بی‌خوابی و مشکلات خواب-02' } }), null);
  assert.equal(answerT10DailyPreparedQuestion({ day: 1, message: question.value, dailyContent: { ...dailyContent, topic_id: 'T09' } }), null);
});

test('T10 sleep-distress answer preserves stop conditions and safety guidance', () => {
  const guide = T10_DAILY_ASSISTANT_GUIDES[0];
  const question = guide.questions.find((item) => item.kind === 'sleep_distress');
  const answer = answerT10DailyPreparedQuestion({
    day: 1,
    message: question.value,
    dailyContent: { id: 'بی‌خوابی و مشکلات خواب-01', day: 1, topic_id: 'T10' },
  });
  assert.ok(answer.includes(guide.stopCondition));
  assert.ok(answer.includes('خواب‌آلودگی'));
  assert.ok(answer.includes('ارزیابی پزشکی'));
});

test('T10 rejects unknown questions and invalid days instead of improvising', () => {
  const dailyContent = { id: 'بی‌خوابی و مشکلات خواب-01', day: 1, topic_id: 'T10' };
  assert.equal(answerT10DailyPreparedQuestion({ day: 1, message: 'سؤال خارج از فهرست', dailyContent }), null);
  assert.deepEqual(getT10DailyAssistantPromptGroups(29), []);
});


test('T10 day 1 safety answers do not repeat the same medical escalation in the prepared runtime output',()=>{
  const guide=T10_DAILY_ASSISTANT_GUIDES[0];
  const distress=guide.questions.find(item=>item.kind==='sleep_distress');
  const stop=guide.questions.find(item=>item.kind==='stop');
  const dailyContent={id:'بی‌خوابی و مشکلات خواب-01',day:1,topic_id:'T10'};
  const distressAnswer=answerT10DailyPreparedQuestion({day:1,message:distress.value,dailyContent});
  const stopAnswer=answerT10DailyPreparedQuestion({day:1,message:stop.value,dailyContent});
  assert.ok(distressAnswer.includes(distress.answer));
  assert.equal((distressAnswer.match(/وقفه تنفسی/g)||[]).length,1);
  assert.equal((distressAnswer.match(/ارزیابی پزشکی/g)||[]).length,1);
  assert.equal((stopAnswer.match(/وقفه تنفسی/g)||[]).length,1);
  assert.match(distressAnswer,/دارو، مکمل، الکل یا مواد را .* خودسرانه تغییر نده/u);
});


test('T10 all 28 day-specific distress answers are used at runtime with a human-support route',()=>{
  for(const guide of T10_DAILY_ASSISTANT_GUIDES){
    const day=guide.day;
    const question=guide.questions.find(item=>item.kind==='sleep_distress');
    const answer=answerT10DailyPreparedQuestion({
      day,
      message:question.value,
      dailyContent:{id:'بی‌خوابی و مشکلات خواب-'+String(day).padStart(2,'0'),day,topic_id:'T10'},
    });
    assert.ok(answer.includes(question.answer),'day '+day+' must use the audited daily distress answer');
    assert.ok(answer.includes('حمایت انسانی'),'day '+day+' must retain the human-support route');
  }
});

test('T10 selected distress answers do not repeat the stop-condition warning',()=>{
  for(const day of [4,17,21,25,26]){
    const guide=T10_DAILY_ASSISTANT_GUIDES.find(item=>item.day===day);
    const question=guide.questions.find(item=>item.kind==='sleep_distress');
    const answer=answerT10DailyPreparedQuestion({
      day,
      message:question.value,
      dailyContent:{id:'بی‌خوابی و مشکلات خواب-'+String(day).padStart(2,'0'),day,topic_id:'T10'},
    });
    assert.ok(!answer.includes('اگر خواب‌آلودگی ایمنی رانندگی یا کار پرخطر را مختل می‌کند، فعالیت را متوقف کن. در خفگی'),
      'day '+day+' must not append the duplicated generic warning block');
  }
});
