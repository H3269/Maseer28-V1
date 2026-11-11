import assert from 'node:assert/strict';
import test from 'node:test';
import { JEALOUSY_DAILY_ASSISTANT_GUIDES, answerJealousyDailyPreparedQuestion, getJealousyDailyAssistantPromptGroups } from '../src/features/assistant/jealousyDailyAssistantPrompts.js';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import { getCanonicalDailyRecordId } from '../src/features/content/dailyContentSelector.js';

test('T05 contains 28 complete days and 14 unique prepared questions per day',()=>{
 assert.equal(JEALOUSY_DAILY_ASSISTANT_GUIDES.length,28);
 for(const g of JEALOUSY_DAILY_ASSISTANT_GUIDES){
  assert.ok(g.title&&g.objective&&g.skill&&g.mechanism&&g.exercise&&g.action&&g.exerciseExample&&g.actionExample);
  assert.equal(g.questions.length,14);
  assert.equal(new Set(g.questions.map(q=>q.value)).size,14);
  assert.ok(g.subtopic.startsWith('T05-S'));
 }
});
test('T05 prompt groups preserve the shared five-section structure for all 28 days',()=>{
 for(let day=1;day<=28;day++){
  const groups=getJealousyDailyAssistantPromptGroups(day);
  assert.deepEqual(groups.map(g=>g.questions.length),[2,2,1,5,4]);
  assert.deepEqual(groups.map(g=>g.label),['فهم تمرین روز '+day,'فهم اقدام اختصاصی روز '+day,'تفاوت تمرین و اقدام','اجرا و موانع','ارزیابی و ایمنی']);
 }
 assert.deepEqual(getJealousyDailyAssistantPromptGroups(29),[]);
});
test('all 392 T05 prepared questions return substantive day-specific answers',()=>{
 let count=0;const answers=new Set();
 for(const g of JEALOUSY_DAILY_ASSISTANT_GUIDES)for(const q of g.questions){
  const a=answerJealousyDailyPreparedQuestion({day:g.day,message:q.value,dailyContent:{exercise:g.exercise,actionText:g.action}});
  assert.ok(a&&a.length>=450,'missing/short answer day '+g.day+' '+q.kind);
  assert.match(a,new RegExp('روز '+('۰۱۲۳۴۵۶۷۸۹'[Math.floor(g.day/10)]||'')+'?'));
  answers.add(a);count++;
 }
 assert.equal(count,392);
 assert.ok(answers.size>300,'answers must be meaningfully varied');
 assert.equal(answerJealousyDailyPreparedQuestion({day:1,message:'سؤال آزاد خارج از فهرست'}),null);
});
test('T05 prepared questions route only for matching canonical topic and day',()=>{
 const g=JEALOUSY_DAILY_ASSISTANT_GUIDES[0],q=g.questions[0];
 const ok=makePageAssistantTurn({screen:'day',text:q.value,dailyContext:{day:1,problem:'حسادت',data:{id:getCanonicalDailyRecordId('حسادت',1),topic_id:'T05',day:1},guidanceData:{id:getCanonicalDailyRecordId('حسادت',1),topic_id:'T05',day:1}}});
 assert.equal(ok.status,'daily_guidance_available');assert.match(ok.message,/راهنمای روز/);
 const wrongTopic=makePageAssistantTurn({screen:'day',text:q.value,dailyContext:{day:1,problem:'حسادت',data:{id:getCanonicalDailyRecordId('حسادت',1),topic_id:'T04',day:1}}});
 assert.equal(wrongTopic.status,'daily_guidance_unavailable');
 const wrongDay=makePageAssistantTurn({screen:'day',text:q.value,dailyContext:{day:2,problem:'حسادت',data:{id:getCanonicalDailyRecordId('حسادت',1),topic_id:'T05',day:1}}});
 assert.equal(wrongDay.status,'daily_guidance_unavailable');
});
test('T05 retains urgent safety precedence and rejects unprepared free-form questions',()=>{
 const urgent=makePageAssistantTurn({screen:'day',text:'امشب قصد دارم خودم را بکشم.',dailyContext:{day:1,problem:'حسادت',data:{id:getCanonicalDailyRecordId('حسادت',1),topic_id:'T05',day:1}}});
 assert.equal(urgent.status,'urgent_human_support_required');
 const free=makePageAssistantTurn({screen:'day',text:'چرا حسادت می‌کنم؟',dailyContext:{day:1,problem:'حسادت',data:{id:getCanonicalDailyRecordId('حسادت',1),topic_id:'T05',day:1}}});
 assert.equal(free.status,'prepared_question_required');
 assert.match(free.message,/گفت‌وگوی آزاد برای این موضوع فعال نیست/);
});
