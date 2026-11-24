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
  T15: 'اعتمادبه‌نفس پایین',
  T16: 'افکار منفی و نشخوار فکری',
  T17: 'مشکلات رابطه',
  T18: 'نفرت از خود',
  T19: 'خودسرزنشی',
  T20: 'کمال‌گرایی',
  T21: 'اجتناب',
  T22: 'استرس',
  T23: 'احساس بی‌ارزشی',
  T24: 'مشکل در کنترل هیجان',
  T25: 'رنجش و کینه',
  T26: 'شرم',
  T27: 'ترس از قضاوت',
  T28: 'ترس از شکست',
  T29: 'ترس از طرد شدن',
  T30: 'شک و تردید',
  T31: 'کنترل‌گری',
  T32: 'بی‌انگیزگی',
  T33: 'خودانتقادی',
  T34: 'مشکل دیگر',
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
  T15: 'confidence_distress',
  T16: 'rumination_distress',
  T17: 'relationship_distress',
  T18: 'self_hatred_distress',
  T19: 'self_blame_distress',
  T20: 'perfectionism_distress',
  T21: 'avoidance_distress',
  T22: 'stress_distress',
  T23: 'worthlessness_distress',
  T24: 'emotion_regulation_distress',
  T25: 'resentment_distress',
  T26: 'shame_distress',
  T27: 'judgment_fear_distress',
  T28: 'failure_fear_distress',
  T29: 'rejection_fear_distress',
  T30: 'doubt_distress',
  T31: 'control_distress',
  T32: 'demotivation_distress',
  T33: 'self_criticism_distress',
  T34: 'other_topic_distress',
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
    riskLevel: clean(dailyContent?.risk_level),
    controlContext: clean(dailyContent?.control_context),
    controlSubtopicId: Array.isArray(dailyContent?.subtopic_ids) && dailyContent.subtopic_ids.length === 1
      ? clean(dailyContent.subtopic_ids[0]) : '',
  };
}

const EXTENDED_TOPIC_SAFETY_FOCUS = Object.freeze({
  T15: 'مقایسه خود با دیگران و موقعیت‌های تضعیف‌کننده اعتمادبه‌نفس',
  T16: 'چرخه فکرهای تکراری و دشواری جداکردن فکر از واقعیت',
  T17: 'تنش رابطه‌ای، مرزهای شخصی و امکان تعامل امن و دوطرفه',
  T18: 'شدت خودبیزاری و هر فکر یا میل مرتبط با آسیب‌زدن به خود',
  T19: 'شدت خودسرزنشی و امکان تفکیک مسئولیت از تحقیر خود',
  T20: 'فشار معیارهای سخت‌گیرانه و ترس از ناقص‌بودن یا اشتباه',
  T21: 'شدت اجتناب و امن و قابل‌تحمل‌بودن نزدیک‌شدن به موقعیت',
  T22: 'نشانه‌های فشار روانی و جسمی و امکان بازیابی آرامش',
  T23: 'فکرهای بی‌ارزشی و هر نشانه ناامیدی یا خطر برای خود',
  T24: 'شدت هیجان و امکان مکث پیش از انتخاب پاسخ',
  T25: 'شدت رنجش و احتمال تشدید تعارض یا رفتار آسیب‌زا',
  T26: 'شدت شرم و احتمال افشای ناخواسته یا احساس تحقیر',
  T27: 'نگرانی از قضاوت و امنیت موقعیت موردنظر',
  T28: 'ترس از شکست و کوچک، برگشت‌پذیر و کم‌خطر بودن گام انتخابی',
  T29: 'ترس از طرد و متقابل و رضایت‌مندانه بودن ارتباط',
  T30: 'شدت سردرگمی و اینکه بررسی بیشتر اطلاعات تازه‌ای می‌دهد یا نه',
  T31: 'مرز نگرانی با رفتار کنترل‌گرانه و حفظ اختیار همه افراد',
  T32: 'افت انگیزه و متناسب‌بودن انتظار با توان فعلی',
  T33: 'شدت منتقد درونی و تبدیل بازخورد به تحقیر یا تنبیه خود',
  T34: 'نشانه فشار مرتبط با موضوع انتخابی، بدون فرض‌کردن علت یا تشخیص',
});
const requestsInterpersonalContact = (value) => /(?:با|از|به)\s*(?:فرد|شخص|دوست|همکار|عضو خانواده|درمانگر|مشاور|طرف مقابل)|(?:گفت.?وگو|تماس|پیام|درخواست بازخورد|مطرح کن|در میان بگذار|هماهنگ کن)/u.test(clean(value));


function buildObservableSuccessCheck({ exercise, action, topic, day, success, reflection }) {
  if (success) {
    return paragraph(
      'ملاک ثبت‌شده برای روز ' + day + ' در موضوع «' + topic + '» این است: ' + success,
      'همان معیار ثبت‌شده را مبنا قرار بده. برای بررسی‌اش این سه قدم را انجام بده: ۱) ملاک را یک‌بار بخوان. ۲) به کاری که واقعاً در تمرین انجام دادی نگاه کن و یک شاهد مشخص از آن پیدا کن. ۳) بنویس کدام بخش ملاک برآورده شد و کدام بخش هنوز نه؛ لازم نیست نتیجه را بهتر از واقعیت نشان بدهی.',
      'اگر ملاک برآورده نشده، این به معنی شکست تو نیست؛ فقط نشان می‌دهد امروز چه چیزی انجام شده و چه چیزی هنوز نیاز به تمرین یا زمان دارد.',
      'متن تمرین امروز برای مقایسه: ' + exercise,
      reflection && 'برای جمع‌بندی از خودت بپرس: ' + reflection,
    );
  }

  if (/توصیف کن/u.test(exercise) && /بدون برچسب|بدون قضاوت|با واژه.?های خودت/u.test(exercise)) {
    return paragraph(
      'در محتوای روز ' + day + ' برای موضوع «' + topic + '» معیار موفقیت جداگانه‌ای ثبت نشده؛ اما خودِ دستور تمرین روشن می‌کند چه خروجی‌ای باید بسازی.',
      'برای اینکه بدانی درست انجامش داده‌ای، نوشته‌ات را با این سه نشانه بررسی کن: ۱) یک مسئله یا موقعیت مشخص را با واژه‌های خودت توضیح داده‌ای. ۲) به‌جای برچسب‌زدن به خودت یا دیگران، اتفاق یا دشواری را توصیف کرده‌ای. ۳) از تشخیص‌گذاری یا نتیجه‌گیری قطعی که در اطلاعاتت نیست پرهیز کرده‌ای.',
      'اگر نوشته‌ات فقط یک عبارت کلی مثل «همه‌چیز خراب است» است، آن را روشن‌تر کن: دقیقاً چه اتفاقی افتاده، در چه موقعیتی، و چه اثری بر تو گذاشته است؟ فقط همان چیزی را بنویس که واقعاً می‌دانی.',
      'نمونه قالب: «وقتی [موقعیت مشخص] پیش می‌آید، [اتفاق یا دشواری قابل مشاهده] را تجربه می‌کنم و اثرش برایم [اثر واقعی] است.» جای خالی‌ها را با تجربه خودت پر کن؛ لازم نیست از این قالب استفاده کنی اگر با دستور روز سازگار نیست.',
      'تمرین امروز: ' + exercise,
    );
  }

  let checks = [];
  if (/توصیف کن/u.test(exercise)) checks.push('آیا توصیفی روشن و قابل فهم نوشته‌ای، نه فقط یک عنوان کلی؟');
  if (/ثبت کن|یادداشت کن|بنویس/u.test(exercise)) checks.push('آیا همان موردی را که دستور خواسته، واقعاً ثبت کرده‌ای؟');
  if (/شناسایی کن|مشخص کن|تعیین کن|انتخاب کن/u.test(exercise)) checks.push('آیا مورد یا انتخاب خواسته‌شده را مشخص کرده‌ای و آن را با حدس یا قضاوت جایگزین نکرده‌ای؟');
  if (/مقایسه کن|تفکیک کن|جدا کن/u.test(exercise)) checks.push('آیا دو بخش موردنظر را جداگانه نوشته‌ای تا تفاوتشان دیده شود؟');
  if (/برنامه|طراحی کن|گام/u.test(exercise)) checks.push('آیا خروجی برنامه یا گام مشخصی را که دستور خواسته، آماده کرده‌ای؟');
  if (/امتحان کن|اجرا کن|به.?کار ببر/u.test(exercise)) checks.push('آیا همان اقدام را در موقعیت امن و مناسب انجام داده‌ای و نتیجه واقعی را ثبت کرده‌ای؟');
  if (!checks.length) checks.push('آیا خروجی‌ای را که فعل اصلی دستور تمرین می‌خواهد، واقعاً تهیه کرده‌ای؟');
  return paragraph(
    'در محتوای روز ' + day + ' برای موضوع «' + topic + '» معیار موفقیت جداگانه‌ای ثبت نشده؛ پس معیار تازه یا نتیجه درمانی از خودمان نمی‌سازیم.',
    'برای بررسی درست انجام‌شدن، متن تمرین را کنار خروجی خودت بگذار و این موارد را یکی‌یکی کنترل کن: ' + checks.map((item, index) => (['۱', '۲', '۳', '۴', '۵', '۶'][index] || String(index + 1)) + ') ' + item).join(' '),
    'اگر همه موارد مربوط به دستور را انجام داده‌ای، تمرین را مطابق خواسته همان روز انجام داده‌ای؛ حتی اگر هنوز احساس یا مسئله‌ات تغییر نکرده باشد. اگر یک مورد جا مانده، فقط همان بخش را کامل کن؛ لازم نیست کل تمرین را از ابتدا تکرار کنی.',
    'تمرین دقیق امروز: ' + exercise,
    action && 'اقدام جداگانه امروز (که با انجام تمرین یکی نیست): ' + action,
    reflection && 'برای مرور نتیجه از خودت بپرس: ' + reflection,
  );
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
        'بگذار ساده بگویم: در روز ' + day + ' از موضوع «' + topic + '»' + (guide.title ? '، با عنوان «' + guide.title + '»' : '') + '، قرار است این کار را انجام بدهی: ' + exercise,
        objective && 'هدف این کار این است: ' + objective,
        skill && 'مهارتی که با این تمرین روی آن کار می‌کنی: ' + skill,
        mechanism && 'چرا این تمرین انتخاب شده: ' + mechanism,
        clean(plainSteps.exercise),
        'تمرین را به‌ترتیب پیش ببر؛ این مسیر را قدم‌به‌قدم برو: ۱) دستور را یک‌بار کامل بخوان. ۲) فقط همان کاری را که در متن خواسته شده انجام بده. ۳) خروجی یا مشاهده‌ای را که به دست آوردی ثبت کن. اگر تعداد، زمان یا قالب مشخصی تعیین شده، همان را رعایت کن؛ اگر مشخص نشده، عدد یا مرحله تازه‌ای از خودت اضافه نکن.',
        'این تمرین قرار نیست به‌تنهایی تشخیص بدهد چه مشکلی داری یا فوراً همه‌چیز را حل کند؛ هدف امروز همان کاری است که در دستور بالا آمده است.',
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
        'اقدام اختصاصی امروز یعنی آموخته تمرین را، فقط وقتی موقعیت مناسب و امنی وجود دارد، به یک کار عملی تبدیل کنی. در روز ' + day + ' از موضوع «' + topic + '»' + (guide.title ? ' با عنوان «' + guide.title + '»' : '') + ' اقدام تو این است: ' + action,
        skill && 'این اقدام برای تمرین مهارت «' + skill + '» در زندگی روزمره طراحی شده است؛ نتیجه فوری یا تغییر رفتار دیگران را تضمین نمی‌کند.',
        clean(plainSteps.action),
        'برای اجرای آن: ۱) ببین موقعیت مناسب و امنی پیش آمده یا نه. ۲) اگر پیش آمده، همان اقدام نوشته‌شده را انجام بده. ۳) بعد فقط نتیجه‌ای را که واقعاً رخ داده ثبت کن. اگر چنین موقعیتی پیش نیامده، آن را نساز و اقدام را به فرصت مناسب موکول کن.',
        'فرقش با تمرین این است که تمرین، کار یادگیری امروز است؛ اقدام، به‌کارگیری آن در یک موقعیت واقعی و امن است.',
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
        'اگر انجام کامل تمرین امروز دشوار است، خودت را تحت فشار نگذار؛ انتخاب نسخه سبک نشانه شکست نیست. اول ببین آیا برای همین روز نسخه سبک مشخصی نوشته شده است یا نه.',
        light ? 'نسخه سبک تأییدشده روز ' + day + ' این است: ' + light : 'برای تمرین روز ' + day + ' نسخه سبک جداگانه‌ای در محتوای ثبت‌شده وجود ندارد؛ بنابراین من تمرین جایگزین یا کوتاه‌شده‌ای را به‌عنوان نسخه تأییدشده جا نمی‌زنم.',
        progress && 'اگر متن و شرایطت اجازه می‌دهد و هنوز توان داری، گام پیشرفت ثبت‌شده این است: ' + progress,
        rest ? 'اگر امروز آمادگی یا فرصت نداری، گزینه استراحت ثبت‌شده این است: ' + rest : 'اگر انجام تمرین در حال حاضر مناسب یا امن نیست، مکث کن و در فرصت مناسب‌تری به همین روز برگرد.',
        'نکته مهم: بخش حساس یا ایمنی‌محور تمرین را خودسرانه تغییر نده. اگر نمی‌دانی کدام قسمت را می‌توان سبک کرد، همان بخش دشوار را مشخص کن تا دقیق‌تر بررسی شود.',
      );
    case 'success':
      return buildObservableSuccessCheck({ exercise, action, topic, day, success, reflection });
    case 'stop':
      return paragraph(
        'در موضوع «' + topic + '» هر نشانه‌ای از به‌خطر‌افتادن امنیت یا بدترشدن حال روانی، دلیل کافی برای توقف تمرین روز ' + day + ' است. لازم نیست تمرین را به پایان برسانی؛ سلامت و امنیت تو در اولویت است.',
        'تمرین امروز که باید در صورت بروز فشار متوقف شود: ' + exercise,
        stop ? 'محدودیت ثبت‌شده برای روز ' + day + ' در موضوع «' + topic + '»: ' + stop : 'در محتوای روز ' + day + ' شرط توقف اختصاصی جداگانه‌ای ثبت نشده است؛ اگر فشار روانی بیشتر شد، احساس ناایمنی ایجاد شد یا ادامه تمرین آزاردهنده بود، آن را متوقف کن.',
        EXTENDED_TOPIC_SAFETY_FOCUS[guide.topicId] && 'ملاحظه ایمنی اختصاصی این حوزه: ' + EXTENDED_TOPIC_SAFETY_FOCUS[guide.topicId],
        contraindications.length ? 'مواردی که نباید با این تمرین انجام دهی: ' + contraindications.join(' ') : '',
        humanSupport,
        'اگر احساس می‌کنی ممکن است به خودت یا فرد دیگری آسیب فوری برسد، فاصله امن ایجاد کن؛ از موقعیت دور شو، ابزار یا وسیله خطرناک را کنار بگذار و از فرد قابل اعتماد یا خدمات اضطراری محل زندگی کمک فوری بخواه. در وضعیت خطر، تمرین نوشتاری را ادامه نده.',
      );
    case 'no_event':
      return paragraph(
        'اگر در روز ' + day + ' موقعیتی برای تمرین «' + (guide.title || topic) + '» پیش نیامده، این به معنی عقب‌ماندن نیست. عمداً موقعیتی ایجاد نکن و برای انجام تمرین، اتفاق ناراحت‌کننده یا موقعیت دشوار نساز.',
        'الان این سه کار را انجام بده: ۱) بنویس «امروز موقعیت مرتبطی پیش نیامد». ۲) اگر متن تمرین اجازه می‌دهد و مرور یک تجربه قبلی برایت امن و قابل‌تحمل است، از همان نمونه استفاده کن؛ اگر اجازه نمی‌دهد، نمونه نساز. ۳) برای فرصت طبیعی بعدی آماده بمان.',
        rest ? 'گزینه استراحت ثبت‌شده امروز: ' + rest : 'در محتوای امروز نسخه استراحت جداگانه‌ای ثبت نشده؛ اگر نمونه قبلی امن نیست، تمرین را به زمان مناسب‌تری موکول کن.',
        light && 'نسخه سبک ثبت‌شده، اگر با وضعیت امروزت سازگار است: ' + light,
      );
    case 'exercise_action_difference':
      return paragraph(
        'در برنامه روز ' + day + '، تمرین و اقدام دو بخش مرتبط با کارکردهای جداگانه‌اند. تمرین امروز چنین است: ' + exercise,
        'اقدام اختصاصی امروز این است: ' + action,
        'تمرین، کاری است که متن امروز برای یادگیری یا تمرین مشخص کرده؛ اقدام اختصاصی، به‌کارگیری آموخته در یک رفتار یا انتخاب عملی در موقعیت واقعی و امن است. ممکن است تمرین را انجام بدهی اما در همان روز موقعیت مناسبی برای اقدام پیش نیاید؛ نیازی به ساختن موقعیت نیست.',
      );
    case 'not_done':
      return paragraph(
        'اگر تمرین روز ' + day + ' را انجام ندادی یا یادت رفت، چیزی را خراب نکرده‌ای؛ خودت را سرزنش نکن و لازم نیست چند روز را یک‌جا جبران کنی.',
        light ? 'اگر مانع فقط سختی یا کمبود وقت بوده و نسخه سبک برایت امن و مناسب است، از همین نسخه شروع کن: ' + light : 'برای این روز نسخه سبک مشخصی ثبت نشده؛ پس لازم نیست نسخه‌ای را با عجله جایگزین کنی.',
        rest ? 'اگر مانع نبودن موقعیت یا مناسب‌نبودن شرایط بوده، گزینه استراحت ثبت‌شده این است: ' + rest : '',
        'قدم بعدی: ۱) علت انجام‌نشدن را بدون سرزنش در یک جمله ثبت کن. ۲) اگر مانع برطرف شده، همین تمرین روز ' + day + ' را در فرصت مناسب انجام بده. ۳) بعد از آن به روز بعد برو؛ تمرین‌ها را روی هم تلنبار نکن.',
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
    case 'confidence_distress':
    case 'rumination_distress':
    case 'relationship_distress':
    case 'self_hatred_distress':
    case 'self_blame_distress':
    case 'perfectionism_distress':
    case 'avoidance_distress':
    case 'stress_distress':
    case 'worthlessness_distress':
    case 'emotion_regulation_distress':
    case 'resentment_distress':
    case 'shame_distress':
    case 'judgment_fear_distress':
    case 'failure_fear_distress':
    case 'rejection_fear_distress':
    case 'doubt_distress':
    case 'control_distress':
    case 'demotivation_distress':
    case 'self_criticism_distress':
    case 'other_topic_distress':
    case 'distress_increased':
      return paragraph(
        'برای تمرین روز ' + day + ' در موضوع «' + topic + '»، اگر فشار یا ناراحتی‌ات بیشتر شد، همان لحظه مکث کن و تمرین را کنار بگذار. برای یادگیری مهارت امروز لازم نیست ناراحتی را تحمل کنی.',
        'تمرین مشخص همین روز که باید در صورت افزایش فشار متوقف شود: ' + exercise,
        stop ? 'محدودیت ویژه روز ' + day + ' در موضوع «' + topic + '»: ' + stop : 'اگر ادامه تمرین فشار را بیشتر می‌کند یا احساس ناایمنی ایجاد شده، آن را متوقف کن و به فعالیت عادی و محیط امن برگرد.',
        EXTENDED_TOPIC_SAFETY_FOCUS[guide.topicId] && 'نشانه‌هایی که در این موضوع باید جدی بگیری: ' + EXTENDED_TOPIC_SAFETY_FOCUS[guide.topicId],
        humanSupport,
        'اگر امن است از موقعیت یا فعالیتی که فشار را بیشتر کرده فاصله بگیر، نوشتن یا گفت‌وگو را کنار بگذار و به یک کار خنثی و آرام برگرد. اگر احتمال آسیب به خودت یا دیگری وجود دارد، تنها نمان و فوراً از فرد قابل اعتماد یا خدمات اضطراری محل زندگی کمک بگیر.',
        'بعداً فقط در صورت احساس امنیت و آمادگی تصمیم بگیر که تمرین را به شکل سبک‌تر ادامه بدهی یا فعلاً کنار بگذاری.',
      );
    case 'talk_other': {
      const interactionRequired = requestsInterpersonalContact(exercise) || requestsInterpersonalContact(action);
      return paragraph(
        'برای تمرین روز ' + day + ' در موضوع «' + topic + '»، گفت‌وگو با فرد دیگری الزامی نیست، مگر اینکه متن خود تمرین صریحاً تعامل را بخواهد.',
        'اگر دستور امروز نوشتن، مرور یا مشاهده شخصی است، همان تمرین را در حریم خصوصی انجام بده: ' + exercise,
        'اگر متن امروز صریحاً تعامل با فرد دیگری می‌خواهد، فقط در صورت رضایت آزادانه، امکان مخالفت و توقف گفت‌وگو بدون ترس اقدام کن.',
        interactionRequired
          ? 'در متن همین روز به تعامل با فرد دیگری اشاره شده است؛ بخش مربوط به آن را فقط با رعایت شرط‌های بالا و بدون افشای ناخواسته انجام بده: ' + (requestsInterpersonalContact(exercise) ? exercise : action)
          : 'در متن تمرین و اقدام امروز الزام به گفت‌وگو با فرد دیگری ثبت نشده است؛ می‌توانی هر دو بخش را بدون درگیرکردن شخص دیگری انجام بدهی.',
        'اگر تهدید، خشونت، ترس یا احتمال تلافی وجود دارد، گفت‌وگوی مستقیم یا میانجی‌گری مشترک را به خودت تحمیل نکن. فاصله امن و حمایت مستقل مهم‌تر است.',
        'اقدام اختصاصی همین روز: ' + action,
      );
    }
    case 'can_change':
      return paragraph(
        'می‌توانی شکل اجرا را با شرایطت هماهنگ کنی، اما نباید هدف اصلی یا شرط‌های ایمنی تمرین عوض شود. هدف روز ' + day + ' در موضوع «' + topic + '» این است: ' + (objective || specificSkill || exercise),
        light ? 'اگر فقط نسخه ساده‌تر لازم داری، نسخه ثبت‌شده این است: ' + light : 'برای این روز نسخه سبک تأییدشده‌ای ثبت نشده است؛ پس من تغییر محتوایی تازه‌ای را به‌جای نسخه اصلی پیشنهاد نمی‌کنم.',
        'معمولاً می‌توانی زمان یا مکان امن را جابه‌جا کنی، یا تمرین را به فرصت مناسب‌تری موکول کنی؛ اما مواجهه، گفت‌وگو، افشاگری، تماس با فرد دیگر یا بخش ایمنی‌محور را بدون بررسی تغییر نده.',
        'اگر می‌خواهی تغییری بدهی، اول مشخص کن کدام بخش دشوار است و چرا؛ سپس بررسی کن آیا تغییر پیشنهادی هنوز همان هدف را حفظ می‌کند.',
        'متن اصلی تمرین برای مقایسه: ' + exercise,
      );
    case 'duration': {
      const minutes = Number(guide.durationMinutes);
      const durationText = Number.isFinite(minutes) && minutes > 0
        ? 'برای روز ' + day + ' زمان پیشنهادی ثبت‌شده ' + minutes + ' دقیقه است؛ این عدد برآورد برنامه‌ریزی است، نه آزمون سرعت و نه الزام درمانی.'
        : 'در محتوای روز ' + day + ' زمان مشخصی برای این تمرین ثبت نشده است؛ بنابراین دقیقه مشخصی حدس نمی‌زنیم.';
      return paragraph(
        durationText,
        'کار را با خواندن دستور شروع کن و تا وقتی ادامه بده که خروجی اصلی خواسته‌شده آماده شده باشد: ' + exercise,
        light ? 'اگر زمان یا تمرکزت محدود است، نسخه سبک ثبت‌شده را ببین: ' + light : 'اگر خسته یا کم‌تمرکز شدی، مکث کن و در فرصت مناسب برگرد؛ نسخه کوتاه تأییدشده‌ای برای این روز ثبت نشده است.',
        'لازم نیست برای پرکردن زمان تعیین‌شده کاری اضافه کنی. اگر زودتر خروجی تمرین آماده شد، همان کافی است؛ اگر بیشتر طول کشید، ایمنی و کیفیت را فدای ساعت نکن.',
      );
    }
    default:
      return null;
  }
}

export function controlSafetyFrame(guide) {
  if (guide.topicId !== 'T31') return '';
  const expectedContextBySubtopic = {
    'T31-S01': 'self_control_need',
    'T31-S02': 'interpersonal_coercive_control',
    'T31-S03': 'relationship_power_safety',
  };
  const contextIsValid = Boolean(
    expectedContextBySubtopic[guide.controlSubtopicId]
    && expectedContextBySubtopic[guide.controlSubtopicId] === guide.controlContext,
  );
  return paragraph(
    contextIsValid
      ? 'زمینه ثبت‌شده این روز: ' + ({
        self_control_need: 'نیاز به کنترل امور شخصی',
        interpersonal_coercive_control: 'رفتار کنترل‌گرانه بین‌فردی',
        relationship_power_safety: 'ایمنی و قدرت در رابطه',
      }[guide.controlContext]) + '. این دسته‌بندی برای فهم تمرین است و تشخیص قطعی درباره تو یا فرد دیگری نیست.'
      : 'یادداشت صحت محتوا: زمینه اختصاصی کنترل‌گری برای این روز کامل یا سازگار ثبت نشده است؛ بنابراین از روی این پاسخ درباره نوع مسئله نتیجه‌گیری نکن.',
    'مرز ایمنی: این راهنما مجوز محدودکردن، تهدیدکردن، ردیابی، وارسی تلفن یا ارتباطات، آزمودن، تحت فشار گذاشتن یا تصمیم‌گرفتن به‌جای فرد دیگری نیست. هر اقدام بین‌فردی فقط با رضایت آزادانه و امکان واقعی مخالفت یا توقف قابل بررسی است.',
    guide.contraindications?.length
      ? 'موارد منع ثبت‌شده برای همین روز را جدی بگیر: ' + guide.contraindications.join(' ')
      : '',
    guide.whenToSeekHumanSupport
      ? 'زمان مراجعه به حمایت انسانی طبق محتوای همین روز: ' + guide.whenToSeekHumanSupport
      : '',
  );
}

function buildControlRestrictedAnswer(guide, question) {
  const day = guide.day;
  const rest = clean(guide.restVersion);
  const stop = clean(guide.stopCondition);
  const support = clean(guide.whenToSeekHumanSupport);
  const roleSpecific = guide.controlContext === 'relationship_power_safety'
    ? 'اگر تحت کنترل دیگری هستی، مسئول اصلاح رفتار او نیستی؛ فقط در صورت امن‌بودن از مسیر محرمانه و مستقل حمایت بگیر. اگر خودت رفتار کنترل‌گرانه انجام داده‌ای، آن را متوقف کن و برای پاسخ‌گویی از متخصص مستقل کمک بگیر؛ از فرد متأثر برای آرام‌کردنت یا تأیید تغییرت مطالبه نکن.'
    : guide.controlContext === 'interpersonal_coercive_control'
      ? 'اگر رفتار کنترل‌گرانه انجام می‌دهی، وارسی، محدودسازی، تهدید و فشار را متوقف کن و از حمایت مستقل برای تغییر رفتار کمک بگیر. اگر تحت کنترل دیگری هستی، برای تغییر رفتار او مسئول نیستی.'
      : 'تمرکز را فقط بر انتخاب‌ها و رفتارهای خودت نگه دار؛ برای رسیدن به اطمینان، خودت یا فرد دیگری را تحت فشار نگذار.';
  const base = 'در روز ' + day + ' از موضوع «' + guide.topic + '»، سطح خطر ثبت‌شده بالاتر از حالت عادی است. برای اینکه راهنمایی روزانه قطع نشود اما رفتار پرخطر هم پیشنهاد نشود، فعلاً بخش اجراییِ تمرین یا اقدام را که شامل کنترل، محدودسازی، مواجهه یا تعامل پرفشار با فرد دیگری است انجام نده. ' + roleSpecific;
  const privateAlternative = rest
    ? 'گزینه استراحت ثبت‌شده همین روز: ' + rest
    : 'جایگزین کم‌خطر فعلی: بدون تماس، وارسی یا دخالت در رفتار هیچ‌کس، فقط در صورت آرامش و تمایل خودت یک یادداشت خصوصی درباره موقعیت، احساس، نیاز و انتخاب خودت بنویس؛ اگر همین کار هم فشار را بیشتر می‌کند، استراحت کن.';
  switch (question.kind) {
    case 'exercise_meaning':
    case 'exercise_example':
      return paragraph(base, 'عنوان و هدف روز: ' + clean(guide.title, 'تمرین روزانه') + (guide.objective ? '؛ هدف ثبت‌شده: ' + guide.objective : ''), privateAlternative, 'این پاسخ به معنی تأیید اجرای تمرین اصلی در شرایط پرخطر نیست.');
    case 'action_meaning':
    case 'action_example':
      return paragraph(base, 'اقدام بین‌فردی را در این وضعیت اجرا نکن و برای انجام آن موقعیت نساز. فعلاً فقط انتخابی را بررسی کن که در اختیار خودت است و به آزادی یا امنیت فرد دیگری دست نمی‌زند.', privateAlternative);
    case 'light_version':
    case 'no_event':
    case 'not_done':
    case 'can_change':
      return paragraph(base, privateAlternative, 'لازم نیست تمرین را جبران کنی یا چند روز را با هم انجام بدهی. هر تغییری باید کم‌خطر باشد و اختیار دیگران را محدود نکند.');
    case 'success':
    case 'exercise_action_difference':
      return paragraph(base, 'در این روز، موفقیت به معنی کنترل نتیجه یا رفتار فرد دیگری نیست. فقط می‌توانی میزان رعایت مرزها، انتخاب‌های خودت و حفظ امنیت را بررسی کنی؛ نبود تغییر فوری در دیگران شکست تو نیست.', privateAlternative);
    case 'stop':
    case 'control_distress':
      return paragraph(base, 'اگر ترس، تهدید، اجبار، احتمال تلافی، افزایش تنش یا احساس ناامنی وجود دارد، تمرین و اقدام بین‌فردی را متوقف کن. وارد مواجهه مستقیم یا میانجی‌گری مشترک نشو.', stop, support, privateAlternative);
    case 'talk_other':
      return paragraph(base, 'در این وضعیت لازم نیست با فرد دیگری صحبت کنی. اگر احتمال تهدید، اجبار یا تلافی وجود دارد، گفت‌وگوی مستقیم را به خودت تحمیل نکن و حمایت مستقل و امن را در اولویت بگذار.', support, privateAlternative);
    case 'duration':
      return paragraph(base, 'زمانی برای اجرای بخش پرخطر تعیین نکن؛ در این وضعیت اولویت با توقف یا استراحت است، نه تکمیل تمرین.', privateAlternative);
    default:
      return paragraph(base, privateAlternative);
  }
}

export function buildSharedDailyAssistantAnswer({ guide, question, plainSteps } = {}) {
  if (!guide || !Object.hasOwn(DISTRESS_KIND_BY_TOPIC, guide.topicId) || !question) return null;
  const expectedQuestion = getSharedDailyAssistantQuestion(guide.topicId, question.value);
  if (!expectedQuestion || expectedQuestion.kind !== question.kind) return null;
  if (guide.topicId === 'T31' && ['high', 'moderate'].includes(guide.riskLevel)) {
    return buildControlRestrictedAnswer(guide, question);
  }
  const body = answerBody({ guide, question, plainSteps });
  if (!body) return null;
  // The transcript already displays the user's question and the assistant icon.
  // Keep this message limited to the answer body; do not repeat labels or daily summaries.
  const safetyFrame = controlSafetyFrame(guide);
  return safetyFrame ? paragraph(safetyFrame, body) : body;
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
