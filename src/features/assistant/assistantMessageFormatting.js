// Safely format the small Markdown subset used by prepared assistant answers.
// Text stays in React text nodes; only paired **bold** spans become <strong>.
export function formatAssistantMessageText(value) {
  const escapedNewline = String.fromCharCode(92) + 'n';
  const normalized = String(value ?? '').split(escapedNewline).join('\n').replace(/\r\n?/g, '\n');

  return normalized.split('\n').map((line) =>
    line.split(/(\*\*[^*]+?\*\*)/g).filter(Boolean).map((part) =>
      part.startsWith('**') && part.endsWith('**')
        ? { type: 'strong', text: part.slice(2, -2) }
        : { type: 'text', text: part },
    ),
  );
}