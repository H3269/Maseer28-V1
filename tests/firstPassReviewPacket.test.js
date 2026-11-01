import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFirstPassReviewPacket } from '../scripts/build-first-pass-review-packet.mjs';

const topics={topics:Array.from({length:34},(_,i)=>({topic_id:`T${String(i+1).padStart(2,'0')}`,name:`موضوع ${i+1}`,display_order:i+1}))};
const content={version:'test',categories:Object.fromEntries(topics.topics.map(t=>[t.name,{days:Array.from({length:28},(_,i)=>({id:`${t.topic_id}-D${i+1}`,title:`عنوان ${i+1}`,exercise:`تمرین ${i+1}`,safety_notes:['review me']}))}]))};

test('packet contains exactly 34 complete source-day snapshots and blank human review fields',()=>{
 const packet=buildFirstPassReviewPacket({content,topics,dayNumber:1});
 assert.equal((packet.match(/### رکورد کامل منبع/g)||[]).length,34);
 assert.ok(packet.includes('"safety_notes"'));
 assert.ok(packet.includes('اختصاصی‌بودن هدف'));
 assert.ok(packet.includes('هیچ امتیاز، تأیید'));
 assert.ok(packet.includes('موضوع 34'));
});

test('packet rejects mismatched registry and content categories',()=>{
 const broken=structuredClone(content);
 delete broken.categories['موضوع 1'];
 assert.throws(()=>buildFirstPassReviewPacket({content:broken,topics}),/do not match exactly/);
});

test('packet rejects invalid day number and incomplete 28-day path',()=>{
 assert.throws(()=>buildFirstPassReviewPacket({content,topics,dayNumber:29}),/dayNumber/);
 const broken=structuredClone(content);
 broken.categories['موضوع 1'].days.pop();
 assert.throws(()=>buildFirstPassReviewPacket({content:broken,topics}),/Expected 28 days/);
});
