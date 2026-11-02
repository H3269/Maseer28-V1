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
const cloud = { processor_identity:'Provider A', processing_region:'EU', data_categories:'prompt text only', retention_period:'30 days', withdrawal_method:'in-app control' };
const sensitive = { necessity_explanation:'Explicit user-requested processing only', exact_data_categories:'user-provided wellbeing text' };
const memory = { retention_period:'30 days', view_edit_delete_controls:'available in app' };
const analytics = { purpose_limitation:'aggregate feature usage', avoid_sensitive_content:true };

test('all consent purposes default to false and no implicit consent is inferred', () => {
  const storage=memoryStorage();
  const state=getConsentState(storage);
  for (const item of Object.values(state.purposes)) assert.equal(item.granted,false);
  assert.equal(hasConsent('ai_cloud_processing',storage),false);
});

test('grant requires explicit action and complete purpose-specific context', () => {
  const storage=memoryStorage();
  assert.throws(()=>grantConsent('ai_cloud_processing',{explicitAction:false,context:cloud},storage),/اقدام صریح/);
  assert.throws(()=>grantConsent('ai_cloud_processing',{explicitAction:true,context:{processor_identity:'Provider A'}},storage),/کامل نیست/);
  assert.equal(hasConsent('ai_cloud_processing',storage),false);
});

test('health-data consent is separate and requires cloud consent first', () => {
  const storage=memoryStorage();
  assert.throws(()=>grantConsent('sensitive_health_data_processing',{explicitAction:true,context:sensitive},storage),/رضایت جداگانه/);
  grantConsent('ai_cloud_processing',{explicitAction:true,context:cloud},storage);
  grantConsent('sensitive_health_data_processing',{explicitAction:true,context:sensitive},storage);
  assert.equal(hasConsent('ai_cloud_processing',storage),true);
  assert.equal(hasConsent('sensitive_health_data_processing',storage),true);
});

test('withdrawing cloud consent also withdraws sensitive processing consent', () => {
  const storage=memoryStorage();
  grantConsent('ai_cloud_processing',{explicitAction:true,context:cloud},storage);
  grantConsent('sensitive_health_data_processing',{explicitAction:true,context:sensitive},storage);
  const state=withdrawConsent('ai_cloud_processing',{},storage);
  assert.equal(state.purposes.ai_cloud_processing.granted,false);
  assert.equal(state.purposes.sensitive_health_data_processing.granted,false);
  assert.ok(state.purposes.ai_cloud_processing.withdrawn_at);
});

test('memory and analytics consent remain independent from cloud and health consent', () => {
  const storage=memoryStorage();
  grantConsent('long_term_ai_memory',{explicitAction:true,context:memory},storage);
  grantConsent('product_analytics',{explicitAction:true,context:analytics},storage);
  assert.equal(hasConsent('long_term_ai_memory',storage),true);
  assert.equal(hasConsent('product_analytics',storage),true);
  assert.equal(hasConsent('ai_cloud_processing',storage),false);
});

test('clearing consent returns every purpose to false', () => {
  const storage=memoryStorage();
  grantConsent('long_term_ai_memory',{explicitAction:true,context:memory},storage);
  clearConsentState(storage);
  assert.equal(storage.getItem(CONSENT_STORAGE_KEY),null);
  assert.equal(hasConsent('long_term_ai_memory',storage),false);
});

test('journey context consent is independent, explicit, and withdrawable', () => {
  const storage = memoryStorage();
  const context = {
    selected_data_categories: 'active day and completed day count only',
    retention_period: 'maximum 24 hours',
    view_edit_delete_controls: 'available in settings',
  };
  assert.equal(hasConsent('journey_context', storage), false);
  assert.throws(() => grantConsent('journey_context', { explicitAction: false, context }, storage), /اقدام صریح/);
  assert.throws(() => grantConsent('journey_context', { explicitAction: true, context: { retention_period: '24 hours' } }, storage), /کامل نیست/);
  grantConsent('journey_context', { explicitAction: true, context }, storage);
  assert.equal(hasConsent('journey_context', storage), true);
  assert.equal(hasConsent('long_term_ai_memory', storage), false);
  const state = withdrawConsent('journey_context', {}, storage);
  assert.equal(state.purposes.journey_context.granted, false);
  assert.ok(state.purposes.journey_context.withdrawn_at);
});

test('unknown purposes are rejected and never treated as consented', () => {
  const storage=memoryStorage();
  assert.equal(hasConsent('unknown_purpose',storage),false);
  assert.throws(()=>grantConsent('unknown_purpose',{explicitAction:true,context:{}},storage),/شناخته‌شده/);
  assert.throws(()=>withdrawConsent('unknown_purpose',{},storage),/شناخته‌شده/);
});
