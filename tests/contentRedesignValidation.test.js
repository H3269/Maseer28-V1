import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContentRedesign } from '../scripts/validate-content-redesign.mjs';

function makeData(){
 const topics=Array.from({length:34},(_,i)=>({topic_id:'T'+String(i+1).padStart(2,'0')}));
 const subtopics=topics.map(x=>({subtopic_id:x.topic_id+'-S01',topic_id:x.topic_id}));
 const records=topics.flatMap(topic=>Array.from({length:28},(_,i)=>{
  const day=i+1, id='QREV_'+topic.topic_id+'_D'+String(day).padStart(2,'0');
  return {review_id:id,topic_id:topic.topic_id,day_number:day,source_content_id:topic.topic_id+'-'+String(day).padStart(2,'0'),draft_content_id:day===1?'DRAFT_'+topic.topic_id+'_D01':null,redesign_status:day===1?'draft_created_pending_review':'not_started',review_status:'pending_review',runtime_eligible:false,scores:{dimension:null}};
 }));
 const drafts=topics.map(topic=>({content_id:'DRAFT_'+topic.topic_id+'_D01',source_content_id:topic.topic_id+'-01',topic_id:topic.topic_id,subtopic_id:topic.topic_id+'-S01',learning_objective:'هدف مشخص',mechanism_focus:'سازوکار محدود',exercise:'تمرین مشاهده',action:'اقدام کم‌خطر',progress_measure:'سنجه مشاهده‌پذیر',safety_and_limits:'حدود ایمنی',evidence_ids:[],review_status:'draft_pending_expert_review',runtime_eligible:false}));
 return {queue:{records},day1:{records:drafts},topics:{topics},subtopics:{subtopics}};
}
test('validates full 952 queue and 34 topic-specific day-one drafts',()=>{
 const result=validateContentRedesign(makeData());
 assert.equal(result.valid,true,result.errors.join('; '));
});
test('blocks premature activation and unverified evidence claims',()=>{
 const data=makeData();
 data.day1.records[0].runtime_eligible=true;
 data.day1.records[0].evidence_ids=['EVD_FAKE'];
 const result=validateContentRedesign(data);
 assert.ok(result.errors.some(x=>x.includes('draft not blocked')));
 assert.ok(result.errors.some(x=>x.includes('unverified evidence claimed')));
});
