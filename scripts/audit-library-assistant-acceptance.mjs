import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { answerLibraryBookTurn } from '../src/features/assistant/libraryBookAssistant.js';

const root = new URL('../public/', import.meta.url);
const matrix = JSON.parse(await readFile(new URL('../tests/fixtures/library-assistant-acceptance.fa.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('content/library.seed.json', root), 'utf8'));
const books = await Promise.all(manifest.books.map(async (meta) => ({
  title: meta.title,
  legacyId: meta.legacyId,
  content: JSON.parse(await readFile(new URL(meta.file, root), 'utf8')),
})));

const globalIntents = new Set(['inventory', 'recommend_self_knowledge', 'recommend_start', 'compare_books']);
const generatedIntents = new Set(['example', 'habit', 'exercise', 'seven_day_plan', 'alternative_exercise', 'progress']);
const clarificationPattern = /عنوان فصل|شماره صفحه|چند واژه|ادعا یا توصیه مشخص/u;
const report = [];
for (const book of books) {
  for (const item of matrix.questions) {
    let prompt = item.question.replaceAll('{book}', 'کتاب ' + ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم'][book.legacyId - 1]);
    if (!globalIntents.has(item.intent) && !prompt.includes('کتاب ')) {
      prompt = 'در کتاب ' + ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم'][book.legacyId - 1] + '، ' + prompt;
    }
    const result = answerLibraryBookTurn({
      books,
      message: prompt,
      conversationState: {
        bookId: book.legacyId,
        bookTitle: book.title,
        lastQuery: prompt,
      },
    });
    const response = String(result?.message || '');
    const global = globalIntents.has(item.intent);
    const referencedPages = [...new Set([...response.matchAll(/صفحه\\s*(\\d+)/gu)].map((match) => Number(match[1])))].slice(0, 12);
    const sourceEvidence = referencedPages.map((pageNumber) => {
      const page = book.content.pages.find((candidate) => Number(candidate.sourcePage || candidate.page) === pageNumber);
      return page ? {
        page: pageNumber,
        headings: (page.blocks || []).filter((block) => block.type === 'heading').map((block) => String(block.text || '').trim()).filter(Boolean),
        excerpt: (page.blocks || []).filter((block) => block.type !== 'heading').map((block) => String(block.text || '').trim()).filter(Boolean).join(' ').slice(0, 900),
      } : { page: pageNumber, missing: true };
    });
    report.push({
      id: item.id,
      bookId: book.legacyId,
      referencedPages,
      sourceEvidence,
      intent: item.intent,
      prompt,
      returned: response.length > 0,
      identifiesBook: global || response.includes(book.title),
      citesSource: global || /منبع:/.test(response),
      clarifiesInsteadOfGuessing: clarificationPattern.test(response),
      labelsAssistantContent: !generatedIntents.has(item.intent) || /پیشنهاد دستیار|ساخته دستیار|دستیار/u.test(response) || clarificationPattern.test(response),
      responseLength: response.length,
      response,
    });
  }
}
const count = (predicate) => report.filter(predicate).length;
const total = report.length;
const byBook = books.map((book) => {
  const rows = report.filter((row) => row.bookId === book.legacyId);
  return {
    book: book.title,
    total: rows.length,
    returned: rows.filter((row) => row.returned).length,
    identifiesBook: rows.filter((row) => row.identifiesBook).length,
    citesSource: rows.filter((row) => row.citesSource).length,
    clarifiesInsteadOfGuessing: rows.filter((row) => row.clarifiesInsteadOfGuessing).length,
    labelsAssistantContent: rows.filter((row) => row.labelsAssistantContent).length,
  };
});
const output = {
  title: 'Library assistant 25-question × 5-book automated coverage',
  scenarios: total,
  returned: count((row) => row.returned),
  identifiesBook: count((row) => row.identifiesBook),
  citesSource: count((row) => row.citesSource),
  clarifiesInsteadOfGuessing: count((row) => row.clarifiesInsteadOfGuessing),
  labelsAssistantContent: count((row) => row.labelsAssistantContent),
  sourceEvidenceRows: count((row) => row.sourceEvidence?.some((source) => source.excerpt?.length >= 90)),
  missingReferencedPages: report.flatMap((row) => row.sourceEvidence || []).filter((source) => source.missing).length,
  byBook,
  note: 'These are routing/source/attribution checks only. They do NOT score semantic correctness, completeness, author-intent interpretation, scientific validity, or answer quality. Human review against the 0–2 rubric remains mandatory.',
  scenariosDetail: report,
};
await mkdir(new URL('../reports/generated/', import.meta.url), { recursive: true });
await writeFile(new URL('../reports/generated/library-assistant-acceptance.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ ...output, scenariosDetail: undefined }, null, 2));
