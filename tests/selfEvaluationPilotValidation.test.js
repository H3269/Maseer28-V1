import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateSelfEvaluationPilot } from '../scripts/validate-self-evaluation-pilot.mjs';

const read=(p)=>JSON.parse(fs.readFileSync(p,'utf8'));
const base=()=>({
 pilot:read('public/assistant/content-drafts/day04-08-self-evaluation-cluster-pilot.v1.json'),
 queue:read('public/assistant/content-drafts/952-day-redesign-queue.v1.json'),
 evidence:read('public/assistant/evidence/evidence-source-registry.v1.json'),
});

test('validates 25 linked, evidence-referenced, non-runtime pilot drafts',()=>{
 const result=validateSelfEvaluationPilot(base());
 assert.equal(result.valid,true,result.errors.join('; '));
 assert.equal(result.summary.drafts,25);
 assert.equal(result.summary.runtime_eligible,0);
});

test('rejects premature activation and broken queue mapping',()=>{
 const data=base();
 data.pilot.records[0].runtime_eligible=true;
 data.queue.records.find(x=>x.topic_id==='T15'&&x.day_number===4).draft_content_id=null;
 const result=validateSelfEvaluationPilot(data);
 assert.ok(result.errors.some(x=>x.includes('draft must remain blocked')));
 assert.ok(result.errors.some(x=>x.includes('queue mapping mismatch')));
});

test('rejects missing or fabricated evidence identifiers',()=>{
 const data=base();
 data.pilot.records[0].evidence_ids=['EVIDENCE_NOT_REGISTERED'];
 const result=validateSelfEvaluationPilot(data);
 assert.ok(result.errors.some(x=>x.includes('unknown evidence id')));
});
