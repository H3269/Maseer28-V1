import { routeSemanticIntake } from './intentContextRouter.js';

export function makeDailyExerciseGuidance({ message, dayData, problem, day }) {
  const text = String(message || '').trim();
  if (!text) return 'پیامت خالی است؛ لطفاً پرسشت را بنویس.';

  const routed = routeSemanticIntake({ text });
  if (routed.safety_handoff.handoff_required) {
    return 'از روی این پیام نشانه‌ای از خطر فوری برداشت می‌شود. راهنمایی تمرین را متوقف می‌کنم. همین الآن از خدمات اورژانسی محل زندگی یا یک فرد امن و قابل اعتماد کمک بگیر.';
  }
  if (routed.next_question?.purpose === 'safety_clarification') return routed.next_question.text;

  // The current day already supplies a topic. Only ask topic disambiguation
  // when the user's message contains multiple actual topic candidates.
  if (routed.next_question?.purpose === 'topic_disambiguation' && routed.topic_candidates.length > 0) {
    return routed.next_question.text;
  }

  const exercise = String(dayData?.exercise || '').trim();
  const action = String(dayData?.actionText || '').trim();
  const topic = String(problem || 'موضوع انتخاب‌شده').trim();
  const asksHow = /چطور|چگونه|از کجا|چه جوری|نمی فهمم|متوجه نمی شوم|توضیح|منظور|سخته|سخت است|انجام بدم|انجام دهم/u.test(text);

  if (!exercise && !action) {
    return 'متن تمرین و راهکار این روز در دسترس نیست؛ نمی‌خواهم چیزی را حدس بزنم. از صفحه روز خارج نشو و بعداً دوباره تلاش کن.';
  }
  if (asksHow) {
    return [
      `داریم درباره «${topic}»، روز ${day} صحبت می‌کنیم.`,
      exercise ? `متن تمرین همین روز: ${exercise}` : '',
      action ? `راهکار اختصاصی همین روز: ${action}` : '',
      'برای اینکه دقیقاً همان چیزی را که لازم داری روشن کنم، لطفاً جمله یا مرحله‌ای از متن بالا را که مبهم است مشخص کن. من نباید بدون فهمیدن بخش مبهم، روش دیگری را جای تمرین اصلی جا بزنم.',
    ].filter(Boolean).join('\n\n');
  }
  return [
    `پیامت را در زمینه «${topic}»، روز ${day} بررسی کردم.`,
    'برای اینکه پاسخ دقیقاً به تمرین امروز مربوط باشد، بگو پرسشت درباره کدام بخش است: فهم متن تمرین، مراحل انجام آن، یا منظور راهکار اختصاصی؟',
  ].join('\n\n');
}
