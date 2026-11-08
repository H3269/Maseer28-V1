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
const citationIntentSet = new Set([
  'book_subject', 'recommend_self_knowledge', 'recommend_start', 'compare_books',
  'main_theme', 'simple_explanation', 'key_points', 'summary', 'topic_relevance',
  'daily_application', 'anger', 'confidence', 'example', 'habit', 'exercise',
  'seven_day_plan', 'alternative_exercise', 'progress', 'concept_compare',
  'scientific_validity', 'alternative_view', 'limitations', 'author_reason',
]);
function collectSourceEvidence(response, fallbackBook) {
  const matches = [...response.matchAll(/منبع:\s*(.*?)\s*(?:·\s*)?صفحه\s*(\d+)/gu)];
  return matches.map((match) => {
    const pageNumber = Number(match[2]);
    const precedingBooks = books.map((candidate) => ({
      book: candidate,
      index: response.lastIndexOf(candidate.title, match.index),
    })).filter((candidate) => candidate.index >= 0)
      .sort((a, b) => b.index - a.index);
    const sourceBook = precedingBooks[0]?.book || fallbackBook;
    const page = sourceBook.content.pages.find((candidate) =>
      Number(candidate.sourcePage || candidate.page) === pageNumber
    );
    const headings = (page?.blocks || [])
      .filter((block) => block.type === 'heading')
      .map((block) => String(block.text || '').trim())
      .filter(Boolean);
    const citationHeading = String(match[1] || '').trim();
    const headingMatches = !citationHeading || citationHeading === 'متن کتاب' || headings.some((heading) =>
      citationHeading.includes(heading) || heading.includes(citationHeading)
    );
    return page ? {
      bookId: sourceBook.legacyId,
      bookTitle: sourceBook.title,
      page: pageNumber,
      citationHeading,
      headings,
      headingMatches,
      excerpt: (page.blocks || [])
        .filter((block) => block.type !== 'heading')
        .map((block) => String(block.text || (Array.isArray(block.rows) ? block.rows.flat().join(' ') : '')).trim())
        .filter(Boolean).join(' ').slice(0, 900),
    } : {
      bookId: sourceBook.legacyId,
      bookTitle: sourceBook.title,
      page: pageNumber,
      citationHeading,
      headings: [],
      headingMatches: false,
      missing: true,
    };
  });
}
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
    const sourceEvidence = collectSourceEvidence(response, book);
    const referencedPages = [...new Set(sourceEvidence.map((source) => source.page))].slice(0, 12);
    const clarifiesInsteadOfGuessing = clarificationPattern.test(response.slice(0, 700));
    const citationExpected = citationIntentSet.has(item.intent) && !clarifiesInsteadOfGuessing;
    const citesSource = sourceEvidence.length > 0;
    const citationSatisfied = !citationExpected || (citesSource && sourceEvidence.every((source) => !source.missing && source.headingMatches));
    report.push({
      id: item.id,
      bookId: book.legacyId,
      referencedPages,
      sourceEvidence,
      intent: item.intent,
      prompt,
      returned: response.length > 0,
      identifiesBook: ['inventory', 'compare_books'].includes(item.intent)
        ? books.every((candidate) => response.includes(candidate.title))
        : global ? books.some((candidate) => response.includes(candidate.title)) : response.includes(book.title),
      citesSource,
      citationExpected,
      citationSatisfied,
      clarifiesInsteadOfGuessing,
      labelsAssistantContent: !generatedIntents.has(item.intent) || /پیشنهاد دستیار|ساخته دستیار|دستیار/u.test(response) || clarificationPattern.test(response.slice(0, 700)),
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
  sourceEvidenceRows: report.flatMap((row) => row.sourceEvidence || []).filter((source) => source.excerpt?.length >= 90).length,
  missingReferencedPages: report.flatMap((row) => row.sourceEvidence || []).filter((source) => source.missing).length,
  sourceHeadingMismatches: report.flatMap((row) => row.sourceEvidence || []).filter((source) => !source.missing && !source.headingMatches).length,
  citationRequiredScenarios: count((row) => row.citationExpected),
  citationSatisfiedScenarios: count((row) => row.citationExpected && row.citationSatisfied),
  missingRequiredCitations: count((row) => row.citationExpected && !row.citationSatisfied),
  byBook,
  note: 'These are routing/source/attribution checks only. They do NOT score semantic correctness, completeness, author-intent interpretation, scientific validity, or answer quality. Human review against the 0–2 rubric remains mandatory.',
  scenariosDetail: report,
};
await mkdir(new URL('../reports/generated/', import.meta.url), { recursive: true });
await writeFile(new URL('../reports/generated/library-assistant-acceptance.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ ...output, scenariosDetail: undefined }, null, 2));
