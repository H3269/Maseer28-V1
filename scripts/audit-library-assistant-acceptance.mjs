import { readFile } from 'node:fs/promises';
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
    report.push({
      id: item.id,
      bookId: book.legacyId,
      intent: item.intent,
      prompt,
      returned: response.length > 0,
      identifiesBook: global || response.includes(book.title),
      citesSource: global || /منبع:/.test(response),
      labelsAssistantContent: !generatedIntents.has(item.intent) || /پیشنهاد دستیار|ساخته دستیار|دستیار/u.test(response),
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
    labelsAssistantContent: rows.filter((row) => row.labelsAssistantContent).length,
  };
});
console.log(JSON.stringify({
  title: 'Library assistant 25-question × 5-book automated coverage',
  scenarios: total,
  returned: count((row) => row.returned),
  identifiesBook: count((row) => row.identifiesBook),
  citesSource: count((row) => row.citesSource),
  labelsAssistantContent: count((row) => row.labelsAssistantContent),
  byBook,
  note: 'These are routing/source/attribution checks only. They do NOT score semantic correctness, completeness, author-intent interpretation, scientific validity, or answer quality. Human review against the 0–2 rubric remains mandatory.',
  scenariosDetail: report,
}, null, 2));
