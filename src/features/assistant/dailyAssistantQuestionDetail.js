/**
 * Expand a prepared daily FAQ with the same day-specific teaching structure
 * used by the T01 assistant. Only authored guide fields and the exact
 * question-specific answer are used; this helper never invents clinical claims,
 * durations, or an example presented as the user's real experience.
 */
const text = (value) => typeof value === 'string' ? value.trim() : '';
const section = (label, value) => {
  const content = text(value);
  return content ? `**${label}:** ${content}` : '';
};
const appendOnce = (parts, answer, label, value) => {
  const content = text(value);
  if (!content) return;
  const heading = `**${label}:**`;
  if (answer.includes(heading)) return;
  parts.push(answer.includes(content)
    ? `${heading} توضیح این مورد در متن بالا آمده است؛ همان توضیح، مبنای اجرای امروز است.`
    : section(label, content));
};
export function expandDailyAssistantQuestionAnswer(answer, { guide, question } = {}) {
  let original = text(answer);
  if (!original || !guide || !question) return answer;
  const additions = [];
  const exercise = text(guide.exercise);
  const action = text(guide.action);
  const objective = text(guide.objective);
  const skill = text(guide.skill);
  const mechanism = text(guide.mechanism);
  const criterion = text(guide.successCriterion);
  const reflection = text(guide.reflectionQuestion || guide.reflectionPrompt);
  const exerciseExample = text(guide.exerciseExample);
  const actionExample = text(guide.actionExample);
  const lightExercise = text(guide.lightVersion);
  const lightAction = text(guide.lightActionVersion);
  const progressExercise = text(guide.progressVersion);
  const progressAction = text(guide.progressActionVersion);
  const restExercise = text(guide.restVersion);
  const restAction = text(guide.restActionVersion);
  const stop = text(guide.stopCondition);
  const support = text(guide.whenToSeekHumanSupport);
  const contraindications = Array.isArray(guide.contraindications) ? guide.contraindications.map(text).filter(Boolean).join(' ') : '';

  switch (question.kind) {
    case 'exercise_meaning':
      appendOnce(additions, original, 'هدف تمرین امروز', objective);
      appendOnce(additions, original, 'مهارت مورد تمرین', skill);
      appendOnce(additions, original, 'منطق آموزشی امروز', mechanism);
      appendOnce(additions, original, 'متن دقیق تمرین امروز', exercise);
      appendOnce(additions, original, 'معیار کافی‌بودن تمرین', criterion);
      appendOnce(additions, original, 'پرسش برای بازبینی', reflection);
      additions.push('**روش اجرای روشن:** ابتدا فقط موقعیت یا موضوعی را انتخاب کن که خود متن تمرین اجازه می‌دهد؛ سپس همان موارد خواسته‌شده را ثبت کن. لازم نیست جزئیات اضافه، نتیجه‌گیری یا اقدام بیرونی به تمرین بیفزایی.');
      break;
    case 'exercise_example':
      if (!/(?:نمونه|مثال|فرض کن|مثلاً)/u.test(original.slice(0, 80))) original = `**نمونه اختصاصی تمرین روز ${guide.day}:** ${original}`;
      appendOnce(additions, original, 'تمرین دقیق همین روز', exercise);
      if (exerciseExample) appendOnce(additions, original, 'نمونه اختصاصی تمرین همین روز', exerciseExample);
      additions.push('**چطور از مثال استفاده کنی؟** مثال فقط برای فهم قالب و سطح جزئیات است؛ آن را با تجربه خودت تطبیق بده، نه اینکه عیناً به‌عنوان تجربه شخصی ثبت کنی. اگر نمونه‌ای طبیعی و کم‌فشار نداری، چیزی نساز و نبود نمونه را بپذیر.');
      appendOnce(additions, original, 'معیار کافی‌بودن', criterion);
      break;
    case 'action_meaning':
      appendOnce(additions, original, 'هدف آموزشی روز', objective);
      appendOnce(additions, original, 'مهارت پشتیبان اقدام', skill);
      appendOnce(additions, original, 'منطق انتخاب اقدام', mechanism);
      appendOnce(additions, original, 'اقدام اختصاصی دقیق امروز', action);
      additions.push('**روش اجرای اقدام:** اقدام را فقط در حدی انجام بده که در متن بالا آمده است؛ آن را به تعهد بزرگ‌تر، مواجهه اجباری، گفت‌وگوی ناامن یا کنترل رفتار دیگران تبدیل نکن.');
      appendOnce(additions, original, 'معیار کافی‌بودن', criterion);
      break;
    case 'action_example':
      if (!/(?:نمونه|مثال|فرض کن|مثلاً)/u.test(original.slice(0, 80))) original = `**نمونه اختصاصی اقدام روز ${guide.day}:** ${original}`;
      appendOnce(additions, original, 'اقدام اختصاصی دقیق همین روز', action);
      if (actionExample) appendOnce(additions, original, 'نمونه اختصاصی اقدام همین روز', actionExample);
      additions.push('**چطور مثال را با شرایط خودت تطبیق بدهی؟** فقط بخش امن، داوطلبانه و در اختیار خودت را نگه دار. مثال نسخه اجباری نیست و اگر شرایط تو متفاوت است، آن را اجرا نکن؛ می‌توانی اقدام را کوچک‌تر کنی یا کنار بگذاری.');
      appendOnce(additions, original, 'معیار کافی‌بودن', criterion);
      break;
    case 'light_version':
      appendOnce(additions, original, 'نسخه سبک تمرین', lightExercise);
      appendOnce(additions, original, 'نسخه سبک اقدام', lightAction);
      appendOnce(additions, original, 'نسخه پیشرفت تمرین، فقط در صورت آمادگی', progressExercise);
      appendOnce(additions, original, 'نسخه پیشرفت اقدام، فقط در صورت آمادگی', progressAction);
      appendOnce(additions, original, 'نسخه استراحت تمرین', restExercise);
      appendOnce(additions, original, 'نسخه استراحت اقدام', restAction);
      additions.push('انتخاب نسخه سبک یا استراحت شکست محسوب نمی‌شود؛ برای جبران روزهای قبل، کار اضافه نکن.');
      break;
    case 'success':
      appendOnce(additions, original, 'معیار کافی‌بودن امروز', criterion);
      appendOnce(additions, original, 'پرسش بازبینی', reflection);
      additions.push('معیار را به همان مهارت یا مشاهده‌ای محدود نگه دار که برای امروز تعریف شده است؛ احساس بهتر، حذف کامل نشانه یا تغییر رفتار فرد دیگر شرط موفقیت نیست.');
      break;
    case 'stop':
      appendOnce(additions, original, 'شرط توقف اختصاصی امروز', stop);
      appendOnce(additions, original, 'محدودیت‌های کاربرد', contraindications);
      appendOnce(additions, original, 'زمان مناسب دریافت حمایت انسانی', support);
      additions.push('اگر خطر فوری آسیب به خود یا دیگری وجود دارد، تمرین را کنار بگذار و از خدمات اضطراری محل زندگی یا فرد امن کمک فوری بگیر.');
      break;
    case 'no_event':
      additions.push('نبود موقعیت، فرصت یا نمونه واقعی به معنی شکست نیست؛ برای کامل‌کردن برنامه موقعیت تازه ایجاد نکن و رفتار یا گفت‌وگویی را به خودت یا دیگری تحمیل نکن.');
      appendOnce(additions, original, 'نسخه سبک', lightExercise);
      appendOnce(additions, original, 'گزینه استراحت', restExercise || restAction);
      break;
    case 'exercise_action_difference':
      appendOnce(additions, original, 'هدف تمرین', objective);
      appendOnce(additions, original, 'متن تمرین', exercise);
      appendOnce(additions, original, 'اقدام اختصاصی', action);
      appendOnce(additions, original, 'مهارت مشترک', skill);
      additions.push('تمرین برای فهم، مشاهده یا ثبت موضوع است؛ اقدام یک گام عملی جداگانه و اختیاری است. انجام تمرین به معنی تعهد به اجرای اقدام نیست.');
      break;
    case 'not_done':
      additions.push('انجام‌نشدن یا فراموش‌شدن تمرین را به تکلیف جبرانی تبدیل نکن و خودت را سرزنش نکن.');
      appendOnce(additions, original, 'بازگشت کوچک در صورت تمایل', lightExercise);
      appendOnce(additions, original, 'اگر امروز به استراحت نیاز داری', restExercise || restAction);
      break;
    case 'talk_other':
      additions.push('گفت‌وگو با فرد دیگر شرط انجام تمرین نیست. فقط اگر خود متن روز به هماهنگی نیاز دارد و گفت‌وگو امن، داوطلبانه و بدون فشار است، آن را در نظر بگیر؛ در غیر این صورت از بخش خصوصی و در اختیار خودت استفاده کن.');
      appendOnce(additions, original, 'حمایت انسانی در صورت نیاز', support);
      break;
    case 'can_change':
      appendOnce(additions, original, 'هدف اصلی که باید حفظ شود', objective);
      appendOnce(additions, original, 'نسخه سبک برای ساده‌سازی', lightExercise);
      appendOnce(additions, original, 'شرط توقف', stop);
      additions.push('تغییر روش نباید تمرین را سنگین‌تر، ناامن یا خارج از اختیار تو کند. اگر راه امن و متناسبی پیدا نمی‌کنی، توقف انتخاب معتبر است.');
      break;
    case 'duration':
      additions.push(guide.durationMinutes == null
        ? 'مدت استاندارد یا اعتبارسنجی‌شده‌ای برای این تمرین ثبت نشده است؛ بنابراین زمان قطعی اعلام نمی‌کنم.'
        : `زمان ثبت‌شده برای تمرین: ${guide.durationMinutes} دقیقه؛ این عدد تضمین یا الزام نیست.`);
      appendOnce(additions, original, 'تمرین امروز', exercise);
      additions.push('به‌اندازه‌ای ادامه بده که هدف همان روز روشن شود؛ با افزایش فشار یا خستگی می‌توانی زودتر متوقف شوی.');
      break;
    default:
      return answer;
  }

  const detail = additions.filter(Boolean).join('\n\n');
  return detail ? `${original}\n\n${detail}` : original;
}
