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
