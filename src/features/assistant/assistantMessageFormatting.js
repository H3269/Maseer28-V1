// Safely format the small Markdown subset used by prepared assistant answers.
// Never inject HTML: text is rendered as React text nodes and only paired **bold** spans become <strong>.
export function formatAssistantMessageText(value) {
  const normalized = String(value ?? '')
    .replace(/\\\\n/g, '\n')
    .replace(/\\r\\n?/g, '\n');

  return normalized.split('\n').map((line) =>
    line.split(/(\\*\\*[^*]+?\\*\\*)/g).filter(Boolean).map((part) =>
      part.startsWith('**') && part.endsWith('**')
        ? { type: 'strong', text: part.slice(2, -2) }
        : { type: 'text', text: part },
    ),
  );
}
