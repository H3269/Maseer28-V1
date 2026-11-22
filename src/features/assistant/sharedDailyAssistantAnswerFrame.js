import { DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN } from './dailyAssistantSafetyReminder.js';

/**
 * Shared response framing for the anger/anxiety pilot and later topic rollout.
 * Destination prose is assigned by semantic section type, not paragraph count.
 */
export function applySharedDailyAssistantAnswerFrame(answer, { day, topic, guide, question, style = 'standard' } = {}) {
  if (typeof answer !== 'string' || !answer.trim() || !guide || !question || !topic) return answer;
  const firstBreak = answer.indexOf('\n');
  const firstLine = firstBreak < 0 ? answer : answer.slice(0, firstBreak);
  const hasDayHeading = /(?:راهنمای روز|روز\s*\d+).*(?:خشم|اضطراب)/u.test(firstLine);
  const hasLegacyTitleHeading = style !== 'sample3' && firstLine.includes(String(guide.title || ''));
  let body = hasDayHeading || hasLegacyTitleHeading
    ? answer.slice(firstBreak < 0 ? answer.length : firstBreak).trim()
    : answer.trim();

  if (style === 'sample3') {
    body = body.replace(/^\*\*پاسخ q\d{2}[^*]*\*\*\s*\n*/u, '').trim();
    return [
      '**' + topic + ' · روز ' + day + ' | ' + guide.title + '**',
      body.replace(/\n{3,}/gu, '\n\n'),
    ].filter(Boolean).join('\n\n');
  }

  return [
    '**راهنمای روز ' + day + ' ' + topic + ' — ' + guide.title + '**',
    '**پاسخ به پرسش**',
    question.label || question.value,
    '**توضیح و راهنمای امروز**',
    body.replace(/\n{3,}/gu, '\n\n'),
  ].filter(Boolean).join('\n\n');
}
const FRAME = '**توضیح و راهنمای امروز**';

function sectionKey(label) {
  const s = String(label || '').replace(/[:：؟?،؛.!؟]/gu, '').replace(/[\u200c\s]+/gu, ' ').trim().toLocaleLowerCase('fa');
  if (/توقف|ایمنی|خطر|آسیب|کمک فوری/u.test(s)) return 'safety';
  if (/مدت|زمان/u.test(s)) return 'duration';
  if (/تفاوت|فرق/u.test(s)) return 'difference';
  if (/نبود.*نمونه|نمونه.*پیش|اگر امروز.*نمونه/u.test(s)) return 'no_event';
  if (/فراموش|انجام.*نشد|انجام.*نداد/u.test(s)) return 'not_done';
  if (/صحبت|گفت.?وگو|فرد دیگر/u.test(s)) return 'talk';
  if (/تغییر|سازگار/u.test(s)) return 'adapt';
  if (/نسخه سبک|سبک/u.test(s)) return 'light';
  if (/پیشرفت/u.test(s)) return 'progress';
  if (/استراحت|مکث/u.test(s)) return 'rest';
  if (/مثال|نمونه|فرضی/u.test(s)) return 'example';
  if (/قدم|گام|مرحله|روش اجرا|چطور/u.test(s)) return 'steps';
  if (/مهارت/u.test(s)) return 'skill';
  if (/منطق|سازوکار|چرایی/u.test(s)) return 'mechanism';
  if (/معیار|موفقیت|نکته/u.test(s)) return 'criterion';
  if (/پرسش|بازبینی|تأمل/u.test(s)) return 'reflection';
  if (/هدف|چرا/u.test(s)) return 'objective';
  if (/اقدام/u.test(s)) return 'action';
  if (/تمرین/u.test(s)) return 'exercise';
  if (/راهنما|توضیح/u.test(s)) return 'overview';
  return 'other:' + s;
}

function parseSections(text) {
  const result = [];
  let current = null;
  const preface = [];
  for (const line of String(text || '').split('\n')) {
    const match = line.match(/^\s*\*\*([^*\n]+)\*\*:?\s*(.*)$/u);
    if (match) {
      current = { label: match[1].trim(), body: [] };
      if (match[2].trim()) current.body.push(match[2].trim());
      result.push(current);
    } else if (current) current.body.push(line);
    else preface.push(line);
  }
  return {
    preface: preface.join('\n').trim(),
    sections: result.map((x) => ({ label: x.label, key: sectionKey(x.label), content: x.body.join('\n').trim() })),
  };
}

function fallbackKey(question) {
  const kind = question && question.kind || '';
  if (kind.includes('example')) return 'example';
  if (kind.includes('action')) return 'action';
  if (kind.includes('exercise')) return 'exercise';
  if (kind === 'success') return 'criterion';
  if (kind === 'stop' || kind === 'anxiety_increased' || kind === 'anger_increased') return 'safety';
  if (kind === 'duration') return 'duration';
  if (kind === 'talk_other') return 'talk';
  if (kind === 'can_change') return 'adapt';
  if (kind === 'light_version') return 'light';
  if (kind === 'no_event') return 'no_event';
  if (kind === 'not_done') return 'not_done';
  if (kind === 'exercise_action_difference') return 'difference';
  return 'overview';
}

/**
 * Rebuild destination headings from the reference. Matching sections are
 * assigned by semantic key. Unmatched legacy labels are retained in prose.
 */
export function alignDailyAssistantAnswerHeadings(answer, referenceAnswer, { guide, question } = {}) {
  if (typeof answer !== 'string' || typeof referenceAnswer !== 'string') return answer;
  const ai = answer.indexOf(FRAME);
  const ri = referenceAnswer.indexOf(FRAME);
  if (ai < 0 || ri < 0) return answer;
  const referenceRaw = referenceAnswer.slice(ri + FRAME.length).trim();
  const destinationRaw = answer.slice(ai + FRAME.length).trim();
  const referenceBody = referenceRaw.replace(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN, '').trim();
  const destinationBody = destinationRaw.replace(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN, '').trim();
  const destinationHasSafetyFooter = destinationRaw.includes(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN);
  const ref = parseSections(referenceBody);
  const src = parseSections(destinationBody);
  if (!ref.sections.length) return answer;

  const slots = ref.sections.map((x) => ({ label: x.label, key: x.key, content: [] }));
  const byKey = new Map();
  slots.forEach((slot, index) => {
    const indexes = byKey.get(slot.key) || [];
    indexes.push(index);
    byKey.set(slot.key, indexes);
  });
  if (src.preface) (slots.find((x) => x.key === 'overview') || slots[0]).content.push(src.preface);

  const seen = new Map();
  for (const section of src.sections) {
    if (!section.content) continue;
    const candidates = byKey.get(section.key);
    let index;
    let contentToPreserve = section.content;
    if (candidates && candidates.length) {
      const count = seen.get(section.key) || 0;
      index = candidates[Math.min(count, candidates.length - 1)];
      seen.set(section.key, count + 1);
      // A semantically matched legacy heading is replaced by the canonical
      // destination heading. Keep its anxiety-specific body, not its old label.
    } else {
      const fallback = byKey.get(fallbackKey(question));
      index = fallback && fallback.length ? fallback[0] : 0;
      // Unmatched legacy headings carry information: retain the label once.
      contentToPreserve = section.label + ' — ' + section.content;
    }
    slots[index].content.push(contentToPreserve);
  }

  const output = slots.map((slot) => '**' + slot.label + '**' + (slot.content.length ? '\n' + slot.content.join('\n\n') : ''));
  return answer.slice(0, ai + FRAME.length) + '\n\n' + output.join('\n\n')
    + (destinationHasSafetyFooter ? '\n\n' + DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN : '');
}
