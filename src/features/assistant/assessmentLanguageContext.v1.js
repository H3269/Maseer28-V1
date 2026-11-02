/**
 * Conservative Persian text-context preprocessing for the experimental
 * assessment prototype. This is not semantic understanding or a validated NLP
 * component. Ambiguous ownership is intentionally excluded from lexical hints.
 */
export const ASSESSMENT_CONTEXT_VERSION = '1.0.0';

const QUOTED_SPANS = [
  /«[^»]*»/gu,
  /“[^”]*”/gu,
  /"[^"]*"/gu,
  /‘[^’]*’/gu,
  /'[^']*'/gu,
];

const ATTRIBUTION = /(?:دوستم|مادرم|پدرم|همسرم|مدیرم|همکارم|خواهرم|برادرم|او|آنها|دیگران)\s+(?:(?:به\s+من|بهم)\s+)?(?:گفت|گفته|نوشت|می\s+گوید|میگه|گفتند)/u;
const META_REQUEST = /(?:برای\s+ترجمه|ترجمه\s+(?:این\s+)?جمله|معنی\s+(?:این\s+)?عبارت|مثال\s+(?:فرضی|از)|جمله\s+فرضی|چطور\s+می(?:شود|شه)\s+گفت)/u;

export function extractConservativeAssessmentEvidence(input) {
  let text = String(input ?? '').normalize('NFKC');
  for (const quotePattern of QUOTED_SPANS) text = text.replace(quotePattern, ' ');
  const clauses = text
    .split(/(?:[؛.!؟\n]+|،?\s+(?:اما|ولی|با\s+این\s+حال)\s+|\s+و(?=\s*(?:دوستم|مادرم|پدرم|همسرم|مدیرم|همکارم|خواهرم|برادرم|او|آنها|دیگران)\s))/u)
    .map((clause) => clause.trim())
    .filter(Boolean);

  const retained = clauses.filter((clause) => !ATTRIBUTION.test(clause) && !META_REQUEST.test(clause));
  return {
    evidence_text: retained.join(' ؛ '),
    excluded_clause_count: clauses.length - retained.length,
    ambiguity_policy: 'exclude_ambiguous_attributed_or_meta_language_clause',
  };
}
