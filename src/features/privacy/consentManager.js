export const CONSENT_STORAGE_KEY = 'maseer28_consent_v1';
export const CONSENT_POLICY_VERSION = '1.0.0';
export const PERSONALIZATION_STORAGE_KEY = 'maseer28_personalization_v1';

export const CONSENT_PURPOSES = Object.freeze([
  'ai_cloud_processing',
  'sensitive_health_data_processing',
  'long_term_ai_memory',
  'journey_context',
  'product_analytics',
]);

const DEFAULT_STATE = Object.freeze({
  schema_version: '1.0.0',
  policy_version: CONSENT_POLICY_VERSION,
  purposes: Object.fromEntries(CONSENT_PURPOSES.map((id) => [id, { granted: false, granted_at: null, withdrawn_at: null, context: null }])),
});

function storageOf(storage) {
  const target = storage ?? globalThis.localStorage;
  if (!target) throw new Error('ذخیره‌سازی محلی رضایت در دسترس نیست.');
  return target;
}

function readState(storage) {
  const raw = storageOf(storage).getItem(CONSENT_STORAGE_KEY);
  if (!raw) return structuredClone(DEFAULT_STATE);
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.schema_version !== '1.0.0' || !parsed.purposes) return structuredClone(DEFAULT_STATE);
    const purposes = Object.fromEntries(CONSENT_PURPOSES.map((id) => {
      const item = parsed.purposes[id];
      return [id, item && item.granted === true
        ? { granted: true, granted_at: item.granted_at ?? null, withdrawn_at: null, context: item.context ?? null }
        : { granted: false, granted_at: null, withdrawn_at: item?.withdrawn_at ?? null, context: null }];
    }));
    return { schema_version: '1.0.0', policy_version: parsed.policy_version ?? CONSENT_POLICY_VERSION, purposes };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function requiredContext(purpose, context) {
  const required = {
    ai_cloud_processing: ['processor_identity', 'processing_region', 'data_categories', 'retention_period', 'withdrawal_method'],
    sensitive_health_data_processing: ['necessity_explanation', 'exact_data_categories'],
    long_term_ai_memory: ['retention_period', 'view_edit_delete_controls'],
    journey_context: ['selected_data_categories', 'retention_period', 'view_edit_delete_controls'],
    product_analytics: ['purpose_limitation', 'avoid_sensitive_content'],
  }[purpose];
  return required.every((key) => {
    const value = context?.[key];
    return typeof value === 'boolean' ? value === true : typeof value === 'string' && value.trim().length > 0;
  });
}

export function getConsentState(storage) {
  return readState(storage);
}

export function hasConsent(purpose, storage) {
  if (!CONSENT_PURPOSES.includes(purpose)) return false;
  return readState(storage).purposes[purpose].granted === true;
}

export function grantConsent(purpose, { explicitAction, context = {}, now = new Date().toISOString() } = {}, storage) {
  if (!CONSENT_PURPOSES.includes(purpose)) throw new Error('هدف رضایت شناخته‌شده نیست.');
  if (explicitAction !== true) throw new Error('رضایت فقط با اقدام صریح کاربر ثبت می‌شود.');
  if (!requiredContext(purpose, context)) throw new Error('اطلاعات لازم برای رضایت آگاهانه کامل نیست.');
  if (purpose === 'sensitive_health_data_processing' && !hasConsent('ai_cloud_processing', storage)) {
    throw new Error('پردازش داده حساس بدون رضایت جداگانه پردازش ابری مجاز نیست.');
  }
  const state = readState(storage);
  state.purposes[purpose] = { granted: true, granted_at: now, withdrawn_at: null, context: structuredClone(context) };
  storageOf(storage).setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
  return state;
}

export function withdrawConsent(purpose, { now = new Date().toISOString() } = {}, storage) {
  if (!CONSENT_PURPOSES.includes(purpose)) throw new Error('هدف رضایت شناخته‌شده نیست.');
  const state = readState(storage);
  state.purposes[purpose] = { granted: false, granted_at: null, withdrawn_at: now, context: null };
  if (purpose === 'ai_cloud_processing') {
    state.purposes.sensitive_health_data_processing = { granted: false, granted_at: null, withdrawn_at: now, context: null };
  }
  storageOf(storage).setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
  const erasure_errors = [];
  if (purpose === 'long_term_ai_memory') {
    try { storageOf(storage).removeItem(PERSONALIZATION_STORAGE_KEY); }
    catch (error) { erasure_errors.push(String(error?.message || error)); }
  }
  return erasure_errors.length ? { ...state, erasure_errors } : state;
}

export function clearConsentState(storage) {
  const target = storageOf(storage);
  target.removeItem(CONSENT_STORAGE_KEY);
  const erasure_errors = [];
  try { target.removeItem(PERSONALIZATION_STORAGE_KEY); }
  catch (error) { erasure_errors.push(String(error?.message || error)); }
  const state = structuredClone(DEFAULT_STATE);
  return erasure_errors.length ? { ...state, erasure_errors } : state;
}

// This module records local choices only. It does not transmit data, enable a processor,
// implement retention/deletion at a provider, or constitute legal consent validation.
