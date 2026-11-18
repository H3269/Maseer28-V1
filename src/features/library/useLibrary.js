import { useCallback, useEffect, useRef, useState } from 'react';
import { libraryRepository } from './libraryRepository.js';
import { createVersionRecord, hasReadableBookContent, normalizeBookContent } from './bookUtils.js';

const SEED_REVISION_KEY = 'seed-content-revision-v89';
const SEED_BOOK_FINGERPRINT_PREFIX = 'seed-book-fingerprint:';
const BASE = import.meta.env.BASE_URL;

// Keep hydrated seed books warm for this app session. The key includes revision
// and active-version metadata so imported/replaced books cannot reuse stale data.
const SEED_BOOK_CONTENT_CACHE = new Map();
const SEED_BOOK_CONTENT_IN_FLIGHT = new Map();
const SEED_BOOK_CONTENT_CACHE_LIMIT = 2;

function isUsableSeedVersion(version) {
  return Boolean(version?.content && hasReadableBookContent(version.content));
}

function seedBookCacheKey(book) {
  return [
    book?.id || '',
    book?.manifestRevision || '',
    book?.seedRevision || '',
    book?.activeVersionId || '',
    book?.updatedAt || '',
  ].join('|');
}

function withCacheBust(path, token) {
  const separator = path.includes('?') ? '&' : '?';
  return `${BASE}${path}${separator}v=${encodeURIComponent(token)}`;
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function fetchJson(path, cacheToken, cache = 'default') {
  const response = await fetch(withCacheBust(path, cacheToken), cache === 'no-store'
    ? { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }
    : { cache });
  if (!response.ok) throw new Error(`خطا در بارگذاری ${path}`);
  return response.json();
}

async function seedLibrary(onCatalogReady = null) {
  // Keep the library catalogue lightweight. Full book JSON is downloaded only
  // when the reader or a book recommendation actually needs that book.
  const manifest = await fetchJson('content/library.seed.json', 'manifest-check-v90', 'no-cache');
  const revision = String(manifest.revision || 'legacy');
  const now = new Date().toISOString();
  const [storedRevision, existingBooks] = await Promise.all([
    libraryRepository.getSetting(SEED_REVISION_KEY),
    libraryRepository.listBooks(),
  ]);
  const existingById = new Map(existingBooks.map((book) => [book.id, book]));
  const catalogueBooks = (manifest.books || []).map((meta) => {
    const bookId = meta.id || `book-${meta.legacyId}`;
    const existingBook = existingById.get(bookId);
    return {
      id: bookId,
      legacyId: meta.legacyId,
      title: existingBook?.title || meta.title,
      subtitle: existingBook?.subtitle || meta.subtitle || '',
      author: existingBook?.author || meta.author || '',
      description: existingBook?.description || meta.description || '',
      coverUrl: `${BASE}${meta.cover}`,
      libraryCoverUrl: meta.libraryCover ? `${BASE}${meta.libraryCover}` : '',
      coverDataUrl: existingBook?.coverDataUrl || '',
      activeVersionId: existingBook?.activeVersionId || null,
      seedFile: meta.file,
      manifestRevision: revision,
      seedRevision: existingBook?.seedRevision || null,
      order: meta.order ?? meta.legacyId ?? 999,
      createdAt: existingBook?.createdAt || now,
      updatedAt: existingBook?.updatedAt || now,
    };
  });

  // Publish lightweight catalogue metadata to the UI before IndexedDB writes
  // finish, so all five eager cover requests can start immediately on first entry.
  onCatalogReady?.(catalogueBooks);
  const manifestReady = catalogueBooks.every((book) => {
    const existing = existingById.get(book.id);
    return Boolean(existing?.seedFile === book.seedFile && existing?.manifestRevision === revision);
  });
  if (storedRevision === revision && manifestReady) return existingBooks;

  await Promise.all(catalogueBooks.map((book) => libraryRepository.putBook(book)));
  await libraryRepository.setSetting(SEED_REVISION_KEY, revision);
  await libraryRepository.setSetting('seed-last-checked-at', now);
  return libraryRepository.listBooks();
}

export function ensureSeedBookContent(book) {
  if (!book?.id) return Promise.reject(new Error('مشخصات کتاب معتبر نیست.'));
  const cacheKey = seedBookCacheKey(book);
  if (SEED_BOOK_CONTENT_CACHE.has(cacheKey)) {
    const cached = SEED_BOOK_CONTENT_CACHE.get(cacheKey);
    if (isUsableSeedVersion(cached?.version)) {
      SEED_BOOK_CONTENT_CACHE.delete(cacheKey);
      SEED_BOOK_CONTENT_CACHE.set(cacheKey, cached);
      return Promise.resolve(cached);
    }
    // A stale or partially-written in-memory record must never block recovery
    // from the canonical seed JSON.
    SEED_BOOK_CONTENT_CACHE.delete(cacheKey);
  }
  if (SEED_BOOK_CONTENT_IN_FLIGHT.has(cacheKey)) return SEED_BOOK_CONTENT_IN_FLIGHT.get(cacheKey);

  const task = (async () => {
  const currentBook = await libraryRepository.getBook(book.id) || book;
  let existingVersion = null;
  if (currentBook.activeVersionId) {
    existingVersion = await libraryRepository.getVersion(currentBook.activeVersionId);
    const currentRevision = currentBook.manifestRevision || currentBook.seedRevision || 'legacy';
    if (isUsableSeedVersion(existingVersion) && currentBook.seedRevision === currentRevision) {
      return { book: currentBook, version: existingVersion };
    }
    if (isUsableSeedVersion(existingVersion) && !currentBook.seedFile) {
      return { book: currentBook, version: existingVersion };
    }
  }
  if (!currentBook.seedFile) throw new Error('فایل محتوای این کتاب در فهرست کتابخانه ثبت نشده است.');

  const revision = String(currentBook.manifestRevision || currentBook.seedRevision || 'legacy');
  const rawContent = await fetchJson(currentBook.seedFile, revision);
  const rawFingerprint = await sha256(JSON.stringify(rawContent));
  const fingerprintKey = `${SEED_BOOK_FINGERPRINT_PREFIX}${currentBook.id}`;
  const previousFingerprint = await libraryRepository.getSetting(fingerprintKey);
  let activeVersionId = currentBook.activeVersionId;

  if (previousFingerprint !== rawFingerprint || !activeVersionId || !isUsableSeedVersion(existingVersion)) {
    const content = normalizeBookContent(rawContent, currentBook.title);
    if (!hasReadableBookContent(content)) throw new Error('فایل کتاب دریافت شد، اما متن قابل‌خواندن کافی در آن وجود ندارد.');
    const versionId = `seed-${currentBook.id}-${rawFingerprint.slice(0, 16)}`;
    const version = createVersionRecord({
      bookId: currentBook.id,
      versionLabel: content.version || '1.0',
      filename: currentBook.seedFile.split('/').pop(),
      mimeType: 'application/json',
      content,
      source: 'seed',
    });
    version.id = versionId;
    await libraryRepository.putVersion(version);
    activeVersionId = versionId;
    await libraryRepository.setSetting(fingerprintKey, rawFingerprint);
  }

  const updatedBook = {
    ...currentBook,
    activeVersionId,
    seedRevision: revision,
    updatedAt: previousFingerprint !== rawFingerprint ? new Date().toISOString() : currentBook.updatedAt,
  };
  await libraryRepository.putBook(updatedBook);
  const version = await libraryRepository.getVersion(activeVersionId);
  if (!isUsableSeedVersion(version)) throw new Error('متن کتاب پس از ذخیره‌سازی کامل و قابل‌خواندن تأیید نشد.');
  return { book: updatedBook, version };
  })();

  SEED_BOOK_CONTENT_IN_FLIGHT.set(cacheKey, task);
  return task.then((result) => {
    SEED_BOOK_CONTENT_CACHE.delete(cacheKey);
    SEED_BOOK_CONTENT_CACHE.set(cacheKey, result);
    while (SEED_BOOK_CONTENT_CACHE.size > SEED_BOOK_CONTENT_CACHE_LIMIT) {
      SEED_BOOK_CONTENT_CACHE.delete(SEED_BOOK_CONTENT_CACHE.keys().next().value);
    }
    return result;
  }).finally(() => {
    if (SEED_BOOK_CONTENT_IN_FLIGHT.get(cacheKey) === task) {
      SEED_BOOK_CONTENT_IN_FLIGHT.delete(cacheKey);
    }
  });
}

export async function updatePublishedLibrary() {
  return seedLibrary();
}

export function useLibrary(enabled = true) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refreshInFlight = useRef(null);
  const hasLoadedOnce = useRef(false);

  const refresh = useCallback(() => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const task = (async () => {
      let cachedBooks = [];
      try {
        // Paint the already-saved five-book catalogue before checking the
        // network manifest. Returning users should not wait for a no-store fetch.
        cachedBooks = await libraryRepository.listBooks().catch(() => []);
        if (cachedBooks.length) {
          setBooks(cachedBooks);
          setLoading(false);
        } else {
          setLoading(true);
        }

        const seededBooks = await seedLibrary((catalogueBooks) => {
          if (catalogueBooks.length) setBooks(catalogueBooks);
        });
        const nextBooks = seededBooks.length ? seededBooks : cachedBooks;
        setBooks(nextBooks);
        setError('');
        hasLoadedOnce.current = true;
        return nextBooks;
      } catch (err) {
        console.error(err);
        if (cachedBooks.length) {
          setBooks(cachedBooks);
          setError('نسخه ذخیره‌شده کتابخانه نمایش داده می‌شود؛ به‌روزرسانی آنلاین در دسترس نبود.');
          hasLoadedOnce.current = true;
          return cachedBooks;
        }
        setError(err?.message || 'خطا در بارگذاری کتابخانه');
        return [];
      } finally {
        setLoading(false);
        refreshInFlight.current = null;
      }
    })();
    refreshInFlight.current = task;
    return task;
  }, []);

  useEffect(() => {
    if (enabled && !hasLoadedOnce.current) refresh();
  }, [enabled, refresh]);

  return { books, loading, error, refresh };
}
