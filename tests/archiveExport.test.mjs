import test from 'node:test';
import assert from 'node:assert/strict';
import { copyTextToClipboard } from '../src/shared/utils.js';
import { exportArchivesZip, triggerBlobDownload } from '../src/features/journey/archiveExport.js';

test('clipboard helper confirms modern API success and falls back after rejection', async () => {
  let written = '';
  assert.equal(await copyTextToClipboard('09123456789', {
    isSecureContext: true,
    navigator: { clipboard: { writeText: async (value) => { written = value; } } },
  }), true);
  assert.equal(written, '09123456789');

  let selected = false;
  let removed = false;
  const environment = {
    isSecureContext: true,
    navigator: { clipboard: { writeText: async () => { throw new Error('denied'); } } },
    document: {
      body: { appendChild() {} },
      createElement: () => ({
        style: {},
        setAttribute() {},
        select() { selected = true; },
        remove() { removed = true; },
      }),
      execCommand: (command) => command === 'copy',
    },
  };
  assert.equal(await copyTextToClipboard('09123456789', environment), true);
  assert.equal(selected, true);
  assert.equal(removed, true);
});

test('clipboard helper rejects false, thrown and unavailable legacy operations', async () => {
  const makeEnvironment = (execCommand) => ({
    isSecureContext: false,
    document: {
      body: { appendChild() {} },
      createElement: () => ({ style: {}, select() {}, remove() {} }),
      execCommand,
    },
  });
  assert.equal(await copyTextToClipboard('text', makeEnvironment(() => false)), false);
  assert.equal(await copyTextToClipboard('text', makeEnvironment(() => { throw new Error('blocked'); })), false);
  assert.equal(await copyTextToClipboard('text', {}), false);
  assert.equal(await copyTextToClipboard('', makeEnvironment(() => true)), false);
});

test('archive export creates a local ZIP containing PDF reports without a server', async () => {
  const context = {
    fillRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    measureText: (value) => ({ width: String(value).length * 10 }),
  };
  const environment = {
    createElement: (tag) => tag === 'canvas' ? {
      width: 0, height: 0,
      getContext: () => context,
      toDataURL: () => 'data:image/jpeg;base64,/9j/2Q==',
    } : null,
  };
  const originalDocument = globalThis.document;
  globalThis.document = environment;
  try {
    const blob = await exportArchivesZip([{
      profileData: { problem: 'آزمون' },
      completed: [1],
      answers: { 1: 'پاسخ آزمایشی' },
      daily: { 1: { score: 4, feedbackText: 'بازخورد' } },
      startedAt: '2026-01-01T00:00:00.000Z',
      archivedAt: '2026-01-28T00:00:00.000Z',
    }]);
    assert.equal(blob.type, 'application/zip');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
    const contents = new TextDecoder().decode(bytes);
    assert.match(contents, /01-آزمون\.pdf/);
    assert.match(contents, /%PDF-1\.4/);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test('Blob download helper dispatches a download and schedules URL cleanup', () => {
  const calls = { clicked: false, removed: false, revoked: [], scheduled: false };
  const environment = {
    document: {
      body: { appendChild() {} },
      createElement: () => ({
        style: {},
        click() { calls.clicked = true; },
        remove() { calls.removed = true; },
      }),
    },
    URL: {
      createObjectURL: () => 'blob:test-file',
      revokeObjectURL: (url) => calls.revoked.push(url),
    },
    setTimeout: (callback, delay) => { calls.scheduled = delay === 30_000; callback(); },
  };
  assert.equal(triggerBlobDownload(new Blob(['file']), 'test.zip', environment), true);
  assert.equal(calls.clicked, true);
  assert.equal(calls.removed, true);
  assert.equal(calls.scheduled, true);
  assert.deepEqual(calls.revoked, ['blob:test-file']);
});

test('Blob download helper fails closed when the host cannot create a download URL', () => {
  assert.throws(() => triggerBlobDownload(new Blob(['file']), 'test.zip', {}), /تحویل فایل/);
  assert.throws(() => triggerBlobDownload(new Blob([]), 'empty.zip', {}), /خالی/);
});
