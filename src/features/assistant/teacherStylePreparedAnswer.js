const INTERNAL_TOPIC_LABELS = Object.freeze({ T01: 'خشم', T02: 'اضطراب', T03: 'ترس', T04: 'نفرت', T18: 'نفرت از خود' });

export function cleanPreparedAssistantTopicText(value, topic) {
  let text = String(value || '')
    .replace(/«?بسته(?:‌ی| ی)?\s*T(0?[1-9]|[12][0-9]|3[0-4])(?:-[A-Z]\d{2})?»?/g, (_, digits) => 'موضوع ' + (INTERNAL_TOPIC_LABELS['T' + digits.padStart(2, '0')] || 'مرتبط'))
    .replace(/\bT(0?[1-9]|[12][0-9]|3[0-4])(?:-[A-Z]\d{2})?\b/g, (_, digits) => INTERNAL_TOPIC_LABELS['T' + digits.padStart(2, '0')] || 'موضوع مرتبط')
    .replace(/این بسته/g, 'این موضوع')
    .replace(/در این بسته/g, 'در این موضوع')
    .replace(/بسته فعلی/g, 'موضوع فعلی');
  if (topic) text = text.replace(/نام موضوع/g, topic);
  return text;
}

export function addTeacherStyleFrame(answer, { guide, topic, question } = {}) {
  if (!answer || !guide || !topic || !question) return null;
  const cleanAnswer = cleanPreparedAssistantTopicText(answer, topic);
  const splitAt = cleanAnswer.indexOf('\n');
  const heading = splitAt < 0 ? cleanAnswer : cleanAnswer.slice(0, splitAt);
  const body = splitAt < 0 ? '' : cleanAnswer.slice(splitAt + 1).replace(/^\n+/, '');
  const objective = guide.objective || guide.title;
  const skill = guide.skill || guide.mechanism || objective;
  const intro = '**بیاییم قدم‌به‌قدم پیش برویم.**\n**هدف امروز:** ' + objective + '\nقرار نیست همه مسئله را یک‌باره حل کنی. امروز فقط روی مهارت «' + skill + '» کار می‌کنیم. هدف این است که دستور امروز را بفهمی و تا جایی که امن و شدنی است اجرا کنی.';
  const exampleSteps = ['exercise_example', 'action_example'].includes(question.kind)
    ? '\n\n**چطور از مثال استفاده کنی؟**\n۱) مثال را فقط برای فهم روش بخوان؛ لازم نیست تجربه تو هم دقیقاً همین باشد.\n۲) یک نمونه کم‌فشار و مرتبط انتخاب کن؛ برای پیدا کردن نمونه خودت را وارد موقعیت دشوار یا ناامن نکن.\n۳) همان مهارت را در حد امن به کار ببر و معیار پایان امروز را بررسی کن. اگر موقعیت مناسب نیست، مکث یا انجام‌ندادن اقدام انتخاب معتبری است.'
    : '';
  const framed = heading + '\n\n' + intro + '\n\n' + body + exampleSteps;
  return cleanPreparedAssistantTopicText(framed, topic);
}
