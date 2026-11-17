import assert from 'node:assert/strict';
import test from 'node:test';
import { hasReadableBookContent, normalizeBookContent } from '../src/features/library/bookUtils.js';

test('rejects missing, empty, and structurally empty book content', () => {
  assert.equal(hasReadableBookContent(null), false);
  assert.equal(hasReadableBookContent({ pages: [] }), false);
  assert.equal(hasReadableBookContent({ pages: [{ text: '   ' }] }), false);
  assert.equal(hasReadableBookContent({ pages: [{ blocks: [{ text: '' }, { rows: [['', '   ']] }] }] }), false);
});

test('accepts readable text stored in legacy page text fields', () => {
  const content = normalizeBookContent({
    title: 'کتاب آزمایشی',
    pages: [{ page: 1, text: 'این یک بند واقعی و قابل خواندن برای آزمون محتوای کتاب است.' }],
  });
  assert.equal(hasReadableBookContent(content), true);
});

test('accepts readable text stored in structured blocks and table rows', () => {
  assert.equal(hasReadableBookContent({
    pages: [{ blocks: [{ type: 'paragraph', text: 'این متن در یک بلوک ساختاریافته قرار دارد و برای مطالعه کافی است.' }] }],
  }), true);
  assert.equal(hasReadableBookContent({
    pages: [{ blocks: [{ type: 'table', rows: [['عنوان', 'توضیح'], ['محتوای واقعی', 'متن جدول قابل خواندن است']] }] }],
  }), true);
});

test('rejects a cached book that has pages but no meaningful readable text', () => {
  const staleVersion = { content: { pages: [{ page: 1, text: '' }, { page: 2, blocks: [] }] } };
  assert.equal(hasReadableBookContent(staleVersion.content), false);
});
