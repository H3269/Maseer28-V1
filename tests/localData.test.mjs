import test from 'node:test';
import assert from 'node:assert/strict';

import { deleteLocalUserData, readLocalUserData } from '../src/features/privacy/localData.js';
import { selectUserOwnedLibraryData } from '../src/features/privacy/indexedDbData.js';

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
      { id: 'book-1', legacyId: 1, title: 'کتاب عمومی اول' },
      { id: 'book-5', legacyId: 5, title: 'کتاب عمومی پنجم' },
      { id: 'book-custom-1', title: 'کتاب کاربر' },
    ],
    versions: [
      { id: 'seed-v1', bookId: 'book-1', source: 'seed' },
      { id: 'upload-v1', bookId: 'book-1', source: 'upload' },
      { id: 'custom-v1', bookId: 'book-custom-1', source: 'seed' },
      { id: 'seed-v5', bookId: 'book-5', source: 'seed' },
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
    books: [{ id: 'book-1', legacyId: 1 }],
    versions: [{ id: 'seed-v1', bookId: 'book-1', source: 'seed' }],
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
    if (reads > 1) throw new Error('readback blocked');
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
    versions: [{ id: 'custom-v1', bookId: 'book-custom-import', source: 'seed' }],
    settings: [],
  });
  assert.deepEqual(selected.books.map((book) => book.id), ['book-custom-import']);
  assert.deepEqual(selected.versions.map((version) => version.id), ['custom-v1']);
});
