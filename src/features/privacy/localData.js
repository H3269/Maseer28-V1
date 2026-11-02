export const COPYRIGHT_ACCEPTANCE_KEY = 'maseer28_copyright_v60';
export const LEGACY_PROFILE_COMPLETE_KEY = 'profile_completed';

function getStorage(storage) {
  const target = storage ?? globalThis.localStorage;
  if (!target) throw new Error('ذخیره‌سازی محلی در این محیط در دسترس نیست.');
  return target;
}

function isUserDataKey(key) {
  return (key.startsWith('maseer28_') && key !== COPYRIGHT_ACCEPTANCE_KEY)
    || key === LEGACY_PROFILE_COMPLETE_KEY;
}

export function readLocalUserData(storage) {
  const target = getStorage(storage);
  const entries = {};
  for (let index = 0; index < target.length; index += 1) {
    const key = target.key(index);
    if (!key || !isUserDataKey(key)) continue;
    const raw = target.getItem(key);
    try { entries[key] = JSON.parse(raw); }
    catch { entries[key] = raw; }
  }
  return {
    schema_version: '1.0.0',
    exported_at: new Date().toISOString(),
    scope: 'This export contains app-owned browser localStorage data only.',
    storage: 'localStorage',
    entries,
  };
}

export function deleteLocalUserData(storage) {
  const target = getStorage(storage);
  const keys = [];
  const errors = [];

  // Take a complete snapshot before making any destructive change.
  try {
    const length = target.length;
    for (let index = 0; index < length; index += 1) {
      const key = target.key(index);
      if (key && isUserDataKey(key)) keys.push(key);
    }
  } catch (error) {
    errors.push({ phase: 'enumerate', message: String(error?.message || error) });
    return { attempted: 0, removed: [], errors, verificationErrors: [] };
  }

  for (const key of keys) {
    try { target.removeItem(key); }
    catch (error) { errors.push({ phase: 'remove', key, message: String(error?.message || error) }); }
  }

  const removed = [];
  const verificationErrors = [];
  for (const key of keys) {
    try {
      if (target.getItem(key) === null) removed.push(key);
    } catch (error) {
      verificationErrors.push({ key, message: String(error?.message || error) });
    }
  }
  return { attempted: keys.length, removed, errors, verificationErrors };
}

export const LOCAL_USER_DATA_POLICY = Object.freeze({
  included: 'All localStorage keys beginning with maseer28_ except copyright acceptance, plus the legacy profile_completed flag.',
  excluded: 'Copyright acceptance, browser data outside this app, downloaded exports, operating-system backups, and any server-side records.',
  note: 'The current application does not provide account-level/server-side deletion through this module.',
});
