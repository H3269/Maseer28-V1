import { useCallback, useEffect, useState } from 'react';
import { libraryRepository } from './libraryRepository.js';
import { createVersionRecord, normalizeBookContent } from './bookUtils.js';

// Published content is revalidated on every library load.  The fingerprint of
// each book is stored separately, so changing a book JSON is enough to publish
// a new active version even if the manifest revision was not bumped.
const SEED_REVISION_KEY = 'seed-content-revision-v88';
const SEED_BOOK_FINGERPRINT_PREFIX = 'seed-book-fingerprint:';
const BASE = import.meta.env.BASE_URL;

function withCacheBust(path, token) {
  const separator = path.includes('?') ? '&' : '?';
  return `${BASE}${path}${separator}v=${encodeURIComponent(token)}`;
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function fetchJson(path, cacheToken) {
  const response = await fetch(withCacheBust(path, cacheToken), {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!response.ok) throw new Error(`خطا در بارگذاری ${path}`);
  return response.json();
}

async function seedLibrary() {
  const manifest = await fetchJson('content/library.seed.json', Date.now());
  const revision = String(manifest.revision || 'legacy');
  const previousRevision = await libraryRepository.getSetting(SEED_REVISION_KEY);
  const now = new Date().toISOString();

  for (const meta of manifest.books || []) {
    const bookId = meta.id || `book-${meta.legacyId}`;
    const rawContent = await fetchJson(meta.file, `${revision}-${Date.now()}`);
    const rawFingerprint = await sha256(JSON.stringify(rawContent));
    const fingerprintKey = `${SEED_BOOK_FINGERPRINT_PREFIX}${bookId}`;
    const previousFingerprint = await libraryRepository.getSetting(fingerprintKey);
    const existingBook = await libraryRepository.getBook(bookId);
    let activeVersionId = existingBook?.activeVersionId;

    if (previousFingerprint !== rawFingerprint || !activeVersionId) {
      const content = normalizeBookContent(rawContent, meta.title);
      const safeFingerprint = rawFingerprint.slice(0, 16);
      const versionId = `seed-${bookId}-${safeFingerprint}`;
      const version = createVersionRecord({
        bookId,
        versionLabel: content.version || meta.versionLabel || '1.0',
        filename: meta.file.split('/').pop(),
        mimeType: 'application/json',
        content,
        source: 'seed',
      });
      version.id = versionId;
      await libraryRepository.putVersion(version);
      activeVersionId = versionId;
      await libraryRepository.setSetting(fingerprintKey, rawFingerprint);
    }

    await libraryRepository.putBook({
      id: bookId,
      legacyId: meta.legacyId,
      title: existingBook?.title || meta.title,
      subtitle: existingBook?.subtitle || meta.subtitle || '',
      author: existingBook?.author || meta.author || '',
      description: existingBook?.description || meta.description || rawContent.subtitle || '',
      coverUrl: `${BASE}${meta.cover}`,
      coverDataUrl: existingBook?.coverDataUrl || '',
      activeVersionId,
      order: meta.order ?? meta.legacyId ?? 999,
      createdAt: existingBook?.createdAt || now,
      updatedAt: previousFingerprint !== rawFingerprint ? now : (existingBook?.updatedAt || now),
    });
  }

  await libraryRepository.setSetting(SEED_REVISION_KEY, revision);
  await libraryRepository.setSetting('seed-last-checked-at', now);
}

export async function updatePublishedLibrary() {
  return seedLibrary();
}

export function useLibrary() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      await seedLibrary();
      setBooks(await libraryRepository.listBooks());
      setError('');
    } catch (err) {
      console.error(err);
      const cachedBooks = await libraryRepository.listBooks().catch(() => []);
      if (cachedBooks.length) {
        setBooks(cachedBooks);
        setError('نسخه ذخیره‌شده کتابخانه نمایش داده می‌شود؛ به‌روزرسانی آنلاین در دسترس نبود.');
      } else {
        setError(err?.message || 'خطا در بارگذاری کتابخانه');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { books, loading, error, refresh };
}
