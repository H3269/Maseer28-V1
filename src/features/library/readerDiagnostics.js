const GLOBAL_KEY = '__M28_READER_DIAGNOSTICS__';
const ENABLE_PARAM = 'readerDiagnostics';

const SAFE_DETAIL_KEYS = new Set([
  'phase', 'durationMs', 'contentPageCount', 'cacheLayer', 'versionPresent',
  'versionContentPresent', 'cacheHit', 'layoutPageCount', 'layoutCurrentType',
  'rootWidth', 'rootHeight', 'articleWidth', 'articleHeight',
  'documentVisibility', 'viewportWidth', 'viewportHeight', 'devicePixelRatio',
  'errorName', 'readerMounted', 'bookId',
]);

export function isReaderDiagnosticsEnabled() {
  try {
    return new URLSearchParams(window.location.search).get(ENABLE_PARAM) === '1';
  } catch {
    return false;
  }
}

function getReport() {
  return typeof window !== 'undefined' ? window[GLOBAL_KEY] : null;
}

export function startReaderDiagnostics(book) {
  if (!isReaderDiagnosticsEnabled()) return false;
  const startedAt = performance.now();
  window[GLOBAL_KEY] = {
    schemaVersion: 1,
    startedAt: new Date().toISOString(),
    startedAtPerformanceMs: startedAt,
    book: {
      legacyId: Number(book?.legacyId) || null,
    },
    events: [],
  };
  recordReaderDiagnostic('open-book-start');
  if (!window.__m28ReaderDiagnosticListenersInstalled) {
    window.__m28ReaderDiagnosticListenersInstalled = true;
    window.addEventListener('error', (event) => {
      recordReaderDiagnostic('browser-error', {
        errorName: String(event.error?.name || 'Error').slice(0, 40),
      });
    });
    window.addEventListener('unhandledrejection', (event) => {
      recordReaderDiagnostic('unhandled-rejection', {
        errorName: String(event.reason?.name || 'PromiseRejection').slice(0, 40),
      });
    });
  }
  return true;
}

export function recordReaderDiagnostic(stage, details = {}) {
  const report = getReport();
  if (!report || !isReaderDiagnosticsEnabled()) return;
  const safeDetails = {};
  Object.entries(details || {}).forEach(([key, value]) => {
    if (!SAFE_DETAIL_KEYS.has(key)) return;
    if (typeof value === 'string') safeDetails[key] = value.slice(0, 80);
    else if (typeof value === 'number' && Number.isFinite(value)) safeDetails[key] = Number(value.toFixed(2));
    else if (typeof value === 'boolean' || value === null) safeDetails[key] = value;
  });
  report.events.push({
    stage: String(stage).slice(0, 64),
    elapsedMs: Number((performance.now() - report.startedAtPerformanceMs).toFixed(2)),
    details: safeDetails,
  });
}

export function downloadReaderDiagnostics() {
  const report = getReport();
  if (!report || !isReaderDiagnosticsEnabled()) return false;
  recordReaderDiagnostic('diagnostic-report-download-requested');
  const resources = performance.getEntriesByType('resource')
    .filter((entry) => /\/content\/books\/book\d+\.json(?:$|\?)/.test(entry.name))
    .slice(-10)
    .map((entry) => ({
      path: (() => {
        try { return new URL(entry.name).pathname; } catch { return 'book-content-resource'; }
      })(),
      durationMs: Number(entry.duration.toFixed(1)),
      transferBytes: Number(entry.transferSize || 0),
    }));
  const payload = {
    ...report,
    completedAt: new Date().toISOString(),
    environment: {
      userAgent: String(navigator.userAgent || '').slice(0, 180),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      documentVisibility: document.visibilityState,
    },
    resources,
    privacy: 'No user profile, medical information, book text, page text, query string, or full resource URL is included.',
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `reader-diagnostics-${Date.now()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
