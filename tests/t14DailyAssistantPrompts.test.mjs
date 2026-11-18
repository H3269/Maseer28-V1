import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import { T14_DAILY_ASSISTANT_GUIDES,answerT14DailyPreparedQuestion,getT14DailyAssistantPromptGroups } from '../src/features/assistant/t14DailyAssistantPrompts.js';
import { DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN } from '../src/features/assistant/dailyAssistantSafetyReminder.js';
const expected=["منظور از تمرین امروز چیست؟","برای تمرین امروز یک مثال می‌زنی؟","منظور از اقدام اختصاصی امروز چیست؟","برای اقدام امروز یک مثال می‌زنی؟","اگر انجام کاملش برایم سخت بود چه کنم؟","از کجا بفهمم درست انجامش داده‌ام؟","چه زمانی باید تمرین امروز را متوقف کنم؟","اگر امروز نمونه یا آمادگی انجام تمرین را نداشتم چه کنم؟","تمرین و اقدام امروز چه تفاوتی دارند؟","اگر تمرین را انجام ندادم یا فراموش کردم چه کنم؟","اگر هنگام تمرین فشار یا ناراحتی‌ام بیشتر شد چه کنم؟","آیا لازم است حتماً با فرد دیگری صحبت کنم؟","می‌توانم تمرین را تغییر بدهم یا به روش خودم انجام بدهم؟","این تمرین چقدر زمان می‌برد؟"];
const daily=g=>({id:'کمبود انگیزه-'+String(g.day).padStart(2,'0'),day:g.day,topic_id:'T14',title:g.title,sourceExercise:g.exercise,sourceActionText:g.action,exercise:g.exercise,actionText:g.action});
test('T14 contains 28 days and 392 complete prepared answers',()=>{assert.equal(T14_DAILY_ASSISTANT_GUIDES.length,28);for(const [i,g] of T14_DAILY_ASSISTANT_GUIDES.entries()){assert.equal(g.day,i+1);assert.equal(g.topicId,'T14');assert.equal(g.questions.length,14);assert.deepEqual(g.questions.map(q=>q.label),expected);assert.ok(g.questions.every(q=>q.answer?.trim()));assert.equal(new Set(g.questions.map(q=>q.answer)).size,14,'answers should be unique within day '+g.day);assert.equal(g.evidenceGrade,'not_assessed');assert.equal(g.subtopicMappingStatus,'proposed_not_registered');}});
test('T14 overlay matches the assistant guide on every day',async()=>{const o=JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json',import.meta.url),'utf8')),ds=o.categories['کمبود انگیزه'].days;assert.equal(ds.length,28);for(const g of T14_DAILY_ASSISTANT_GUIDES){const d=ds.find(x=>x.day===g.day);assert.equal(d.title,g.title);assert.equal(d.exercise,g.exercise);assert.equal(d.actionText,g.action);assert.equal(d.lightExerciseText,g.lightVersion);assert.equal(d.lightActionText,g.lightActionVersion);assert.equal(d.progressActionText,g.progressActionVersion);assert.equal(d.restExerciseText,g.restVersion);assert.equal(d.restActionText,g.restActionVersion);assert.equal(d.intro,'هدف امروز: '+g.objective+'\nمهارت امروز: '+g.skill);assert.equal(d.closing,'معیار موفقیت: '+g.successCriterion+'\nپرسش بازتاب: '+g.reflectionPrompt+'\nشرط توقف: '+g.stopCondition);}});
test('T14 exposes five prompt groups and fourteen questions per day',()=>{for(let d=1;d<=28;d++){const groups=getT14DailyAssistantPromptGroups(d);assert.equal(groups.length,5);assert.equal(groups.flatMap(g=>g.questions).length,14);}assert.deepEqual(getT14DailyAssistantPromptGroups(29),[]);});
test('T14 day 10 flexible scheduling remains distinct from fixed start cues',()=>{const day10=T14_DAILY_ASSISTANT_GUIDES[9];assert.equal(day10.title,'انتخاب پنجره زمانی سازگار');assert.match(day10.exercise,/دو یا سه بازه ممکن/u);assert.match(day10.exercise,/تعهدهای ثابت/u);assert.doesNotMatch(day10.exercise,/ساعت ثابت|نشانه طبیعی شروع/u);});
test('T14 day 13 and day 21 retain distinct motivation skills after cross-topic review',()=>{const day13=T14_DAILY_ASSISTANT_GUIDES[12],day21=T14_DAILY_ASSISTANT_GUIDES[20];assert.equal(day13.title,'تنظیم سطح چالش با مهارت فعلی');assert.match(day13.objective,/مهارت و منابع فعلی/u);assert.match(day13.exercise,/مهارتی که اکنون داری/u);assert.doesNotMatch(day13.exercise,/معیار کافی|کیفیتِ کافی/u);assert.equal(day21.title,'بازگرداندن حق انتخاب در اجرای هدف');assert.match(day21.objective,/حس اختیار/u);assert.match(day21.exercise,/ترتیب گام‌ها، زمان مناسب، محیط، ابزار/u);assert.doesNotMatch(day21.exercise,/وقفه|اگر-آنگاه/u);});
test('T14 answers require exact canonical identity and topic',()=>{const g=T14_DAILY_ASSISTANT_GUIDES[0],q=g.questions[0];assert.ok(answerT14DailyPreparedQuestion({day:1,message:q.value,dailyContent:daily(g)}));assert.equal(answerT14DailyPreparedQuestion({day:1,message:q.value,dailyContent:{...daily(g),id:'کمبود انگیزه-02'}}),null);assert.equal(answerT14DailyPreparedQuestion({day:1,message:q.value,dailyContent:{...daily(g),topic_id:'T32'}}),null);assert.equal(answerT14DailyPreparedQuestion({day:1,message:'سؤال خارج از کاتالوگ',dailyContent:daily(g)}),null);});

test('T14 safety-sensitive prepared answers append the shared safety reminder',async()=>{const {DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN}=await import('../src/features/assistant/dailyAssistantSafetyReminder.js');for(const g of T14_DAILY_ASSISTANT_GUIDES)for(const kind of ['success','stop','motivation_distress','talk_other']){const q=g.questions.find(x=>x.kind===kind),a=answerT14DailyPreparedQuestion({day:g.day,message:q.value,dailyContent:daily(g)});assert.equal(a.split(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN).length-1,1,'shared reminder must appear once '+g.day+' '+kind);assert.ok(a.endsWith(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN),'shared reminder must be last '+g.day+' '+kind);}});
test('T14 answers are unique across all 392 prepared question slots',()=>{const answers=T14_DAILY_ASSISTANT_GUIDES.flatMap(g=>g.questions.map(q=>q.answer));assert.equal(answers.length,392);assert.equal(new Set(answers).size,392);});

test('T14 is wired into the page assistant and serves the selected day answer',()=>{const g=T14_DAILY_ASSISTANT_GUIDES[0],data={...daily(g)};const result=makePageAssistantTurn({screen:'day',text:g.questions[0].value,dailyContext:{day:1,problem:'کمبود انگیزه',data,guidanceData:data}});assert.equal(result.status,'daily_guidance_available');assert.match(result.message,/راهنمای روز 1 کمبود انگیزه/u);});
test('all 392 T14 prepared questions resolve to their own day-specific answer',()=>{for(const g of T14_DAILY_ASSISTANT_GUIDES){for(const q of g.questions){const answer=answerT14DailyPreparedQuestion({day:g.day,message:q.value,dailyContent:daily(g)});assert.ok(answer,'missing answer for day '+g.day+': '+q.value);assert.match(answer,new RegExp('راهنمای روز '+g.day+' کمبود انگیزه','u'));}}});

test('page assistant routes every T14 day to the matching day-specific guide',()=>{for(const g of T14_DAILY_ASSISTANT_GUIDES){const data=daily(g);const result=makePageAssistantTurn({screen:'day',text:g.questions[0].value,dailyContext:{day:g.day,problem:'کمبود انگیزه',data,guidanceData:data}});assert.equal(result.status,'daily_guidance_available','day '+g.day);assert.ok(result.message.includes('راهنمای روز '+g.day+' کمبود انگیزه'),'wrong guide for day '+g.day);}});

test('T14 daily titles remain distinct from other topics under the shared 0.30 lexical screen',async()=>{const o=JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json',import.meta.url),'utf8'));const normalize=v=>String(v||'').normalize('NFKC').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200f\u200e]/g,' ').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim().toLowerCase();const stop=new Set(['نسخه','سبک','تمرین','اقدام','فقط','یک','و','یا','را','از','به','در','که','اگر','برای','با','بدون','امروز','فعلا','کن','کنید','بنویس','بنویسی','بنویسید','ثبت','انتخاب','نام','ببر','مشخص','بررسی','انجام','بده','بگیر','دارد','هست','است','میشود','شود','تا','خودت','خود','او','این','آن','همان','هر','هیچ','همه']);const tokens=v=>new Set(normalize(v).split(' ').filter(t=>t.length>2&&!stop.has(t)));const ours=o.categories['کمبود انگیزه'].days;assert.equal(new Set(ours.map(x=>normalize(x.title))).size,28);for(const [topic,c] of Object.entries(o.categories))if(topic!=='کمبود انگیزه')for(const a of ours)for(const b of c.days||[]){const x=tokens(a.title),y=tokens(b.title),u=new Set([...x,...y]);let n=0;for(const z of x)if(y.has(z))n++;assert.ok(!u.size||n/u.size<0.30,'T14 title overlap: '+a.day+' '+a.title+' / '+topic+' '+b.day+' '+b.title);}});


test('T14 exercise and action texts have no exact cross-topic duplicates in the 952-day override set',async()=>{const o=JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json',import.meta.url),'utf8'));for(const d of o.categories['کمبود انگیزه'].days)for(const field of ['exercise','actionText']){const dup=Object.entries(o.categories).flatMap(([topic,c])=>(c.days||[]).flatMap(x=>['exercise','actionText'].filter(f=>x[f]===d[field]&&!(topic==='کمبود انگیزه'&&x.day===d.day&&f===field)).map(f=>({topic,day:x.day,field:f}))));assert.deepEqual(dup,[],'duplicate T14 day '+d.day+' '+field);}});

test('T14 day 8 and day 23 retain motivation-specific boundaries',()=>{const day8=T14_DAILY_ASSISTANT_GUIDES[7],day23=T14_DAILY_ASSISTANT_GUIDES[22];assert.equal(day8.title,'آزمون تمایل پس از تماس کوتاه');assert.match(day8.exercise,/انتظار خود را در یک عبارت بنویس/u);assert.match(day8.exercise,/تجربه واقعی و تمایل فعلی به ادامه/u);assert.doesNotMatch(day8.exercise,/تکمیل کار یا ادامه‌دادن هدف این تمرین نیست/u);assert.equal(day23.title,'فهرست آماده گزینه‌های اجرایی');assert.match(day23.exercise,/سه گزینه کوتاه و متفاوت/u);assert.match(day23.mechanism,/منبع انگیزش یا ارزش شخصی را دوباره تحلیل نمی‌کند/u);});
test('T14 seven audited days keep distinct goal-specific mechanisms and all 98 answers synchronized', async () => {
  const { readFile } = await import('node:fs/promises');
  const overlay = JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
  const expected = {
    1: ['نقشه یک هدف مشخص', 'نقشه‌برداری هدف‌محور'],
    2: ['تفکیک علاقه و وضوح هدف', 'تمایز علاقه و وضوح'],
    8: ['آزمون تمایل پس از تماس کوتاه', 'آزمایش تجربه انگیزش'],
    16: ['روشن‌کردن وابستگی اطلاعاتی هدف', 'شفاف‌سازی وابستگی'],
    19: ['استخراج الگوی اجرای مؤثر', 'تحلیل شرایط اجرای هدف'],
    23: ['فهرست آماده گزینه‌های اجرایی', 'پیش‌انتخاب گزینه اجرایی'],
    25: ['حمایت هدف‌محور برای مانع باقی‌مانده', 'درخواست حمایت هدف‌محور'],
  };
  for (const [dayText, [title, skill]] of Object.entries(expected)) {
    const day = Number(dayText);
    const guide = T14_DAILY_ASSISTANT_GUIDES.find((item) => item.day === day);
    const live = overlay.categories['کمبود انگیزه'].days.find((item) => item.day === day);
    assert.equal(guide.title, title);
    assert.equal(guide.skill, skill);
    assert.equal(guide.questions.length, 14);
    assert.equal(new Set(guide.questions.map((item) => item.answer)).size, 14);
    assert.equal(live.title, guide.title);
    assert.equal(live.exercise, guide.exercise);
    assert.equal(live.actionText, guide.action);
    assert.equal(live.intro, 'هدف امروز: ' + guide.objective + '\nمهارت امروز: ' + guide.skill);
    assert.ok(guide.questions.find((item) => item.kind === 'exercise_meaning').answer.includes(guide.exercise));
    assert.ok(guide.questions.find((item) => item.kind === 'action_meaning').answer.includes(guide.action));
    assert.ok(guide.questions.find((item) => item.kind === 'exercise_action_difference').answer.includes(guide.exercise));
    assert.ok(guide.questions.find((item) => item.kind === 'exercise_action_difference').answer.includes(guide.action));
    assert.ok(guide.questions.find((item) => item.kind === 'stop').answer.includes(guide.stopCondition));
    assert.ok(guide.questions.find((item) => item.kind === 'talk_other').answer.includes(guide.title));
  }
  const day16 = T14_DAILY_ASSISTANT_GUIDES.find((item) => item.day === 16);
  assert.match(day16.exercise, /یک پرسش یا وابستگی اطلاعاتی\/تصمیمی/u);
  assert.match(day16.exercise, /هزینه، فاصله، حمل‌ونقل/u);
  assert.match(day16.action, /درخواست محدود و امن/u);
  assert.match(day16.exercise, /هزینه، فاصله، حمل‌ونقل، ساعت دسترسی، ابزار عمومی یا وضعیت جسمی و خواب را در این تمرین ارزیابی نکن/u);
  const day19 = T14_DAILY_ASSISTANT_GUIDES.find((item) => item.day === 19);
  assert.match(day19.exercise, /نشانه یا آماده‌سازی/u);
  assert.match(day19.exercise, /رفتار مشخص/u);
  assert.match(day19.action, /قابل‌تکرار/u);
  assert.doesNotMatch(day19.exercise, /ثبت موفقیت یا حال خوب/u);
});


test('T14 day 1 and day 28 prepared answers have clean stop, support and punctuation wording', () => {
  const day1 = T14_DAILY_ASSISTANT_GUIDES.find((guide) => guide.day === 1);
  const day28 = T14_DAILY_ASSISTANT_GUIDES.find((guide) => guide.day === 28);
  const stop1 = day1.questions.find((question) => question.id === 'q07').answer;
  const talk1 = day1.questions.find((question) => question.id === 'q12').answer;
  const stop28 = day28.questions.find((question) => question.id === 'q07').answer;
  const change28 = day28.questions.find((question) => question.id === 'q13').answer;
  assert.doesNotMatch(stop1, /اگر اگر/u);
  assert.equal((talk1.match(/گفت‌وگو با فرد دیگر شرط انجام تمرین نیست/gu) || []).length, 1);
  assert.doesNotMatch(stop28, /متوقف کن اگر: اگر/u);
  assert.match(change28, /جمع‌بندی و انتخاب گام بعدی\. نسخه سبک:/u);
});


test('T14 all 28 stop answers have a single grammatical stop-condition lead-in', () => {
  for (const guide of T14_DAILY_ASSISTANT_GUIDES) {
    const answer = guide.questions.find((question) => question.id === 'q07').answer;
    assert.doesNotMatch(answer, /متوقف کن اگر:\s*اگر|متوقف کن اگر اگر|اگر:/u, 'day ' + guide.day);
  }
});


test('T14 selected stop answers do not repeat the same stop instruction within one sentence', () => {
  for (const day of [2, 6, 19, 22, 27]) {
    const answer = T14_DAILY_ASSISTANT_GUIDES.find((guide) => guide.day === day).questions.find((question) => question.id === 'q07').answer;
    assert.doesNotMatch(answer, /متوقف کن[^.]{0,70}متوقف کن/u, 'day ' + day);
  }
});


test('T14 selected distress answers avoid duplicated stop and professional referral instructions',()=>{const day19=T14_DAILY_ASSISTANT_GUIDES.find(g=>g.day===19).questions.find(q=>q.id==='q11').answer;const day25=T14_DAILY_ASSISTANT_GUIDES.find(g=>g.day===25).questions.find(q=>q.id==='q11').answer;assert.doesNotMatch(day19,/مرور گذشته[\s\S]{0,120}مرور گذشته/u);assert.equal((day25.match(/ارزیابی حرفه‌ای/g)||[]).length,1);});


test('T14 all 28 stop answers retain the canonical day-specific stop condition',()=>{for(const guide of T14_DAILY_ASSISTANT_GUIDES){const answer=guide.questions.find(q=>q.id==='q07').answer;assert.ok(answer.includes(guide.stopCondition),'day '+guide.day);}});


test('T14 talk answers name the exact action for all 28 days',()=>{for(const guide of T14_DAILY_ASSISTANT_GUIDES){const q=guide.questions.find(x=>x.id==='q12');const answer=answerT14DailyPreparedQuestion({day:guide.day,message:q.value,dailyContent:daily(guide)});assert.ok(answer.includes(guide.action),'day '+guide.day+' action');assert.ok(answer.endsWith(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN),'day '+guide.day+' shared safety reminder remains last');}});


test('T14 adaptation answers name the exact exercise and action for all 28 days',()=>{for(const guide of T14_DAILY_ASSISTANT_GUIDES){const q=guide.questions.find(x=>x.id==='q13');const answer=answerT14DailyPreparedQuestion({day:guide.day,message:q.value,dailyContent:daily(guide)});assert.ok(answer.includes(guide.exercise),'day '+guide.day+' exercise');assert.ok(answer.includes(guide.action),'day '+guide.day+' action');}});

test('T14 duration answers name the exact daily exercise and action for all 28 days',()=>{for(const guide of T14_DAILY_ASSISTANT_GUIDES){const q=guide.questions.find(x=>x.id==='q14');const answer=answerT14DailyPreparedQuestion({day:guide.day,message:q.value,dailyContent:daily(guide)});assert.ok(answer.includes(guide.exercise),'day '+guide.day+' exercise');assert.ok(answer.includes(guide.action),'day '+guide.day+' action');}});