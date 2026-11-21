import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { T13_DAILY_ASSISTANT_GUIDES, answerT13DailyPreparedQuestion, getT13DailyAssistantPromptGroups } from '../src/features/assistant/t13DailyAssistantPrompts.js';
import { T12_DAILY_ASSISTANT_GUIDES } from '../src/features/assistant/t12DailyAssistantPrompts.js';
import { DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN, DAILY_ASSISTANT_SAFETY_QUESTION_KINDS } from '../src/features/assistant/dailyAssistantSafetyReminder.js';
import { formatAssistantMessageText } from '../src/features/assistant/assistantMessageFormatting.js';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import { getDailySafetyMode } from '../src/features/content/dailySafety.js';

const EXPECTED_QUESTIONS = [
  "منظور از تمرین امروز چیست؟",
  "برای تمرین امروز یک مثال می‌زنی؟",
  "منظور از اقدام اختصاصی امروز چیست؟",
  "برای اقدام امروز یک مثال می‌زنی؟",
  "اگر انجام کاملش برایم سخت بود چه کنم؟",
  "از کجا بفهمم درست انجامش داده‌ام؟",
  "چه زمانی باید تمرین امروز را متوقف کنم؟",
  "اگر امروز نمونه یا آمادگی انجام تمرین را نداشتم چه کنم؟",
  "تمرین و اقدام امروز چه تفاوتی دارند؟",
  "اگر تمرین را انجام ندادم یا فراموش کردم چه کنم؟",
  "اگر هنگام تمرین فشار یا ناراحتی‌ام بیشتر شد چه کنم؟",
  "آیا لازم است حتماً با فرد دیگری صحبت کنم؟",
  "می‌توانم تمرین را تغییر بدهم یا به روش خودم انجام بدهم؟",
  "این تمرین چقدر زمان می‌برد؟"
];
function dailyContent(guide) {
  return { id: 'تنهایی-' + String(guide.day).padStart(2, '0'), topic_id: 'T13', day: guide.day,
    title: guide.title, sourceExercise: guide.exercise, sourceActionText: guide.action,
    exercise: guide.exercise, actionText: guide.action, lightExerciseText: 'نسخه عمومی قدیمی',
    progressVersion: 'نسخه عمومی پیشرفت', restExerciseText: 'نسخه عمومی استراحت', lightActionText: 'اقدام عمومی قدیمی',
    progressActionText: 'پیشرفت عمومی قدیمی', restActionText: 'استراحت عمومی قدیمی' };
}

test('T13 guide has exactly 28 days and 392 complete answers under the fixed 14-question contract', () => {
  assert.equal(T13_DAILY_ASSISTANT_GUIDES.length, 28);
  for (const [index, guide] of T13_DAILY_ASSISTANT_GUIDES.entries()) {
    assert.equal(guide.day, index + 1); assert.equal(guide.topicId, 'T13'); assert.equal(guide.topic, 'تنهایی');
    assert.equal(guide.questions.length, 14);
    assert.equal(guide.reviewStatus, guide.day === 14 ? 'owner_approved' : 'pending_owner_review');
    for (const field of ['lightActionVersion','progressActionVersion','restActionVersion']) assert.ok(guide[field], 'missing '+field+' on day '+guide.day);
    assert.equal(guide.evidenceGrade, 'not_assessed'); assert.equal(guide.subtopicMappingStatus, 'proposed_not_registered');
    assert.deepEqual(guide.questions.map((q) => q.label), EXPECTED_QUESTIONS);
    assert.ok(guide.questions.every((q) => typeof q.answer === 'string' && q.answer.trim()));
    const stopAnswer = guide.questions.find((q) => q.kind === 'stop').answer;
    assert.match(stopAnswer, new RegExp('^محدودیت ایمنی روز ' + guide.day + ':'), 'stop answer must present the day-specific safety limit without a false conditional wrapper on day ' + guide.day);
    assert.ok(stopAnswer.includes(guide.stopCondition), 'stop answer must preserve the exact day-specific stop condition on day ' + guide.day);
    assert.doesNotMatch(stopAnswer, /^محدودیت ایمنی روز \d+::/u, 'stop heading must contain exactly one colon on day ' + guide.day);
    assert.doesNotMatch(stopAnswer, /متوقف کن اگر:\s*اگر/u, 'stop answer must not repeat the conditional opener on day ' + guide.day);
  }
});

test('T13 content overlay has 28 days and exactly matches assistant exercise/action source', async () => {
  const overlay = JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
  const days = overlay.categories['تنهایی']?.days || []; assert.equal(days.length, 28);
  for (const guide of T13_DAILY_ASSISTANT_GUIDES) {
    const day = days.find((item) => item.day === guide.day); assert.ok(day, 'missing day ' + guide.day);
    assert.equal(day.title, guide.title, 'title mismatch on day ' + guide.day);
    assert.equal(day.intro, 'هدف امروز: ' + guide.objective + '\nمهارت امروز: ' + guide.skill);
    assert.equal(day.closing, 'معیار موفقیت: ' + guide.successCriterion + '\nپرسش بازتاب: ' + guide.reflectionPrompt + '\nشرط توقف: ' + guide.stopCondition);
    assert.equal(day.exercise, guide.exercise, 'exercise mismatch on day ' + guide.day);
    assert.equal(day.actionText, guide.action, 'action mismatch on day ' + guide.day);
  }
});


test('T13 high-overlap candidates were sharpened into loneliness-specific tasks', async () => {
  const overlay = JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
  const days = overlay.categories['تنهایی'].days;
  const day1 = days.find((day) => day.day === 1);
  const day9 = days.find((day) => day.day === 9);
  const day12 = days.find((day) => day.day === 12);
  const day19 = days.find((day) => day.day === 19);
  const day25 = days.find((day) => day.day === 25);
  assert.match(day1.exercise, /فاصله میان ارتباط دلخواه و ارتباط در دسترس/u);
  assert.match(day9.actionText, /شروع ساده و یک نقطه پایان طبیعی/u);
  assert.match(day12.actionText, /فعالیتی مشخص و کم‌فشار با زمان محدود/u);
  assert.match(day19.exercise, /نیازی که پشت آن است، رفتار مشخصی که می‌خواهی/u);
  assert.match(day25.actionText, /عامل تسهیل‌کننده را برای تکرار/u);
});

test('T13 day 24 verifies a source before use instead of repeating day 14 activity-access checks', async () => {
  const overlay = JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
  const days = overlay.categories['تنهایی'].days;
  const day14 = days.find((day) => day.day === 14);
  const day24 = days.find((day) => day.day === 24);
  const guide24 = T13_DAILY_ASSISTANT_GUIDES.find((guide) => guide.day === 24);
  assert.match(day14.exercise, /فعالیت گروهی کم‌هزینه|فعالیت گروهی/u);
  const guide14 = T13_DAILY_ASSISTANT_GUIDES.find((guide) => guide.day === 14);
  assert.match(guide14.questions.find((question) => question.kind === 'exercise_example').answer, /باغبانی|گروه داوطلبانه/u);
  assert.doesNotMatch(guide14.questions.find((question) => question.kind === 'exercise_example').answer, /هزینه|زمان و هزینه/u);
  assert.match(day24.exercise, /نیاز اجتماعی یا حمایتی مشخص/u);
  assert.doesNotMatch(day24.exercise, /فعالیت گروهی|علاقه/u);
  assert.match(guide24.questions.find((question) => question.kind === 'exercise_example').answer, /حمایت در سوگ|راهنمایی اجتماعی/u);
  assert.match(day14.actionText, /قالب فعالیت|امکان مشارکت/u);
  assert.match(day24.actionText, /رسمی‌بودن منبع|شرایط محرمانگی/u);
  assert.doesNotMatch(day24.actionText, /هزینه و دسترس‌پذیری/u);
  assert.equal(day24.actionText, guide24.action);
  assert.match(guide24.questions.find((question) => question.kind === 'action_meaning').answer, /رسمی‌بودن منبع/u);
  assert.match(guide24.questions.find((question) => question.kind === 'action_example').answer, /اطلاعات شخصی نفرست/u);
});

test('T13 titles remain distinct from all other topic titles under the shared 0.30 screen', async () => {
  const overlay=JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json',import.meta.url),'utf8'));
  const normalize=(value)=>String(value||'').normalize('NFKC').replace(/[يى]/g,'ی').replace(/ك/g,'ک')
    .replace(/[\u200c\u200f\u200e]/g,' ').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim().toLowerCase();
  const stop=new Set(['نسخه','سبک','تمرین','اقدام','فقط','یک','و','یا','را','از','به','در','که','اگر','برای','با','بدون','امروز','فعلا','کن','کنید','بنویس','بنویسی','بنویسید','ثبت','انتخاب','نام','ببر','مشخص','بررسی','انجام','بده','بگیر','دارد','هست','است','میشود','شود','تا','خودت','خود','او','این','آن','همان','هر','هیچ','همه']);
  const tokens=(value)=>new Set(normalize(value).split(' ').filter((token)=>token.length>2&&!stop.has(token)));
  const t13=overlay.categories['تنهایی'].days;
  assert.equal(new Set(t13.map(day=>normalize(day.title))).size,28);
  for(const [topic,category] of Object.entries(overlay.categories)) if(topic!=='تنهایی') {
    for(const day of t13) for(const other of category.days||[]) {
      const left=tokens(day.title),right=tokens(other.title),union=new Set([...left,...right]);
      let intersection=0;for(const token of left)if(right.has(token))intersection+=1;
      const similarity=union.size?intersection/union.size:0;
      assert.ok(similarity<0.30,'T13 day '+day.day+' title overlaps '+topic+' day '+other.day+': '+similarity);
    }
  }
});

test('T13 exposes five prompt groups and exactly fourteen questions for every day', () => {
  for (let day = 1; day <= 28; day += 1) {
    const groups = getT13DailyAssistantPromptGroups(day); assert.equal(groups.length, 5);
    assert.deepEqual(groups.map((g) => g.label), ['فهم تمرین روز ' + day,'فهم اقدام اختصاصی روز ' + day,'تفاوت تمرین و اقدام','اجرا و موانع','ارزیابی و ایمنی']);
    assert.equal(groups.flatMap((g) => g.questions).length, 14);
  }
  assert.deepEqual(getT13DailyAssistantPromptGroups(0), []); assert.deepEqual(getT13DailyAssistantPromptGroups(29), []);
});

test('all 392 T13 answers are day-bound, teacher-framed and append the shared reminder to exactly four safety answers', () => {
  let checked = 0; const safetyKinds = new Set(['success','stop','loneliness_increased','talk_other']);
  for (const guide of T13_DAILY_ASSISTANT_GUIDES) for (const question of guide.questions) {
    const answer = answerT13DailyPreparedQuestion({day:guide.day,message:question.value,dailyContent:dailyContent(guide)});
    assert.equal(typeof answer,'string','day '+guide.day+' '+question.kind);
    if(question.kind==='light_version') for(const field of ['lightVersion','lightActionVersion','progressVersion','progressActionVersion','restVersion','restActionVersion']) assert.ok(answer.includes(guide[field]),'adaptive answer omitted '+field+' on day '+guide.day);
    if(question.kind==='light_version') for(const stale of ['نسخه عمومی قدیمی','نسخه عمومی پیشرفت','نسخه عمومی استراحت','اقدام عمومی قدیمی','پیشرفت عمومی قدیمی','استراحت عمومی قدیمی']) assert.equal(answer.includes(stale),false,'legacy generic variant leaked into T13 answer');
    assert.match(answer,new RegExp('راهنمای روز '+guide.day+' تنهایی')); assert.ok(answer.includes(guide.title));
    assert.equal(answer.includes(String.fromCharCode(92)+'n'),false);
    const visible=formatAssistantMessageText(answer).flat().map(part=>part.text).join('\n'); assert.equal(visible.includes('**'),false);
    const expected=safetyKinds.has(question.kind); assert.equal(DAILY_ASSISTANT_SAFETY_QUESTION_KINDS.has(question.kind),expected);
    const count=answer.split(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN).length-1;
    assert.equal(count,expected?1:0,'shared reminder count day '+guide.day+' '+question.kind);
    assert.equal(answer.endsWith(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN),expected);
    const topicReminderCount=answer.split('یادآوری اختصاصی ایمنی درباره تنهایی').length-1;
    assert.equal(topicReminderCount,expected?1:0,'topic reminder count day '+guide.day+' '+question.kind);
    checked++;
  }
  assert.equal(checked,392);
});

test('T13 answers are unique and do not copy any exact T12 prepared answer', () => {
  const answers = T13_DAILY_ASSISTANT_GUIDES.flatMap((guide) => guide.questions.map((q) => q.answer));
  const t12Answers = new Set(T12_DAILY_ASSISTANT_GUIDES.flatMap((guide) => guide.questions.map((q) => q.answer)));
  assert.equal(answers.length, 392);
  assert.equal(new Set(answers).size, 392, 'each T13 answer must be textually unique');
  for (const field of ['lightActionVersion','progressActionVersion','restActionVersion']) assert.equal(new Set(T13_DAILY_ASSISTANT_GUIDES.map(g => g[field])).size, 28, field+' must be unique by day');
  assert.ok(answers.every((answer) => !t12Answers.has(answer)), 'T13 answers must not copy T12 answers verbatim');
});

test('T13 exercises and actions have no exact cross-topic duplicate in the 952-day override set', async () => {
  const overlay = JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
  const all = Object.entries(overlay.categories).flatMap(([topic, category]) => (category.days || []).flatMap((day) => [
    { topic, day: day.day, field: 'exercise', text: day.exercise },
    { topic, day: day.day, field: 'actionText', text: day.actionText },
  ]));
  for (const day of overlay.categories['تنهایی'].days) for (const field of ['exercise', 'actionText']) {
    const duplicates = all.filter((item) => item.text === day[field]
      && !(item.topic === 'تنهایی' && item.day === day.day && item.field === field));
    assert.deepEqual(duplicates, [], 'exact duplicate for T13 day ' + day.day + ' ' + field);
  }
});

test('T13 daily variants stay below the T12 cross-topic semantic overlap threshold', () => {
  const fields=['title','exercise','action','lightVersion','lightActionVersion','progressVersion','progressActionVersion','restVersion','restActionVersion'];
  const normalize = value => String(value || '').normalize('NFKC')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\\u200c\\u200f\\u200e]/g, ' ')
    .replace(/[^\\p{L}\\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const stop=new Set(['نسخه','سبک','تمرین','اقدام','فقط','یک','و','یا','را','از','به','در','که','اگر','برای','با','بدون','امروز','فعلا','کن','کنید','بنویس','بنویسی','بنویسید','ثبت','انتخاب','نام','ببر','مشخص','بررسی','انجام','بده','بگیر','دارد','هست','است','میشود','شود','تا','خودت','خود','او','این','آن','همان','هر','هیچ','همه']);
  const tokens=(value)=>new Set(normalize(value).split(' ').filter((token)=>token.length>2&&!stop.has(token)));
  for(const guide of T13_DAILY_ASSISTANT_GUIDES) for(const other of T12_DAILY_ASSISTANT_GUIDES) for(const field of fields) {
    const left=tokens(guide[field]),right=tokens(other[field]),union=new Set([...left,...right]);
    let intersection=0;for(const token of left)if(right.has(token))intersection+=1;
    const similarity=union.size?intersection/union.size:0;
    assert.ok(similarity<0.30,'T13 day '+guide.day+' '+field+' overlaps T12 day '+other.day+': '+similarity);
  }
});

test('T13 prepared answers reject mismatched identity, content and free-text questions', () => {
  const guide=T13_DAILY_ASSISTANT_GUIDES[0], content=dailyContent(guide);
  assert.equal(answerT13DailyPreparedQuestion({day:2,message:guide.questions[0].value,dailyContent:content}),null);
  assert.equal(answerT13DailyPreparedQuestion({day:1,message:guide.questions[0].value,dailyContent:{...content,id:'تنهایی-02'}}),null);
  assert.equal(answerT13DailyPreparedQuestion({day:1,message:guide.questions[0].value,dailyContent:{...content,topic_id:'T12'}}),null);
  assert.equal(answerT13DailyPreparedQuestion({day:1,message:guide.questions[0].value,dailyContent:{...content,sourceActionText:'اقدام ناسازگار'}}),null);
  assert.equal(answerT13DailyPreparedQuestion({day:1,message:'یک سؤال آزاد',dailyContent:content}),null);
});

test('T13 launcher exposes only safe-day prompts and labels the topic correctly', async () => {
  const launcher = await readFile(new URL('../src/features/assistant/GlobalAssistantLauncher.jsx', import.meta.url), 'utf8');
  assert.match(launcher, /isT13DailyPromptContext/u);
  assert.match(launcher, /getDailySafetyMode\(dailyContext\?\.data\) === 'blocked' \? \[\] : getT13DailyAssistantPromptGroups/u);
  assert.match(launcher, /t13-daily-prompt-trigger/u);
  assert.match(launcher, /isT13DailyPromptContext \? "تنهایی"/u);
});

test('T13 specialist-review metadata does not gate content; independent safety routing remains active', () => {
  const guide=T13_DAILY_ASSISTANT_GUIDES[0], content=dailyContent(guide);
  const legacyContent={...content}; delete legacyContent.topic_id;
  const result=makePageAssistantTurn({screen:'day',text:guide.questions[0].value,dailyContext:{day:1,problem:'تنهایی',data:legacyContent,guidanceData:legacyContent}});
  assert.equal(result.status, 'daily_guidance_available');
  const safetyGuide=T13_DAILY_ASSISTANT_GUIDES[13];
  const safetyDay={...dailyContent(safetyGuide),review_status:'owner_approved',risk_level:'caution',subtopic_ids:['T13-S02','T13-S03']};
  assert.equal(safetyGuide.reviewStatus,'owner_approved');
  assert.equal(getDailySafetyMode(safetyDay),'caution');
  const available=makePageAssistantTurn({screen:'day',text:safetyGuide.questions[0].value,dailyContext:{day:14,problem:'تنهایی',data:safetyDay,guidanceData:safetyDay}});
  assert.equal(available.status, 'daily_guidance_available');
  const highRiskDay={...safetyDay,risk_level:'high',review_status:'owner_approved'};
  const safetyBlocked=makePageAssistantTurn({screen:'day',text:safetyGuide.questions[0].value,dailyContext:{day:14,problem:'تنهایی',data:highRiskDay,guidanceData:highRiskDay}});
  assert.equal(safetyBlocked.status,'daily_guidance_unavailable');
  assert.match(safetyBlocked.message,/سطح خطر ثبت‌شده/);
  assert.doesNotMatch(safetyBlocked.message,/تأیید|متخصص|بازبینی/u);
  const emergency=makePageAssistantTurn({screen:'day',text:'دیگه نمی‌کشم. همه‌چی تمومه.',dailyContext:{day:14,problem:'تنهایی',data:safetyDay,guidanceData:safetyDay}});
  assert.equal(emergency.status,'safety_clarification_required',
    'the independent emergency safety route must remain active');
});
