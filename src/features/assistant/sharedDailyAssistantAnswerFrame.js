/**
 * Adds one shared outer response structure to the T01 anger and T02 anxiety
 * prepared answers. The authored, topic/day-specific answer body is preserved.
 */
export function applySharedDailyAssistantAnswerFrame(answer, { day, topic, guide, question } = {}) {
  if (typeof answer !== 'string' || !answer.trim() || !guide || !question || !topic) return answer;

  const firstLineBreak = answer.indexOf('\n');
  const firstLine = firstLineBreak < 0 ? answer : answer.slice(0, firstLineBreak);
  const body = /(?:راهنمای روز|روز\s*\d+).*(?:خشم|اضطراب)/u.test(firstLine)
    || firstLine.includes(String(guide.title || ''))
    ? answer.slice(firstLineBreak < 0 ? answer.length : firstLineBreak).trim()
    : answer.trim();
  const normalizedBody = body
    .replace(/^\\s*\\*\\*(?!شماره ۰۹۱۹۰۸۸۹۰۶۲)[^*\\n]+\\*\\*\\s*$/gmu, '')
    .replace(/\\n{3,}/gu, '\\n\\n')
    .trim();

  return [
    `**راهنمای روز ${day} ${topic} — ${guide.title}**`,
    '**پاسخ به پرسش**',
    question.label || question.value,
    '**توضیح و راهنمای امروز**',
    normalizedBody,
  ].filter(Boolean).join('\n\n');
}
