import SHARED_DAILY_ASSISTANT_EXAMPLES from './sharedDailyAssistantExamples.v1.json' with { type: 'json' };

const TOPIC_NAMES = Object.freeze({
  T01: 'خشم',
  T02: 'اضطراب',
  T03: 'ترس',
  T04: 'نفرت',
  T05: 'حسادت',
  T06: 'غم و سوگ',
  T07: 'احساس گناه',
  T08: 'وابستگی عاطفی',
  T09: 'اهمال‌کاری',
  T10: 'بی‌خوابی و مشکلات خواب',
  T11: 'عادت‌های تکراری',
  T12: 'مرزبندی و نه گفتن',
  T13: 'تنهایی',
  T14: 'کمبود انگیزه',
});

const DISTRESS_KIND_BY_TOPIC = Object.freeze({
  T01: 'anger_increased',
  T02: 'anxiety_increased',
  T03: 'fear_increased',
  T04: 'hostility_increased',
  T05: 'jealousy_increased',
  T06: 'grief_increased',
  T07: 'guilt_increased',
  T08: 'dependency_increased',
  T09: 'procrastination_increased',
  T10: 'sleep_distress',
  T11: 't11_distress',
  T12: 'boundary_distress',
  T13: 'loneliness_increased',
  T14: 'motivation_distress',
});

const QUESTION_DEFINITIONS = Object.freeze([
  { id: 'q01', label: 'منظور از تمرین امروز چیست؟', value: 'منظور از تمرین امروز چیست؟', kind: 'exercise_meaning' },
  { id: 'q02', label: 'برای تمرین امروز یک مثال می‌زنی؟', value: 'برای تمرین امروز یک مثال می‌زنی؟', kind: 'exercise_example' },
  { id: 'q03', label: 'منظور از اقدام اختصاصی امروز چیست؟', value: 'منظور از اقدام اختصاصی امروز چیست؟', kind: 'action_meaning' },
  { id: 'q04', label: 'برای اقدام امروز یک مثال می‌زنی؟', value: 'برای اقدام امروز یک مثال می‌زنی؟', kind: 'action_example' },
  { id: 'q05', label: 'اگر انجام کاملش برایم سخت بود چه کنم؟', value: 'اگر انجام کاملش برایم سخت بود چه کنم؟', kind: 'light_version' },
  { id: 'q06', label: 'از کجا بفهمم درست انجامش داده‌ام؟', value: 'از کجا بفهمم درست انجامش داده‌ام؟', kind: 'success' },
  { id: 'q07', label: 'چه زمانی باید تمرین امروز را متوقف کنم؟', value: 'چه زمانی باید تمرین امروز را متوقف کنم؟', kind: 'stop' },
  { id: 'q08', label: 'اگر امروز نمونه یا آمادگی انجام تمرین را نداشتم چه کنم؟', value: 'اگر امروز نمونه یا آمادگی انجام تمرین را نداشتم چه کنم؟', kind: 'no_event' },
  { id: 'q09', label: 'تمرین و اقدام امروز چه تفاوتی دارند؟', value: 'تمرین و اقدام امروز چه تفاوتی دارند؟', kind: 'exercise_action_difference' },
  { id: 'q10', label: 'اگر تمرین را انجام ندادم یا فراموش کردم چه کنم؟', value: 'اگر تمرین را انجام ندادم یا فراموش کردم چه کنم؟', kind: 'not_done' },
  { id: 'q11', label: 'اگر هنگام تمرین فشار یا ناراحتی‌ام بیشتر شد چه کنم؟', value: 'اگر هنگام تمرین فشار یا ناراحتی‌ام بیشتر شد چه کنم؟', kind: 'distress_increased' },
  { id: 'q12', label: 'آیا لازم است حتماً با فرد دیگری صحبت کنم؟', value: 'آیا لازم است حتماً با فرد دیگری صحبت کنم؟', kind: 'talk_other' },
  { id: 'q13', label: 'می‌توانم تمرین را تغییر بدهم یا به روش خودم انجام بدهم؟', value: 'می‌توانم تمرین را تغییر بدهم یا به روش خودم انجام بدهم؟', kind: 'can_change' },
  { id: 'q14', label: 'این تمرین چقدر زمان می‌برد؟', value: 'این تمرین چقدر زمان می‌برد؟', kind: 'duration' },
]);

// These five topics still inherit generic light/rest text from the base package.
// Do not present those shared fallback strings as topic-specific guidance.
const TOPICS_WITH_UNSCOPED_FALLBACKS = new Set(['T04', 'T05', 'T09', 'T10', 'T13']);

const clean = (value, fallback = '') => String(value ?? fallback).trim();
const paragraph = (...parts) => parts.filter((part) => typeof part === 'string' && part.trim()).join('\n\n');

function toDayNumber(value) {
  const normalized = String(value ?? '').replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 28 ? parsed : null;
}

function questionsForTopic(topicId) {
  if (!Object.hasOwn(DISTRESS_KIND_BY_TOPIC, topicId)) return [];
  return QUESTION_DEFINITIONS.map((question) => Object.freeze({
    ...question,
    kind: question.id === 'q11' ? DISTRESS_KIND_BY_TOPIC[topicId] : question.kind,
  }));
}

export function getSharedDailyAssistantQuestion(topicId, message) {
  const text = String(message ?? '').trim();
  if (!text) return null;
  return questionsForTopic(topicId).find((question) => question.value === text) || null;
}

export function getSharedDailyAssistantPromptGroups(day, topicId) {
  const dayNumber = toDayNumber(day);
  const questions = questionsForTopic(topicId);
  if (!dayNumber || questions.length !== 14) return [];
  return [
    { label: 'فهم تمرین روز ' + dayNumber, questions: questions.slice(0, 2) },
    { label: 'فهم اقدام اختصاصی روز ' + dayNumber, questions: questions.slice(2, 4) },
    { label: 'تفاوت تمرین و اقدام', questions: [questions[8]] },
    { label: 'اجرا و موانع', questions: [questions[4], questions[7], questions[9], questions[12], questions[13]] },
    { label: 'ارزیابی و ایمنی', questions: [questions[5], questions[6], questions[10], questions[11]] },
  ];
}

function extractLabeledLine(source, labels) {
  const accepted = new Set(labels);
  for (const line of String(source || '').split(/\r?\n/u)) {
    const match = line.trim().match(/^([^:：]+)\s*[:：]\s*(.+)$/u);
    if (match && accepted.has(match[1].trim())) return match[2].trim();
  }
  return '';
}

function cleanExample(value) {
  return clean(value).replace(/^(?:نمونه فرضی:\s*){2,}/u, 'نمونه فرضی: ');
}

function listText(value) {
  if (Array.isArray(value)) return value.map((item) => clean(item)).filter(Boolean);
  const single = clean(value);
  return single ? [single] : [];
}

const MIGRATED_EXAMPLES_BY_DAY = new Map(
  (Array.isArray(SHARED_DAILY_ASSISTANT_EXAMPLES.records) ? SHARED_DAILY_ASSISTANT_EXAMPLES.records : [])
    .map((record) => [record.topicId + ':' + record.day, record]),
);

function getMigratedDailyExamples(topicId, day, dailyContent) {
  const record = MIGRATED_EXAMPLES_BY_DAY.get(topicId + ':' + day);
  if (!record) return null;
  // Examples are tied to the exact source exercise/action so an old example
  // can never silently attach to edited or adapted instructions.
  // The page router may pass adapted, user-visible wording to the answer
  // engine. Example provenance must be checked against the untouched
  // canonical source carried alongside that wording, not against the
  // adapted text; otherwise every legitimate adaptation drops its example.
  const exercise = clean(dailyContent?.sourceExercise || dailyContent?.exercise || dailyContent?.instructions);
  const action = clean(dailyContent?.sourceActionText || dailyContent?.actionText || dailyContent?.action);
  if (record.exerciseSource !== exercise || record.actionSource !== action) return null;
  return record;
}

function makeGuideFromDailyContent({ topicId, topicName, day, dailyContent } = {}) {
  const intro = clean(dailyContent?.intro);
  const closing = clean(dailyContent?.closing);
  const exercise = clean(dailyContent?.exercise || dailyContent?.instructions);
  const action = clean(dailyContent?.actionText || dailyContent?.action);
  if (!exercise || !action) return null;

  const migratedExamples = getMigratedDailyExamples(topicId, day, dailyContent);
  const stopConditions = listText(dailyContent?.stop_conditions || dailyContent?.stopConditions);
  const hasTopicScopedFallbacks = !TOPICS_WITH_UNSCOPED_FALLBACKS.has(topicId);
  const lightExercise = clean(dailyContent?.lightVersion || (hasTopicScopedFallbacks ? dailyContent?.lightExerciseText : ''));
  const lightAction = clean(dailyContent?.lightActionVersion || (hasTopicScopedFallbacks ? dailyContent?.lightActionText : ''));
  const progressAction = clean(dailyContent?.progressVersion || (hasTopicScopedFallbacks ? dailyContent?.progressActionText : ''));
  const restExercise = clean(dailyContent?.restVersion || (hasTopicScopedFallbacks ? dailyContent?.restExerciseText : ''));
  const restAction = clean(dailyContent?.restActionVersion || (hasTopicScopedFallbacks ? dailyContent?.restActionText : ''));

  return {
    day,
    topicId,
    topic: topicName,
    title: clean(dailyContent?.title),
    objective: clean(dailyContent?.learning_objective || dailyContent?.objective)
      || extractLabeledLine(intro, ['هدف', 'هدف امروز', 'هدف تمرین']),
    skill: clean(dailyContent?.target_skill || dailyContent?.skill)
      || extractLabeledLine(intro, ['مهارت', 'مهارت امروز', 'مهارت محوری']),
    mechanism: clean(dailyContent?.teaching_point || dailyContent?.mechanism)
      || extractLabeledLine(intro, ['چرایی تمرین', 'سازوکار', 'مکانیسم']),
    exercise,
    action,
    exerciseExample: cleanExample(dailyContent?.exerciseExample || migratedExamples?.exerciseExample),
    actionExample: cleanExample(dailyContent?.actionExample || migratedExamples?.actionExample),
    lightVersion: clean(dailyContent?.lightVersion) || paragraph(
      lightExercise && 'نسخه سبک تمرین: ' + lightExercise,
      lightAction && 'نسخه سبک اقدام: ' + lightAction,
    ),
    progressVersion: clean(dailyContent?.progressVersion) || (progressAction ? 'نسخه پیشرفت اقدام: ' + progressAction : ''),
    restVersion: clean(dailyContent?.restVersion) || paragraph(
      restExercise && 'نسخه استراحت تمرین: ' + restExercise,
      restAction && 'نسخه استراحت اقدام: ' + restAction,
    ),
    successCriterion: clean(dailyContent?.success_criterion || dailyContent?.successCriterion)
      || extractLabeledLine(closing, ['معیار موفقیت', 'معیار امروز']),
    stopCondition: stopConditions.join(' ')
      || clean(dailyContent?.stopCondition || dailyContent?.stop_condition_text)
      || extractLabeledLine(closing, ['شرط توقف', 'شرط توقف امروز', 'شرط توقف/احتیاط']),
    stopConditions,
    contraindications: listText(dailyContent?.contraindications),
    reflectionQuestion: clean(dailyContent?.reflection_prompt || dailyContent?.reflectionQuestion)
      || extractLabeledLine(closing, ['پرسش بازتاب', 'پرسش تأمل', 'پرسش بازبینی']),
    whenToSeekHumanSupport: clean(dailyContent?.when_to_seek_human_support || dailyContent?.whenToSeekHumanSupport),
    durationMinutes: dailyContent?.duration_minutes ?? dailyContent?.durationMinutes ?? null,
    durationStatus: clean(dailyContent?.duration_status || dailyContent?.durationStatus),
  };
}

function answerBody({ guide, question, plainSteps = {} }) {
  const day = guide.day;
  const topic = clean(guide.topic, TOPIC_NAMES[guide.topicId] || 'موضوع انتخاب‌شده');
  const exercise = clean(guide.exercise);
  const action = clean(guide.action);
  const exerciseExample = clean(guide.exerciseExample);
  const actionExample = clean(guide.actionExample);
  const light = clean(guide.lightVersion);
  const success = clean(guide.successCriterion);
  const stop = clean(guide.stopCondition);
  const rest = clean(guide.restVersion);
  const progress = clean(guide.progressVersion);
  const objective = clean(guide.objective);
  const skill = clean(guide.skill);
  const specificSkill = skill || (guide.title && !/^نقشه شروع/u.test(clean(guide.title)) ? clean(guide.title) : '');
  const mechanism = clean(guide.mechanism);
  const reflection = clean(guide.reflectionQuestion);
  const humanSupport = clean(guide.whenToSeekHumanSupport);
  const contraindications = listText(guide.contraindications);

  switch (question.kind) {
    case 'exercise_meaning':
      return paragraph(
        objective
          ? 'در روز ' + day + '، تمرین با عنوان «' + (guide.title || specificSkill || topic) + '» بر ' + (specificSkill ? 'مهارت «' + specificSkill + '»' : 'موضوع «' + topic + '»') + ' متمرکز است. به‌جای نتیجه‌گیری کلی، دستور همان روز را بررسی می‌کنی. هدف این روز این است: ' + objective
          : specificSkill
            ? 'در روز ' + day + '، تمرین تو بر مهارت «' + specificSkill + '» متمرکز است. متن تمرین مشخص می‌کند امروز چه چیزی را بررسی یا ثبت کنی.'
            : 'در روز ' + day + '، تمرین مربوط به «' + topic + '» بر اساس دستور ثبت‌شده پیش می‌رود؛ لازم نیست هدف یا معنای دیگری به آن نسبت بدهی.',
        skill && 'مهارتی که امروز تقویتش می‌کنی این است: ' + skill,
        mechanism,
        'برای انجامش این مسیر را قدم‌به‌قدم برو: ' + exercise,
        clean(plainSteps.exercise),
        'تمرین را به‌ترتیب پیش ببر و فقط همان مواردی را ثبت کن که در دستور تمرین آمده است. تعداد نمونه‌ها را هم بیشتر یا کمتر نکن. نوشته‌ات لازم نیست طولانی یا بی‌نقص باشد؛ کافی است مشاهده واقعی را از حدس، قضاوت و موارد نامعلوم جدا کنی.',
      );
    case 'exercise_example':
      return exerciseExample
        ? paragraph(
          'برای ملموس‌تر شدن تمرین روز ' + day + (guide.title ? ' با عنوان «' + guide.title + '»' : '') + '، این موقعیت فرضی را در نظر بگیر:',
          exerciseExample,
          objective
            ? 'حالا همین منطق را روی یک نمونه کم‌فشار از زندگی خودت امتحان کن. اگر موقعیتت دقیقاً شبیه این مثال نیست، اشکالی ندارد؛ بخش مهم تمرین همان است: ' + objective
            : 'حالا فقط ساختار مثال را با دستور تمرین امروز مقایسه کن؛ لازم نیست موقعیتی شبیه آن برای خودت ایجاد کنی.',
          'این فقط یک مثال برای فهمیدن روش است؛ لازم نیست عمداً چنین موقعیتی ایجاد کنی یا خودت را وارد بحث کنی.',
        )
        : paragraph(
          'برای تمرین روز ' + day + ' مثال فرضی جداگانه‌ای در محتوای ثبت‌شده وجود ندارد. نمی‌خواهم موقعیت ساختگی بسازم یا تجربه‌ای را به تو نسبت بدهم.',
          'متن دقیق تمرین روز ' + day + ' این است: ' + exercise,
          'اگر بخشی از دستور تمرین روز ' + day + ' برایت مبهم است، همان جمله را مشخص کن تا فقط قالب همان بخش را روشن کنیم.',
        );
    case 'action_meaning':
      return paragraph(
        'اقدام اختصاصی امروز، آموخته تمرین را به یک رفتار کوچک و عملی پیوند می‌دهد. در روز ' + day + ' ' + (specificSkill ? 'مهارت «' + specificSkill + '» را' : 'موضوع «' + topic + '» را') + ' به این شکل در انتخاب‌های روزمره به کار می‌گیری:',
        skill && 'این اقدام به تقویت مهارت «' + skill + '» کمک می‌کند؛ قرار نیست نتیجه فوری یا تغییر رفتار دیگران را تضمین کند.',
        action,
        clean(plainSteps.action),
        'تمرین به تو فرصت می‌دهد موضوع را بررسی کنی؛ اقدام یعنی اگر موقعیت مناسب و امنی پیش آمد، یک رفتار مشخص را انتخاب کنی. انجام اقدام اجباری نیست و قرار نیست برای انجامش موقعیت بسازی.',
      );
    case 'action_example':
      return actionExample
        ? paragraph(
          'یک نمونه فرضی از اقدام روز ' + day + ' را ببین. هدف این مثال فقط روشن‌کردن شیوه انجام اقدام امروز است:',
          actionExample,
          'در مثال، اقدام امروز به شکلی مشخص و قابل مشاهده اجرا می‌شود. اگر شرایط تو متفاوت است، اصل اقدام را نگه دار و شکل امن و متناسب با شرایط خودت را انتخاب کن.',
          'اگر شرایط زندگی تو شبیه این نمونه نیست یا گفتن یا انجام‌دادن آن امن نیست، آن را اجرا نکن؛ اقدام امروز فقط در موقعیت امن و با رضایت آزادانه مطرح است.',
        )
        : paragraph(
          'برای اقدام اختصاصی روز ' + day + ' مثال فرضی جداگانه‌ای در محتوای ثبت‌شده وجود ندارد. نمی‌خواهم موقعیت یا رفتار دیگری را حدس بزنم.',
          'متن دقیق اقدام اختصاصی روز ' + day + ' این است: ' + action,
          'اگر بخشی از اقدام روز ' + day + ' برایت مبهم است، همان بخش را مشخص کن تا بدون ساختن سناریوی تازه توضیحش بدهیم.',
        );
    case 'light_version':
      return paragraph(
        'اگر نسخه کامل تمرین با توان یا شرایط امروزت سازگار نیست، خودت را تحت فشار نگذار. نسخه سبک کمک می‌کند با فشار کمتر ارتباطت را با مسیر حفظ کنی؛ این انتخاب نشانه شکست نیست.',
        light ? 'نسخه سبک مخصوص روز ' + day + ' این است: ' + light : 'برای تمرین روز ' + day + ' نسخه سبک جداگانه‌ای در محتوای ثبت‌شده وجود ندارد؛ لازم نیست خودت نسخه تازه‌ای بسازی یا تمرین را به خودت تحمیل کنی.',
        progress && 'اگر آمادگی بیشتری داری، فقط در حدی که امن و طبیعی است می‌توانی این گام را هم در نظر بگیری: ' + progress,
        rest ? 'و اگر امروز زمان یا آمادگی نداری: ' + rest : 'اگر امروز آمادگی نداری، تمرین را به زمان مناسب‌تری موکول کن.',
      );
    case 'success':
      return paragraph(
        success
          ? 'برای سنجش تمرین روز ' + day + '، به‌جای انتظار برای تغییر بزرگ یا برطرف‌شدن کامل مسئله، این معیار روشن را بررسی کن: ' + success
          : 'در محتوای روز ' + day + ' معیار موفقیت جداگانه‌ای ثبت نشده است؛ بنابراین نمی‌خواهم معیار تازه‌ای بسازم. خروجی مشخصی را که خود تمرین خواسته ثبت کن: ' + exercise,
        success
          ? 'به زبان ساده، اگر توانستی بخش اصلی ' + (specificSkill ? 'تمرین «' + specificSkill + '»' : 'تمرین امروز') + ' را در یک نمونه تشخیص بدهی یا ثبت کنی، به اندازه لازم پیش رفته‌ای. لازم نیست احساس یا شرایط مربوط به موضوع کاملاً تغییر کند.'
          : 'انجام یا انجام‌نشدن تمرین را صادقانه ثبت کن؛ نتیجه را بزرگ‌تر از چیزی که واقعاً مشاهده کرده‌ای توصیف نکن.',
        reflection && 'برای مرور کوتاه از خودت بپرس: ' + reflection,
        'اگر بخشی مبهم مانده، همان قسمت را دوباره با یک مثال ساده بررسی کن؛ خودت را بابت کامل‌نبودن سرزنش نکن.',
      );
    case 'stop':
      return paragraph(
        'هر نشانه‌ای از به‌خطر‌افتادن امنیت یا بدترشدن حال روانی، دلیل کافی برای توقف است. لازم نیست تمرین را به پایان برسانی؛ سلامت و امنیت تو در اولویت است.',
        stop ? 'برای روز ' + day + ' به این محدودیت توجه کن: ' + stop : 'در محتوای روز ' + day + ' شرط توقف اختصاصی جداگانه‌ای ثبت نشده است؛ اگر فشار روانی بیشتر شد، احساس ناایمنی ایجاد شد یا ادامه تمرین آزاردهنده بود، آن را متوقف کن.',
        contraindications.length ? 'مواردی که نباید با این تمرین انجام دهی: ' + contraindications.join(' ') : '',
        humanSupport,
        'اگر احساس می‌کنی ممکن است به خودت یا فرد دیگری آسیب فوری برسد، فاصله امن ایجاد کن؛ از موقعیت دور شو، ابزار یا وسیله خطرناک را کنار بگذار و از فرد قابل اعتماد یا خدمات اضطراری محل زندگی کمک فوری بخواه. در وضعیت خطر، تمرین نوشتاری را ادامه نده.',
      );
    case 'no_event':
      return paragraph(
        'اگر امروز موقعیتی برای ' + (guide.title ? 'تمرین «' + guide.title + '»' : 'تمرین روز ' + day) + ' پیش نیامده، منتظر اتفاق ناخوشایند نمان و عمداً موقعیتی ایجاد نکن. همین نبودن موقعیت را ثبت کن؛ لازم نیست برای انجام تمرین اتفاقی بسازی.',
        rest ? 'اگر مرور یک تجربه قبلی برایت امن و قابل‌تحمل است، می‌توانی از نسخه استراحت امروز استفاده کنی: ' + rest : 'اگر مرور تجربه قبلی امن یا قابل‌تحمل نیست، تمرین را به زمان دیگری موکول کن.',
        light && 'اگر فقط می‌خواهی ارتباطت با مسیر حفظ شود، همین نسخه کوتاه کافی است: ' + light,
      );
    case 'exercise_action_difference':
      return paragraph(
        'در برنامه روز ' + day + '، تمرین و اقدام دو بخش مرتبط با کارکردهای جداگانه‌اند. تمرین امروز چنین است: ' + exercise,
        'اقدام اختصاصی امروز این است: ' + action,
        'تمرین به ' + (specificSkill ? 'شناخت و مشاهده مهارت «' + specificSkill + '»' : 'مشاهده و بررسی موضوع') + ' کمک می‌کند؛ اقدام، انتخاب رفتاری کوچک در یک موقعیت واقعی و امن است. بنابراین ممکن است تمرین را انجام بدهی، اما در همان روز فرصتی مناسب برای اقدام پیدا نشود. این موضوع طبیعی است و نیازی به ساختن موقعیت ندارد.',
      );
    case 'not_done':
      return paragraph(
        'اگر تمرین روز ' + day + ' را انجام ندادی یا فراموش کردی، این موضوع به معنی شکست نیست. خودت را سرزنش نکن و برای جبران یک روز، چند روز را یک‌جا انجام نده؛ هر زمان آماده بودی از همین مرحله ادامه بده.',
        light ? 'اگر کمبود وقت یا دشواری تمرین مانع شده، می‌توانی با نسخه کوتاه روز ' + day + ' شروع کنی: ' + light : '',
        rest ? 'اگر موقعیت مناسبی وجود نداشته یا شرایط امن نبوده، فعلاً این گزینه را انتخاب کن: ' + rest : '',
        'وقتی آماده بودی، به مسیر عادی برگرد. هدف، یادگیری تدریجی است نه انجام بی‌وقفه و اجباری همه تمرین‌ها.',
      );
    case 'anger_increased':
    case 'anxiety_increased':
    case 'fear_increased':
    case 'hostility_increased':
    case 'jealousy_increased':
    case 'grief_increased':
    case 'guilt_increased':
    case 'dependency_increased':
    case 'procrastination_increased':
    case 'sleep_distress':
    case 't11_distress':
    case 'boundary_distress':
    case 'loneliness_increased':
    case 'motivation_distress':
    case 'distress_increased':
      return paragraph(
        'برای تمرین روز ' + day + ' در موضوع «' + topic + '»، اگر فشار یا ناراحتی‌ات بیشتر شد، همان لحظه مکث کن و تمرین را کنار بگذار. برای یادگیری مهارت امروز لازم نیست ناراحتی را تحمل کنی.',
        stop ? 'محدودیت ویژه روز ' + day + ' این است: ' + stop : 'اگر ادامه تمرین فشار را بیشتر می‌کند یا احساس ناایمنی ایجاد شده، آن را متوقف کن و به فعالیت عادی و محیط امن برگرد.',
        humanSupport,
        'اگر امن است از موقعیت یا فعالیتی که فشار را بیشتر کرده فاصله بگیر، نوشتن یا گفت‌وگو را کنار بگذار و به یک کار خنثی و آرام برگرد. اگر احتمال آسیب به خودت یا دیگری وجود دارد، تنها نمان و فوراً از فرد قابل اعتماد یا خدمات اضطراری محل زندگی کمک بگیر.',
        'بعداً فقط در صورت احساس امنیت و آمادگی تصمیم بگیر که تمرین را به شکل سبک‌تر ادامه بدهی یا فعلاً کنار بگذاری.',
      );
    case 'talk_other':
      return paragraph(
        'برای انجام تمرین روز ' + day + '، گفت‌وگو با فرد دیگری الزامی نیست. بخش اصلی را می‌توانی به‌تنهایی و در فضای خصوصی انجام بدهی: ' + exercise,
        'اگر اقدام امروز به تعامل با شخص دیگری مربوط می‌شود، فقط وقتی آن را در نظر بگیر که هر دو نفر آزادانه رضایت داشته باشند، بتوانند مخالفت کنند و بدون ترس گفت‌وگو را متوقف کنند.',
        'اگر تهدید، خشونت، ترس یا احتمال تلافی وجود دارد، گفت‌وگوی مستقیم یا میانجی‌گری مشترک را به خودت تحمیل نکن. فاصله امن و حمایت مستقل مهم‌تر است.',
      );
    case 'can_change':
      return paragraph(
        'بله؛ شیوه اجرای تمرین روز ' + day + ' می‌تواند با شرایط تو هماهنگ شود، به شرط آنکه ' + (specificSkill ? 'هدف اصلی یعنی مهارت «' + specificSkill + '»' : 'دستور اصلی تمرین') + ' و محدودیت‌های ایمنی حفظ شود.',
        light ? 'نسخه کوتاه‌تر و ساده‌ترش این است: ' + light : 'اگر انجام کامل تمرین دشوار است، آن را متوقف کن یا به زمان مناسب‌تری موکول کن؛ نسخه تازه‌ای را بدون بررسی هدف تمرین نساز.',
        objective && 'هدف اصلی این روز این است: ' + objective,
        'هیچ تغییری نباید تو را مجبور کند وارد موقعیت ناامن شوی، با کسی روبه‌رو شوی یا چیزی را که نمی‌خواهی افشا کنی.',
      );
    case 'duration': {
      const minutes = Number(guide.durationMinutes);
      const durationText = Number.isFinite(minutes) && minutes > 0
        ? 'در محتوای روز ' + day + ' مدت ' + minutes + ' دقیقه ثبت شده است. این زمان فقط برآورد برنامه‌ریزی است و الزام یا زمان استاندارد درمانی محسوب نمی‌شود.'
        : 'در محتوای روز ' + day + ' زمان مشخصی برای این تمرین ثبت نشده است؛ بنابراین بهتر است عددی نسازیم یا تو را به مدت‌زمانی ساختگی متعهد نکنیم.';
      return paragraph(
        durationText,
        'به‌اندازه‌ای ادامه بده که بخش اصلی ' + (specificSkill ? '«' + specificSkill + '»' : 'تمرین امروز') + ' را بفهمی و انجام دهی. اگر وقت یا تمرکز کافی نداری، نسخه سبک همین روز را انتخاب کن: ' + (light || 'امروز مکث کن و در زمان مناسب‌تری ادامه بده.'),
        'هر وقت خسته شدی می‌توانی مکث کنی. کیفیت فهم و رعایت ایمنی مهم‌تر از مدت‌زمان یا کامل‌کردن همه جزئیات است.',
      );
    }
    default:
      return null;
  }
}

export function buildSharedDailyAssistantAnswer({ guide, question, plainSteps } = {}) {
  if (!guide || !Object.hasOwn(DISTRESS_KIND_BY_TOPIC, guide.topicId) || !question) return null;
  const expectedQuestion = getSharedDailyAssistantQuestion(guide.topicId, question.value);
  if (!expectedQuestion || expectedQuestion.kind !== question.kind) return null;
  const body = answerBody({ guide, question, plainSteps });
  if (!body) return null;
  // The transcript already displays the user's question and the assistant icon.
  // Keep this message limited to the answer body; do not repeat labels or daily summaries.
  return body;
}

export function buildSharedDailyAssistantAnswerFromDailyContent({
  topicId,
  topicName = TOPIC_NAMES[topicId],
  day,
  message,
  dailyContent,
  plainSteps = {},
} = {}) {
  const dayNumber = toDayNumber(day);
  if (!dayNumber || !Object.hasOwn(DISTRESS_KIND_BY_TOPIC, topicId) || !topicName
    || !dailyContent || typeof dailyContent !== 'object') return null;
  if (dailyContent.day != null && Number(dailyContent.day) !== dayNumber) return null;
  if (dailyContent.topic_id && dailyContent.topic_id !== topicId) return null;

  const canonicalId = topicName + '-' + String(dayNumber).padStart(2, '0');
  const legacyId = topicId + '-D' + String(dayNumber).padStart(2, '0');
  if (dailyContent.id && dailyContent.id !== canonicalId
    && !(dailyContent.id === legacyId && dailyContent.topic_id === topicId)) return null;
  if (!dailyContent.id && dailyContent.topic_id !== topicId) return null;

  const question = getSharedDailyAssistantQuestion(topicId, message);
  if (!question) return null;
  const guide = makeGuideFromDailyContent({ topicId, topicName, day: dayNumber, dailyContent });
  if (!guide) return null;
  return buildSharedDailyAssistantAnswer({ guide, question, plainSteps });
}

export const SHARED_DAILY_ASSISTANT_TOPIC_NAMES = TOPIC_NAMES;
export const SHARED_DAILY_ASSISTANT_DISTRESS_KINDS = DISTRESS_KIND_BY_TOPIC;
