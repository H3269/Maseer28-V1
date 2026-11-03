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
      books: { keyPath: 'id', autoIncrement: false, indexes: {} },
      versions: {
        keyPath: 'id',
        autoIncrement: false,
        indexes: { bookId: { keyPath: 'bookId', unique: false, multiEntry: false } },
      },
      settings: { keyPath: 'key', autoIncrement: false, indexes: {} },
    };
    for (const [storeName, expected] of Object.entries(expectedSchema)) {
      const actual = currentLibrary.schema?.[storeName];
      if (!actual) continue; // A fresh install has no library database yet.
      const actualIndexNames = Object.keys(actual.indexDetails || {}).sort();
      const expectedIndexNames = Object.keys(expected.indexes).sort();
      const indexesMatch = JSON.stringify(actualIndexNames) === JSON.stringify(expectedIndexNames)
        && expectedIndexNames.every((name) => {
          const actualIndex = actual.indexDetails?.[name];
          const expectedIndex = expected.indexes[name];
          return actualIndex
            && actualIndex.keyPath === expectedIndex.keyPath
            && actualIndex.unique === expectedIndex.unique
            && actualIndex.multiEntry === expectedIndex.multiEntry;
        });
      if (actual.keyPath !== expected.keyPath || actual.autoIncrement !== expected.autoIncrement || !indexesMatch) {
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
  restore: 'Restore is opt-in, conflict-free only, and never overwrites existing keys. IndexedDB writes are atomic; localStorage failures trigger a guarded compensating rollback. A rollback failure is reported as recovery_required and requires manual recovery.',
  integrity: 'The checksum detects accidental corruption; it is not cryptographic authentication and does not prove who created the file.',
  scope: 'Only app-owned localStorage and user-owned records selected from maseer28-library are included. Downloads, browser/device backups, and server-side data are excluded.',
});

function waitForTransaction(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error || new Error('تراکنش بازیابی لغو شد.'));
    transaction.onerror = () => reject(transaction.error || new Error('تراکنش بازیابی ناموفق بود.'));
  });
}

function serializeStorageValue(value) {
  return JSON.stringify(value);
}

/**
 * Restores only into an empty namespace. Existing keys/IDs are never overwritten.
 * IndexedDB writes are one atomic transaction; localStorage is applied afterward
 * and compensating rollback removes the imported IndexedDB rows if it fails.
 */
export async function restorePrivacyBackup(candidate, { storage, indexedDBApi = globalThis.indexedDB } = {}) {
  const preview = await createPrivacyRestorePreview(candidate, { storage, indexedDBApi });
  if (!preview.valid) return { restored: false, phase: 'preflight', errors: preview.errors || preview.validation?.errors || [] };
  if (preview.conflicts.total > 0) {
    return { restored: false, phase: 'conflict', errors: ['بازیابی بدون بازنویسی فقط در فضای خالی مجاز است؛ ابتدا تعارض‌ها را جداگانه بررسی کنید.'], conflicts: preview.conflicts };
  }
  if (!storage || !indexedDBApi) {
    return { restored: false, phase: 'environment', errors: ['دسترسی هم‌زمان به localStorage و IndexedDB برای بازیابی کامل الزامی است.'] };
  }

  const stores = candidate.indexedDB.stores;
  const importedKeys = {
    books: stores.books.map((row) => row.id),
    versions: stores.versions.map((row) => row.id),
    settings: stores.settings.map((row) => row.key),
  };
  let db;
  let indexedDbCommitted = false;
  try {
    db = await new Promise((resolve, reject) => {
      const request = indexedDBApi.open('maseer28-library');
      request.onupgradeneeded = (event) => {
        if (event.oldVersion !== 0) {
          request.transaction.abort();
          return;
        }
        request.result.createObjectStore('books', { keyPath: 'id' });
        const versions = request.result.createObjectStore('versions', { keyPath: 'id' });
        versions.createIndex('bookId', 'bookId', { unique: false });
        request.result.createObjectStore('settings', { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('بازکردن پایگاه داده برای بازیابی ناموفق بود.'));
      request.onblocked = () => reject(new Error('بازکردن پایگاه داده برای بازیابی مسدود شده است.'));
    });

    const expected = {
      books: { keyPath: 'id', indexes: [] },
      versions: { keyPath: 'id', indexes: ['bookId'] },
      settings: { keyPath: 'key', indexes: [] },
    };
    for (const [name, schema] of Object.entries(expected)) {
      if (!db.objectStoreNames.contains(name)) throw new Error(`مخزن ${name} وجود ندارد؛ بازیابی متوقف شد.`);
      const tx = db.transaction(name, 'readonly');
      const store = tx.objectStore(name);
      const indexes = Array.from(store.indexNames).sort();
      const expectedIndexes = schema.indexes;
      const indexesMatch = JSON.stringify(indexes) === JSON.stringify(expectedIndexes)
        && expectedIndexes.every((indexName) => {
          const index = store.index(indexName);
          return index.keyPath === indexName && index.unique === false && index.multiEntry === false;
        });
      if (store.keyPath !== schema.keyPath || store.autoIncrement || !indexesMatch) {
        throw new Error(`ساختار مخزن ${name} تغییر کرده است؛ بازیابی متوقف شد.`);
      }
    }

    const writeTx = db.transaction(['books', 'versions', 'settings'], 'readwrite');
    const completion = waitForTransaction(writeTx);
    for (const name of ['books', 'versions', 'settings']) {
      for (const row of stores[name]) writeTx.objectStore(name).add(row);
    }
    await completion;
    indexedDbCommitted = true;

    const appliedLocalKeys = [];
    try {
      for (const [key, value] of Object.entries(candidate.localStorage.entries)) {
        if (storage.getItem(key) !== null) throw new Error(`کلید ${key} هم‌زمان با بازیابی ایجاد شده است.`);
        storage.setItem(key, serializeStorageValue(value));
        appliedLocalKeys.push(key);
      }
      const verification = readLocalUserData(storage).entries;
      for (const [key, value] of Object.entries(candidate.localStorage.entries)) {
        if (stableStringify(verification[key]) !== stableStringify(value)) throw new Error(`راستی‌آزمایی کلید ${key} ناموفق بود.`);
      }
    } catch (localError) {
      for (const key of appliedLocalKeys) {
        try { storage.removeItem(key); } catch { /* reported through recovery status below */ }
      }
      const rollbackTx = db.transaction(['books', 'versions', 'settings'], 'readwrite');
      const rollbackDone = waitForTransaction(rollbackTx);
      for (const [name, field] of [['books', 'id'], ['versions', 'id'], ['settings', 'key']]) {
        const incomingByKey = new Map(stores[name].map((row) => [row[field], row]));
        const store = rollbackTx.objectStore(name);
        for (const key of importedKeys[name]) {
          const request = store.get(key);
          request.onsuccess = () => {
            const current = request.result;
            if (current === undefined) return;
            if (stableStringify(current) !== stableStringify(incomingByKey.get(key))) {
              try { rollbackTx.abort(); } catch { /* transaction may already be inactive */ }
              return;
            }
            store.delete(key);
          };
        }
      }
      try {
        await rollbackDone;
        indexedDbCommitted = false;
        return { restored: false, phase: 'localStorage', rolledBack: true, errors: [String(localError?.message || localError)] };
      } catch (rollbackError) {
        return { restored: false, phase: 'recovery_required', rolledBack: false, errors: [String(localError?.message || localError), String(rollbackError?.message || rollbackError)] };
      }
    }

    return {
      restored: true,
      counts: { localStorage: Object.keys(candidate.localStorage.entries).length, books: stores.books.length, versions: stores.versions.length, settings: stores.settings.length },
      verified: true,
    };
  } catch (error) {
    return { restored: false, phase: indexedDbCommitted ? 'recovery_required' : 'indexedDB', errors: [String(error?.message || error)] };
  } finally {
    db?.close();
  }
}
