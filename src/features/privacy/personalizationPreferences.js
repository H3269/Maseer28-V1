import {
  hasConsent,
  PERSONALIZATION_STORAGE_KEY,
} from './consentManager.js';

export const DEFAULT_PERSONALIZATION = Object.freeze({
  schema_version: '1.0.0',
  response_detail: 'balanced',
  communication_style: 'neutral',
  step_pacing: 'one_at_a_time',
  example_style: 'mixed',
  language: 'fa',
});

const ENUMS = Object.freeze({
  response_detail: ['concise', 'balanced', 'detailed'],
  communication_style: ['direct', 'supportive', 'neutral'],
  step_pacing: ['one_at_a_time', 'grouped'],
  example_style: ['practical', 'conceptual', 'mixed'],
  language: ['fa', 'en', 'auto'],
});

function storageOf(storage) {
  const target = storage ?? globalThis.localStorage;
  if (!target) throw new Error('ذخیره‌سازی محلی در این محیط در دسترس نیست.');
  return target;
}

export function validatePersonalizationPreferences(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('تنظیمات شخصی‌سازی باید یک شیء معتبر باشد.');
  }
  const unknown = Object.keys(input).filter((key) => key !== 'schema_version' && !Object.hasOwn(ENUMS, key));
  if (unknown.length) throw new Error('ذخیره اطلاعات حساس یا فیلد ناشناخته در پروفایل شخصی‌سازی مجاز نیست.');
  const result = { ...DEFAULT_PERSONALIZATION };
  for (const [key, allowed] of Object.entries(ENUMS)) {
    if (input[key] === undefined) continue;
    if (!allowed.includes(input[key])) throw new Error('مقدار تنظیم شخصی‌سازی معتبر نیست: ' + key);
    result[key] = input[key];
  }
  return result;
}

export function loadPersonalizationPreferences(storage) {
  if (!hasConsent('long_term_ai_memory', storage)) return { ...DEFAULT_PERSONALIZATION };
  const raw = storageOf(storage).getItem(PERSONALIZATION_STORAGE_KEY);
  if (!raw) return { ...DEFAULT_PERSONALIZATION };
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.schema_version !== '1.0.0') return { ...DEFAULT_PERSONALIZATION };
    return validatePersonalizationPreferences(parsed);
  } catch {
    return { ...DEFAULT_PERSONALIZATION };
  }
}

export function savePersonalizationPreferences(input, { explicitAction, now = new Date().toISOString() } = {}, storage) {
  if (explicitAction !== true) throw new Error('ذخیره تنظیمات به اقدام صریح کاربر نیاز دارد.');
  if (!hasConsent('long_term_ai_memory', storage)) throw new Error('برای ذخیره بلندمدت تنظیمات، رضایت مستقل حافظه لازم است.');
  const preferences = validatePersonalizationPreferences(input);
  const persisted = { ...preferences, updated_at: now };
  storageOf(storage).setItem(PERSONALIZATION_STORAGE_KEY, JSON.stringify(persisted));
  return preferences;
}

export function clearPersonalizationPreferences(storage) {
  storageOf(storage).removeItem(PERSONALIZATION_STORAGE_KEY);
  return { ...DEFAULT_PERSONALIZATION };
}
