const DB_NAME = 'maseer28-library';
const STORE_NAMES = ['books', 'versions', 'settings'];

function isSeedBook(book, versions) {
  const legacyId = Number(book?.legacyId);
  if (!Number.isInteger(legacyId) || legacyId < 1 || legacyId > 5) return false;
  if (book?.id !== `book-${legacyId}`) return false;
  const activeVersionId = String(book?.activeVersionId || '');
  if (!activeVersionId.startsWith(`seed-book-${legacyId}-`)) return false;
  return versions.some((version) =>
    version?.id === activeVersionId
    && version?.bookId === book.id
    && version?.source === 'seed'
  );
}

function isSeedSetting(row) {
  return String(row?.key || '').startsWith('seed-')
    || String(row?.key || '').startsWith('seed-book-fingerprint:');
}

export function selectUserOwnedLibraryData({ books = [], versions = [], settings = [] } = {}) {
  const seedBooks = books.filter((book) => isSeedBook(book, versions));
  const seedBookIds = new Set(seedBooks.map((book) => book.id));
  const userBooks = books.filter((book) => !seedBookIds.has(book.id));
  // Unknown/orphaned records are preserved rather than destructively guessed.
  const userVersions = versions.filter((version) => version?.source !== 'seed');
  const userSettings = settings.filter((setting) => !isSeedSetting(setting));
  return { books: userBooks, versions: userVersions, settings: userSettings };
}

function openExistingDatabase(indexedDBApi) {
  return new Promise((resolve, reject) => {
    let createdDuringRead = false;
    let settled = false;
    const request = indexedDBApi.open(DB_NAME);
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    request.onupgradeneeded = (event) => {
      if (event.oldVersion === 0) {
        createdDuringRead = true;
        request.transaction.abort();
      }
    };
    request.onblocked = () => {
      fail(new Error('بازکردن پایگاه داده کتابخانه مسدود شده است؛ تب‌ها یا پنجره‌های دیگر را ببندید و دوباره تلاش کنید.'));
    };
    request.onsuccess = () => {
      // A blocked request can later succeed after another tab closes its connection.
      // If the caller has already received the blocked error, close this late connection.
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      if (createdDuringRead) {
        request.result.close();
        resolve(null);
      } else resolve(request.result);
    };
    request.onerror = () => {
      if (settled) return;
      if (createdDuringRead || request.error?.name === 'AbortError') {
        settled = true;
        resolve(null);
      } else fail(request.error || new Error('بازکردن پایگاه داده کتابخانه ناموفق بود.'));
    };
  });
}

function readStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error('خواندن اطلاعات کتابخانه ناموفق بود.'));
  });
}

export async function readIndexedDbSnapshot(indexedDBApi = globalThis.indexedDB) {
  if (!indexedDBApi) throw new Error('IndexedDB در این مرورگر در دسترس نیست.');
  const db = await openExistingDatabase(indexedDBApi);
  if (!db) return { database: DB_NAME, version: null, schema: null, stores: { books: [], versions: [], settings: [] } };
  try {
    const schema = {};
    for (const name of STORE_NAMES) {
      if (!db.objectStoreNames.contains(name)) throw new Error(`مخزن ${name} در پایگاه داده وجود ندارد.`);
      const tx = db.transaction(name, 'readonly');
      const store = tx.objectStore(name);
      const indexes = Array.from(store.indexNames).sort();
      schema[name] = {
        keyPath: store.keyPath,
        autoIncrement: store.autoIncrement,
        indexes,
        indexDetails: Object.fromEntries(indexes.map((indexName) => {
          const index = store.index(indexName);
          return [indexName, {
            keyPath: index.keyPath,
            unique: index.unique,
            multiEntry: index.multiEntry,
          }];
        })),
      };
    }
    const tx = db.transaction(STORE_NAMES, 'readonly');
    const [books, versions, settings] = await Promise.all([
      readStore(tx.objectStore('books')),
      readStore(tx.objectStore('versions')),
      readStore(tx.objectStore('settings')),
    ]);
    return { database: DB_NAME, version: db.version, schema, stores: { books, versions, settings } };
  } finally { db.close(); }
}

export async function readIndexedDbUserData(indexedDBApi = globalThis.indexedDB) {
  if (!indexedDBApi) throw new Error('IndexedDB در این مرورگر در دسترس نیست؛ کامل بودن خروجی قابل تأیید نیست.');
  const db = await openExistingDatabase(indexedDBApi);
  if (!db) return { database: DB_NAME, stores: { books: [], versions: [], settings: [] } };
  try {
    const tx = db.transaction(STORE_NAMES, 'readonly');
    const [books, versions, settings] = await Promise.all([
      readStore(tx.objectStore('books')),
      readStore(tx.objectStore('versions')),
      readStore(tx.objectStore('settings')),
    ]);
    const selected = selectUserOwnedLibraryData({ books, versions, settings });
    return { database: DB_NAME, stores: selected };
  } finally {
    db.close();
  }
}

function deleteStoreKeys(store, rows, keyField) {
  for (const row of rows) {
    const key = row?.[keyField];
    if (key !== undefined && key !== null) store.delete(key);
  }
}

export async function deleteIndexedDbUserData(indexedDBApi = globalThis.indexedDB) {
  if (!indexedDBApi) throw new Error('IndexedDB در این مرورگر در دسترس نیست؛ پاک‌سازی کامل قابل تأیید نیست.');
  const db = await openExistingDatabase(indexedDBApi);
  if (!db) return { database: DB_NAME, attempted: 0, removed: 0, remaining: 0 };
  try {
    const readTx = db.transaction(STORE_NAMES, 'readonly');
    const [books, versions, settings] = await Promise.all([
      readStore(readTx.objectStore('books')),
      readStore(readTx.objectStore('versions')),
      readStore(readTx.objectStore('settings')),
    ]);
    const selected = selectUserOwnedLibraryData({ books, versions, settings });
    const counts = {
      books: selected.books.length,
      versions: selected.versions.length,
      settings: selected.settings.length,
    };
    const attempted = counts.books + counts.versions + counts.settings;
    if (!attempted) return { database: DB_NAME, attempted: 0, removed: 0, counts, remaining: 0 };

    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAMES, 'readwrite');
      deleteStoreKeys(tx.objectStore('books'), selected.books, 'id');
      deleteStoreKeys(tx.objectStore('versions'), selected.versions, 'id');
      deleteStoreKeys(tx.objectStore('settings'), selected.settings, 'key');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('حذف اطلاعات کتابخانه ناموفق بود.'));
      tx.onabort = () => reject(tx.error || new Error('تراکنش حذف اطلاعات کتابخانه لغو شد.'));
    });

    const verifyTx = db.transaction(STORE_NAMES, 'readonly');
    const [remainingBooks, remainingVersions, remainingSettings] = await Promise.all([
      readStore(verifyTx.objectStore('books')),
      readStore(verifyTx.objectStore('versions')),
      readStore(verifyTx.objectStore('settings')),
    ]);
    const remaining = selectUserOwnedLibraryData({
      books: remainingBooks,
      versions: remainingVersions,
      settings: remainingSettings,
    });
    const removed = attempted - remaining.books.length - remaining.versions.length - remaining.settings.length;
    return { database: DB_NAME, attempted, removed, counts, remaining: remaining.books.length + remaining.versions.length + remaining.settings.length };
  } finally {
    db.close();
  }
}

export const INDEXED_DB_USER_DATA_POLICY = Object.freeze({
  database: DB_NAME,
  exported: 'User-created books, non-seed book versions, and non-seed settings.',
  preserved: 'Verified seeded public books, all seed-source versions (including orphaned/uncertain records), and seed revision/fingerprint settings.',
  note: 'This covers this browser IndexedDB database only; it does not remove downloaded files, browser/device backups, or server-side records.',
});
