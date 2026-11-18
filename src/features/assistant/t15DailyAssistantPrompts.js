import { normalizeDailyAssistantGuide } from './dailyAssistantGuideContract.js';
import T15_GUIDE from './t15DailyAssistantGuide.v1.json' with { type: 'json' };
import { addTeacherStyleFrame } from './teacherStylePreparedAnswer.js';
import { appendDailyAssistantSafetyReminder } from './dailyAssistantSafetyReminder.js';
export const T15_DAILY_ASSISTANT_GUIDES=Object.freeze(T15_GUIDE.records.map(normalizeDailyAssistantGuide));
function toT15DayNumber(value){const day=Number(value);return Number.isInteger(day)&&day>=1&&day<=28?day:null;}
function replaceExact(source,original,replacement){if(!original||!replacement||original===replacement)return source;return source.split(original).join(replacement);}
export function answerT15DailyPreparedQuestion({day,message,dailyContent}={}){
 const dayNumber=toT15DayNumber(day);if(!dayNumber||!dailyContent||typeof dailyContent!=='object')return null;
 const guide=T15_DAILY_ASSISTANT_GUIDES.find(item=>item.day===dayNumber),expectedId=`اعتمادبه‌نفس پایین-${String(dayNumber).padStart(2,'0')}`;
 if(!guide||dailyContent.id!==expectedId||Number(dailyContent.day)!==dayNumber||(dailyContent.topic_id!=null&&dailyContent.topic_id!=='T15')||String(dailyContent.title||'').trim()!==guide.title||String(dailyContent.sourceExercise??dailyContent.exercise??'').trim()!==guide.exercise||String(dailyContent.sourceActionText??dailyContent.actionText??dailyContent.action??'').trim()!==guide.action)return null;
 const question=guide.questions.find(item=>item.value===String(message||'').trim());if(!question||!question.answer?.trim())return null;
 let body=question.answer;body=replaceExact(body,guide.exercise,String(dailyContent.exercise||guide.exercise).trim());body=replaceExact(body,guide.action,String(dailyContent.actionText||dailyContent.action||guide.action).trim());
 const heading=`راهنمای روز ${guide.day} اعتمادبه‌نفس پایین — ${guide.title}`,framed=addTeacherStyleFrame(`${heading}\n\n${body}`,{guide,question,topic:'اعتمادبه‌نفس پایین'});
 const safetyKinds=new Set(['success','stop','self_confidence_distress','talk_other']),reminder='یادآوری اختصاصی ایمنی T15: تردید درباره یک مهارت یا موقعیت، ارزش انسانی تو را تعیین نمی‌کند. تبعیض، بازخورد ناعادلانه، کمبود فرصت یا منابع و شرایط ناامن را به نقص شخصی نسبت نده؛ افشا، مواجهه یا دریافت بازخورد اجباری نیست.';
 return appendDailyAssistantSafetyReminder(safetyKinds.has(question.kind)?framed.trimEnd()+'\n\n'+reminder:framed,question.kind);
}
export function getT15DailyAssistantPromptGroups(day){
 const dayNumber=toT15DayNumber(day),guide=T15_DAILY_ASSISTANT_GUIDES.find(item=>item.day===dayNumber);if(!guide)return [];
 return [{label:'فهم تمرین روز '+guide.day,questions:guide.questions.filter(item=>['exercise_meaning','exercise_example'].includes(item.kind))},{label:'فهم اقدام اختصاصی روز '+guide.day,questions:guide.questions.filter(item=>['action_meaning','action_example'].includes(item.kind))},{label:'تفاوت تمرین و اقدام',questions:guide.questions.filter(item=>item.kind==='exercise_action_difference')},{label:'اجرا و موانع',questions:guide.questions.filter(item=>['light_version','no_event','not_done','can_change','duration'].includes(item.kind))},{label:'ارزیابی و ایمنی',questions:guide.questions.filter(item=>['success','stop','self_confidence_distress','talk_other'].includes(item.kind))}];
}
