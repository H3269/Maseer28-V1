import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildNeighbourTextIndex } from '../src/features/library/readerEngine.js';
import { readFile as readSource } from 'node:fs/promises';

const engineSource = await readSource(new URL('../src/features/library/readerEngine.js', import.meta.url), 'utf8');
assert.match(engineSource, /const \{ blockTexts, nextTexts, previousTexts \} = buildNeighbourTextIndex\(blocks\)/);

const bookFiles = [1, 2, 3, 4, 5].map((id) => new URL(`../public/content/books/book${id}.json`, import.meta.url));

test('optimized reader neighbours exactly match the former scans across all five canonical books', async () => {
  let pagesChecked = 0;
  let blocksChecked = 0;
  for (let bookIndex = 0; bookIndex < bookFiles.length; bookIndex += 1) {
    const book = JSON.parse(await readFile(bookFiles[bookIndex], 'utf8'));
    assert.ok(Array.isArray(book.pages) && book.pages.length > 0, `book ${bookIndex + 1} must contain source pages`);
    for (const [pageIndex, page] of book.pages.entries()) {
      const blocks = Array.isArray(page.blocks)
        ? page.blocks
        : String(page.text || '').replace(/\r/g, '').split(/\n\s*\n/).filter(Boolean).map((text) => ({ type: 'paragraph', text }));
      const { blockTexts, nextTexts, previousTexts } = buildNeighbourTextIndex(blocks);
      assert.equal(blockTexts.length, blocks.length);
      assert.equal(nextTexts.length, blocks.length);
      assert.equal(previousTexts.length, blocks.length);
      for (let index = 0; index < blocks.length; index += 1) {
        const expectedNext = blockTexts.slice(index + 1).find(Boolean) || '';
        const expectedPrevious = blockTexts.slice(0, index).reverse().find(Boolean) || '';
        assert.equal(nextTexts[index], expectedNext, `book ${bookIndex + 1}, page ${pageIndex + 1}, block ${index + 1}: next neighbour changed`);
        assert.equal(previousTexts[index], expectedPrevious, `book ${bookIndex + 1}, page ${pageIndex + 1}, block ${index + 1}: previous neighbour changed`);
      }
      pagesChecked += 1;
      blocksChecked += blocks.length;
    }
  }
  assert.ok(pagesChecked > 0 && blocksChecked > 0, 'all five canonical books must be inspected');
});
