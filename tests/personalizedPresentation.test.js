import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PERSONALIZATION } from '../src/features/privacy/personalizationPreferences.js';
import { getConversationOverview, getPersonalizedQuestionText } from '../src/features/assistant/personalizedPresentation.js';

const question={id:'clarify_example',stage:'differential_clarification',prompt:'یک موقعیت مشخص را توضیح بده.',};

test('concise and detailed preferences change the displayed question',()=>{
 const concise=getPersonalizedQuestionText(question,{...DEFAULT_PERSONALIZATION,response_detail:'concise'});
 const detailed=getPersonalizedQuestionText(question,{...DEFAULT_PERSONALIZATION,response_detail:'detailed'});
 assert.ok(concise.length<detailed.length);
 assert.ok(detailed.includes('این پرسش'));
});

test('example style changes clarification examples',()=>{
 const practical=getPersonalizedQuestionText(question,{...DEFAULT_PERSONALIZATION,example_style:'practical'});
 const conceptual=getPersonalizedQuestionText(question,{...DEFAULT_PERSONALIZATION,example_style:'conceptual'});
 assert.notEqual(practical,conceptual);
 assert.ok(practical.includes('گفت‌وگوی اخیر'));
 assert.ok(conceptual.includes('چهار بخش'));
});

test('supportive tone and grouped overview follow user preferences',()=>{
 const supportive=getPersonalizedQuestionText(question,{...DEFAULT_PERSONALIZATION,communication_style:'supportive'});
 const grouped=getConversationOverview({...DEFAULT_PERSONALIZATION,step_pacing:'grouped'});
 const single=getConversationOverview({...DEFAULT_PERSONALIZATION,step_pacing:'one_at_a_time'});
 assert.ok(supportive.startsWith('هرقدر'));
 assert.ok(grouped.includes('نمای کلی'));
 assert.equal(single,'');
});

test('safety question wording is invariant under all personalization settings',()=>{
 const safety={id:'safety_now',stage:'safety_check',prompt:'پرسش ایمنی ثابت'};
 const variants=[
  {...DEFAULT_PERSONALIZATION,response_detail:'concise',communication_style:'supportive',example_style:'practical',step_pacing:'grouped'},
  {...DEFAULT_PERSONALIZATION,response_detail:'detailed',communication_style:'direct',example_style:'conceptual',step_pacing:'one_at_a_time'},
 ];
 for(const prefs of variants) assert.equal(getPersonalizedQuestionText(safety,prefs),safety.prompt);
});
