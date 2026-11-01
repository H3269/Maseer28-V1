import fs from 'node:fs';

const REQUIRED = ['learning_objective','mechanism_focus','exercise','action','progress_measure','safety_and_limits'];
const TOPICS = ['T15','T23','T33','T19','T26'];
const PHASES = {4:'guided_skill_building',5:'guided_skill_building',6:'guided_skill_building',7:'guided_skill_application',8:'consolidation_and_review'};
const norm = (v) => String(v ?? '').normalize('NFKC').replace(/\s+/g,' ').trim();

export function validateSelfEvaluationPilot({pilot,queue,evidence}) {
 const errors=[];
 const records=pilot.records ?? [];
 const evidenceIds=new Set((evidence.sources ?? []).map(x=>x.evidence_id));
 const queueBySlot=new Map((queue.records ?? []).map(x=>[x.topic_id+':'+x.day_number,x]));
 const seen=new Set();
 if(records.length!==25) errors.push('pilot must contain exactly 25 records');
 for(const topic of TOPICS) for(let day=4;day<=8;day++){
  const slot=topic+':'+day;
  const matches=records.filter(x=>x.topic_id===topic&&x.day_number===day);
  if(matches.length!==1) errors.push('expected exactly one draft for '+slot);
 }
 for(const r of records){
  const slot=r.topic_id+':'+r.day_number;
  if(!TOPICS.includes(r.topic_id)||r.day_number<4||r.day_number>8) errors.push('out-of-scope record '+r.content_id);
  if(seen.has(r.content_id)) errors.push('duplicate content id '+r.content_id);
  seen.add(r.content_id);
  const expected='DRAFT_'+r.topic_id+'_D'+String(r.day_number).padStart(2,'0');
  if(r.content_id!==expected) errors.push('content id mismatch '+r.content_id);
  if(r.source_content_id!==r.topic_name+'-'+String(r.day_number).padStart(2,'0')) errors.push('source content id mismatch '+r.content_id);
  if(r.phase!==PHASES[r.day_number]) errors.push('phase mismatch '+r.content_id);
  for(const field of REQUIRED) if(!norm(r[field])) errors.push('missing '+field+' '+r.content_id);
  if(r.review_status!=='draft_pending_expert_review'||r.runtime_eligible!==false) errors.push('draft must remain blocked '+r.content_id);
  if(!Array.isArray(r.evidence_ids)||r.evidence_ids.length===0) errors.push('missing evidence provenance '+r.content_id);
  for(const id of [...(r.evidence_ids??[]),...(r.source_reference_ids??[])]) if(!evidenceIds.has(id)) errors.push('unknown evidence id '+id+' in '+r.content_id);
  const q=queueBySlot.get(slot);
  if(!q||q.draft_content_id!==r.content_id||q.source_content_id!==r.source_content_id) errors.push('queue mapping mismatch '+slot);
  if(q&&(q.redesign_status!=='draft_created_pending_review'||q.review_status!=='pending_review'||q.runtime_eligible!==false)) errors.push('queue gate mismatch '+slot);
  if(q&&Object.values(q.scores??{}).some(v=>v!==null)) errors.push('queue scores must remain null '+slot);
 }
 for(const topic of TOPICS){
  const group=records.filter(x=>x.topic_id===topic).sort((a,b)=>a.day_number-b.day_number);
  for(const field of ['learning_objective','mechanism_focus','exercise','action','progress_measure']){
   const values=group.map(x=>norm(x[field]));
   if(new Set(values).size!==values.length) errors.push('non-progressive repeated '+field+' for '+topic);
  }
 }
 for(let day=4;day<=8;day++){
  const group=records.filter(x=>x.day_number===day);
  for(const field of ['learning_objective','exercise','action','progress_measure']){
   const values=group.map(x=>norm(x[field]));
   if(new Set(values).size!==values.length) errors.push('duplicate daily '+field+' on day '+day);
  }
 }
 if(records.some(x=>x.topic_id==='T18')) errors.push('T18 must not have an instructional pilot draft');
 return {valid:errors.length===0,errors,summary:{drafts:records.length,topics:TOPICS.length,days:'04-08',runtime_eligible:records.filter(x=>x.runtime_eligible===true).length}};
}

if(process.argv[1]?.endsWith('validate-self-evaluation-pilot.mjs')){
 const read=(p)=>JSON.parse(fs.readFileSync(p,'utf8'));
 const result=validateSelfEvaluationPilot({
  pilot:read('public/assistant/content-drafts/day04-08-self-evaluation-cluster-pilot.v1.json'),
  queue:read('public/assistant/content-drafts/952-day-redesign-queue.v1.json'),
  evidence:read('public/assistant/evidence/evidence-source-registry.v1.json'),
 });
 console.log(JSON.stringify(result,null,2));
 if(!result.valid) throw new Error('Self-evaluation pilot validation failed');
}
