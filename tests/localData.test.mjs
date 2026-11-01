import test from 'node:test';
import assert from 'node:assert/strict';

import { deleteLocalUserData, readLocalUserData } from '../src/features/privacy/localData.js';

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
