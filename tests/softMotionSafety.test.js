import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const motion = readFileSync(new URL('../src/styles/soft-motion.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const entry = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

test('soft motion is loaded as an additive stylesheet and screen identity is explicit', () => {
  assert.match(entry, /styles\/soft-motion\.css/);
  assert.match(app, /className="app" data-screen=\{screen\}/);
});

test('screen motion preserves direct-child layout and excludes the library screen', () => {
  assert.match(motion, /\.app:not\(\.appLoading\):not\(\[data-screen="books"\]\) > section\.card/);
  assert.doesNotMatch(motion, /\.appScreenTransition/);
});

test('motion does not override floating header or draggable assistant launcher transforms', () => {
  assert.doesNotMatch(motion, /\.header\b|\.globalAssistantLauncher\b/);
  assert.doesNotMatch(motion, /will-change|backdrop-filter|filter:/);
});

test('reduced-motion preference disables all newly-added animations', () => {
  assert.match(motion, /prefers-reduced-motion: reduce/);
  assert.match(motion, /animation: none !important/);
});

test('reader-specific surfaces are not targeted by the motion layer', () => {
  assert.doesNotMatch(motion, /bookReader|bookReaderFull|\.reader/);
});
