import test from 'node:test';
import assert from 'node:assert/strict';
import { readLocalUserData } from '../src/features/privacy/localData.js';

class MemoryStorage {
  constructor(entries = {}) { this.values = new Map(Object.entries(entries)); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
}

test('privacy export marks incomplete data when reading an owned key fails', () => {
  const storage = new MemoryStorage({ maseer28_state: '{"ok":true}' });
  storage.getItem = () => { throw new Error('read blocked'); };
  const result = readLocalUserData(storage);
  assert.equal(result.complete, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].phase, 'read');
  assert.deepEqual(result.entries, {});
});

test('privacy export marks incomplete data when storage enumeration fails', () => {
  const storage = new MemoryStorage({ maseer28_state: '{}' });
  Object.defineProperty(storage, 'length', { get() { throw new Error('storage denied'); } });
  const result = readLocalUserData(storage);
  assert.equal(result.complete, false);
  assert.equal(result.errors[0].phase, 'enumerate');
  assert.deepEqual(result.entries, {});
});

test('privacy export marks complete when all owned local keys are readable', () => {
  const result = readLocalUserData(new MemoryStorage({
    maseer28_state: '{"answers":{"1":"ok"}}',
    maseer28_copyright_v60: '1',
    unrelated: 'keep',
  }));
  assert.equal(result.complete, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(Object.keys(result.entries), ['maseer28_state']);
});
