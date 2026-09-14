import { useCallback, useEffect, useState } from 'react';
import { libraryRepository } from './libraryRepository.js';
import { createVersionRecord, normalizeBookContent } from './bookUtils.js';

const SEED_REVISION_KEY = 'seed-content-revision';
const BASE = import.meta.env.BASE_URL;

async function seedLibrary() {
  const manifestResponse = await fetch(`${BASE}content/library.seed.json`);
  if (!manifestResponse.ok) throw new Error('فایل تنظیمات اولیه کتابخانه پیدا نشد.');
  const manifest = await manifestResponse.json();
  const revision = String(manifest.revision || 'legacy');
  const seededRevision = await libraryRepository.getSetting(SEED_REVISION_KEY);
  if (seededRevision === revision) return;

  for (const meta of manifest.books || []) {
    const response = await fetch(`${BASE}${meta.file}`);
    if (!response.ok) throw new Error(`خطا در بارگذاری ${meta.title}`);
    const content = normalizeBookContent(await response.json(), meta.title);
    const bookId = meta.id || `book-${meta.legacyId}`;
    const version = createVersionRecord({
      bookId,
      versionLabel: content.version || meta.versionLabel || '1.0',
      filename: meta.file.split('/').pop(),
      mimeType: 'application/json',
      content,
      source: 'seed',
    });
    version.id = `seed-${bookId}-${String(content.version || 'v1').replace(/[^a-zA-Z0-9.-]+/g, '-')}`;
    await libraryRepository.putVersion(version);
    await libraryRepository.putBook({
      id: bookId,
      legacyId: meta.legacyId,
      title: content.title || meta.title,
      subtitle: content.subtitle || meta.subtitle || '',
      author: content.author || meta.author || '',
      description: meta.description || content.subtitle || '',
      coverUrl: `${BASE}${meta.cover}`,
      coverDataUrl: '',
      activeVersionId: version.id,
      order: meta.order ?? meta.legacyId ?? 999,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  await libraryRepository.setSetting(SEED_REVISION_KEY, revision);
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
      setError(err?.message || 'خطا در بارگذاری کتابخانه');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { books, loading, error, refresh };
}
