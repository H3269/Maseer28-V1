const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function faDigits(value) {
  return String(value ?? '').replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

function localizeTextNode(node) {
  const parent = node.parentElement;
  if (!parent || parent.closest('script, style, textarea, input, select, [contenteditable="true"]')) return;
  const localized = faDigits(node.nodeValue);
  if (localized !== node.nodeValue) node.nodeValue = localized;
}

function localizeElementAttributes(element) {
  if (!element || element.nodeType !== 1) return;
  for (const attribute of ['placeholder', 'title', 'aria-label', 'aria-valuetext', 'alt']) {
    const value = element.getAttribute(attribute);
    if (value && /[0-9]/.test(value)) element.setAttribute(attribute, faDigits(value));
  }
}

function localizeSubtree(root, doc) {
  if (!root) return;
  if (root.nodeType === 3) {
    localizeTextNode(root);
    return;
  }
  if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
  if (root.nodeType === 1) localizeElementAttributes(root);
  const walker = doc.createTreeWalker(root, 4);
  let node;
  while ((node = walker.nextNode())) localizeTextNode(node);
  if (root.querySelectorAll) {
    root.querySelectorAll('[placeholder], [title], [aria-label], [aria-valuetext], [alt]').forEach(localizeElementAttributes);
  }
}

/**
 * Localizes user-visible text across the rendered app while leaving editable
 * field values and machine-readable identifiers untouched.
 */
export function installPersianDigitDisplay(root, environment = globalThis) {
  const doc = environment.document;
  const Observer = environment.MutationObserver;
  if (!root || !doc?.createTreeWalker || typeof Observer !== 'function') return () => {};
  localizeSubtree(root, doc);
  const observer = new Observer((records) => {
    for (const record of records) {
      if (record.type === 'characterData') localizeTextNode(record.target);
      else if (record.type === 'attributes') localizeElementAttributes(record.target);
      else for (const node of record.addedNodes || []) localizeSubtree(node, doc);
    }
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['placeholder', 'title', 'aria-label', 'aria-valuetext', 'alt'],
  });
  return () => observer.disconnect();
}
