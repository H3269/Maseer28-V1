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


function readU16(bytes, offset) { return bytes[offset] | (bytes[offset + 1] << 8); }
function readU32(bytes, offset) { return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0; }
function testCrc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
  }
  return (crc ^ -1) >>> 0;
}
function extractStoredZipEntries(bytes) {
  const eocd = bytes.length - 22;
  assert.equal(readU32(bytes, eocd), 0x06054b50, 'ZIP end-of-central-directory signature');
  const count = readU16(bytes, eocd + 10);
  const centralSize = readU32(bytes, eocd + 12);
  const centralOffset = readU32(bytes, eocd + 16);
  assert.equal(centralOffset + centralSize, eocd, 'central directory bounds');
  const entries = [];
  let cursor = centralOffset;
  for (let i = 0; i < count; i += 1) {
    assert.equal(readU32(bytes, cursor), 0x02014b50, 'central directory signature');
    const crc = readU32(bytes, cursor + 16);
    const size = readU32(bytes, cursor + 24);
    const nameLength = readU16(bytes, cursor + 28);
    const extraLength = readU16(bytes, cursor + 30);
    const commentLength = readU16(bytes, cursor + 32);
    const localOffset = readU32(bytes, cursor + 42);
    const name = new TextDecoder().decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    assert.equal(readU32(bytes, localOffset), 0x04034b50, 'local file header signature');
    const localNameLength = readU16(bytes, localOffset + 26);
    const localExtraLength = readU16(bytes, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.slice(dataStart, dataStart + size);
    assert.equal(data.length, size);
    assert.equal(testCrc32(data), crc, 'entry CRC-32');
    entries.push({ name, data });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  assert.equal(cursor, centralOffset + centralSize);
  return entries;
}
function makeCanvasEnvironment() {
  const context = {
    fillRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    measureText: (value) => ({ width: String(value).length * 10 }),
  };
  return {
    createElement: (tag) => tag === 'canvas' ? {
      width: 0, height: 0,
      getContext: () => context,
      toDataURL: () => 'data:image/jpeg;base64,/9j/2Q==',
    } : null,
  };
}

test('archive export produces a structurally valid local ZIP with readable PDF structure', async () => {
  const originalDocument = globalThis.document;
  globalThis.document = makeCanvasEnvironment();
  try {
    const longAnswer = 'پاسخ آزمایشی برای آزمون صفحه‌بندی. '.repeat(150);
    const blob = await exportArchivesZip([
      {
        profileData: { problem: 'آزمون اول' },
        completed: [1],
        answers: { 1: longAnswer },
        daily: { 1: { score: 4, feedbackText: 'بازخورد' } },
        startedAt: '2026-01-01T00:00:00.000Z',
        archivedAt: '2026-01-28T00:00:00.000Z',
      },
      {
        profileData: { problem: 'آزمون دوم' },
        completed: [1, 2],
        answers: { 1: 'پاسخ یک', 2: 'پاسخ دو' },
        daily: {},
      },
    ]);
    assert.equal(blob.type, 'application/zip');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const entries = extractStoredZipEntries(bytes);
    assert.equal(entries.length, 2);
    assert.deepEqual(entries.map((entry) => entry.name), ['01-آزمون-اول.pdf', '02-آزمون-دوم.pdf']);

    const firstPdf = new TextDecoder().decode(entries[0].data);
    const secondPdf = new TextDecoder().decode(entries[1].data);
    assert.match(firstPdf, /^%PDF-1\.4/);
    assert.match(firstPdf, /%%EOF$/);
    assert.match(firstPdf, /\/Count [2-9][0-9]*/);
    assert.match(firstPdf, /startxref\n\d+\n%%EOF$/);
    assert.match(secondPdf, /%PDF-1\.4/);
    assert.match(secondPdf, /آزمون دوم/);
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
