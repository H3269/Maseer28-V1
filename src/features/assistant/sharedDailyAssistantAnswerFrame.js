/**
 * Adds one shared response structure to the T01 anger and T02 anxiety
 * prepared answers while preserving topic/day-specific guidance.
 */
export function applySharedDailyAssistantAnswerFrame(answer, { day, topic, guide, question } = {}) {
  if (typeof answer !== 'string' || !answer.trim() || !guide || !question || !topic) return answer;

  const firstLineBreak = answer.indexOf('\n');
  const firstLine = firstLineBreak < 0 ? answer : answer.slice(0, firstLineBreak);
  const body = /(?:راهنمای روز|روز\s*\d+).*(?:خشم|اضطراب)/u.test(firstLine)
    || firstLine.includes(String(guide.title || ''))
    ? answer.slice(firstLineBreak < 0 ? answer.length : firstLineBreak).trim()
    : answer.trim();
  // Preserve authored headings inside the answer; they carry topic/day-specific guidance.
  const normalizedBody = body
    .replace(/\n{3,}/gu, '\n\n')
    .trim();

  return [
    '**راهنمای روز ' + day + ' ' + topic + ' — ' + guide.title + '**',
    '**پاسخ به پرسش**',
    question.label || question.value,
    '**توضیح و راهنمای امروز**',
    normalizedBody,
  ].filter(Boolean).join('\n\n');
}

/**
 * Rebuilds only the anxiety answer's section labels from the matching anger
 * answer. The anxiety prose is retained in order and divided across the
 * reference sections; no anger exercise or clinical text is copied.
 */
export function alignDailyAssistantAnswerHeadings(answer, referenceAnswer) {
  if (typeof answer !== 'string' || typeof referenceAnswer !== 'string') return answer;
  const frameHeading = '**توضیح و راهنمای امروز**';
  const answerFrameIndex = answer.indexOf(frameHeading);
  const referenceFrameIndex = referenceAnswer.indexOf(frameHeading);
  if (answerFrameIndex < 0 || referenceFrameIndex < 0) return answer;

  const referenceBody = referenceAnswer.slice(referenceFrameIndex + frameHeading.length);
  const referenceHeadings = [...referenceBody.matchAll(/\*\*([^*\n]+)\*\*/gu)].map((match) => match[1].trim());
  if (!referenceHeadings.length) return answer;

  const body = answer.slice(answerFrameIndex + frameHeading.length).trim();
  const prose = body.replace(/\*\*([^*\n]+)\*\*/gu, '').trim();
  const paragraphs = prose.split(/\n\s*\n/gu).map((part) => part.trim()).filter(Boolean);
  const alignedSections = referenceHeadings.map((heading, index) => {
    const start = Math.floor(index * paragraphs.length / referenceHeadings.length);
    const end = Math.floor((index + 1) * paragraphs.length / referenceHeadings.length);
    const content = paragraphs.slice(start, end).join('\n\n');
    return '**' + heading + '**' + (content ? '\n' + content : '');
  });

  return answer.slice(0, answerFrameIndex + frameHeading.length) + '\n\n' + alignedSections.join('\n\n');
}
