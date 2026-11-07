export const fa = (value) => String(value ?? '').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

export function normalizeDigits(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

export function formatDate(value) {
  if (!value) return '-';
  try {
    return fa(new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)));
  } catch {
    return fa(value);
  }
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function uid(prefix = 'id') {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}


/**
 * Copies text with a verified Clipboard API result and a legacy fallback.
 * Host-WebView paste must still be verified manually.
 */
export async function copyTextToClipboard(text, environment = globalThis) {
  const value = String(text ?? '');
  if (!value) return false;
  const clipboard = environment.navigator?.clipboard;
  if (environment.isSecureContext && typeof clipboard?.writeText === 'function') {
    try {
      await clipboard.writeText(value);
      return true;
    } catch {
      // Try the selection-based fallback.
    }
  }
  const doc = environment.document;
  if (!doc?.body || typeof doc.createElement !== 'function' || typeof doc.execCommand !== 'function') return false;
  let textarea;
  try {
    textarea = doc.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute?.('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    doc.body.appendChild(textarea);
    textarea.select();
    return doc.execCommand('copy') === true;
  } catch {
    return false;
  } finally {
    try { textarea?.remove(); } catch { /* best-effort cleanup */ }
  }
}
