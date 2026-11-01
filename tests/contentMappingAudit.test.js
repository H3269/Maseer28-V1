import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildContentMappingQueue } from '../scripts/generate-content-mapping-queue.mjs';
import { auditContentMappings } from '../scripts/audit-content-mappings.mjs';

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [content, topics, subtopics] = await Promise.all([
  read('../public/content/path-content.json'),
  read('../public/assistant/knowledge/topics.v1.json'),
  read('../public/assistant/knowledge/subtopics.v1.json'),
]);
const evidenceRegistry = { schema_version:'1.0.0', registry_id:'test', status:'draft_requires_expert_review', runtime_eligible:false, evidence:[] };

test('queue creates 952 pending mappings without guessing subtopics',()=>{
 const queue=buildContentMappingQueue({content,topics});
 assert.equal(queue.mappings.length,952);
 assert.equal(queue.runtime_eligible,false);
 assert.ok(queue.mappings.every(item=>item.mapping_status==='pending_review'));
 assert.ok(queue.mappings.every(item=>item.subtopic_ids.length===0));
});

test('audit reports complete expected source coverage and 952 unreviewed mappings',()=>{
 const queue=buildContentMappingQueue({content,topics});
 const report=auditContentMappings({content,topics,subtopics,evidenceRegistry,mappingSet:queue});
 assert.deepEqual(report.errors,[]);
 assert.equal(report.counts.expected_source_days,952);
 assert.equal(report.counts.mapping_records,952);
 assert.equal(report.counts.pending_review,952);
 assert.equal(report.readiness.complete_source_coverage,true);
 assert.equal(report.readiness.all_records_reviewed,false);
 assert.equal(report.readiness.approved_for_runtime,false);
});

test('audit rejects a subtopic attached to the wrong parent topic',()=>{
 const queue=buildContentMappingQueue({content,topics});
 queue.mappings[0].subtopic_ids=[subtopics.subtopics.find(item=>item.topic_id==='T02').subtopic_id];
 const report=auditContentMappings({content,topics,subtopics,evidenceRegistry,mappingSet:queue});
 assert.ok(report.errors.some(error=>error.includes('another parent topic')));
});

test('approved mapping requires reviewer rationale and fully traceable approved evidence',()=>{
 const queue=buildContentMappingQueue({content,topics});
 const mapping=queue.mappings[0];
 mapping.mapping_status='approved';
 mapping.subtopic_ids=[subtopics.subtopics.find(item=>item.topic_id===mapping.source_topic_id).subtopic_id];
 mapping.review={reviewer_id:'expert-1',reviewed_at:'2026-11-02T10:00:00Z',rationale:'Full-day review',evidence_ids:['EVD_VALID_1']};
 const evidence={evidence_id:'EVD_VALID_1',title:'Guideline',citation:'DOI:10.0000/example',population:'Adults',study_type:'Clinical guideline',review_status:'approved',reviewer_id:'reviewer-1',reviewed_at:'2026-11-02T09:00:00Z'};
 const report=auditContentMappings({content,topics,subtopics,evidenceRegistry:{...evidenceRegistry,evidence:[evidence]},mappingSet:queue});
 assert.deepEqual(report.errors,[]);
});

test('audit rejects duplicate evidence IDs and incomplete evidence metadata',()=>{
 const queue=buildContentMappingQueue({content,topics});
 queue.mappings[0].mapping_status='approved';
 queue.mappings[0].subtopic_ids=[subtopics.subtopics.find(item=>item.topic_id==='T01').subtopic_id];
 queue.mappings[0].review={reviewer_id:'expert-1',reviewed_at:'2026-11-02T10:00:00Z',rationale:'Reviewed',evidence_ids:['EVD_DUP']};
 const evidence={evidence_id:'EVD_DUP',title:'Title',citation:'Citation',population:'Adults',study_type:'Trial',review_status:'approved',reviewer_id:'reviewer-1',reviewed_at:'2026-11-02T09:00:00Z'};
 const report=auditContentMappings({content,topics,subtopics,evidenceRegistry:{...evidenceRegistry,evidence:[evidence,evidence]},mappingSet:queue});
 assert.ok(report.errors.some(error=>error.includes('duplicate evidence ID')));
});

test('audit rejects duplicate source content IDs and non-draft runtime flags',()=>{
 const changed=structuredClone(content);
 const names=Object.keys(changed.categories);
 changed.categories[names[1]].days[0].id=changed.categories[names[0]].days[0].id;
 const queue=buildContentMappingQueue({content:changed,topics});
 queue.runtime_eligible=true;
 const report=auditContentMappings({content:changed,topics,subtopics,evidenceRegistry,mappingSet:queue});
 assert.ok(report.errors.some(error=>error.includes('Duplicate source content ID')));
 assert.ok(report.errors.some(error=>error.includes('runtime_eligible=false')));
});
