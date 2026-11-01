export const COPYRIGHT_ACCEPTANCE_KEY = 'maseer28_copyright_v60';
export const LEGACY_PROFILE_COMPLETE_KEY = 'profile_completed';

function getStorage(storage) {
  const target = storage ?? globalThis.localStorage;
  if (!target) throw new Error('ذخیره‌سازی محلی در این محیط در دسترس نیست.');
  return target;
}

function isUserDataKey(key) {
  return key.startsWith('maseer28_') && key !== COPYRIGHT_ACCEPTANCE_KEY
    || key === LEGACY_PROFILE_COMPLETE_KEY;
}

export function readLocalUserData(storage) {
  const target = getStorage(storage);
  const entries = {};
  const errors = [];
  for (let index = 0; index < target.length; index += 1) {
    let key;
    try { key = target.key(index); } catch (error) { errors.push({ key: null, message: String(error?.message || error) }); continue; }
    if (!key || !isUserDataKey(key)) continue;
    try {
      const raw = target.getItem(key);
      try { entries[key] = JSON.parse(raw); }
      catch { entries[key] = raw; }
    } catch (error) { errors.push({ key, message: String(error?.message || error) }); }
  }
  return {
    schema_version: '1.0.0',
    exported_at: new Date().toISOString(),
    scope: 'This export contains app-owned browser localStorage data only.',
    storage: 'localStorage',
    entries,
    complete: errors.length === 0,
    errors,
  };
}

export function deleteLocalUserData(storage) {
  const target = getStorage(storage);
  const keys = [];
  const removed = [];
  const errors = [];
  for (let index = 0; index < target.length; index += 1) {
    const key = target.key(index);
    if (key && isUserDataKey(key)) keys.push(key);
  }
  for (const key of keys) {
    try { target.removeItem(key); }
    catch (error) { errors.push({ key, stage: 'remove', message: String(error?.message || error) }); continue; }
    try {
      if (target.getItem(key) === null) removed.push(key);
      else errors.push({ key, stage: 'verify', message: 'کلید پس از تلاش برای حذف همچنان موجود است.' });
    } catch (error) { errors.push({ key, stage: 'verify', message: String(error?.message || error) }); }
  }
  return { attempted: keys.length, removed, errors };
}

export const LOCAL_USER_DATA_POLICY = Object.freeze({
  included: 'All localStorage keys beginning with maseer28_ except copyright acceptance, plus the legacy profile_completed flag.',
  excluded: 'Copyright acceptance, browser data outside this app, downloaded exports, operating-system backups, and any server-side records.',
  note: 'The current application does not provide account-level/server-side deletion through this module.',
});
