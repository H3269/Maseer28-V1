import test from 'node:test';
import assert from 'node:assert/strict';
import { extractConservativeAssessmentEvidence } from '../src/features/assistant/assessmentLanguageContext.v1.js';

test('quoted phrases are excluded from lexical assessment evidence', () => {
  const result = extractConservativeAssessmentEvidence('او گفت «من از خودم متنفرم»');
  assert.equal(result.evidence_text.trim(), '');
  assert.equal(result.excluded_clause_count, 1);
});

test('externally attributed clauses are excluded without discarding a separate personal clause', () => {
  const result = extractConservativeAssessmentEvidence('من از خودم متنفرم و دوستم گفت که من بی‌ارزشم');
  assert.match(result.evidence_text, /من از خودم متنفرم/u);
  assert.doesNotMatch(result.evidence_text, /دوستم گفت/u);
});

test('adversative personal correction is retained after an attributed statement', () => {
  const result = extractConservativeAssessmentEvidence('دوستم گفت من بی‌ارزشم، ولی من با این حرف موافق نیستم');
  assert.match(result.evidence_text, /من با این حرف موافق نیستم/u);
  assert.doesNotMatch(result.evidence_text, /دوستم گفت/u);
});

test('meta-language request clauses are excluded while separate personal experience is retained', () => {
  const result = extractConservativeAssessmentEvidence('برای ترجمه جمله «من بی‌ارزشم» کمک می‌خواهم؛ اما من گاهی واقعاً احساس بی‌ارزشی دارم');
  assert.match(result.evidence_text, /واقعاً احساس بی‌ارزشی دارم/u);
  assert.doesNotMatch(result.evidence_text, /برای ترجمه/u);
});

test('ambiguous attributed content is conservatively excluded and policy is explicit', () => {
  const result = extractConservativeAssessmentEvidence('مدیرم گفت من همیشه شکست می‌خورم');
  assert.equal(result.evidence_text, '');
  assert.equal(result.ambiguity_policy, 'exclude_ambiguous_attributed_or_meta_language_clause');
});
