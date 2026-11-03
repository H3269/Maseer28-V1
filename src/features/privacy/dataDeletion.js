import { createLocalUserDataDeletionPlan, deleteLocalUserData } from './localData.js';
import { deleteIndexedDbUserData, readIndexedDbSnapshot } from './indexedDbData.js';

/**
 * Coordinates deletion of app-owned localStorage and user-owned library IndexedDB data.
 * Browser storage APIs do not provide a transaction spanning both databases, so this
 * executor never claims atomicity and reports partial/uncertain outcomes explicitly.
 */
export async function executeCompleteLocalDataDeletion({
  storage = globalThis.localStorage,
  indexedDBApi = globalThis.indexedDB,
} = {}) {
  const stores = {
    localStorage: { attempted: 0, removed: 0, remaining: null, verified: false, errors: [] },
    indexedDB: { attempted: 0, removed: 0, remaining: null, verified: false, errors: [] },
  };

  // Preflight both stores before the first destructive operation.
  let localPlan;
  try {
    localPlan = createLocalUserDataDeletionPlan(storage);
    if (localPlan.errors.length) {
      stores.localStorage.errors = localPlan.errors;
      return { deleted: false, status: 'preflight_failed', stores, errors: ['بررسی اولیه localStorage ناموفق بود؛ هیچ داده‌ای حذف نشد.'] };
    }
  } catch (error) {
    stores.localStorage.errors = [{ phase: 'preflight', message: String(error?.message || error) }];
    return { deleted: false, status: 'preflight_failed', stores, errors: ['دسترسی به localStorage ممکن نبود؛ هیچ داده‌ای حذف نشد.'] };
  }

  try {
    await readIndexedDbSnapshot(indexedDBApi);
  } catch (error) {
    stores.indexedDB.errors = [{ phase: 'preflight', message: String(error?.message || error) }];
    return { deleted: false, status: 'preflight_failed', stores, errors: ['بررسی اولیه IndexedDB ناموفق بود؛ هیچ داده‌ای حذف نشد.'] };
  }

  // Execute both namespaces even if one reports an error; the final result is
  // never presented as complete unless both stores independently verify empty.
  try {
    const result = deleteLocalUserData(storage, localPlan);
    stores.localStorage = {
      attempted: result.attempted,
      removed: result.removed.length,
      remaining: Array.isArray(result.remainingKeys) ? result.remainingKeys.length : null,
      verified: result.errors.length === 0
        && result.verificationErrors.length === 0
        && Array.isArray(result.remainingKeys)
        && result.remainingKeys.length === 0,
      errors: [...result.errors, ...result.verificationErrors],
    };
  } catch (error) {
    stores.localStorage.errors = [{ phase: 'delete', message: String(error?.message || error) }];
  }

  try {
    const result = await deleteIndexedDbUserData(indexedDBApi);
    stores.indexedDB = {
      attempted: result.attempted,
      removed: result.removed,
      remaining: result.remaining,
      verified: result.remaining === 0 && result.removed === result.attempted,
      errors: [],
    };
  } catch (error) {
    stores.indexedDB.errors = [{ phase: 'delete_or_verify', message: String(error?.message || error) }];
  }

  const verified = stores.localStorage.verified && stores.indexedDB.verified;
  if (verified) {
    return { deleted: true, status: 'complete', stores, errors: [] };
  }

  const uncertain = stores.localStorage.remaining === null
    || stores.indexedDB.remaining === null
    || stores.localStorage.errors.some((error) => error.phase === 'enumerate_after_delete')
    || stores.indexedDB.errors.length > 0;
  const anyRemoved = stores.localStorage.removed > 0 || stores.indexedDB.removed > 0;
  const status = uncertain ? 'recovery_required' : anyRemoved ? 'partial_delete' : 'failed';
  return {
    deleted: false,
    status,
    stores,
    errors: status === 'recovery_required'
      ? ['نتیجه حذف در دست‌کم یک مخزن قابل راستی‌آزمایی نیست؛ پیش از استفاده مجدد، وضعیت داده‌های محلی باید بررسی شود.']
      : ['حذف کامل تأیید نشد؛ بخشی از داده‌ها ممکن است باقی مانده باشند.'],
  };
}

export const COMPLETE_LOCAL_DATA_DELETION_POLICY = Object.freeze({
  scope: 'App-owned localStorage keys (excluding copyright acceptance) and user-owned records in maseer28-library IndexedDB.',
  preserved: 'Copyright acceptance, verified public seed library data, unrelated browser storage, downloaded exports, device backups, and server-side records.',
  atomicity: 'No cross-store atomic transaction exists. The executor preflights both stores, verifies each deletion independently, and reports partial_delete or recovery_required instead of claiming complete deletion.',
});
