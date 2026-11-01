import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const readJson=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
export const SAMPLE_DAYS=[1,2,7,14,21,28];
export const TEMPLATE_FIELDS=['title','intro','exercise','actionText','closing','scientific_family','lightActionText','progressActionText','lightExerciseText','restExerciseText','restActionText','legacyBookReason'];
const norm=s=>String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase('fa');

export function auditSampleDayTemplates({content,topics,days=SAMPLE_DAYS}){
 const registry=topics.topics??[], categories=content.categories??{};
 if(registry.length!==34||Object.keys(categories).length!==34) throw new Error('Expected exactly 34 topics and 34 content categories.');
 const normalizedNames=new Map(registry.map(t=>[norm(t.name),t]));
 if(Object.keys(categories).some(name=>!normalizedNames.has(norm(name)))) throw new Error('Content categories do not match topic registry.');
 const report=[];
 for(const dayNumber of days){
  if(!Number.isInteger(dayNumber)||dayNumber<1||dayNumber>28) throw new Error(`Invalid sample day: ${dayNumber}`);
  const records=registry.map(topic=>{
   const category=categories[topic.name];
   if(!Array.isArray(category?.days)||category.days.length!==28) throw new Error(`Expected 28 days for ${topic.name}.`);
   return {topic,day:category.days[dayNumber-1]};
  });
  for(const field of TEMPLATE_FIELDS){
   const groups=new Map();
   for(const {topic,day} of records){
    let value=norm(field==='legacyBookReason'?day.legacyBookRec?.reason:day[field]);
    value=value.split(`«${norm(topic.name)}»`).join('«[topic]»');
    if(!value) value='[empty]';
    groups.set(value,[...(groups.get(value)??[]),topic.name]);
   }
   report.push({day:dayNumber,field,unique_templates:groups.size,topics_with_value:records.filter(({day})=>field==='legacyBookReason'?Boolean(day.legacyBookRec?.reason):day[field]!==undefined&&day[field]!==null&&day[field]!=='').length,groups:[...groups.entries()].sort((a,b)=>b[1].length-a[1].length).map(([template,topicNames])=>({topic_count:topicNames.length,topics:topicNames,template_preview:template.slice(0,180)}))});
  }
  const bookRefs=records.map(({day})=>day.legacyBookRec?JSON.stringify({bookId:day.legacyBookRec.bookId,page:day.legacyBookRec.page,chapter:day.legacyBookRec.chapter}):null);
  const bookGroups=new Map();
  records.forEach(({topic},index)=>{const key=bookRefs[index]??'[no reference]';bookGroups.set(key,[...(bookGroups.get(key)??[]),topic.name]);});
  report.push({day:dayNumber,field:'legacyBookRec.reference_tuple',unique_templates:bookGroups.size,topics_with_value:bookRefs.filter(Boolean).length,groups:[...bookGroups.entries()].map(([value,topicNames])=>({topic_count:topicNames.length,topics:topicNames,template_preview:value}))});
 }
 return {scope:{topic_count:registry.length,sample_days:days,record_count:registry.length*days.length},report,limitations:['این گزارش فقط شباهت قالب متنی را پس از جایگزینی نام موضوع می‌سنجد.','شباهت یا تفاوت متن، کیفیت بالینی یا تناسب واقعی تمرین را اثبات نمی‌کند.','برای داوری کیفیت، متن کامل هر رکورد و زمینه آموزشی باید توسط بازبین متخصص بررسی شود.']};
}

export function renderSampleTemplateReport(result){
 const lines=['# گزارش نمونه‌برداری قالب محتوای مسیر۲۸','',`تعداد موضوع: ${result.scope.topic_count} | روزهای نمونه: ${result.scope.sample_days.join('، ')} | تعداد رکوردها: ${result.scope.record_count}`,'','> این گزارش ابزار غربالگری ساختاری است؛ امتیازدهی روان‌شناختی یا داوری کیفیت انجام نمی‌دهد.','','| روز | فیلد | قالب یکتا بین ۳۴ موضوع | پوشش فیلد |','|---:|---|---:|---:|'];
 for(const item of result.report) lines.push(`| ${item.day} | ${item.field} | ${item.unique_templates} | ${item.topics_with_value}/34 |`);
 lines.push('','## گروه‌های قالب مشترک');
 for(const item of result.report){
  if(!item.groups.length) continue;
  lines.push(`### روز ${item.day} — ${item.field}`);
  for(const group of item.groups) lines.push(`- ${group.topic_count>1?'قالب مشترک':'قالب منفرد'} (${group.topic_count} موضوع): ${group.topics.join('، ')} | ${group.template_preview}`);
 }
 lines.push('','## محدودیت‌ها',...result.limitations.map(x=>`- ${x}`),'');
 return lines.join('\n');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=auditSampleDayTemplates({content:readJson('public/content/path-content.json'),topics:readJson('public/assistant/knowledge/topics.v1.json')});
 const output=path.join(root,'artifacts','content-template-sample-report.md');
 fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.writeFileSync(output,renderSampleTemplateReport(result)+'\n','utf8');
 process.stdout.write(`Audited ${result.scope.record_count} sampled records across ${result.scope.sample_days.length} days.\\n`);
}
