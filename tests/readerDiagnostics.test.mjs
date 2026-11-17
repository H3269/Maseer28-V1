import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isReaderDiagnosticsEnabled,
  recordReaderDiagnostic,
  startReaderDiagnostics,
} from '../src/features/library/readerDiagnostics.js';

test('Reader diagnostics are opt-in and exclude unapproved content fields', () => {
  const previousWindow = globalThis.window;
  const previousLocation = globalThis.location;
  globalThis.window = {
    location: { search: '' },
    addEventListener() {},
  };
  try {
    assert.equal(isReaderDiagnosticsEnabled(), false);
    assert.equal(startReaderDiagnostics({ legacyId: 3, id: 'book-3' }), false);
    assert.equal(window.__M28_READER_DIAGNOSTICS__, undefined);

    window.location.search = '?readerDiagnostics=1';
    assert.equal(isReaderDiagnosticsEnabled(), true);
    assert.equal(startReaderDiagnostics({ legacyId: 3, id: 'book-3' }), true);

    recordReaderDiagnostic('privacy-check', {
      layoutPageCount: 12,
      articleTextLength: 999,
      pageText: 'متن خصوصی نباید ثبت شود',
      userName: 'نام آزمایشی',
      errorName: 'TypeError',
    });

    const report = window.__M28_READER_DIAGNOSTICS__;
    assert.equal(report.book.legacyId, 3);
    assert.equal(report.book.id, undefined);
    const event = report.events.find((item) => item.stage === 'privacy-check');
    assert.deepEqual(event.details, {
      layoutPageCount: 12,
      errorName: 'TypeError',
    });
    const serialized = JSON.stringify(report);
    assert.equal(serialized.includes('متن خصوصی'), false);
    assert.equal(serialized.includes('نام آزمایشی'), false);
    assert.equal(serialized.includes('articleTextLength'), false);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
  }
});


test('downloaded Reader diagnostics redact resource query strings and omit profile data', async () => {
  const keys = ['window', 'document', 'navigator', 'performance'];
  const previousGlobals = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const previousCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const previousRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  let capturedBlob = null;
  const anchor = { href: '', download: '', click() {}, remove() {} };

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: { search: '?readerDiagnostics=1&private=value' },
      innerWidth: 390,
      innerHeight: 844,
      setTimeout(callback) { callback(); },
      addEventListener() {},
    },
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { visibilityState: 'visible', body: { appendChild() {} }, createElement: () => anchor },
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { userAgent: 'Android diagnostic test' },
  });
  Object.defineProperty(globalThis, 'performance', {
    configurable: true,
    value: {
      now: () => 200,
      getEntriesByType: () => [
        { name: 'https://example.test/Maseer28/content/books/book3.json?token=private', duration: 42.25, transferSize: 512 },
        { name: 'https://example.test/Maseer28/content/books/book4.json?secret=private', duration: 30, transferSize: 256 },
      ],
    },
  });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: (blob) => { capturedBlob = blob; return 'blob:reader-diagnostics-test'; },
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => {} });

  try {
    assert.equal(startReaderDiagnostics({ legacyId: 3, name: 'must-not-be-exported' }), true);
    recordReaderDiagnostic('export-privacy-check', {
      layoutPageCount: 17,
      userName: 'private user',
      medicalNote: 'private medical data',
    });
    assert.equal(downloadReaderDiagnostics(), true);
    assert.ok(capturedBlob);
    const payloadText = await capturedBlob.text();
    const payload = JSON.parse(payloadText);

    assert.equal(payload.book.legacyId, 3);
    assert.deepEqual(payload.resources, [{
      path: '/Maseer28/content/books/book3.json',
      durationMs: 42.3,
      transferBytes: 512,
    }, {
      path: '/Maseer28/content/books/book4.json',
      durationMs: 30,
      transferBytes: 256,
    }]);
    assert.equal(payloadText.includes('token=private'), false);
    assert.equal(payloadText.includes('secret=private'), false);
    assert.equal(payloadText.includes('private=value'), false);
    assert.equal(payloadText.includes('private user'), false);
    assert.equal(payloadText.includes('private medical data'), false);
    assert.equal(payloadText.includes('must-not-be-exported'), false);
  } finally {
    for (const key of keys) {
      const descriptor = previousGlobals[key];
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    if (previousCreateObjectURL) Object.defineProperty(URL, 'createObjectURL', previousCreateObjectURL);
    else delete URL.createObjectURL;
    if (previousRevokeObjectURL) Object.defineProperty(URL, 'revokeObjectURL', previousRevokeObjectURL);
    else delete URL.revokeObjectURL;
  }
});
