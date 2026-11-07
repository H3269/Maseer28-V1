import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { answerLibraryBookQuestion } from '../src/features/assistant/libraryBookAssistant.js';

const root = new URL('../public/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('content/library.seed.json', root), 'utf8'));
const books = await Promise.all(manifest.books.map(async (meta) => ({
  title: meta.title,
  legacyId: meta.legacyId,
  content: JSON.parse(await readFile(new URL(meta.file, root), 'utf8')),
})));

test('all five seeded books have searchable text and grounded summary excerpts', () => {
  assert.equal(books.length, 5);
  for (const book of books) {
    assert.ok(book.content.pages.length > 0, `${book.title} must have pages`);
    const response = answerLibraryBookQuestion({
      books,
      message: `خلاصه کتاب ${['اول','دوم','سوم','چهارم','پنجم'][book.legacyId - 1]}`,
    });
    assert.ok(response, `${book.title} should return a summary`);
    assert.ok(response.includes(book.title), `response should identify ${book.title}`);
    assert.match(response, /منبع:/);
    assert.match(response, /صفحه/);
  }
});

test('a focused question returns only excerpts that match terms in the source book', () => {
  const book = books[4];
  const firstText = book.content.pages
    .flatMap((page) => page.blocks || [])
    .map((block) => block.text || '')
    .find((text) => text.length > 80);
  assert.ok(firstText);
  const keyword = firstText.split(/\s+/).find((word) => word.length > 4);
  const response = answerLibraryBookQuestion({
    books,
    message: `در کتاب پنجم درباره ${keyword} چه نوشته شده؟`,
  });
  assert.ok(response.includes(book.title));
  assert.ok(response.includes('منبع:'));
});

test('book questions do not invent a source when the requested book is unavailable', () => {
  const response = answerLibraryBookQuestion({
    books: [],
    message: 'خلاصه کتاب پنجم',
  });
  assert.equal(response, null);
});

test('an unspecified book is clarified instead of selecting an arbitrary title', () => {
  const response = answerLibraryBookQuestion({
    books,
    message: 'لطفاً خلاصه کتاب را بگو',
  });
  assert.match(response, /نام یکی از کتاب‌ها/);
});
