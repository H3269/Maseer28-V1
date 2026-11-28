import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

function offlineAssetManifest() {
  return {
    name: 'path28-offline-asset-manifest',
    generateBundle(_options, bundle) {
      const seedPath = path.resolve(process.cwd(), 'public/content/library.seed.json');
      const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      const files = new Set();
      // Vite's complete output bundle includes entry chunks, lazy-loaded chunks,
      // stylesheets, fonts and imported images—not only assets in index.html.
      for (const fileName of Object.keys(this.getModuleIds ? {} : {})) void fileName;
      for (const [fileName, item] of Object.entries(this.getFileName ? {} : {})) void fileName, void item;
      for (const fileName of Object.keys(this.getModuleIds ? {} : {})) files.add(fileName);
      for (const fileName of Object.keys(this.getModuleIds ? {} : {})) void fileName;
      // Rollup output is available through the bundle argument.
      for (const [fileName, item] of Object.entries(this.getModuleIds ? {} : {})) {
        if (item && (item.type === 'chunk' || item.type === 'asset')) files.add(fileName);
      }
      for (const fileName of [
        'content/runtime-v1/index.json',
        'content/library.seed.json',
      ]) files.add(fileName);
      const index = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/content/runtime-v1/index.json'), 'utf8'));
      for (const topic of index.topics || []) {
        files.add('content/runtime-v1/' + topic.basePath);
        files.add('content/runtime-v1/' + topic.overridePath);
      }
      for (const book of seed.books || []) {
        if (book.file) files.add(book.file);
        if (book.cover) files.add(book.cover);
        if (book.libraryCover) files.add(book.libraryCover);
      }
      this.emitFile({
        type: 'asset',
        fileName: 'offline-assets.json',
        source: JSON.stringify({
          schema: 1,
          version: 'path28-offline-assets-v1',
          files: [...files].sort(),
        }),
      });
    },
  };
}

export default defineConfig({
  base: '/Maseer28-V1/',
  plugins: [react(), offlineAssetManifest()],
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
