const DB_NAME = 'maseer28-library';
const DB_VERSION = 1;
const BOOKS = 'books';
const VERSIONS = 'versions';
const SETTINGS = 'settings';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BOOKS)) db.createObjectStore(BOOKS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(VERSIONS)) {
        const store = db.createObjectStore(VERSIONS, { keyPath: 'id' });
        store.createIndex('bookId', 'bookId', { unique: false });
      }
      if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(name, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode);
    const store = tx.objectStore(name);
    let result;
    let requestError;
    try {
      const value = fn(store, tx);
      if (value instanceof IDBRequest) {
        value.onsuccess = () => { result = value.result; };
        value.onerror = () => { requestError = value.error; };
      } else if (value && typeof value.then === 'function') {
        value.then((x) => { result = x; }).catch((e) => { requestError = e; tx.abort(); });
      } else {
        result = value;
      }
    } catch (error) {
      db.close();
      reject(error);
      return;
    }
    tx.oncomplete = () => { db.close(); requestError ? reject(requestError) : resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error || requestError); };
    tx.onabort = () => { db.close(); reject(tx.error || requestError || new Error('IndexedDB transaction aborted')); };
  });
}


export const libraryRepository = {
  async listBooks() {
    const db = await openDb();
    try {
      const tx = db.transaction(BOOKS, 'readonly');
      const rows = await requestToPromise(tx.objectStore(BOOKS).getAll());
      return rows.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.title.localeCompare(b.title, 'fa'));
    } finally { db.close(); }
  },

  async getBook(id) {
    return withStore(BOOKS, 'readonly', (s) => s.get(id));
  },

  async putBook(book) {
    return withStore(BOOKS, 'readwrite', (s) => s.put(book));
  },

  async deleteBook(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([BOOKS, VERSIONS], 'readwrite');
      tx.objectStore(BOOKS).delete(id);
      const index = tx.objectStore(VERSIONS).index('bookId');
      const range = IDBKeyRange.only(id);
      const cursor = index.openCursor(range);
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (c) { c.delete(); c.continue(); }
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  },

  async listVersions(bookId) {
    const db = await openDb();
    try {
      const tx = db.transaction(VERSIONS, 'readonly');
      const index = tx.objectStore(VERSIONS).index('bookId');
      const rows = await requestToPromise(index.getAll(IDBKeyRange.only(bookId)));
      return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } finally { db.close(); }
  },

  async getVersion(id) {
    return withStore(VERSIONS, 'readonly', (s) => s.get(id));
  },

  async putVersion(version) {
    return withStore(VERSIONS, 'readwrite', (s) => s.put(version));
  },

  async deleteVersion(id) {
    return withStore(VERSIONS, 'readwrite', (s) => s.delete(id));
  },

  async getSetting(key) {
    const row = await withStore(SETTINGS, 'readonly', (s) => s.get(key));
    return row?.value;
  },

  async setSetting(key, value) {
    return withStore(SETTINGS, 'readwrite', (s) => s.put({ key, value }));
  },
};
