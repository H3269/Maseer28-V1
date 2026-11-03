import { readLocalUserData } from './localData.js';
import { readIndexedDbUserData, readIndexedDbSnapshot } from './indexedDbData.js';
export const PRIVACY_BACKUP_FORMAT = 'maseer28-browser-backup';
export const PRIVACY_BACKUP_VERSION = '3.0.0';
function stableStringify(value) {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function checksum(value) {
  let hash = 0x811c9dc5;
  const input = stableStringify(value);
  for (let index = 0; index < input.length; index += 1) { hash ^= input.charCodeAt(index); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
export async function createPrivacyBackup({ storage, indexedDBApi, now = () => new Date() } = {}) {
  const results = await Promise.all([Promise.resolve(readLocalUserData(storage)), readIndexedDbUserData(indexedDBApi)]);
  const payload = { format: PRIVACY_BACKUP_FORMAT, schema_version: PRIVACY_BACKUP_VERSION, exported_at: now().toISOString(), scope: 'App-owned localStorage data and user-owned records from maseer28-library IndexedDB in this browser only.', localStorage: results[0], indexedDB: results[1] };
  return { ...payload, integrity: { algorithm: 'fnv1a-32-non-cryptographic', checksum: checksum(payload) } };
}
export function validatePrivacyBackup(candidate) {
  const errors = [];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return { valid: false, errors: ['ساختار فایل پشتیبان معتبر نیست.'] };
  if (candidate.format !== PRIVACY_BACKUP_FORMAT) errors.push('شناسه قالب فایل پشتیبان معتبر نیست.');
  if (candidate.schema_version !== PRIVACY_BACKUP_VERSION) errors.push('نسخه فایل پشتیبان پشتیبانی نمی‌شود.');
  if (!candidate.localStorage || candidate.localStorage.storage !== 'localStorage' || !candidate.localStorage.entries || typeof candidate.localStorage.entries !== 'object' || Array.isArray(candidate.localStorage.entries)) errors.push('بخش localStorage ناقص یا نامعتبر است.');
  if (!candidate.indexedDB || candidate.indexedDB.database !== 'maseer28-library' || !candidate.indexedDB.stores || !['books', 'versions', 'settings'].every((key) => Array.isArray(candidate.indexedDB.stores[key]))) errors.push('بخش IndexedDB ناقص یا نامعتبر است.');
  if (!candidate.integrity || candidate.integrity.algorithm !== 'fnv1a-32-non-cryptographic' || typeof candidate.integrity.checksum !== 'string') errors.push('اطلاعات کنترل سلامت فایل وجود ندارد.');
  if (errors.length) return { valid: false, errors };
  const payload = { ...candidate }; delete payload.integrity;
  if (checksum(payload) !== candidate.integrity.checksum) errors.push('محتوای فایل با مقدار کنترل سلامت آن مطابقت ندارد؛ فایل ممکن است ناقص یا تغییرکرده باشد.');
  return { valid: errors.length === 0, errors, format: candidate.format, schema_version: candidate.schema_version, exported_at: candidate.exported_at };
}

export async function createPrivacyRestorePreview(candidate, { storage, indexedDBApi } = {}) {
  const validation = validatePrivacyBackup(candidate);
  if (!validation.valid) return { valid: false, validation, errors: validation.errors };
  const errors = [];
  const localEntries = candidate.localStorage.entries;
  for (const [key, value] of Object.entries(localEntries)) {
    if (!(key.startsWith('maseer28_') && key !== 'maseer28_copyright_v60') && key !== 'profile_completed') errors.push(`کلید ${key} خارج از محدوده مجاز برنامه است.`);
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol') errors.push(`مقدار کلید ${key} قابل بازیابی نیست.`);
  }
  const stores = candidate.indexedDB.stores;
  const keyFields = { books: 'id', versions: 'id', settings: 'key' };
  for (const [storeName, field] of Object.entries(keyFields)) {
    const seen = new Set();
    for (const row of stores[storeName]) {
      if (!row || typeof row !== 'object' || Array.isArray(row) || typeof row[field] !== 'string' || !row[field].trim()) { errors.push(`رکورد نامعتبر در بخش ${storeName} وجود دارد.`); continue; }
      if (seen.has(row[field])) errors.push(`شناسه تکراری در بخش ${storeName} وجود دارد.`);
      seen.add(row[field]);
      if (storeName === 'versions' && row.source === 'seed') errors.push('نسخه‌های عمومی seed نباید از فایل پشتیبان کاربر بازیابی شوند.');
      if (storeName === 'versions' && (typeof row.bookId !== 'string' || !row.bookId.trim())) errors.push('هر نسخه کتاب باید شناسه کتاب والد معتبر داشته باشد.');
      if (storeName === 'settings' && (row.key.startsWith('seed-') || row.key.startsWith('seed-book-fingerprint:'))) errors.push('تنظیمات داخلی seed قابل بازیابی از فایل کاربر نیستند.');
    }
  }
  if (errors.length) return { valid: false, validation, errors };
  try {
    const currentLocal = readLocalUserData(storage).entries;
    const currentLibrary = await readIndexedDbSnapshot(indexedDBApi);
    const expectedSchema = {
      books: { keyPath: 'id', indexes: [] },
      versions: { keyPath: 'id', indexes: ['bookId'] },
      settings: { keyPath: 'key', indexes: [] },
    };
    for (const [storeName, expected] of Object.entries(expectedSchema)) {
      const actual = currentLibrary.schema?.[storeName];
      if (actual && (actual.keyPath !== expected.keyPath || expected.indexes.some((name) => !actual.indexes.includes(name)))) {
        return { valid: false, validation, errors: [`ساختار مخزن ${storeName} با ساختار مورد انتظار برنامه مطابقت ندارد؛ پیش‌نمایش بازیابی متوقف شد.`] };
      }
    }
    const localConflicts = Object.keys(localEntries).filter((key) => Object.hasOwn(currentLocal, key));
    const indexedDbConflicts = {};
    for (const [storeName, field] of Object.entries(keyFields)) {
      const currentKeys = new Set(currentLibrary.stores[storeName].map((row) => row?.[field]));
      indexedDbConflicts[storeName] = stores[storeName].filter((row) => currentKeys.has(row[field])).map((row) => row[field]);
    }
    return { valid: true, validation, counts: { localStorage: Object.keys(localEntries).length, books: stores.books.length, versions: stores.versions.length, settings: stores.settings.length }, conflicts: { localStorage: localConflicts, indexedDB: indexedDbConflicts, total: localConflicts.length + Object.values(indexedDbConflicts).reduce((sum, keys) => sum + keys.length, 0) }, databaseSchema: currentLibrary.schema, note: 'این پیش‌نمایش فقط داده‌ها را می‌خواند و هیچ تغییری در ذخیره‌سازی مرورگر ایجاد نمی‌کند.' };
  } catch {
    return { valid: false, validation, errors: ['خواندن وضعیت فعلی مرورگر برای تهیه پیش‌نمایش کامل ممکن نشد؛ هیچ داده‌ای تغییر نکرد.'] };
  }
}

export const PRIVACY_BACKUP_POLICY = Object.freeze({
  restore: 'This version creates and validates backup files only. It does not restore or overwrite browser data.',
  integrity: 'The checksum detects accidental corruption; it is not cryptographic authentication and does not prove who created the file.',
  scope: 'Only app-owned localStorage and user-owned records selected from maseer28-library are included. Downloads, browser/device backups, and server-side data are excluded.',
});