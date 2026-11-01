import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const DIMENSIONS = ['target_specificity','psychological_mechanism','evidence_support','exercise_alignment','progression_and_difficulty','safety_and_cautions','outcome_measurement','accessibility'];
const TEXT_FIELDS = ['title','intro','exercise','actionText','closing'];
const normalize = (value, topic) => String(value ?? '').normalize('NFKC').split(`«${topic}»`).join('«[TOPIC]»').split(topic).join('[TOPIC]').replace(/\s+/g,' ').trim().toLocaleLowerCase('fa');

export function buildReviewQueue(content, topics) {
  const byName = new Map((topics.topics ?? []).map((t) => [String(t.name).normalize('NFKC').trim(), t]));
  const reviews = [];
  for (const [name, category] of Object.entries(content.categories ?? {})) {
    const topic = byName.get(String(name).normalize('NFKC').trim());
    if (!topic) throw new Error(`No exact topic registry match: ${name}`);
    if (!Array.isArray(category.days) || category.days.length !== 28) throw new Error(`Expected 28 days: ${name}`);
    category.days.forEach((day,index) => {
      if (!day.id) throw new Error(`Missing content ID for ${topic.topic_id}, day ${index+1}`);
      reviews.push({
        review_id:`QREV_${topic.topic_id}_D${String(index+1).padStart(2,'0')}`,
        topic_id:topic.topic_id, day_number:index+1, content_id:day.id,
        review_status:'pending_review',
        scores:Object.fromEntries(DIMENSIONS.map((d)=>[d,null])),
        reviewer_id:null, reviewed_at:null, rationale:null, evidence_ids:[], safety_notes:[]
      });
    });
  }
  return reviews;
}

export function auditCourseContentQuality({content,topics,ledger,evidenceRegistry}) {
  const errors=[];
  const expected=buildReviewQueue(content,topics);
  const expectedById=new Map(expected.map(item=>[item.review_id,item]));
  const sourceById=new Map();
  for(const [name,category] of Object.entries(content.categories ?? {})){
    const topic=topics.topics.find(t=>t.name===name);
    for(const [i,day] of (category.days ?? []).entries()) sourceById.set(`QREV_${topic?.topic_id}_D${String(i+1).padStart(2,'0')}`,{day});
  }
  const evidenceById=new Map((evidenceRegistry?.evidence ?? []).map(item=>[item.evidence_id,item]));
  const seen=new Set(), statusCounts={pending_review:0,in_review:0,needs_revision:0,rejected:0,reviewed_not_approved:0,approved_for_educational_review:0};
  const repeated={};
  for(const field of TEXT_FIELDS){
    const perDay=[];
    for(let day=0;day<28;day++){
      const groups=new Map();
      for(const [topic,category] of Object.entries(content.categories ?? {})){
        const value=normalize(category.days?.[day]?.[field],topic);
        if(value) groups.set(value,[...(groups.get(value)??[]),topic]);
      }
      perDay.push({day:day+1,shared_templates:[...groups.values()].filter(v=>v.length>1).map(names=>({topic_count:names.length,topics:names}))});
    }
    repeated[field]=perDay;
  }
  for(const review of ledger.reviews ?? []){
    if(seen.has(review.review_id)) errors.push(`Duplicate review id: ${review.review_id}`);
    seen.add(review.review_id);
    const source=sourceById.get(review.review_id);
    if(!source) {errors.push(`Unknown review id: ${review.review_id}`);continue;}
    if(review.content_id!==source.day.id) errors.push(`Source content ID mismatch: ${review.review_id}`);
    if(review.topic_id!==expectedById.get(review.review_id)?.topic_id) errors.push(`Topic ID mismatch: ${review.review_id}`);
    if(!Object.hasOwn(statusCounts,review.review_status)){errors.push(`Invalid status: ${review.review_id}`);continue;}
    statusCounts[review.review_status]++;
    for(const dimension of DIMENSIONS){
      const score=review.scores?.[dimension];
      if(score!==null && (!Number.isInteger(score)||score<0||score>3)) errors.push(`Invalid score ${dimension}: ${review.review_id}`);
    }
    for(const evidenceId of review.evidence_ids ?? []) {
      const evidence=evidenceById.get(evidenceId);
      if(!evidence) errors.push('Unknown evidence ID (not present in evidence registry): '+review.review_id+' -> '+evidenceId);
      else if(!evidence.title?.trim() || !evidence.citation?.trim()) errors.push('Evidence source is not traceable: '+review.review_id+' -> '+evidenceId);
    }
    if(review.review_status==='approved_for_educational_review'){
      if(DIMENSIONS.some(d=>!Number.isInteger(review.scores?.[d])||review.scores[d]<2)) errors.push(`Approval requires all eight scores >=2: ${review.review_id}`);
      if((review.scores?.safety_and_cautions??0)<2) errors.push(`Approval blocked by safety score: ${review.review_id}`);
      if(!review.reviewer_id?.trim()) errors.push(`Approval lacks reviewer: ${review.review_id}`);
      if(!review.reviewed_at||Number.isNaN(Date.parse(review.reviewed_at))) errors.push(`Approval lacks review date: ${review.review_id}`);
      if(!review.rationale?.trim()) errors.push(`Approval lacks rationale: ${review.review_id}`);
      if(!(review.evidence_ids?.length)) errors.push(`Approval lacks evidence IDs: ${review.review_id}`);
      for(const evidenceId of review.evidence_ids ?? []) {
        const evidence=evidenceById.get(evidenceId);
        if(!evidence || !['reviewed','approved'].includes(evidence.review_status) || !evidence.reviewer_id?.trim() || !evidence.reviewed_at || !evidence.citation?.trim()) errors.push('Approval cites evidence that is absent, unreviewed, or untraceable: '+review.review_id+' -> '+evidenceId);
      }
    }
  }
  const missing=expected.filter(x=>!seen.has(x.review_id)).map(x=>x.review_id);
  if(ledger.runtime_eligible!==false) errors.push('Quality review ledger must remain runtime_eligible=false.');
  return {
    errors,
    coverage:{expected_days:expected.length,review_records:seen.size,missing_reviews:missing.length,...statusCounts},
    text_template_warnings:Object.fromEntries(Object.entries(repeated).map(([field,days])=>[field,days.filter(d=>d.shared_templates.length>0).length])),
    repeated_templates_by_field:repeated,
    readiness:{structural_integrity:errors.length===0,complete_review_coverage:missing.length===0,all_reviewed:missing.length===0&&statusCounts.pending_review===0&&statusCounts.in_review===0,approved_for_educational_review:errors.length===0&&missing.length===0&&statusCounts.approved_for_educational_review===expected.length,runtime_eligible:false},
    missing_review_ids:missing,
    limitations:['این ابزار معنای بالینی یا تناسب واقعی تمرین را ارزیابی نمی‌کند.','تفاوت متنی به‌تنهایی اختصاصی‌بودن آموزشی را ثابت نمی‌کند.','تأیید آموزشی معادل اثربخشی درمانی یا مجوز توصیه خودکار نیست.']
  };
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const report=auditCourseContentQuality({content:readJson('public/content/path-content.json'),topics:readJson('public/assistant/knowledge/topics.v1.json'),ledger:readJson('public/assistant/reviews/course-content-quality-review.v1.json'),evidenceRegistry:readJson('public/assistant/evidence/evidence.v1.json')});
 process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
 if(report.errors.length) process.exitCode=1;
}
