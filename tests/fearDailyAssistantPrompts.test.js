import test from 'node:test';
import assert from 'node:assert/strict';
import { FEAR_DAILY_ASSISTANT_GUIDES, answerFearDailyPreparedQuestion, getFearDailyAssistantPromptGroups } from '../src/features/assistant/fearDailyAssistantPrompts.js';
import { makeDailyExerciseGuidanceTurn } from '../src/features/assistant/dailyExerciseAssistantGuidance.js';
import { readFile } from 'node:fs/promises';

test('T03 prepared assistant has 28 canonical day slots and 14 unique prompts per day',()=>{
 assert.equal(FEAR_DAILY_ASSISTANT_GUIDES.length,28);
 assert.deepEqual(FEAR_DAILY_ASSISTANT_GUIDES.map(x=>x.day),Array.from({length:28},(_,i)=>i+1));
 for(const g of FEAR_DAILY_ASSISTANT_GUIDES){assert.equal(g.topicId,'T03');assert.equal(g.topic,'ترس');assert.equal(g.questions.length,14);assert.equal(new Set(g.questions.map(q=>q.value)).size,14);assert.ok(g.exercise&&g.action&&g.exerciseExample&&g.actionExample&&g.objective&&g.skill&&g.mechanism&&g.lightVersion&&g.progressVersion&&g.restVersion&&g.successCriterion&&g.reflectionQuestion&&g.stopCondition);}
});
test('T03 daily exercises and actions are not exact duplicates across the 28-day bank',()=>{
 assert.equal(new Set(FEAR_DAILY_ASSISTANT_GUIDES.map(x=>x.exercise.trim())).size,28);
 assert.equal(new Set(FEAR_DAILY_ASSISTANT_GUIDES.map(x=>x.action.trim())).size,28);
});
test('T03 prompt groups use the shared five-section structure and stay scoped to the selected day',()=>{
 for(let day=1;day<=28;day++){
  const groups=getFearDailyAssistantPromptGroups(day);
  assert.equal(groups.length,5);
  assert.deepEqual(groups.map(group=>group.questions.length),[2,2,1,5,4]);
  assert.deepEqual(groups.map(group=>group.label),[
   'فهم تمرین روز '+day,
   'فهم اقدام اختصاصی روز '+day,
   'تفاوت تمرین و اقدام',
   'اجرا و موانع',
   'ارزیابی و ایمنی',
  ]);
 }
 assert.deepEqual(getFearDailyAssistantPromptGroups(29),[]);
 assert.equal(getFearDailyAssistantPromptGroups('۱').length,5);
});
test('T03 prepared answers quote the active visible daily content and refuse unknown prompts',()=>{
 const g=FEAR_DAILY_ASSISTANT_GUIDES[0],visible={topic_id:'T03',day:1,exercise:'متن تمرین نمایان روز اول ترس',actionText:'اقدام اختصاصی نمایان روز اول ترس'};
 assert.match(answerFearDailyPreparedQuestion({day:1,message:g.questions.find(q=>q.kind==='exercise_meaning').value,dailyContent:visible}),/متن تمرین نمایان روز اول ترس/);
 assert.match(answerFearDailyPreparedQuestion({day:1,message:g.questions.find(q=>q.kind==='action_meaning').value,dailyContent:visible}),/اقدام اختصاصی نمایان روز اول ترس/);
 assert.equal(answerFearDailyPreparedQuestion({day:1,message:'پرسش آزاد خارج از بانک'}),null);
});
test('T03 router requires canonical topic identity, keeps safety preemption, and refuses out-of-bank questions',()=>{
 const data={topic_id:'T03',day:1,exercise:'تمرین روز اول ترس',actionText:'اقدام روز اول ترس'};
 const q=FEAR_DAILY_ASSISTANT_GUIDES[0].questions[0].value;
 const good=makeDailyExerciseGuidanceTurn({message:q,dayData:data,problem:'ترس',day:1});
 assert.match(good.response,/راهنمای روز ۱ ترس/);
 const mismatch=makeDailyExerciseGuidanceTurn({message:q,dayData:{...data,topic_id:'T02'},problem:'ترس',day:1});
 assert.match(mismatch.response,/شناسه موضوع/);
 const outside=makeDailyExerciseGuidanceTurn({message:'یک پرسش آزاد',dayData:data,problem:'ترس',day:1});
 assert.match(outside.response,/در فهرست راهنمای آماده موضوع ترس نیست/);
 const safety=makeDailyExerciseGuidanceTurn({message:'امشب قصد دارم خودم را بکشم',dayData:data,problem:'ترس',day:1});
 assert.match(safety.response,/خطر فوری/);
});
test('T03 assigns one canonical, topic-owned subtopic to every day with a non-overlapping T03/T21 boundary',async()=>{
 const source=await readFile(new URL('../src/features/assistant/fearDailyAssistantPrompts.js',import.meta.url),'utf8');
 const registry=JSON.parse(await readFile(new URL('../public/assistant/knowledge/subtopics.v1.json',import.meta.url),'utf8'));
 assert.match(source,/Draft educational content; not expert-approved treatment/);
 assert.equal(FEAR_DAILY_ASSISTANT_GUIDES.length,28);
 const allowed=new Set(['T03-S01','T03-S02','T03-S03']);
 assert.ok(FEAR_DAILY_ASSISTANT_GUIDES.every(x=>allowed.has(x.subtopic)), 'every T03 day must have exactly one canonical T03 subtopic');
 assert.deepEqual(FEAR_DAILY_ASSISTANT_GUIDES.map(x=>x.subtopic),["T03-S01","T03-S01","T03-S01","T03-S03","T03-S03","T03-S03","T03-S03","T03-S02","T03-S01","T03-S03","T03-S03","T03-S03","T03-S02","T03-S03","T03-S02","T03-S02","T03-S02","T03-S02","T03-S03","T03-S02","T03-S03","T03-S01","T03-S02","T03-S02","T03-S03","T03-S02","T03-S03","T03-S02"]);
 const s01=registry.subtopics.find(x=>x.subtopic_id==='T03-S01');
 const s03=registry.subtopics.find(x=>x.subtopic_id==='T03-S03');
 const t21=registry.subtopics.find(x=>x.subtopic_id==='T21-S01');
 assert.match(s01.name,/ارزیابی شواهد حاضر/);
 assert.match(s01.definition,/پاسخ دفاعی فوری در T03-S03/);
 assert.match(s03.name,/پاسخ دفاعی فوری/);
 assert.match(s03.definition,/الگوی اجتناب رفتاری/);
 assert.match(t21.name,/رفتار اجتنابی/);
 assert.match(t21.definition,/پاسخ هیجانی\/دفاعی فوری ترس/);
 assert.notEqual(s03.name,t21.name);
});

test('T03 runtime override and prepared assistant bank match all 28 exercise/action pairs',async()=>{
 const override=JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json',import.meta.url),'utf8'));
 const days=override.categories['ترس'].days; assert.equal(days.length,28);
 for(const g of FEAR_DAILY_ASSISTANT_GUIDES){const source=days.find(x=>x.day===g.day);assert.ok(source);assert.equal(g.exercise,source.exercise,'exercise day '+g.day);assert.equal(g.action,source.actionText,'action day '+g.day);}
});
test('T03 has no exact exercise/action duplication with any other topic override',async()=>{
 const override=JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json',import.meta.url),'utf8'));
 const normalize=s=>String(s||'').normalize('NFKC').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\s،؛.!؟,:]/g,'').toLowerCase();
 const fear=override.categories['ترس'].days;
 for(const [topic,data] of Object.entries(override.categories)){if(topic==='ترس')continue;for(const row of data.days||[])for(const f of fear){assert.notEqual(normalize(f.exercise),normalize(row.exercise),'exercise duplicate with '+topic+' day '+row.day);assert.notEqual(normalize(f.actionText),normalize(row.actionText),'action duplicate with '+topic+' day '+row.day);}}
});

test('T03 urgent safety clarification persists and never falls back to a prepared routine answer',()=>{
 const data={topic_id:'T03',day:1,exercise:'تمرین روز اول ترس',actionText:'اقدام روز اول ترس'};
 const first=makeDailyExerciseGuidanceTurn({message:'دیگه نمی‌کشم و نمی‌دانم چه کنم',dayData:data,problem:'ترس',day:1});
 assert.equal(first.nextState.safetyStatus,'pending');
 const second=makeDailyExerciseGuidanceTurn({message:'شاید، مطمئن نیستم',dayData:data,problem:'ترس',day:1,conversationState:first.nextState});
 assert.equal(second.nextState.safetyStatus,'handoff');
 assert.match(second.response,/کمک فوری انسانی/);
 const third=makeDailyExerciseGuidanceTurn({message:FEAR_DAILY_ASSISTANT_GUIDES[0].questions[0].value,dayData:data,problem:'ترس',day:1,conversationState:second.nextState});
 assert.match(third.response,/کمک فوری انسانی/);
 assert.doesNotMatch(third.response,/راهنمای روز/);
});

test('each T03 day has distinct, explicitly hypothetical exercise and action examples',()=>{
 const exerciseExamples=new Set(),actionExamples=new Set();
 for(const g of FEAR_DAILY_ASSISTANT_GUIDES){exerciseExamples.add(g.exerciseExample);actionExamples.add(g.actionExample);}
 assert.equal(exerciseExamples.size,28);
 assert.equal(actionExamples.size,28);
 const g=FEAR_DAILY_ASSISTANT_GUIDES[0];
 const exercise=answerFearDailyPreparedQuestion({day:1,message:g.questions.find(q=>q.kind==='exercise_example').value});
 const action=answerFearDailyPreparedQuestion({day:1,message:g.questions.find(q=>q.kind==='action_example').value});
 assert.match(exercise,/مثال فرضی/);assert.ok(exercise.includes(g.exerciseExample));
 assert.match(action,/مثال فرضی/);assert.ok(action.includes(g.actionExample));
});

test('T03 prepared guide metadata maps to all ten runtime fields for every day',async()=>{
 const override=JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json',import.meta.url),'utf8'));
 for(const g of FEAR_DAILY_ASSISTANT_GUIDES){
  const row=override.categories['ترس'].days.find(x=>x.day===g.day);
  assert.equal(row.title,g.title,'title day '+g.day);
  assert.equal(row.intro,`هدف: ${g.objective}\nمهارت: ${g.skill}\nسازوکار: ${g.mechanism}`,'intro day '+g.day);
  assert.equal(row.closing,`معیار موفقیت: ${g.successCriterion}\nپرسش بازتاب: ${g.reflectionQuestion}\nشرط توقف: ${g.stopCondition}`,'closing day '+g.day);
  assert.equal(row.lightExerciseText,`نسخه سبک تمرین: ${g.lightVersion}`,'light exercise day '+g.day);
  assert.equal(row.lightActionText,`نسخه سبک اقدام: ${g.lightVersion}`,'light action day '+g.day);
  assert.equal(row.progressActionText,`نسخه پیشرفت اقدام: ${g.progressVersion}`,'progress day '+g.day);
  assert.equal(row.restExerciseText,`نسخه استراحت تمرین: ${g.restVersion}`,'rest exercise day '+g.day);
  assert.equal(row.restActionText,`نسخه استراحت اقدام: ${g.restVersion}`,'rest action day '+g.day);
 }
});
