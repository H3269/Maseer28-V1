import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('soft motion stays isolated from protected app surfaces', async () => {
  const css = await readFile(new URL('../src/styles/soft-motion.css', import.meta.url), 'utf8');
  const entry = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');

  assert.match(entry, /import ['"]\.\/styles\/soft-motion\.css['"]/);
  assert.match(css, /body:not\(\.reader-mode\)/);
  assert.match(css, /\.app:not\(\.appLoading\)/);
  assert.match(css, /:not\(\.header\)/);
  assert.match(css, /:not\(\.appBottomDock\)/);
  assert.match(css, /:not\(\.globalAssistantLauncher\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /200ms/);
  assert.match(css, /\.assistantTranscript\s*>\s*\.userMessage/);
  assert.match(css, /\.assistantTranscript\s*>\s*\.assistantMessage/);

  // New motion must not replace transforms used by floating controls or existing UI.
  assert.doesNotMatch(css, /(?:^|[;{}])\s*transform\s*:/m);
});
