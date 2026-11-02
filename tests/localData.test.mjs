import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

import { createLocalUserDataDeletionPlan, deleteLocalUserData, readLocalUserData } from '../src/features/privacy/localData.js';
import { deleteIndexedDbUserData, readIndexedDbUserData, selectUserOwnedLibraryData } from '../src/features/privacy/indexedDbData.js';

class MemoryStorage {
  constructor(entries = {}) { this.values = new Map(Object.entries(entries)); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
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
  const originalKey = storage.key.bind(storage);
  let enumerations = 0;
  storage.key = (index) => {
    enumerations += 1;
    if (enumerations > 1) throw new Error('final enumeration blocked');
    return originalKey(index);
  };

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
