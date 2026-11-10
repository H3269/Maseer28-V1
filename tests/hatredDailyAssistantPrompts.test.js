import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { HATRED_DAILY_ASSISTANT_GUIDES, answerHatredDailyPreparedQuestion, getHatredDailyAssistantPromptGroups } from '../src/features/assistant/hatredDailyAssistantPrompts.js';

test('T04 has 28 complete days and exactly 14 unique prepared questions per day',()=>{
 assert.equal(HATRED_DAILY_ASSISTANT_GUIDES.length,28);
 for(const g of HATRED_DAILY_ASSISTANT_GUIDES){
  assert.equal(g.topicId,'T04');assert.equal(g.topic,'نفرت');assert.equal(g.questions.length,14);
  assert.equal(new Set(g.questions.map(q=>q.value)).size,14);
  for(const key of ['subtopic','objective','skill','mechanism','exercise','action','lightVersion','progressVersion','restVersion','successCriterion','reflectionQuestion','stopCondition','exerciseExample','actionExample'])assert.ok(String(g[key]||'').trim(),`day ${g.day} missing ${key}`);
  assert.ok(g.exerciseExample.length>=120,`day ${g.day} exercise example is not sufficiently worked`);
  assert.ok(g.actionExample.length>=120,`day ${g.day} action example is not sufficiently worked`);
  assert.doesNotMatch(g.exerciseExample,/\bT18\b/,`day ${g.day} exposes an internal topic code`);
  assert.doesNotMatch(g.actionExample,/\bT18\b/,`day ${g.day} exposes an internal topic code`);
 }
});

test('T04 uses the shared five groups and all 392 prompts are covered',()=>{
 for(let day=1;day<=28;day++){
  const groups=getHatredDailyAssistantPromptGroups(day);
  assert.equal(groups.length,5);assert.deepEqual(groups.map(g=>g.questions.length),[2,2,1,5,4]);
  assert.equal(groups.reduce((n,g)=>n+g.questions.length,0),14);
 }
 assert.deepEqual(getHatredDailyAssistantPromptGroups(0),[]);
 assert.deepEqual(getHatredDailyAssistantPromptGroups(29),[]);
});

test('T04 exercises, actions and hypothetical examples are unique within the topic',()=>{
 const unique=(key)=>new Set(HATRED_DAILY_ASSISTANT_GUIDES.map(g=>g[key].normalize('NFKC').replace(/\s+/g,' ').trim())).size;
 for(const key of ['exercise','action','exerciseExample','actionExample'])assert.equal(unique(key),28,key);
});

test('T04 prepared answers stay tied to the selected day and the visible runtime text',()=>{
 const g=HATRED_DAILY_ASSISTANT_GUIDES[0];
 const visible={exercise:'تمرین نمایان و جاری T04',actionText:'اقدام نمایان و جاری T04'};
 const exercise=answerHatredDailyPreparedQuestion({day:1,message:g.questions.find(q=>q.kind==='exercise_meaning').value,dailyContent:visible});
 const action=answerHatredDailyPreparedQuestion({day:1,message:g.questions.find(q=>q.kind==='action_meaning').value,dailyContent:visible});
 assert.ok(exercise.includes(visible.exercise));assert.ok(action.includes(visible.actionText));
 assert.equal(answerHatredDailyPreparedQuestion({day:29,message:g.questions[0].value}),null);
 assert.equal(answerHatredDailyPreparedQuestion({day:1,message:'پرسش آزاد خارج از بانک'}),null);
});

test('T04 self-hatred days are classification/referral only and never provide self-hatred exercises',()=>{
 for(const day of [4,10,11]){
  const g=HATRED_DAILY_ASSISTANT_GUIDES[day-1];
  assert.equal(g.subtopic,'T04-S02');
  assert.match(g.exercise,/T18|خودمعطوف|خودبیزاری/);
  assert.match(g.action,/T18|خودبیزاری|نفرت از خود/);
  assert.doesNotMatch(g.exercise,/خودمهربانی|بازسازی باور خود|تمرین عزت نفس/);
 }
 assert.equal(HATRED_DAILY_ASSISTANT_GUIDES[27].subtopic,'T04-S03');
});

test('T04 runtime exercise/action overrides match all 28 assistant guide entries',async()=>{
 const [raw]=await Promise.all([readFile(new URL('../public/content/daily-text-overrides.v1.json',import.meta.url),'utf8')]);
 const overrides=JSON.parse(raw).categories['نفرت'].days;
 assert.equal(overrides.length,28);
 for(const g of HATRED_DAILY_ASSISTANT_GUIDES){
  const row=overrides.find(x=>x.day===g.day);assert.ok(row,`missing runtime day ${g.day}`);
  assert.equal(row.exercise,g.exercise,`exercise mismatch day ${g.day}`);
  assert.equal(row.actionText,g.action,`action mismatch day ${g.day}`);
 }
});

test('T04 exercise/action text has no exact same-field duplicate in the other 33 topic overlays',async()=>{
 const raw=await readFile(new URL('../public/content/daily-text-overrides.v1.json',import.meta.url),'utf8');
 const categories=JSON.parse(raw).categories;
 const norm=s=>String(s||'').normalize('NFKC').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[\u200c\u200f\u200e]/g,' ').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim().toLowerCase();
 for(const field of ['exercise','actionText']){
  const own=new Set(categories['نفرت'].days.map(x=>norm(x[field])));
  for(const [topic,data] of Object.entries(categories)){
   if(topic==='نفرت')continue;
   for(const row of data.days||[])assert.equal(own.has(norm(row[field])),false,'T04 '+field+' duplicates '+topic+' day '+row.day);
  }
 }
});

test('T04 assigns exactly one canonical package subtopic to each of the 28 days',()=>{
 const allowed=new Set(['T04-S01','T04-S02','T04-S03']);
 assert.ok(HATRED_DAILY_ASSISTANT_GUIDES.every(g=>allowed.has(g.subtopic)));
 assert.equal(new Set(HATRED_DAILY_ASSISTANT_GUIDES.map(g=>g.day)).size,28);
 assert.equal(HATRED_DAILY_ASSISTANT_GUIDES[27].subtopic,'T04-S03');
 assert.deepEqual(HATRED_DAILY_ASSISTANT_GUIDES.filter(g=>g.subtopic==='T04-S02').map(g=>g.day),[4,10,11]);
});


test('T04 all 392 prepared answers teach the user with clear steps, day-specific content and safety',()=>{
 for(const g of HATRED_DAILY_ASSISTANT_GUIDES){
  for(const q of g.questions){
   const answer=answerHatredDailyPreparedQuestion({day:g.day,message:q.value,dailyContent:{exercise:g.exercise,actionText:g.action}});
   assert.ok(answer, `missing answer day ${g.day} kind ${q.kind}`);
   assert.ok(answer.length>=450, `answer too short day ${g.day} kind ${q.kind}: ${answer.length}`);
   assert.match(answer,/راهنمای روز/, `missing day context day ${g.day} kind ${q.kind}`);
   assert.match(answer,/ایمنی|متوقف|فاصله|اختیاری|مکث/);
   if(q.kind==='exercise_example'||q.kind==='action_example'){
    assert.match(answer,/موقعیت فرضی|قدم‌به‌قدم|چطور انجامش بدهی/);
    assert.match(answer,/معیار پایان|از کجا بفهمی کافی است/);
   }
  }
 }
});

test('T04 day 2 example question gives a worked observation-versus-interpretation example, not a paraphrase',()=>{
 const g=HATRED_DAILY_ASSISTANT_GUIDES[1];
 const q=g.questions.find(x=>x.kind==='exercise_example');
 const answer=answerHatredDailyPreparedQuestion({day:2,message:q.value,dailyContent:{exercise:g.exercise,actionText:g.action}});
 assert.match(answer,/همکارت می‌گوید/);
 assert.match(answer,/این جمله چیزی است که شنیده‌ای/);
 assert.match(answer,/برداشت تو از نیت اوست/);
 assert.match(answer,/۱\. موقعیت فرضی/);
 assert.match(answer,/۴\. از کجا بفهمی کافی است/);
});

test('T04 self-hatred safety handoff uses the human-readable topic title, never the internal code',()=>{
 const g=HATRED_DAILY_ASSISTANT_GUIDES[3];
 const q=g.questions.find(x=>x.kind==='stop');
 const answer=answerHatredDailyPreparedQuestion({day:4,message:q.value});
 assert.match(answer,/این مسیر را ادامه نده و مسیر «نفرت از خود» را انتخاب کن/);
 assert.doesNotMatch(answer,/\\bT18\\b/);
});
