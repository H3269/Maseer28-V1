import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const readJson=(p)=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const DIMENSIONS=[
 ['target_specificity','اختصاصی‌بودن هدف'],
 ['psychological_mechanism','دقت سازوکار روان‌شناختی'],
 ['evidence_support','پشتوانه شواهد'],
 ['exercise_alignment','تناسب تمرین'],
 ['progression_and_difficulty','توالی و دشواری'],
 ['safety_and_cautions','ایمنی و احتیاط'],
 ['outcome_measurement','سنجش نتیجه'],
 ['accessibility','دسترس‌پذیری']
];
const escapeHeading=(s)=>String(s).replace(/[\r\n#]/g,' ').trim();

export function buildFirstPassReviewPacket({content,topics,dayNumber=1}){
 if(!Number.isInteger(dayNumber)||dayNumber<1||dayNumber>28) throw new Error('dayNumber must be an integer from 1 to 28.');
 const registry=topics.topics??[];
 const categories=content.categories??{};
 if(registry.length!==34) throw new Error(`Expected 34 registered topics, found ${registry.length}.`);
 const byName=new Map(registry.map(t=>[String(t.name).normalize('NFKC').trim(),t]));
 const categoryNames=Object.keys(categories);
 if(categoryNames.length!==34) throw new Error(`Expected 34 content categories, found ${categoryNames.length}.`);
 const missing=registry.filter(t=>!Object.hasOwn(categories,t.name));
 const unknown=categoryNames.filter(n=>!byName.has(String(n).normalize('NFKC').trim()));
 if(missing.length||unknown.length) throw new Error('Topic registry and content categories do not match exactly.');
 const records=registry.slice().sort((a,b)=>a.display_order-b.display_order).map(topic=>{
  const days=categories[topic.name].days;
  if(!Array.isArray(days)||days.length!==28) throw new Error(`Expected 28 days for ${topic.name}.`);
  const day=days[dayNumber-1];
  if(!day?.id) throw new Error(`Missing content id for ${topic.name}, day ${dayNumber}.`);
  return {topic_id:topic.topic_id,topic_name:topic.name,display_order:topic.display_order,day_number:dayNumber,content_id:day.id,source_day:day};
 });
 const lines=[
 '# بسته بازبینی انسانی محتوای مسیر۲۸',
 '',
 `نسخه منبع: ${content.version??'نامشخص'}`,
 `روز نمونه: ${dayNumber} از ۲۸ | تعداد رکورد: ${records.length}`,
 '',
 '> این بسته صرفاً مواد خام را برای بازبینی انسانی کنار هم قرار می‌دهد. هیچ امتیاز، تأیید، تشخیص، یا نتیجه بالینی به‌صورت خودکار تولید نشده است. بازبین باید متن کامل و زمینه هر روز را بررسی کند.',
 '',
 '## راهنمای بازبین',
 '',
 'برای هر موضوع، تمام فیلدهای رکورد منبع را بخوانید. در هر بُعد از ۰ تا ۳ امتیاز دهید یا «نیازمند اطلاعات بیشتر» ثبت کنید. امتیاز ۰ یا ۱ در ایمنی، تأیید را متوقف می‌کند. تأیید آموزشی، اثربخشی درمانی یا مجوز استفاده خودکار نیست.',
 '',
 '| بُعد | امتیاز ۰ تا ۳ | دلیل/نقص مشخص |',
 '|---|---:|---|',
 ...DIMENSIONS.map(([key,label])=>`| ${label} (${key}) | ____ | ____ |`),
 '| تصمیم | pending / revision / reject / educational review | ____ |',
 '| بازبین و تخصص مرتبط | ____ | ____ |',
 '| شناسه شواهد | ____ | ____ |',
 '| ملاحظات ایمنی و معیار توقف | ____ | ____ |',
 '',
 '---',
 ''
 ];
 for(const record of records){
  lines.push(`## ${String(record.display_order).padStart(2,'0')}. ${escapeHeading(record.topic_name)} — ${record.topic_id}`,'');
  lines.push(`شناسه محتوا: \`${record.content_id}\` | روز: ${record.day_number}`,'');
  lines.push('### رکورد کامل منبع','', '```json',JSON.stringify(record.source_day,null,2),'```','');
  lines.push('### یادداشت بازبین','','- هدف آموزشی دقیق:','- سازوکار هدف:','- تناسب تمرین با سازوکار:','- ادعاهای نیازمند منبع:','- خطرها، موارد منع و معیار توقف:','- اصلاح پیشنهادی:','- تصمیم و دلیل:','','---','');
 }
 return lines.join('\n')+'\n';
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const packet=buildFirstPassReviewPacket({content:readJson('public/content/path-content.json'),topics:readJson('public/assistant/knowledge/topics.v1.json'),dayNumber:Number(process.env.REVIEW_DAY??1)});
 const output=path.join(root,'artifacts','first-pass-review-34-days.md');
 fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.writeFileSync(output,packet,'utf8');
 process.stdout.write(`Created ${output} with 34 source-day records. No scores were generated.\\n`);
}
