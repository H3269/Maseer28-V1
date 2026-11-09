import test from 'node:test';
import assert from 'node:assert/strict';
import { CONSENT_STORAGE_KEY, getConsentState, hasConsent, grantConsent, withdrawConsent, clearConsentState } from '../src/features/privacy/consentManager.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}
const memory = { retention_period:'until withdrawn', view_edit_delete_controls:'available in settings' };

test('only local non-sensitive preference storage is supported and defaults to false', () => {
  const storage=memoryStorage();
  const state=getConsentState(storage);
  assert.deepEqual(Object.keys(state.purposes), ['long_term_ai_memory']);
  assert.equal(hasConsent('long_term_ai_memory',storage),false);
  for (const purpose of ['ai_cloud_processing','sensitive_health_data_processing','product_analytics']) {
    assert.equal(hasConsent(purpose,storage),false);
    assert.throws(()=>grantConsent(purpose,{explicitAction:true,context:{}},storage),/شناخته‌شده/);
    assert.throws(()=>withdrawConsent(purpose,{},storage),/شناخته‌شده/);
  }
});

test('local preference consent requires explicit action and complete context', () => {
  const storage=memoryStorage();
  assert.throws(()=>grantConsent('long_term_ai_memory',{explicitAction:false,context:memory},storage),/اقدام صریح/);
  assert.throws(()=>grantConsent('long_term_ai_memory',{explicitAction:true,context:{retention_period:'until withdrawn'}},storage),/کامل نیست/);
  assert.equal(hasConsent('long_term_ai_memory',storage),false);
  grantConsent('long_term_ai_memory',{explicitAction:true,context:memory},storage);
  assert.equal(hasConsent('long_term_ai_memory',storage),true);
});

test('withdrawing local preference consent turns it off and clears its profile', () => {
  const storage=memoryStorage();
  grantConsent('long_term_ai_memory',{explicitAction:true,context:memory},storage);
  const state=withdrawConsent('long_term_ai_memory',{},storage);
  assert.equal(state.purposes.long_term_ai_memory.granted,false);
  assert.ok(state.purposes.long_term_ai_memory.withdrawn_at);
});

test('clearing consent returns every supported purpose to false', () => {
  const storage=memoryStorage();
  grantConsent('long_term_ai_memory',{explicitAction:true,context:memory},storage);
  clearConsentState(storage);
  assert.equal(storage.getItem(CONSENT_STORAGE_KEY),null);
  assert.equal(hasConsent('long_term_ai_memory',storage),false);
});

test('unknown purposes are rejected and never treated as consented', () => {
  const storage=memoryStorage();
  assert.equal(hasConsent('unknown_purpose',storage),false);
  assert.throws(()=>grantConsent('unknown_purpose',{explicitAction:true,context:{}},storage),/شناخته‌شده/);
  assert.throws(()=>withdrawConsent('unknown_purpose',{},storage),/شناخته‌شده/);
});
