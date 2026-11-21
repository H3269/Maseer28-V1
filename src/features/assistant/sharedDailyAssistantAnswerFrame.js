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
