import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

function offlineAssetManifest() {
  return {
    name: 'path28-offline-asset-manifest',
    generateBundle(_options, bundle) {
      const root = process.cwd();
      const seed = JSON.parse(fs.readFileSync(path.join(root, 'public/content/library.seed.json'), 'utf8'));
      const index = JSON.parse(fs.readFileSync(path.join(root, 'public/content/runtime-v1/index.json'), 'utf8'));
      const files = new Set();
      // Include every eager and lazy production chunk, stylesheet, font and
      // imported asset, not merely the resources linked from index.html.
      for (const [fileName, item] of Object.entries(bundle)) {
        if (item && (item.type === 'chunk' || item.type === 'asset')) files.add(fileName);
      }
      files.add('content/runtime-v1/index.json');
      files.add('content/library.seed.json');
      for (const topic of index.topics || []) {
        if (topic.basePath) files.add('content/runtime-v1/' + topic.basePath);
        if (topic.overridePath) files.add('content/runtime-v1/' + topic.overridePath);
      }
      for (const book of seed.books || []) {
        if (book.file) files.add(book.file);
        if (book.cover) files.add(book.cover);
        if (book.libraryCover) files.add(book.libraryCover);
      }
      this.emitFile({
        type: 'asset',
        fileName: 'offline-assets.json',
        source: JSON.stringify({ schema: 1, version: 'path28-offline-assets-v1', files: [...files].sort() }),
      });
    },
  };
}

export default defineConfig({
  base: '/Maseer28-V1/',
  plugins: [react(), offlineAssetManifest()],
  build: { target: 'es2020', sourcemap: false },
});
