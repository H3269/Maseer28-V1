const INTERNAL_TOPIC_LABELS = Object.freeze({ T01: 'خشم', T02: 'اضطراب', T03: 'ترس', T04: 'نفرت', T18: 'نفرت از خود' });
const replaceInternalLabels = (value) => String(value || '')
  .replace(/\\bT(?:0[1-4]|18)\\b/g, (id) => INTERNAL_TOPIC_LABELS[id] || id)
  .replace(/«?بسته(?:‌ی| ی)?\\s*(?:T0?[1-4]|T18)?»?/g, 'این موضوع')
  .replace(/این بسته/g, 'این موضوع')
  .replace(/در این بسته/g, 'در این موضوع')
  .replace(/بسته فعلی/g, 'موضوع فعلی');

export function cleanPreparedAssistantTopicText(value, topic) {
  let text = replaceInternalLabels(value);
  if (topic) text = text.replace(/نام موضوع/g, topic);
  return text;
}

export function buildTeacherStylePreparedAnswer({ guide, question, topic, dailyExercise, dailyAction, safetyReminder, steps = {} } = {}) {
  if (!guide || !question || !topic) return null;
  const exercise = String(dailyExercise || guide.exercise || '').trim();
  const action = String(dailyAction || guide.action || '').trim();
  const skill = guide.skill || guide.mechanism || guide.objective || guide.title;
  const intro = 'راهنمای روز ' + String(guide.day).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]) + ' ' + topic + ' — ' + guide.title
    + '\\n\\n**بیاییم ساده و قدم‌به‌قدم پیش برویم.**\\nقرار نیست همه مسئله را یک‌باره حل کنی. امروز فقط روی مهارت «' + skill + '» تمرکز می‌کنیم. این راهنما آموزشی است و جای تشخیص یا درمان تخصصی را نمی‌گیرد.';
  const mechanism = guide.mechanism || guide.objective || 'این تمرین کمک می‌کند تجربه را روشن‌تر ببینی و درباره آن عجولانه نتیجه‌گیری نکنی.';
  const criterion = guide.successCriterion || 'بخش اصلی خواسته‌شده در تمرین، تا حد امن و قابل انجام روشن شده باشد.';
  const stop = guide.stopCondition || 'اگر ناراحتی شدید، احساس ناامنی یا احتمال آسیب پیش آمد، تمرین را متوقف کن و کمک انسانی مناسب بگیر.';
  const light = guide.lightVersion || 'فقط یک بخش کوچک و کم‌فشار از تمرین را انجام بده؛ اگر همین هم دشوار یا ناامن است، مکث کن.';
  const safety = [intro, '**یادآوری ایمنی:** ' + stop, safetyReminder].filter(Boolean).join('\\n\\n');
  const worked = (example, instruction, kind) => {
    const isExercise = kind === 'exercise';
    const step1 = isExercise
      ? '۱) یک نمونه واقعی، کم‌فشار و مرتبط انتخاب کن. لازم نیست سخت‌ترین تجربه را مرور کنی یا موقعیت تازه‌ای بسازی.'
      : '۱) اول بررسی کن آیا موقعیت امن و مناسب است و این کار واقعاً در اختیار خودت قرار دارد.';
    const step2 = isExercise
      ? '۲) مثال را بخوان و ببین کدام بخش آن مهارت امروز را نشان می‌دهد. سپس همان روش را با اطلاعاتی که واقعاً داری انجام بده؛ حدس‌ها را واقعیت ننویس.'
      : '۲) اقدام را به کوچک‌ترین رفتار امن و قابل‌کنترل خودت تبدیل کن. قرار نیست فرد دیگری را مجبور به تغییر کنی.';
    const step3 = isExercise
      ? '۳) فقط همان چیزی را ثبت کن که تمرین خواسته است. اگر پاسخ یا نمونه‌ای نداری، همان را صادقانه بنویس.'
      : '۳) فقط اگر شرایط امن است اجرا کن؛ اگر احتمال خطر، فشار یا تشدید تعارض وجود دارد، انجامش نده.';
    return '**یک مثال فرضی و آموزشی**\\n' + example + '\\n\\n**حالا چطور از آن استفاده کنی؟**\\n' + step1 + '\\n' + step2 + '\\n' + step3
      + '\\n\\n**ارتباط با تمرین امروز:**\\n' + instruction
      + '\\n\\n**از کجا بفهمی کافی است؟**\\n' + criterion
      + '\\n\\nاین مثال نسخه زندگی تو نیست؛ فقط روش را نشان می‌دهد. لازم نیست عین آن را تکرار کنی.';
  };
  let response;
  switch (question.kind) {
    case 'exercise_meaning':
      response = intro + '\\n\\n**معنی ساده تمرین امروز**\\n' + exercise
        + '\\n\\n**چرا این تمرین را انجام می‌دهیم؟**\\n' + mechanism
        + '\\n\\n**قدم‌به‌قدم:**\\n' + (steps.exercise || ('۱) دستور تمرین را یک بار بخوان.\\n۲) یک نمونه کم‌فشار و مرتبط انتخاب کن.\\n۳) خروجی خواسته‌شده را کوتاه ثبت کن و بخش نامعلوم را حدس نزن.'))
        + '\\n\\n**معیار پایان:** ' + criterion
        + '\\n\\nاگر نمونه‌ای پیدا نمی‌کنی، چیزی را به زور ایجاد نکن.\\n\\n' + safety;
      break;
    case 'exercise_example':
      response = intro + '\\n\\n' + worked(guide.exerciseExample || exercise, exercise, 'exercise') + '\\n\\n' + safetyReminder;
      break;
    case 'action_meaning':
      response = intro + '\\n\\n**معنی ساده اقدام اختصاصی امروز**\\n' + action
        + '\\n\\n**چرا این اقدام انتخاب شده؟**\\n' + mechanism
        + '\\n\\n**چطور انجامش بدهی؟**\\n' + (steps.action || ('۱) فقط وقتی موقعیت امن و مناسب است به آن فکر کن.\\n۲) یک گام کوچک و در اختیار خودت انتخاب کن.\\n۳) اگر شرایط مناسب نیست، اقدام را به تعویق بینداز یا انجام نده.'))
        + '\\n\\nاقدام اجباری نیست و قرار نیست رفتار دیگران را کنترل کنی.\\n\\n' + safety;
      break;
    case 'action_example':
      response = intro + '\\n\\n' + worked(guide.actionExample || action, action, 'action') + '\\n\\n' + safetyReminder;
      break;
    case 'light_version':
      response = intro + '\\n\\n**اگر انجام کامل تمرین سخت است**\\n' + light
        + '\\n\\nنسخه سبک یعنی کار را با توان و شرایط امروزت هماهنگ کنی؛ نه اینکه به خودت فشار بیاوری. اگر همین مقدار هم ناراحتت می‌کند یا امن نیست، مکث کن. این شکست نیست.\\n\\n**معیار امروز:** ' + criterion + '\\n\\n' + safetyReminder;
      break;
    case 'success':
      response = intro + '\\n\\n**از کجا بفهمی تمرین را درست انجام داده‌ای؟**\\n' + criterion
        + '\\n\\nموفقیت به معنی حذف کامل احساس یا حل‌شدن همه مشکلات نیست. فقط بررسی کن آیا خروجی مشخص امروز را تا حد امن و ممکن انجام داده‌ای. اگر نه، ببین کدام بخش مبهم بود؛ خودت را سرزنش نکن.\\n\\n' + safetyReminder;
      break;
    case 'stop':
      response = intro + '\\n\\n**چه زمانی باید تمرین را متوقف کنی؟**\\n' + stop
        + '\\n\\nاگر خطر واقعی یا فوری، احساس ناامنی، تشدید شدید ناراحتی یا احتمال آسیب به خودت یا دیگری وجود دارد، تمرین را کنار بگذار. فاصله امن ایجاد کن و از فرد قابل اعتماد یا خدمات اضطراری محل زندگی کمک بگیر. کامل‌کردن تمرین از ایمنی مهم‌تر نیست.\\n\\n' + safetyReminder;
      break;
    case 'no_event':
      response = intro + '\\n\\n**اگر امروز چنین موقعیتی پیش نیامد**\\nلازم نیست برای انجام تمرین، موقعیت دشوار یا ترسناک بسازی یا خودت را در معرض تنش قرار بدهی. اگر مرور یک نمونه قبلی کم‌فشار و امن است، همان را بررسی کن؛ در غیر این صورت نسخه سبک را انتخاب کن یا امروز مکث کن.\\n\\n**نسخه سبک:** ' + light + '\\n\\nنبودن موقعیت به معنی عقب‌ماندن یا شکست نیست.\\n\\n' + safetyReminder;
      break;
    case 'exercise_action_difference':
      response = intro + '\\n\\n**فرق تمرین و اقدام امروز**\\n**تمرین:** ' + exercise
        + '\\n\\nتمرین برای فهمیدن، مشاهده یا ثبت تجربه است.\\n\\n**اقدام اختصاصی:** ' + action
        + '\\n\\nاقدام یک گام عملی در زندگی روزمره است و فقط وقتی شرایط امن و مناسب باشد انجام می‌شود. ممکن است تمرین را انجام بدهی اما اقدام را به زمان دیگری موکول کنی؛ این کاملاً قابل قبول است.\\n\\n' + safetyReminder;
      break;
    case 'not_done':
      response = intro + '\\n\\n**اگر تمرین را انجام ندادی یا فراموش کردی**\\nخودت را سرزنش نکن و چند روز را یک‌جا جبران نکن. اول ببین مانع چه بوده: فراموشی، خستگی، نامفهوم‌بودن دستور یا مناسب‌نبودن شرایط. اگر دلیل، ناراحتی یا ناامنی بوده، مکث تصمیم درستی است.\\n\\n**برای شروع دوباره:** ' + light + '\\n\\nلازم نیست از ابتدا شروع کنی یا به خودت فشار بیاوری.\\n\\n' + safetyReminder;
      break;
    case 'anger_increased':
    case 'anxiety_increased':
    case 'fear_increased':
      response = intro + '\\n\\n**اگر هنگام تمرین فشار یا احساس اصلی بیشتر شد**\\n۱) نوشتن، مرور یا آزمایش را متوقف کن.\\n۲) به محیط امن یا یک فعالیت عادی و خنثی برگرد؛ خودت را مجبور به ادامه نکن.\\n۳) اگر نشانه جسمانی تازه یا شدید داری، آن را خودکار به اضطراب یا ترس نسبت نده و ارزیابی پزشکی مناسب بگیر.\\n۴) اگر احتمال آسیب فوری به خودت یا دیگری وجود دارد، تنها نمان و از فرد امن یا خدمات اضطراری کمک بگیر.\\n\\n**شرط توقف ویژه امروز:** ' + stop + '\\n\\n' + safetyReminder;
      break;
    case 'talk_other':
      response = intro + '\\n\\n**آیا لازم است با فرد دیگری صحبت کنی؟**\\nنه؛ برای انجام بخش نوشتاری یا مشاهده‌ای تمرین، گفت‌وگو با فرد دیگر الزامی نیست. اگر حمایت می‌خواهی، فردی امن و قابل اعتماد را انتخاب کن. در رابطه ناامن یا شرایط همراه با تهدید، خودت را به گفت‌وگوی مستقیم، افشا یا روبه‌روشدن مجبور نکن.\\n\\n' + safetyReminder;
      break;
    case 'can_change':
      response = intro + '\\n\\n**آیا می‌توانی تمرین را تغییر بدهی؟**\\nمی‌توانی زمان یا قالب انجام را ساده‌تر کنی و از نسخه سبک استفاده کنی؛ اما هدف اصلی تمرین و هشدارهای ایمنی را حذف نکن. هیچ تغییری نباید تو را وارد موقعیت ناامن کند.\\n\\n**نسخه سبک:** ' + light + '\\n\\n' + safetyReminder;
      break;
    case 'duration':
      response = intro + '\\n\\n**چقدر زمان لازم است؟**\\nبرای این روز زمان قطعی و تأییدشده‌ای ثبت نشده است؛ بنابراین عددی حدس نمی‌زنم. فقط به‌اندازه‌ای وقت بگذار که دستور روشن شود و فشار زیادی ایجاد نکند. اگر خسته شدی، مکث کن یا نسخه سبک را انتخاب کن.\\n\\n**هدف امروز:** ' + (guide.objective || skill) + '\\n\\n' + safetyReminder;
      break;
    default:
      return null;
  }
  return cleanPreparedAssistantTopicText(response, topic);
}
