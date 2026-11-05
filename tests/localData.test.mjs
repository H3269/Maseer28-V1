import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import test from 'node:test';
import assert from 'node:assert/strict';

import { createLocalUserDataDeletionPlan, deleteLocalUserData, readLocalUserData } from '../src/features/privacy/localData.js';
import { deleteIndexedDbUserData, readIndexedDbUserData, readIndexedDbSnapshot, selectUserOwnedLibraryData } from '../src/features/privacy/indexedDbData.js';
import { createPrivacyBackup, validatePrivacyBackup, createPrivacyRestorePreview, restorePrivacyBackup, PRIVACY_BACKUP_POLICY } from '../src/features/privacy/privacyBackup.js';
import { executeCompleteLocalDataDeletion } from '../src/features/privacy/dataDeletion.js';
import { sanitizeJourneyState } from '../src/features/journey/journeyStore.js';

class MemoryStorage {
  constructor(entries = {}) { this.values = new Map(Object.entries(entries)); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function resignPrivacyBackup(candidate) {
  const payload = { ...candidate };
  delete payload.integrity;
  const stable = (value) => Array.isArray(value) ? '[' + value.map(stable).join(',') + ']'
    : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}'
      : JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (const char of stable(payload)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 0x01000193); }
  return { ...payload, integrity: { algorithm: 'fnv1a-32-non-cryptographic', checksum: (hash >>> 0).toString(16).padStart(8, '0') } };
}

test('privacy export includes app-owned personal data but excludes copyright and unrelated browser data', () => {
  const storage = new MemoryStorage({
    maseer28_state: JSON.stringify({ answers: { 1: 'private reflection' } }),
    maseer28_user_profile_v1: JSON.stringify({ name: 'نمونه' }),
    maseer28_reader_progress_v66: '{"book-1":4}',
    maseer28_copyright_v60: '1',
    unrelated_site_preference: 'keep',
  });
  const exported = readLocalUserData(storage);
  assert.deepEqual(Object.keys(exported.entries).sort(), [
    'maseer28_reader_progress_v66',
    'maseer28_state',
    'maseer28_user_profile_v1',
  ]);
  assert.equal(exported.entries.maseer28_state.answers[1], 'private reflection');
  assert.equal(exported.entries.maseer28_user_profile_v1.name, 'نمونه');
});

test('privacy deletion removes app-owned personal keys but preserves copyright and unrelated browser data', () => {
  const storage = new MemoryStorage({
    maseer28_state: '{}',
    maseer28_user_profile_v1: '{}',
    maseer28_reader_settings_v64: '{}',
    maseer28_copyright_v60: '1',
    profile_completed: '1',
    unrelated_site_preference: 'keep',
  });
  const result = deleteLocalUserData(storage);
  assert.equal(result.attempted, 4);
  assert.equal(result.removed.length, 4);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.remainingKeys, []);
  assert.equal(storage.getItem('maseer28_copyright_v60'), '1');
  assert.equal(storage.getItem('unrelated_site_preference'), 'keep');
  assert.equal(storage.getItem('maseer28_state'), null);
  assert.equal(storage.getItem('profile_completed'), null);
});

test('privacy helpers fail clearly when browser storage is unavailable', () => {
  assert.throws(() => readLocalUserData(null), /ذخیره‌سازی محلی/);
  assert.throws(() => deleteLocalUserData(null), /ذخیره‌سازی محلی/);
});


test('IndexedDB privacy scope exports user-created records but preserves seeded public library content', () => {
  const selected = selectUserOwnedLibraryData({
    books: [
      { id: 'book-1', legacyId: 1, activeVersionId: 'seed-book-1-hash1', title: 'کتاب عمومی اول' },
      { id: 'book-5', legacyId: 5, activeVersionId: 'seed-book-5-hash5', title: 'کتاب عمومی پنجم' },
      { id: 'book-custom-1', title: 'کتاب کاربر' },
    ],
    versions: [
      { id: 'seed-book-1-hash1', bookId: 'book-1', source: 'seed' },
      { id: 'upload-v1', bookId: 'book-1', source: 'upload' },
      { id: 'custom-v1', bookId: 'book-custom-1', source: 'upload' },
      { id: 'seed-book-5-hash5', bookId: 'book-5', source: 'seed' },
    ],
    settings: [
      { key: 'seed-content-revision-v90', value: '90' },
      { key: 'seed-book-fingerprint:book-1', value: 'hash' },
      { key: 'reader-preference', value: 'large-text' },
    ],
  });
  assert.deepEqual(selected.books.map((x) => x.id), ['book-custom-1']);
  assert.deepEqual(selected.versions.map((x) => x.id), ['upload-v1', 'custom-v1']);
  assert.deepEqual(selected.settings.map((x) => x.key), ['reader-preference']);
});

test('IndexedDB privacy scope does not classify seed versions as user content', () => {
  const selected = selectUserOwnedLibraryData({
    books: [{ id: 'book-1', legacyId: 1, activeVersionId: 'seed-book-1-hash1' }],
    versions: [{ id: 'seed-book-1-hash1', bookId: 'book-1', source: 'seed' }],
    settings: [{ key: 'seed-last-checked-at', value: 'today' }],
  });
  assert.deepEqual(selected, { books: [], versions: [], settings: [] });
});


test('local deletion reports read-back failures instead of throwing outside its error boundary', () => {
  const storage = new MemoryStorage({ maseer28_state: '{}' });
  const originalGetItem = storage.getItem.bind(storage);
  let reads = 0;
  storage.getItem = (key) => {
    reads += 1;
    if (reads >= 1) throw new Error('readback blocked');
    return originalGetItem(key);
  };
  const result = deleteLocalUserData(storage);
  assert.equal(result.attempted, 1);
  assert.deepEqual(result.removed, []);
  assert.equal(result.verificationErrors.length, 1);
  assert.equal(result.verificationErrors[0].key, 'maseer28_state');
});

test('local deletion stops before deleting anything when key enumeration fails', () => {
  const storage = new MemoryStorage({ maseer28_state: '{}' });
  Object.defineProperty(storage, 'length', { get() { throw new Error('storage denied'); } });
  const result = deleteLocalUserData(storage);
  assert.equal(result.attempted, 0);
  assert.equal(result.errors[0].phase, 'enumerate');
  assert.equal(storage.values.has('maseer28_state'), true);
});

test('a custom book with a legacy-looking number is not mistaken for a seeded book', () => {
  const selected = selectUserOwnedLibraryData({
    books: [{ id: 'book-custom-import', legacyId: 1, title: 'کتاب واردشده' }],
    versions: [{ id: 'custom-v1', bookId: 'book-custom-import', source: 'upload' }],
    settings: [],
  });
  assert.deepEqual(selected.books.map((book) => book.id), ['book-custom-import']);
  assert.deepEqual(selected.versions.map((version) => version.id), ['custom-v1']);
});


test('privacy deletion plan snapshots app keys without deleting them', () => {
  const storage = new MemoryStorage({ maseer28_state: '{}', maseer28_copyright_v60: '1', unrelated: 'x' });
  const plan = createLocalUserDataDeletionPlan(storage);
  assert.deepEqual(plan, { keys: ['maseer28_state'], errors: [] });
  assert.equal(storage.getItem('maseer28_state'), '{}');
  const result = deleteLocalUserData(storage, plan);
  assert.deepEqual(result.removed, ['maseer28_state']);
});

test('failed privacy deletion preflight prevents all local deletion', () => {
  const storage = new MemoryStorage({ maseer28_state: '{}' });
  Object.defineProperty(storage, 'length', { get() { throw new Error('storage denied'); } });
  const plan = createLocalUserDataDeletionPlan(storage);
  const result = deleteLocalUserData(storage, plan);
  assert.equal(result.attempted, 0);
  assert.equal(result.errors.length, 1);
  assert.equal(storage.values.has('maseer28_state'), true);
});


test('uncertain seed-like books and orphaned seed versions are preserved from destructive classification', () => {
  const selected = selectUserOwnedLibraryData({
    books: [{ id: 'book-2', legacyId: 2, title: 'رکورد ناقص یا واردشده' }],
    versions: [{ id: 'seed-book-2-oldhash', bookId: 'book-2', source: 'seed' }],
    settings: [],
  });
  assert.deepEqual(selected.books.map((book) => book.id), ['book-2']);
  assert.deepEqual(selected.versions, []);
});


const PRIVACY_TEST_DB = 'maseer28-library';


function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB test request failed'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB test transaction failed'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB test transaction aborted'));
  });
}

async function removePrivacyTestDatabase() {
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(PRIVACY_TEST_DB);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB test database deletion was blocked'));
  });
}

test('IndexedDB export and deletion operate against an IndexedDB API implementation', async () => {
  await removePrivacyTestDatabase();
  const openRequest = indexedDB.open(PRIVACY_TEST_DB, 1);
  openRequest.onupgradeneeded = () => {
    const database = openRequest.result;
    database.createObjectStore('books', { keyPath: 'id' });
    database.createObjectStore('versions', { keyPath: 'id' });
    database.createObjectStore('settings', { keyPath: 'key' });
  };
  const db = await requestResult(openRequest);
  const seedVersionId = 'seed-book-1-0123456789abcdef';
  const writeTx = db.transaction(['books', 'versions', 'settings'], 'readwrite');
  writeTx.objectStore('books').put({ id: 'book-1', legacyId: 1, activeVersionId: seedVersionId, title: 'کتاب عمومی' });
  writeTx.objectStore('books').put({ id: 'book-user-1', title: 'کتاب شخصی' });
  writeTx.objectStore('versions').put({ id: seedVersionId, bookId: 'book-1', source: 'seed' });
  writeTx.objectStore('versions').put({ id: 'upload-book-1', bookId: 'book-1', source: 'upload' });
  writeTx.objectStore('versions').put({ id: 'user-version-1', bookId: 'book-user-1', source: 'upload' });
  writeTx.objectStore('settings').put({ key: 'seed-content-revision-v90', value: '90' });
  writeTx.objectStore('settings').put({ key: 'reader-preference', value: 'large-text' });
  await transactionDone(writeTx);
  db.close();

  try {
    const exported = await readIndexedDbUserData();
    assert.deepEqual(exported.stores.books.map((row) => row.id), ['book-user-1']);
    assert.deepEqual(exported.stores.versions.map((row) => row.id).sort(), ['upload-book-1', 'user-version-1']);
    assert.deepEqual(exported.stores.settings.map((row) => row.key), ['reader-preference']);

    const result = await deleteIndexedDbUserData();
    assert.equal(result.attempted, 4);
    assert.equal(result.removed, 4);
    assert.equal(result.remaining, 0);

    const verifyDb = await requestResult(indexedDB.open(PRIVACY_TEST_DB));
    try {
      const verifyTx = verifyDb.transaction(['books', 'versions', 'settings'], 'readonly');
      const [books, versions, settings] = await Promise.all([
        requestResult(verifyTx.objectStore('books').getAll()),
        requestResult(verifyTx.objectStore('versions').getAll()),
        requestResult(verifyTx.objectStore('settings').getAll()),
      ]);
      assert.deepEqual(books.map((row) => row.id), ['book-1']);
      assert.deepEqual(versions.map((row) => row.id), [seedVersionId]);
      assert.deepEqual(settings.map((row) => row.key), ['seed-content-revision-v90']);
    } finally {
      verifyDb.close();
    }
  } finally {
    await removePrivacyTestDatabase();
  }
});


test('IndexedDB privacy helpers treat a missing database as empty without creating it', async () => {
  await removePrivacyTestDatabase();
  const exported = await readIndexedDbUserData();
  assert.deepEqual(exported.stores, { books: [], versions: [], settings: [] });

  const result = await deleteIndexedDbUserData();
  assert.equal(result.attempted, 0);
  assert.equal(result.removed, 0);
  assert.equal(result.remaining, 0);

  const databases = await indexedDB.databases();
  assert.equal(databases.some((database) => database.name === PRIVACY_TEST_DB), false);
});

test('IndexedDB privacy deletion is a no-op for an existing database with empty stores', async () => {
  await removePrivacyTestDatabase();
  const openRequest = indexedDB.open(PRIVACY_TEST_DB, 1);
  openRequest.onupgradeneeded = () => {
    const database = openRequest.result;
    database.createObjectStore('books', { keyPath: 'id' });
    database.createObjectStore('versions', { keyPath: 'id' });
    database.createObjectStore('settings', { keyPath: 'key' });
  };
  const db = await requestResult(openRequest);
  db.close();

  try {
    const exported = await readIndexedDbUserData();
    assert.deepEqual(exported.stores, { books: [], versions: [], settings: [] });

    const result = await deleteIndexedDbUserData();
    assert.equal(result.attempted, 0);
    assert.equal(result.removed, 0);
    assert.deepEqual(result.counts, { books: 0, versions: 0, settings: 0 });
    assert.equal(result.remaining, 0);
  } finally {
    await removePrivacyTestDatabase();
  }
});


test('local deletion detects app-owned keys created after the deletion snapshot', () => {
  const storage = new MemoryStorage({ maseer28_state: '{}' });
  const originalRemove = storage.removeItem.bind(storage);
  storage.removeItem = (key) => {
    originalRemove(key);
    storage.setItem('maseer28_state_from_another_tab', '{"late":true}');
  };

  const plan = createLocalUserDataDeletionPlan(storage);
  const result = deleteLocalUserData(storage, plan);

  assert.equal(result.removed.length, 1);
  assert.deepEqual(result.remainingKeys, ['maseer28_state_from_another_tab']);
  assert.deepEqual(result.verificationErrors, []);
});


test('local deletion does not verify success when final namespace enumeration fails', () => {
  const storage = new MemoryStorage({ maseer28_state: '{}' });
  let lengthReads = 0;
  Object.defineProperty(storage, 'length', {
    get() {
      lengthReads += 1;
      if (lengthReads > 1) throw new Error('final enumeration blocked');
      return storage.values.size;
    },
  });

  const plan = createLocalUserDataDeletionPlan(storage);
  const result = deleteLocalUserData(storage, plan);

  assert.equal(result.removed.length, 1);
  assert.equal(result.remainingKeys, null);
  assert.equal(result.verificationErrors.length, 1);
  assert.equal(result.verificationErrors[0].phase, 'enumerate_after_delete');
});

test('local deletion returns an empty remaining-key list after complete removal', () => {
  const storage = new MemoryStorage({ maseer28_state: '{}', maseer28_profile: '{}' });
  const result = deleteLocalUserData(storage);
  assert.deepEqual(result.remainingKeys, []);
  assert.deepEqual(result.verificationErrors, []);
  assert.equal(result.removed.length, 2);
});


test('IndexedDB blocked-open fails clearly and closes a connection if it later succeeds', async () => {
  const request = {};
  const indexedDbApi = {
    open(name) {
      assert.equal(name, PRIVACY_TEST_DB);
      return request;
    },
  };

  const pending = readIndexedDbUserData(indexedDbApi);
  request.onblocked();
  await assert.rejects(pending, /مسدود شده است/);

  let closed = false;
  request.result = { close() { closed = true; } };
  request.onsuccess();
  assert.equal(closed, true);
});

test('privacy backup bundle includes both browser stores and validates integrity', async () => {
  const storage = new MemoryStorage({ maseer28_state: JSON.stringify({ answers: { 1: 'پاسخ' } }), maseer28_copyright_v60: '1', unrelated: 'keep' });
  const backup = await createPrivacyBackup({ storage, now: () => new Date('2026-11-03T10:00:00.000Z') });
  assert.equal(validatePrivacyBackup(backup).valid, true);
  assert.equal(backup.localStorage.entries.maseer28_state.answers[1], 'پاسخ');
  assert.deepEqual(backup.indexedDB.stores, { books: [], versions: [], settings: [] });
  assert.equal(backup.localStorage.entries.maseer28_copyright_v60, undefined);
  assert.match(backup.integrity.checksum, /^[a-f0-9]{8}$/);
  assert.match(PRIVACY_BACKUP_POLICY.restore, /conflict-free only/);
});

test('privacy backup validation detects altered content and unsupported schema versions', async () => {
  const backup = await createPrivacyBackup({ storage: new MemoryStorage({ maseer28_state: '{}' }) });
  const corrupted = structuredClone(backup);
  corrupted.localStorage.entries.maseer28_state = 'tampered';
  assert.equal(validatePrivacyBackup(corrupted).valid, false);
  const unsupported = { ...backup, schema_version: '99.0.0' };
  assert.equal(validatePrivacyBackup(unsupported).valid, false);
});

test('privacy backup and controlled restore preserve a quarantined archive payload without rewriting it', async () => {
  const malformedArchive = [
    { pathId: 'recoverable-entry', profileData: { problem: 'خشم' }, answers: { 1: 'پاسخ آرشیوشده' } },
    null,
    'legacy-unparsed-entry',
    ['unexpected-nested-array'],
  ];
  const quarantinedState = { schema: 7, archive: [], archiveRecoveryRequired: malformedArchive };
  const sourceStorage = new MemoryStorage({ maseer28_state: JSON.stringify(quarantinedState) });
  const sourceApi = new IDBFactory();
  const backup = await createPrivacyBackup({ storage: sourceStorage, indexedDBApi: sourceApi });
  assert.equal(validatePrivacyBackup(backup).valid, true);
  assert.deepEqual(backup.localStorage.entries.maseer28_state, quarantinedState,
    'backup must carry the complete quarantine payload without filtering entries');

  const targetStorage = new MemoryStorage({});
  const targetApi = new IDBFactory();
  const preview = await createPrivacyRestorePreview(backup, { storage: targetStorage, indexedDBApi: targetApi });
  assert.equal(preview.valid, true);
  assert.equal(preview.conflicts.total, 0);
  assert.deepEqual([...targetStorage.values.entries()], [], 'preview must remain read-only');

  const restored = await restorePrivacyBackup(backup, { storage: targetStorage, indexedDBApi: targetApi });
  assert.deepEqual({ restored: restored.restored, verified: restored.verified }, { restored: true, verified: true });
  const restoredState = readLocalUserData(targetStorage).entries.maseer28_state;
  assert.deepEqual(restoredState, quarantinedState, 'restore must preserve the exact quarantined state');
  const hydrated = sanitizeJourneyState(restoredState);
  assert.deepEqual(hydrated.archive, []);
  assert.deepEqual(hydrated.archiveRecoveryRequired, malformedArchive,
    'the restored application state must remain quarantined and recoverable');
});

test('restore preview rejects checksummed but malformed library records before mutation', async () => {
  const indexedDBApi = new IDBFactory();
  const base = await createPrivacyBackup({ storage: new MemoryStorage({}), indexedDBApi });
  const malformed = structuredClone(base);
  malformed.indexedDB.stores.books = [{
    id: 'user-book-1',
    title: { injected: 'not a renderable title' },
    activeVersionId: 'missing-version',
  }];
  malformed.indexedDB.stores.versions = [{
    id: 'version-1',
    bookId: 'user-book-1',
    source: 'upload',
    content: { pages: [] },
  }];
  const candidate = resignPrivacyBackup(malformed);
  const storage = new MemoryStorage({});
  const before = [...storage.values.entries()];
  const preview = await createPrivacyRestorePreview(candidate, { storage, indexedDBApi });
  assert.equal(preview.valid, false);
  assert.ok(preview.errors.some((error) => /عنوان متنی معتبر/.test(error)));
  assert.ok(preview.errors.some((error) => /نسخه فعال کتاب/.test(error)));
  assert.ok(preview.errors.some((error) => /ساختار کتاب قابل نمایش/.test(error)));
  assert.deepEqual([...storage.values.entries()], before);
});

test('restore preview validates backup and reports collisions without changing browser storage', async () => {
  const storage = new MemoryStorage({ maseer28_state: JSON.stringify({ current: true }), unrelated_site_preference: 'preserve-me' });
  const backup = await createPrivacyBackup({ storage: new MemoryStorage({ maseer28_state: JSON.stringify({ restored: true }), maseer28_user_profile_v2: JSON.stringify({ name: 'نمونه' }) }) });
  const before = [...storage.values.entries()];
  const preview = await createPrivacyRestorePreview(backup, { storage });
  assert.equal(preview.valid, true);
  assert.equal(preview.counts.localStorage, 2);
  assert.deepEqual(preview.conflicts.localStorage, ['maseer28_state']);
  assert.equal(preview.conflicts.total, 1);
  assert.deepEqual([...storage.values.entries()], before);
  assert.match(preview.note, /هیچ تغییری/);
});

test('restore preview rejects corrupted backup without touching storage', async () => {
  const storage = new MemoryStorage({ maseer28_state: '{}' });
  const backup = await createPrivacyBackup({ storage: new MemoryStorage({ maseer28_state: '{"safe":true}' }) });
  const corrupted = structuredClone(backup);
  corrupted.indexedDB.stores.books.push({ title: 'missing primary key' });
  const before = [...storage.values.entries()];
  const preview = await createPrivacyRestorePreview(corrupted, { storage });
  assert.equal(preview.valid, false);
  assert.ok(preview.errors.length > 0);
  assert.deepEqual([...storage.values.entries()], before);
});


test('restore preview detects collisions with preserved seeded IndexedDB rows and exposes the real schema', async () => {
  await removePrivacyTestDatabase();
  const sourceApi = new IDBFactory();
  const sourceOpen = sourceApi.open(PRIVACY_TEST_DB, 1);
  sourceOpen.onupgradeneeded = () => {
    sourceOpen.result.createObjectStore('books', { keyPath: 'id' });
    const versions = sourceOpen.result.createObjectStore('versions', { keyPath: 'id' });
    versions.createIndex('bookId', 'bookId', { unique: false });
    sourceOpen.result.createObjectStore('settings', { keyPath: 'key' });
  };
  const sourceDb = await requestResult(sourceOpen);
  const sourceTx = sourceDb.transaction(['books', 'versions', 'settings'], 'readwrite');
  sourceTx.objectStore('books').put({ id: 'book-1', title: 'Imported collision', activeVersionId: 'upload-version-1' });
  sourceTx.objectStore('versions').put({ id: 'upload-version-1', bookId: 'book-1', source: 'upload', content: { title: 'Imported collision', pages: [{ page: 1, text: 'صفحه آزمایشی' }] } });
  await transactionDone(sourceTx);
  sourceDb.close();
  const backup = await createPrivacyBackup({ storage: new MemoryStorage({ maseer28_state: '{}' }), indexedDBApi: sourceApi });

  const currentOpen = indexedDB.open(PRIVACY_TEST_DB, 1);
  currentOpen.onupgradeneeded = () => {
    currentOpen.result.createObjectStore('books', { keyPath: 'id' });
    const versions = currentOpen.result.createObjectStore('versions', { keyPath: 'id' });
    versions.createIndex('bookId', 'bookId', { unique: false });
    currentOpen.result.createObjectStore('settings', { keyPath: 'key' });
  };
  const currentDb = await requestResult(currentOpen);
  const currentTx = currentDb.transaction(['books', 'versions', 'settings'], 'readwrite');
  currentTx.objectStore('books').put({ id: 'book-1', legacyId: 1, activeVersionId: 'seed-book-1-fingerprint', title: 'Public seed' });
  currentTx.objectStore('versions').put({ id: 'seed-book-1-fingerprint', bookId: 'book-1', source: 'seed' });
  await transactionDone(currentTx);
  currentDb.close();

  try {
    const snapshot = await readIndexedDbSnapshot();
    assert.equal(snapshot.schema.books.keyPath, 'id');
    assert.equal(snapshot.schema.settings.keyPath, 'key');
    assert.deepEqual(snapshot.schema.versions.indexes, ['bookId']);
    assert.equal(snapshot.stores.books.length, 1);
    const preview = await createPrivacyRestorePreview(backup, { storage: new MemoryStorage({}), indexedDBApi: indexedDB });
    assert.equal(preview.valid, true);
    assert.deepEqual(preview.conflicts.indexedDB.books, ['book-1']);
    assert.equal(preview.conflicts.total, 1);
  } finally {
    await removePrivacyTestDatabase();
  }
});

test('IndexedDB snapshot exposes actual store key paths and indexes', async () => {
  await removePrivacyTestDatabase();
  const openRequest = indexedDB.open(PRIVACY_TEST_DB, 1);
  openRequest.onupgradeneeded = () => {
    openRequest.result.createObjectStore('books', { keyPath: 'wrongKey' });
    openRequest.result.createObjectStore('versions', { keyPath: 'id' });
    openRequest.result.createObjectStore('settings', { keyPath: 'key' });
  };
  const db = await requestResult(openRequest);
  db.close();
  try {
    const snapshot = await readIndexedDbSnapshot();
    assert.equal(snapshot.schema.books.keyPath, 'wrongKey');
  } finally { await removePrivacyTestDatabase(); }
});


test('restore preview rejects IndexedDB stores with an unexpected autoIncrement key generator', async () => {
  await removePrivacyTestDatabase();
  const openRequest = indexedDB.open(PRIVACY_TEST_DB, 1);
  openRequest.onupgradeneeded = () => {
    openRequest.result.createObjectStore('books', { keyPath: 'id', autoIncrement: true });
    const versions = openRequest.result.createObjectStore('versions', { keyPath: 'id' });
    versions.createIndex('bookId', 'bookId', { unique: false });
    openRequest.result.createObjectStore('settings', { keyPath: 'key' });
  };
  const db = await requestResult(openRequest);
  db.close();
  const backup = await createPrivacyBackup({ storage: new MemoryStorage({ maseer28_state: '{}' }) });
  try {
    const preview = await createPrivacyRestorePreview(backup, { storage: new MemoryStorage({}), indexedDBApi: indexedDB });
    assert.equal(preview.valid, false);
    assert.match(preview.errors[0], /ساختار مخزن books/);
  } finally { await removePrivacyTestDatabase(); }
});

test('restore preview rejects an index with the expected name but an incompatible keyPath', async () => {
  await removePrivacyTestDatabase();
  const openRequest = indexedDB.open(PRIVACY_TEST_DB, 1);
  openRequest.onupgradeneeded = () => {
    openRequest.result.createObjectStore('books', { keyPath: 'id' });
    const versions = openRequest.result.createObjectStore('versions', { keyPath: 'id' });
    versions.createIndex('bookId', 'wrongBookId', { unique: false });
    openRequest.result.createObjectStore('settings', { keyPath: 'key' });
  };
  const db = await requestResult(openRequest);
  db.close();
  const backup = await createPrivacyBackup({ storage: new MemoryStorage({ maseer28_state: '{}' }) });
  try {
    const preview = await createPrivacyRestorePreview(backup, { storage: new MemoryStorage({}), indexedDBApi: indexedDB });
    assert.equal(preview.valid, false);
    assert.match(preview.errors[0], /ساختار مخزن versions/);
  } finally { await removePrivacyTestDatabase(); }
});


test('controlled restore imports into an empty browser namespace and verifies both stores', async () => {
  const api = new IDBFactory();
  const storage = new MemoryStorage({});
  const sourceApi = new IDBFactory();
  const sourceOpen = sourceApi.open(PRIVACY_TEST_DB, 1);
  sourceOpen.onupgradeneeded = () => {
    sourceOpen.result.createObjectStore('books', { keyPath: 'id' });
    const versions = sourceOpen.result.createObjectStore('versions', { keyPath: 'id' });
    versions.createIndex('bookId', 'bookId', { unique: false });
    sourceOpen.result.createObjectStore('settings', { keyPath: 'key' });
  };
  const sourceDb = await requestResult(sourceOpen);
  const sourceTx = sourceDb.transaction(['books', 'versions', 'settings'], 'readwrite');
  sourceTx.objectStore('books').put({ id: 'user-book-1', title: 'کتاب شخصی', activeVersionId: 'user-version-1' });
  sourceTx.objectStore('versions').put({ id: 'user-version-1', bookId: 'user-book-1', source: 'upload', content: { title: 'کتاب شخصی', pages: [{ page: 1, text: 'متن آزمایشی کتاب' }] } });
  sourceTx.objectStore('settings').put({ key: 'reader-preference', value: 'large' });
  await transactionDone(sourceTx);
  sourceDb.close();
  const backup = await createPrivacyBackup({
    storage: new MemoryStorage({ maseer28_state: JSON.stringify({ restored: true }) }),
    indexedDBApi: sourceApi,
  });
  try {
    const result = await restorePrivacyBackup(backup, { storage, indexedDBApi: api });
    assert.equal(result.restored, true);
    assert.equal(result.verified, true);
    assert.deepEqual(readLocalUserData(storage).entries.maseer28_state, { restored: true });
    const verifyDb = await requestResult(api.open(PRIVACY_TEST_DB));
    try {
      const tx = verifyDb.transaction(['books', 'versions', 'settings'], 'readonly');
      const [books, versions, settings] = await Promise.all([
        requestResult(tx.objectStore('books').getAll()),
        requestResult(tx.objectStore('versions').getAll()),
        requestResult(tx.objectStore('settings').getAll()),
      ]);
      assert.deepEqual(books.map((row) => row.id), ['user-book-1']);
      assert.deepEqual(versions.map((row) => row.id), ['user-version-1']);
      assert.deepEqual(settings.map((row) => row.key), ['reader-preference']);
    } finally { verifyDb.close(); }
  } finally {
    await new Promise((resolve, reject) => {
      const request = api.deleteDatabase(PRIVACY_TEST_DB);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  }
});

test('controlled restore refuses existing localStorage conflicts without writing IndexedDB', async () => {
  const api = new IDBFactory();
  const storage = new MemoryStorage({ maseer28_state: 'existing' });
  const backup = await createPrivacyBackup({ storage: new MemoryStorage({ maseer28_state: 'incoming' }), indexedDBApi: new IDBFactory() });
  const result = await restorePrivacyBackup(backup, { storage, indexedDBApi: api });
  assert.equal(result.restored, false);
  assert.equal(result.phase, 'conflict');
  assert.equal(storage.getItem('maseer28_state'), 'existing');
  assert.equal((await api.databases()).some((entry) => entry.name === PRIVACY_TEST_DB), false);
});

test('controlled restore compensates IndexedDB when localStorage writing fails', async () => {
  const api = new IDBFactory();
  const storage = new MemoryStorage({});
  storage.setItem = () => { throw new Error('quota exceeded'); };
  const backup = await createPrivacyBackup({
    storage: new MemoryStorage({ maseer28_state: JSON.stringify({ incoming: true }) }),
    indexedDBApi: new IDBFactory(),
  });
  try {
    const result = await restorePrivacyBackup(backup, { storage, indexedDBApi: api });
    assert.equal(result.restored, false);
    assert.equal(result.phase, 'localStorage');
    assert.equal(result.rolledBack, true);
    const db = await requestResult(api.open(PRIVACY_TEST_DB));
    try {
      const tx = db.transaction(['books', 'versions', 'settings'], 'readonly');
      const [books, versions, settings] = await Promise.all([
        requestResult(tx.objectStore('books').getAll()),
        requestResult(tx.objectStore('versions').getAll()),
        requestResult(tx.objectStore('settings').getAll()),
      ]);
      assert.deepEqual(books, []);
      assert.deepEqual(versions, []);
      assert.deepEqual(settings, []);
    } finally { db.close(); }
  } finally {
    await new Promise((resolve, reject) => {
      const request = api.deleteDatabase(PRIVACY_TEST_DB);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  }
});


test('controlled restore detects a localStorage write that mutates storage before throwing and verifies rollback', async () => {
  const api = new IDBFactory();
  const storage = new MemoryStorage({});
  let firstWrite = true;
  storage.setItem = (key, value) => {
    MemoryStorage.prototype.setItem.call(storage, key, value);
    if (firstWrite) {
      firstWrite = false;
      throw new Error('write completed but adapter reported failure');
    }
  };
  const backup = await createPrivacyBackup({
    storage: new MemoryStorage({ maseer28_state: JSON.stringify({ incoming: true }) }),
    indexedDBApi: new IDBFactory(),
  });
  try {
    const result = await restorePrivacyBackup(backup, { storage, indexedDBApi: api });
    assert.equal(result.restored, false);
    assert.equal(result.phase, 'localStorage');
    assert.equal(result.rolledBack, true);
    assert.equal(storage.getItem('maseer28_state'), null);
    const db = await requestResult(api.open(PRIVACY_TEST_DB));
    try {
      const tx = db.transaction(['books', 'versions', 'settings'], 'readonly');
      const [books, versions, settings] = await Promise.all([
        requestResult(tx.objectStore('books').getAll()),
        requestResult(tx.objectStore('versions').getAll()),
        requestResult(tx.objectStore('settings').getAll()),
      ]);
      assert.deepEqual(books, []);
      assert.deepEqual(versions, []);
      assert.deepEqual(settings, []);
    } finally { db.close(); }
  } finally {
    await new Promise((resolve, reject) => {
      const request = api.deleteDatabase(PRIVACY_TEST_DB);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  }
});

test('controlled restore reports recovery_required when localStorage compensation cannot be verified', async () => {
  const api = new IDBFactory();
  const storage = new MemoryStorage({});
  storage.setItem = (key, value) => {
    MemoryStorage.prototype.setItem.call(storage, key, value);
    throw new Error('write reported failure');
  };
  storage.removeItem = () => { throw new Error('remove blocked'); };
  const backup = await createPrivacyBackup({
    storage: new MemoryStorage({ maseer28_state: JSON.stringify({ incoming: true }) }),
    indexedDBApi: new IDBFactory(),
  });
  try {
    const result = await restorePrivacyBackup(backup, { storage, indexedDBApi: api });
    assert.equal(result.restored, false);
    assert.equal(result.phase, 'recovery_required');
    assert.equal(result.rolledBack, false);
    assert.notEqual(storage.getItem('maseer28_state'), null);
  } finally {
    const request = api.deleteDatabase(PRIVACY_TEST_DB);
    await new Promise((resolve, reject) => {
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  }
});


test('controlled restore verifies committed IndexedDB in a fresh read and compensates on verification failure', async () => {
  const baseApi = new IDBFactory();
  const sourceApi = new IDBFactory();
  const sourceOpen = sourceApi.open(PRIVACY_TEST_DB, 1);
  sourceOpen.onupgradeneeded = () => {
    sourceOpen.result.createObjectStore('books', { keyPath: 'id' });
    const versions = sourceOpen.result.createObjectStore('versions', { keyPath: 'id' });
    versions.createIndex('bookId', 'bookId', { unique: false });
    sourceOpen.result.createObjectStore('settings', { keyPath: 'key' });
  };
  const sourceDb = await requestResult(sourceOpen);
  const sourceTx = sourceDb.transaction(['books', 'versions', 'settings'], 'readwrite');
  sourceTx.objectStore('books').put({ id: 'post-commit-book', title: 'restore check', activeVersionId: 'post-commit-version' });
  sourceTx.objectStore('versions').put({ id: 'post-commit-version', bookId: 'post-commit-book', source: 'upload', content: { title: 'restore check', pages: [{ page: 1, text: 'verification fixture' }] } });
  await transactionDone(sourceTx);
  sourceDb.close();
  const backup = await createPrivacyBackup({
    storage: new MemoryStorage({ maseer28_state: JSON.stringify({ restored: true }) }),
    indexedDBApi: sourceApi,
  });
  let opens = 0;
  const failingReadbackApi = {
    open(name) {
      opens += 1;
      if (opens !== 3) return baseApi.open(name);
      const request = {};
      queueMicrotask(() => {
        request.error = new Error('simulated post-commit readback failure');
        request.onerror?.();
      });
      return request;
    },
  };
  const storage = new MemoryStorage({});
  try {
    const result = await restorePrivacyBackup(backup, { storage, indexedDBApi: failingReadbackApi });
    assert.equal(result.restored, false);
    assert.equal(result.phase, 'verification');
    assert.equal(result.rolledBack, true);
    assert.equal(storage.getItem('maseer28_state'), null);
    const db = await requestResult(baseApi.open(PRIVACY_TEST_DB));
    try {
      const tx = db.transaction(['books', 'versions', 'settings'], 'readonly');
      assert.deepEqual(await requestResult(tx.objectStore('books').getAll()), []);
    } finally { db.close(); }
  } finally {
    await new Promise((resolve, reject) => {
      const request = baseApi.deleteDatabase(PRIVACY_TEST_DB);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  }
});

async function createDeletionFixture(api) {
  const request = api.open('maseer28-library', 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    db.createObjectStore('books', { keyPath: 'id' });
    const versions = db.createObjectStore('versions', { keyPath: 'id' });
    versions.createIndex('bookId', 'bookId', { unique: false });
    db.createObjectStore('settings', { keyPath: 'key' });
  };
  const db = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const tx = db.transaction(['books', 'versions', 'settings'], 'readwrite');
  tx.objectStore('books').put({ id: 'book-user-1', title: 'کتاب شخصی' });
  tx.objectStore('versions').put({ id: 'version-user-1', bookId: 'book-user-1', source: 'upload' });
  tx.objectStore('books').put({ id: 'book-1', legacyId: 1, activeVersionId: 'seed-book-1-v1' });
  tx.objectStore('versions').put({ id: 'seed-book-1-v1', bookId: 'book-1', source: 'seed' });
  tx.objectStore('settings').put({ key: 'reader-preference', value: 'large' });
  tx.objectStore('settings').put({ key: 'seed-content-revision-v90', value: '90' });
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}

test('coordinated local deletion verifies both stores and preserves public seed and unrelated data', async () => {
  const api = new IDBFactory();
  await createDeletionFixture(api);
  const storage = new MemoryStorage({
    maseer28_state: '{"private":true}',
    maseer28_user_profile_v2: '{"name":"نمونه"}',
    maseer28_copyright_v60: '1',
    unrelated: 'keep',
  });
  try {
    const result = await executeCompleteLocalDataDeletion({ storage, indexedDBApi: api });
    assert.equal(result.deleted, true);
    assert.equal(result.status, 'complete');
    assert.equal(result.stores.localStorage.verified, true);
    assert.equal(result.stores.indexedDB.verified, true);
    assert.equal(storage.getItem('maseer28_state'), null);
    assert.equal(storage.getItem('maseer28_user_profile_v2'), null);
    assert.equal(storage.getItem('maseer28_copyright_v60'), '1');
    assert.equal(storage.getItem('unrelated'), 'keep');
    const db = await new Promise((resolve, reject) => {
      const request = api.open('maseer28-library');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const tx = db.transaction(['books', 'versions', 'settings'], 'readonly');
      const [books, versions, settings] = await Promise.all([
        new Promise((resolve, reject) => { const r=tx.objectStore('books').getAll(); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); }),
        new Promise((resolve, reject) => { const r=tx.objectStore('versions').getAll(); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); }),
        new Promise((resolve, reject) => { const r=tx.objectStore('settings').getAll(); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); }),
      ]);
      assert.deepEqual(books.map((row) => row.id), ['book-1']);
      assert.deepEqual(versions.map((row) => row.id), ['seed-book-1-v1']);
      assert.deepEqual(settings.map((row) => row.key), ['seed-content-revision-v90']);
    } finally { db.close(); }
  } finally {
    await new Promise((resolve, reject) => {
      const request = api.deleteDatabase('maseer28-library');
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  }
});

test('coordinated deletion reports partial_delete when localStorage retains a key but IndexedDB deletion verifies', async () => {
  const api = new IDBFactory();
  await createDeletionFixture(api);
  const storage = new MemoryStorage({ maseer28_state: '{}', maseer28_profile: '{}' });
  const originalRemove = storage.removeItem.bind(storage);
  storage.removeItem = (key) => {
    if (key === 'maseer28_profile') throw new Error('simulated remove denial');
    originalRemove(key);
  };
  try {
    const result = await executeCompleteLocalDataDeletion({ storage, indexedDBApi: api });
    assert.equal(result.deleted, false);
    assert.equal(result.status, 'partial_delete');
    assert.equal(result.stores.localStorage.verified, false);
    assert.deepEqual(result.stores.localStorage.remaining, 1);
    assert.equal(result.stores.indexedDB.verified, true);
    assert.equal(storage.getItem('maseer28_state'), null);
    assert.equal(storage.getItem('maseer28_profile'), '{}');
  } finally {
    await new Promise((resolve, reject) => {
      const request = api.deleteDatabase('maseer28-library');
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  }
});

test('coordinated deletion aborts before mutation when IndexedDB preflight fails', async () => {
  const storage = new MemoryStorage({ maseer28_state: '{}' });
  const api = { open() { throw new Error('IndexedDB unavailable'); } };
  const result = await executeCompleteLocalDataDeletion({ storage, indexedDBApi: api });
  assert.equal(result.deleted, false);
  assert.equal(result.status, 'preflight_failed');
  assert.equal(storage.getItem('maseer28_state'), '{}');
});

test('coordinated deletion reports recovery_required when IndexedDB fails after localStorage was cleared', async () => {
  const storage = new MemoryStorage({ maseer28_state: '{}' });
  const api = new IDBFactory();
  let opens = 0;
  const failingAfterPreflight = {
    open(name) {
      opens += 1;
      if (opens === 1) return api.open(name);
      const request = {};
      queueMicrotask(() => {
        request.error = new Error('simulated IndexedDB delete-stage open failure');
        request.onerror?.();
      });
      return request;
    },
  };
  const result = await executeCompleteLocalDataDeletion({ storage, indexedDBApi: failingAfterPreflight });
  assert.equal(result.deleted, false);
  assert.equal(result.status, 'recovery_required');
  assert.equal(result.stores.localStorage.verified, true);
  assert.equal(result.stores.indexedDB.verified, false);
  assert.equal(storage.getItem('maseer28_state'), null);
});
