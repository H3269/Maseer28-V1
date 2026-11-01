import test from 'node:test';
import assert from 'node:assert/strict';
import { grantConsent, withdrawConsent, PERSONALIZATION_STORAGE_KEY } from '../src/features/privacy/consentManager.js';
import {
  DEFAULT_PERSONALIZATION,
  clearPersonalizationPreferences,
  loadPersonalizationPreferences,
  savePersonalizationPreferences,
  validatePersonalizationPreferences,
} from '../src/features/privacy/personalizationPreferences.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}
const memoryConsent = { retention_period:'until withdrawn', view_edit_delete_controls:'available in settings' };

test('preferences are session defaults unless independent long-term memory consent exists',()=>{
 const storage=memoryStorage();
 assert.deepEqual(loadPersonalizationPreferences(storage),{...DEFAULT_PERSONALIZATION});
 assert.throws(()=>savePersonalizationPreferences({response_detail:'concise'},{explicitAction:true},storage),/رضایت مستقل حافظه/);
});

test('only explicit, non-sensitive preference choices can be saved after consent',()=>{
 const storage=memoryStorage();
 grantConsent('long_term_ai_memory',{explicitAction:true,context:memoryConsent},storage);
 const saved=savePersonalizationPreferences({response_detail:'concise',communication_style:'direct',step_pacing:'one_at_a_time'},{explicitAction:true,now:'2026-11-02T10:00:00Z'},storage);
 assert.equal(saved.response_detail,'concise');
 assert.equal(loadPersonalizationPreferences(storage).communication_style,'direct');
 assert.equal(JSON.parse(storage.getItem(PERSONALIZATION_STORAGE_KEY)).updated_at,'2026-11-02T10:00:00Z');
});

test('memory withdrawal immediately erases the persisted personalization profile',()=>{
 const storage=memoryStorage();
 grantConsent('long_term_ai_memory',{explicitAction:true,context:memoryConsent},storage);
 savePersonalizationPreferences({response_detail:'detailed'},{explicitAction:true},storage);
 withdrawConsent('long_term_ai_memory',{},storage);
 assert.equal(storage.getItem(PERSONALIZATION_STORAGE_KEY),null);
 assert.deepEqual(loadPersonalizationPreferences(storage),{...DEFAULT_PERSONALIZATION});
});

test('sensitive content and unknown profile fields are rejected',()=>{
 assert.throws(()=>validatePersonalizationPreferences({diagnosis:'anxiety'}),/ذخیره اطلاعات حساس/);
 assert.throws(()=>validatePersonalizationPreferences({risk_history:'private'}),/ذخیره اطلاعات حساس/);
 assert.throws(()=>validatePersonalizationPreferences({response_detail:'extreme'}),/مقدار تنظیم/);
});

test('users can clear saved preferences independently',()=>{
 const storage=memoryStorage();
 grantConsent('long_term_ai_memory',{explicitAction:true,context:memoryConsent},storage);
 savePersonalizationPreferences({example_style:'practical'},{explicitAction:true},storage);
 clearPersonalizationPreferences(storage);
 assert.equal(storage.getItem(PERSONALIZATION_STORAGE_KEY),null);
});
