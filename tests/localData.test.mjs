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

test('privacy export reports inaccessible keys instead of silently claiming completeness',()=>{
 const storage=new MemoryStorage({maseer28_state:'{}'});
 storage.getItem=(key)=>{ if(key==='maseer28_state') throw new Error('blocked'); return null; };
 const exported=readLocalUserData(storage);
 assert.equal(exported.complete,false);
 assert.equal(exported.errors.length,1);
 assert.equal(exported.errors[0].key,'maseer28_state');
});

test('privacy deletion reports removal and verification failures without throwing',()=>{
 const storage=new MemoryStorage({maseer28_state:'{}',maseer28_profile:'{}'});
 const originalRemove=storage.removeItem.bind(storage);
 storage.removeItem=(key)=>{ if(key==='maseer28_state') throw new Error('blocked'); originalRemove(key); };
 const originalGet=storage.getItem.bind(storage);
 storage.getItem=(key)=>{ if(key==='maseer28_profile') throw new Error('verification blocked'); return originalGet(key); };
 const result=deleteLocalUserData(storage);
 assert.equal(result.attempted,2);
 assert.equal(result.removed.length,0);
 assert.equal(result.errors.length,2);
 assert.ok(result.errors.some(item=>item.key==='maseer28_state'&&item.stage==='remove'));
 assert.ok(result.errors.some(item=>item.key==='maseer28_profile'&&item.stage==='verify'));
});
