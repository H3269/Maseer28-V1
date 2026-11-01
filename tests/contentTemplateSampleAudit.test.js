import test from 'node:test';
import assert from 'node:assert/strict';
import {auditSampleDayTemplates,renderSampleTemplateReport} from '../scripts/audit-content-template-sample.mjs';
const topics={topics:Array.from({length:34},(_,i)=>({topic_id:`T${String(i+1).padStart(2,'0')}`,name:`موضوع ${i+1}`,display_order:i+1}))};
const content={categories:Object.fromEntries(topics.topics.map((t,i)=>[t.name,{days:Array.from({length:28},(_,d)=>({id:`${i}-${d}`,title:'شروع',exercise:`تمرین درباره «${t.name}»`,actionText:`اقدام ${i}`}))}]))};

test('sample audit detects shared templates after topic-name substitution',()=>{
 const result=auditSampleDayTemplates({content,topics,days:[1]});
 const exercise=result.report.find(x=>x.field==='exercise');
 assert.equal(exercise.unique_templates,1);
 assert.equal(exercise.groups[0].topic_count,34);
 const action=result.report.find(x=>x.field==='actionText');
 assert.equal(action.unique_templates,34);
 assert.equal(action.groups.reduce((sum,g)=>sum+g.topic_count,0),34);
 const refs=result.report.find(x=>x.field==='legacyBookRec.reference_tuple');
 assert.equal(refs.topics_with_value,0);
 assert.equal(refs.groups[0].topic_count,34);
 assert.ok(renderSampleTemplateReport(result).includes('قالب یکتا'));
 assert.ok(renderSampleTemplateReport(result).includes('قالب منفرد'));
});

test('sample audit rejects invalid days and incomplete source paths',()=>{
 assert.throws(()=>auditSampleDayTemplates({content,topics,days:[29]}),/Invalid sample day/);
 const broken=structuredClone(content);broken.categories['موضوع 1'].days.pop();
 assert.throws(()=>auditSampleDayTemplates({content:broken,topics,days:[1]}),/Expected 28 days/);
});


test('topic normalization does not replace an unquoted substring inside an unrelated word',()=>{
 const collisionTopics=structuredClone(topics);
 collisionTopics.topics[0].name='ترس';
 const collisionContent=structuredClone(content);
 const firstName=topics.topics[0].name;
 const firstCategory=collisionContent.categories[firstName];
 delete collisionContent.categories[firstName];
 firstCategory.days[0].exercise='ترس از نتیجه';
 collisionContent.categories['ترس']=firstCategory;
 const result=auditSampleDayTemplates({content:collisionContent,topics:collisionTopics,days:[1]});
 const exercise=result.report.find(x=>x.field==='exercise');
 assert.equal(exercise.unique_templates,2);
 assert.ok(exercise.groups.some(g=>g.topics.includes('ترس')&&g.template_preview.includes('ترس از نتیجه')));
});
