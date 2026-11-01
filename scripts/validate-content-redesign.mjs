import fs from 'node:fs';
export function validateContentRedesign({queue,day1,day2,topics,subtopics}) {
 const errors=[];
 const topicIds=new Set((topics.topics??[]).map(x=>x.topic_id));
 const subById=new Map((subtopics.subtopics??[]).map(x=>[x.subtopic_id,x]));
 const records=queue.records??[], drafts=[...(day1.records??[]),...(day2.records??[])];
 const expected=new Set();
 for(const topic of topics.topics??[]) for(let day=1;day<=28;day++) expected.add('QREV_'+topic.topic_id+'_D'+String(day).padStart(2,'0'));
 const ids=new Set();
 for(const item of records){
  if(ids.has(item.review_id)) errors.push('duplicate queue id '+item.review_id);
  ids.add(item.review_id);
  if(!topicIds.has(item.topic_id)) errors.push('unknown queue topic '+item.topic_id);
  if(item.runtime_eligible!==false||item.review_status!=='pending_review') errors.push('queue item activated or reviewed prematurely '+item.review_id);
  if(Object.values(item.scores??{}).some(x=>x!==null)) errors.push('queue score is not null '+item.review_id);
 }
 if(records.length!==952||ids.size!==expected.size||[...expected].some(x=>!ids.has(x))) errors.push('queue must cover all 952 topic-day slots');
 const draftIds=new Set();
 for(const item of drafts){
  if(draftIds.has(item.content_id)) errors.push('duplicate draft id '+item.content_id);
  draftIds.add(item.content_id);
  if(!topicIds.has(item.topic_id)) errors.push('unknown draft topic '+item.topic_id);
  if(subById.get(item.subtopic_id)?.topic_id!==item.topic_id) errors.push('subtopic parent mismatch '+item.content_id);
  for(const field of ['learning_objective','mechanism_focus','exercise','action','progress_measure','safety_and_limits']) if(!String(item[field]??'').trim()) errors.push('missing '+field+' '+item.content_id);
  if(item.review_status!=='draft_pending_expert_review'||item.runtime_eligible!==false) errors.push('draft not blocked '+item.content_id);
  if((item.evidence_ids??[]).length) errors.push('unverified evidence claimed '+item.content_id);
 }
 if((day1.records??[]).length!==34||(day2.records??[]).length!==34||drafts.length!==68||draftIds.size!==68) errors.push('day one and day two batches must contain 68 unique drafts');
 for(const item of drafts){
  const q=records.find(x=>x.topic_id===item.topic_id&&x.day_number===item.day_number);
  if(!q||q.draft_content_id!==item.content_id||q.source_content_id!==item.source_content_id) errors.push('queue mapping mismatch '+item.content_id);
 }
 return {valid:errors.length===0,errors,summary:{queue_records:records.length,drafts_created:drafts.length,not_started:records.filter(x=>x.redesign_status==='not_started').length,runtime_eligible:drafts.filter(x=>x.runtime_eligible===true).length}};
}
if(process.argv[1]?.endsWith('validate-content-redesign.mjs')){
 const root=process.cwd();
 const read=p=>JSON.parse(fs.readFileSync(root+'/'+p,'utf8'));
 const r=validateContentRedesign({queue:read('public/assistant/content-drafts/952-day-redesign-queue.v1.json'),day1:read('public/assistant/content-drafts/day01-34-topic-drafts.v1.json'),day2:read('public/assistant/content-drafts/day02-34-topic-drafts.v1.json'),topics:read('public/assistant/knowledge/topics.v1.json'),subtopics:read('public/assistant/knowledge/subtopics.v1.json')});
 console.log(JSON.stringify(r,null,2));
 if(!r.valid) throw new Error('Content redesign validation failed');
}
