import { routeSemanticIntake } from './intentContextRouter.js';

const SAFETY_QUESTION = 'آیا همین الآن خطر فوری، قصد یا برنامه عملی برای آسیب به خودت یا شخص دیگری وجود دارد؟ اگر پاسخ روشن نیست، بگو مطمئن نیستی.';
const SAFETY_HANDOFF = 'راهنمایی تمرین را متوقف می‌کنم. اگر احتمال خطر فوری وجود دارد یا مطمئن نیستی، همین الآن با خدمات اورژانسی محل زندگی یا یک فرد امن و قابل اعتماد تماس بگیر و تنها نمان. این گفت‌وگو جای کمک فوری انسانی را نمی‌گیرد.';
const MAX_CONTEXT_TEXT = 1200;

export function selectDailyExerciseGuidanceData({ guidanceData, data } = {}) {
  if (!guidanceData) return data;
  return {
    ...(data && typeof data === 'object' ? data : {}),
    ...guidanceData,
    exercise: guidanceData.exercise || data?.exercise || data?.instructions || '',
    actionText: guidanceData.action || guidanceData.actionText || data?.actionText || data?.action || '',
    adaptation: guidanceData.adaptation || data?.adaptation || '',
  };
}

function normalize(value) {
  return String(value ?? '').normalize('NFKC')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/[،؛.!؟,]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function classifySafetyReply(message) {
  const value = normalize(message);
  const possibleOrUncertain = /(?:^|[\s،,])(?:بله|آره|اره|دارم)(?:$|[\s،,])|(?:ممکنه|ممکن است|احتمالش هست|مطمئن نیستم|نمی دانم|نمی دونم|شاید|قصد دارم|برنامه دارم|اما|ولی)/u.test(value);
  if (possibleOrUncertain) return 'possible_or_uncertain_danger';

  if (value === 'نه' || value === 'خیر'
      || /(?:خطر فوری ندارم|قصد(?: آسیب)? ندارم|قصدی ندارم|برنامه(?: ای)? ندارم|الان امن هستم|الان در خطر نیستم)/u.test(value)) {
    return 'no_immediate_danger';
  }
  return 'unclear';
}
function boundedState(state = {}) {
  return {
    safetyStatus: ['pending', 'handoff', 'cleared'].includes(state.safetyStatus) ? state.safetyStatus : 'none',
    lastUserMessage: String(state.lastUserMessage || '').slice(0, 400),
    lastAssistantMessage: String(state.lastAssistantMessage || '').slice(0, MAX_CONTEXT_TEXT),
    lastTopic: String(state.lastTopic || '').slice(0, 100),
    contextDay: String(state.contextDay ?? '').slice(0, 20),
    contextTopic: String(state.contextTopic || '').slice(0, 100),
  };
}

function result(response, state, userMessage = '') {
  return {
    response,
    nextState: {
      ...state,
      lastUserMessage: String(userMessage || state.lastUserMessage || '').slice(0, 400),
      lastAssistantMessage: String(response || '').slice(0, MAX_CONTEXT_TEXT),
    },
  };
}

function splitPriorAssistantText(text) {
  return String(text || '').split(/\n\s*\n/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({
      paragraph,
      sentences: (paragraph.match(/[^.!؟?]+[.!؟?]?/gu) || [])
        .map((sentence) => sentence.trim())
        .filter(Boolean),
    }));
}

function ordinalIndex(token, count) {
  const ordinals = new Map([
    ['اول', 0], ['اولین', 0], ['یک', 0], ['1', 0],
    ['دوم', 1], ['دومین', 1], ['دو', 1], ['2', 1],
    ['سوم', 2], ['سومین', 2], ['سه', 2], ['3', 2],
    ['چهارم', 3], ['چهار', 3], ['4', 3],
    ['پنجم', 4], ['پنج', 4], ['5', 4],
    ['ششم', 5], ['شش', 5], ['6', 5],
    ['هفتم', 6], ['هفت', 6], ['7', 6],
    ['هشتم', 7], ['هشت', 7], ['8', 7],
    ['نهم', 8], ['نه', 8], ['9', 8],
    ['دهم', 9], ['ده', 9], ['10', 9],
  ]);
  if (/^(?:آخر|آخرین)$/u.test(token)) return count - 1;
  return ordinals.get(token) ?? -1;
}

const ORDINAL_PATTERN = 'اول|اولین|یک|1|دوم|دومین|دو|2|سوم|سومین|سه|3|چهارم|چهار|4|پنجم|پنج|5|ششم|شش|6|هفتم|هفت|7|هشتم|هشت|8|نهم|نه|9|دهم|ده|10|آخر|آخرین';

function priorTextReference(message, state) {
  const value = normalize(message);
  const blocks = splitPriorAssistantText(state.lastAssistantMessage);
  const sentences = blocks.flatMap((block) => block.sentences);
  const sentenceMatch = value.match(new RegExp('^جمله\\s*(' + ORDINAL_PATTERN + ')(?:\\s+(?:رو|را))?(?:\\s+بگو)?$', 'u'));
  if (sentenceMatch) {
    const index = ordinalIndex(sentenceMatch[1], sentences.length);
    return index >= 0 && sentences[index]
      ? { label: sentenceMatch[1].startsWith('آخر') ? 'جمله آخر' : 'جمله ' + (index + 1), text: sentences[index] }
      : { clarification: 'در پاسخ قبلی به‌اندازه کافی جمله برای این ارجاع وجود ندارد. لطفاً چند کلمه از جمله موردنظرت را بنویس.' };
  }

  const paragraphMatch = value.match(new RegExp('^(?:بند|پاراگراف|قسمت|بخش)\\s*(' + ORDINAL_PATTERN + ')(?:\\s+(?:رو|را))?(?:\\s+بگو)?$', 'u'));
  if (paragraphMatch) {
    const index = ordinalIndex(paragraphMatch[1], blocks.length);
    return index >= 0 && blocks[index]
      ? { label: paragraphMatch[1].startsWith('آخر') ? 'بند آخر' : 'بند ' + (index + 1), text: blocks[index].paragraph }
      : { clarification: 'در پاسخ قبلی چنین بندی وجود ندارد. لطفاً چند کلمه از بخش موردنظرت را بنویس.' };
  }

  if (/^(?:همون|همان)\s+جمله(?:\s+(?:قبلی|رو\s+بگو|را\s+بگو))?$/u.test(value)
      || /^(?:اون|آن)\s+یکی(?:\s+(?:رو\s+بگو|را\s+بگو))?$/u.test(value)) {
    return { clarification: 'منظورت از «همون جمله» یا «اون یکی» دقیقاً کدام جمله است؟ چند کلمه از آن را بنویس یا بگو جمله اول، دوم یا آخر.' };
  }
  return null;
}

function followUpResponse(message, state) {
  const value = normalize(message);
  if (!state.lastAssistantMessage) return null;
  const paragraphs = state.lastAssistantMessage.split(/\n\s*\n/u).map((part) => part.trim()).filter(Boolean);
  let selected = null;
  let label = '';

  const reference = priorTextReference(value, state);
  if (reference?.clarification) return reference.clarification;
  if (reference?.text) {
    return 'این ' + reference.label + ' از پاسخ قبلی است:\n\n«' + reference.text + '»\n\nمی‌خواهی همین بخش را توضیح بدهم یا درباره‌اش مثال بزنم؟';
  }

  if (/(?:خلاصه|کوتاه تر|مختصرتر)/u.test(value)) {
    const exercise = paragraphs.find((part) => /^متن تمرین همین روز:/u.test(part));
    const action = paragraphs.find((part) => /^راهکار اختصاصی همین روز:/u.test(part));
    const summaryParts = [exercise, action].filter(Boolean);
    if (summaryParts.length) {
      return `خلاصه محتوای همان روز، بدون افزودن مطلب تازه:\n\n${summaryParts.join('\n\n')}`;
    }
  }
  if (/^(?:چرا|چطور|یعنی چی|منظورت چیه|مثال بزن|یه مثال بزن|مثالی بزن)[؟?]?$/u.test(value)) {
    if (/مثال/u.test(value)) {
      return 'می‌توانم یک مثال فرضی و غیرشخصی را فقط برای روشن‌شدن یک مرحله توضیح بدهم. کدام جمله یا مرحله از پاسخ قبلی برایت مثال می‌خواهد؟';
    }
    return 'منظورت دلیل یا توضیح کدام جمله از پاسخ قبلی است؟ همان جمله یا چند کلمه‌اش را بنویس تا درباره همان بخش پاسخ بدهم، نه اینکه حدس بزنم.';
  }
  if (/(?:راهکار|اقدام اختصاصی|اقدام امروز)/u.test(value)) {
    selected = paragraphs.find((part) => /^راهکار اختصاصی همین روز:/u.test(part));
    label = 'راهکار اختصاصی';
  } else if (/(?:تمرین|دستورالعمل|مراحل انجام)/u.test(value)) {
    selected = paragraphs.find((part) => /^متن تمرین همین روز:/u.test(part));
    label = 'متن تمرین';
  } else {
    const colloquialOrdinal = value.match(/^(?:همون\s+)?(اولی|دومی|سومی)(?:\s+(?:رو|را|بگو|رو\s+بگو|را\s+بگو))?$/u);
    if (colloquialOrdinal) {
      const index = /اولی/u.test(colloquialOrdinal[1]) ? 0 : /دومی/u.test(colloquialOrdinal[1]) ? 1 : 2;
      const labelled = paragraphs.filter((part) =>
        /^(?:متن تمرین همین روز:|راهکار اختصاصی همین روز:)/u.test(part));
      selected = labelled[index] || null;
      label = index === 0 ? 'بخش اول' : index === 1 ? 'بخش دوم' : 'بخش سوم';
    } else {
      const ordinal = value.match(/(?:قسمت|بخش|مرحله)\s*(اول|یک|1|۱|دوم|دو|2|۲|سوم|سه|3|۳)/u);
      if (ordinal) {
        const number = /اول|یک|1|۱/u.test(ordinal[1]) ? 0 : /دوم|دو|2|۲/u.test(ordinal[1]) ? 1 : 2;
        selected = paragraphs[number];
        label = `بخش ${number + 1}`;
      }
    }
  }

  if (/(?:همون\s+قبلی|همان\s+قبلی|قبلی\s+رو\s+بگو|قبلی\s+را\s+بگو|اون\s+قسمت|آن\s+قسمت|همون\s+بخش|همان\s+بخش|اون\s+یکی|آن\s+یکی)/u.test(value)
      && !/(?:راهکار|اقدام|تمرین|اولی|دومی|سومی)/u.test(value)) {
    return 'منظورت از «قبلی» یا «اون قسمت» دقیقاً کدام مورد است: متن تمرین، راهکار اختصاصی، یا جمله‌ای از توضیح قبلی؟ نمی‌خواهم بخش اشتباهی را به تو نسبت بدهم.';
  }

  if (selected) {
    return `این ${label} از پاسخ قبلی است:\n\n${selected}\n\nاگر هنوز مبهم است، مشخص کن کدام جمله یا واژه‌اش را بیشتر باز کنم.`;
  }
  if (/(?:بیشتر توضیح|واضح تر|روشن تر|متوجه نشدم|نفهمیدم|همین بخش|بیشتر باز کن|منظورم)/u.test(value)) {
    const topic = state.lastTopic ? ` درباره «${state.lastTopic}»` : '';
    return `در ادامه همان گفت‌وگوی قبلی${topic} هستیم. نمی‌خواهم منظور تو را حدس بزنم؛ لطفاً جمله یا واژه‌ای از پاسخ قبلی را که مبهم است عیناً بنویس.`;
  }
  return null;
}


function splitGroundedSentences(value) {
  return String(value || '').split(/(?<=[.!؟?])\s+/u).map((part) => part.trim()).filter(Boolean);
}

function extractQuotedItems(value) {
  return [...String(value || '').matchAll(/«([^»]+)»/gu)].map((match) => match[1].trim()).filter(Boolean);
}

function groundedSection(label, value) {
  const source = String(value || '').trim();
  if (!source) return '';
  const sentences = splitGroundedSentences(source);
  const quoted = extractQuotedItems(source);
  let steps = sentences;
  if (quoted.length >= 2 && /دو ستون|دو پرسش|دو بخش|سه خط|سه بخش/u.test(source)) {
    const firstQuote = source.indexOf('«');
    const lead = firstQuote > 0 ? source.slice(0, firstQuote).trim() : '';
    const prefix = /دو ستون/u.test(source) ? 'ستون ' : /دو پرسش/u.test(source) ? 'پرسش ' : 'بخش ';
    const lastQuoteEnd = source.lastIndexOf('»') + 1;
    const trailing = source.slice(lastQuoteEnd).replace(/^[،؛.：:\\s]+/u, '').trim();
    steps = [
      ...(lead ? [lead] : []),
      ...quoted.map((item, index) => prefix + (index + 1) + ': «' + item + '»'),
      ...(trailing ? splitGroundedSentences(trailing) : []),
    ];
  }
  const notes = [];
  const instructions = [];
  for (const step of steps) {
    if (/^(?:اگر|در صورتی که|چنانچه|لازم نیست|ضرورتی ندارد|در صورت)/u.test(step)) notes.push(step);
    else instructions.push(step);
  }
  const lines = [label + ':'];
  instructions.forEach((step, index) => lines.push('گام ' + (index + 1) + ': ' + step));
  if (notes.length) lines.push('شرط یا یادآوری خود متن:\n' + notes.map((item) => '• ' + item).join('\n'));
  return lines.join('\n');
}

function blankResponseTemplate(exercise) {
  const source = String(exercise || '');
  const quoted = extractQuotedItems(source);
  if (quoted.length >= 2) {
    return 'قالب خالی برای نوشتن پاسخ خودت (نه مثال ساخته‌شده):\n'
      + quoted.map((item, index) => (index + 1) + ') ' + item + ' → [پاسخ خودت]').join('\n');
  }
  const match = source.match(/(?:در سه خط|در سه بخش|دو پرسش|دو سؤال)\s*بنویس\s*[:：]\s*([\s\S]+)/u);
  if (match) {
    const prompts = match[1].split(/[؟?]/u).map((item) => item.trim()).filter(Boolean).slice(0, 5);
    if (prompts.length >= 2) {
      return 'قالب خالی برای نوشتن پاسخ خودت (نه مثال ساخته‌شده):\n'
        + prompts.map((item, index) => (index + 1) + ') ' + item + '؟ → [پاسخ خودت]').join('\n');
    }
  }
  return 'برای ساختن قالب دقیق، لازم است جمله یا مرحله‌ای را که می‌خواهی برایش نمونه ببینی مشخص کنی؛ از خودم موقعیت یا پاسخ شخصی نمی‌سازم.';
}

function hasApprovedDayMetadata(dayData) {
  return dayData?.review_status === 'approved';
}

export function makeDailyExerciseGuidanceTurn({ message, dayData, problem, day, conversationState } = {}) {
  const text = String(message || '').trim();
  let state = boundedState(conversationState);
  const currentTopic = String(problem || 'موضوع انتخاب‌شده').trim().slice(0, 100);
  const currentDay = String(day ?? '').slice(0, 20);
  if ((state.contextDay && state.contextDay !== currentDay)
      || (state.contextTopic && state.contextTopic !== currentTopic)) {
    state = { ...state, lastUserMessage: '', lastAssistantMessage: '', lastTopic: '' };
  }
  state = { ...state, contextDay: currentDay, contextTopic: currentTopic };
  if (!text) return result('پیامت خالی است؛ لطفاً پرسشت را بنویس.', state);

  if (state.safetyStatus === 'handoff') {
    return result(SAFETY_HANDOFF, state, text);
  }

  if (state.safetyStatus === 'pending') {
    const safetyReply = classifySafetyReply(text);
    if (safetyReply === 'possible_or_uncertain_danger') {
      state = { ...state, safetyStatus: 'handoff' };
      return result(SAFETY_HANDOFF, state, text);
    }
    if (safetyReply === 'no_immediate_danger') {
      state = { ...state, safetyStatus: 'cleared' };
      return result('ممنون که روشن کردی. از پاسخ تو برداشت می‌کنم که در همین لحظه خطر فوری یا قصد و برنامه عملی نداری. اگر این وضعیت تغییر کرد، راهنمایی تمرین را متوقف کن و از یک فرد امن یا خدمات فوری کمک بگیر. اگر مایل هستی، حالا می‌توانیم به خود تمرین امروز برگردیم.', state, text);
    }
    return result(`${SAFETY_QUESTION}\n\nاگر مطمئن نیستی، همین را بگو تا به‌جای ادامه تمرین، کمک انسانی را در اولویت بگذاریم.`, state, text);
  }

  if (state.safetyStatus === 'cleared' && /(?:خودکشی|آسیب به خود|خودزنی|آسیب به دیگران|در خطرم|تهدیدم می کند)/u.test(normalize(text))) {
    state = { ...state, safetyStatus: 'pending' };
  }

  const routed = routeSemanticIntake({ text });
  if (routed.safety_handoff.handoff_required) {
    state = { ...state, safetyStatus: 'handoff' };
    return result(SAFETY_HANDOFF, state, text);
  }
  if (routed.next_question?.purpose === 'safety_clarification') {
    state = { ...state, safetyStatus: 'pending' };
    return result(routed.next_question.text || SAFETY_QUESTION, state, text);
  }

  const followUp = followUpResponse(text, state);
  if (followUp) return result(followUp, state, text);

  const normalizedMessage = normalize(text);
  if (/(?:سخت(?:ه| است)?|از پسش برنمی آیم|نمی توانم انجام|نمی تونم انجام|وقت ندارم|فرصت ندارم|یادم رفت|انجام ندادم|نشد انجام)/u.test(normalizedMessage)) {
    return result(
      'لازم نیست خودت را مجبور کنی یا تمرین را خودسرانه تغییر بدهی. برای اینکه درست راهنمایی‌ات کنم، مانع اصلی کدام بود: نامفهوم بودن دستور، کمبود وقت، شدت ناراحتی، یا یک مانع عملی دیگر؟',
      { ...state, lastTopic: currentTopic },
      text,
    );
  }
  if (/(?:انجامش دادم|تمرین را انجام دادم|تمرین رو انجام دادم|تمومش کردم|تمامش کردم|ثبت کردم)/u.test(normalizedMessage)) {
    return result(
      'متوجه شدم که می‌گویی تمرین را انجام داده‌ای. برای اینکه تجربه‌ات را درست دنبال کنم، هنگام انجام آن چه چیزی مشاهده کردی یا چه بخشی برایت برجسته بود؟',
      { ...state, lastTopic: currentTopic },
      text,
    );
  }
  if (/(?:درست انجام دادم|درست انجامش دادم|اشتباه انجام دادم|نمی دانم درست)/u.test(normalizedMessage)) {
    return result(
      'نمی‌خواهم بدون دیدن کاری که انجام داده‌ای قضاوت کنم. لطفاً کوتاه بگو دقیقاً چه مراحلی را انجام دادی تا آن را با متن تمرین همین روز مقایسه کنیم.',
      { ...state, lastTopic: currentTopic },
      text,
    );
  }

  if (routed.next_question?.purpose === 'topic_disambiguation' && routed.topic_candidates.length > 0) {
    return result(routed.next_question.text, { ...state, lastTopic: String(problem || '').slice(0, 100) }, text);
  }


  const exercise = String(dayData?.exercise || dayData?.instructions || '').trim();
  const action = String(dayData?.actionText || dayData?.action || '').trim();
  const topic = String(problem || 'موضوع انتخاب‌شده').trim();
  const normalized = normalize(text);
  const reviewed = hasApprovedDayMetadata(dayData);

  if (!exercise && !action) {
    return result('متن تمرین و راهکار این روز در دسترس نیست؛ نمی‌خواهم چیزی را حدس بزنم. از صفحه روز خارج نشو و بعداً دوباره تلاش کن.', state, text);
  }

  if (/(?:چرا|علت|دلیل)/u.test(normalized)) {
    const rationale = reviewed && String(dayData?.teaching_point || dayData?.learning_objective || '').trim();
    const response = rationale
      ? 'توضیح ثبت‌شده و بازبینی‌شده برای این روز:\n' + rationale
      : 'برای این روز توضیح تأییدشده‌ای درباره چرایی تمرین در داده قابل استفاده دستیار ثبت نشده است. نمی‌خواهم دلیل روان‌شناختی را حدس بزنم. اگر بگویی کدام جمله یا بخش برایت سؤال‌برانگیز است، می‌توانم ساختار و منظور صریح همان متن را روشن‌تر کنم.';
    return result(response, { ...state, lastTopic: topic.slice(0, 100) }, text);
  }

  if (/(?:مثال|نمونه)/u.test(normalized)) {
    return result(blankResponseTemplate(exercise), { ...state, lastTopic: topic.slice(0, 100) }, text);
  }

  if (/(?:چقدر زمان|چند دقیقه|مدت زمان|مدتش چقدر)/u.test(normalized)) {
    const duration = reviewed && Number.isInteger(dayData?.duration_minutes) ? dayData.duration_minutes : null;
    return result(duration
      ? 'مدت ثبت‌شده و بازبینی‌شده برای این روز ' + duration + ' دقیقه است. لازم نیست بیشتر از حد قابل‌تحمل ادامه بدهی.'
      : 'برای این روز مدت زمان تأییدشده‌ای در داده قابل استفاده دستیار وجود ندارد؛ بنابراین عددی تعیین نمی‌کنم. فقط متن اصلی را در حدی که برایت قابل‌تحمل است بخوان و اگر درباره خود دستور ابهام داری همان بخش را بپرس.',
    state, text);
  }

  if (/(?:معیار|درست انجام|موفقیت)/u.test(normalized)) {
    const criterion = reviewed ? String(dayData?.success_criterion || '').trim() : '';
    return result(criterion
      ? 'معیار ثبت‌شده و بازبینی‌شده برای این روز:\n' + criterion
      : 'برای این روز معیار موفقیتِ تأییدشده‌ای در داده قابل استفاده دستیار ثبت نشده است. از روی متن می‌توانیم فقط بررسی کنیم چه چیزی خواسته شده؛ اما معیار تازه‌ای از خودمان نمی‌سازیم.',
    state, text);
  }

  if (/(?:شرایط توقف|کی متوقف|چه وقت متوقف|توقف تمرین)/u.test(normalized)) {
    const conditions = reviewed && Array.isArray(dayData?.stop_conditions) ? dayData.stop_conditions.filter(Boolean) : [];
    return result(conditions.length
      ? 'شرایط توقف ثبت‌شده و بازبینی‌شده برای این روز:\n' + conditions.map((item, index) => (index + 1) + ') ' + item).join('\n')
      : 'شرایط توقف اختصاصی و تأییدشده‌ای برای این روز در داده قابل استفاده دستیار موجود نیست. اگر همین حالا احساس خطر، فشار شدید یا ناایمنی داری، تمرین را ادامه نده و از حمایت انسانی مناسب کمک بگیر.',
    state, text);
  }

  const asksHow = /چطور|چگونه|از کجا|چه جوری|نمی فهمم|متوجه نمی شوم|توضیح|منظور|سخته|سخت است|انجام بدم|انجام دهم|مرحله|گام/u.test(normalized);
  if (asksHow) {
    const parts = [
      'داریم درباره «' + topic + '»، روز ' + day + ' صحبت می‌کنیم.',
      groundedSection('تمرین روز، بر اساس ترتیب متن اصلی', exercise),
      groundedSection('راهکار اختصاصی روز، بر اساس ترتیب متن اصلی', action),
      dayData?.adaptation ? 'تطبیق ثبت‌شده برای امروز:\n' + String(dayData.adaptation) : '',
      'این گام‌ها فقط به بخش‌های موجود در متن اصلی شکسته شده‌اند؛ دستور تازه‌ای به تمرین اضافه نشده است. اگر یکی از گام‌ها مبهم است، شماره آن یا چند کلمه از همان جمله را بفرست تا فقط همان قسمت را باز کنم.',
    ].filter(Boolean);
    return result(parts.join('\n\n'), { ...state, lastTopic: topic.slice(0, 100) }, text);
  }

  const response = [
    'پیامت را در زمینه «' + topic + '»، روز ' + day + ' بررسی کردم.',
    'برای اینکه دقیقاً به محتوای امروز پاسخ بدهم، بگو پرسشت درباره کدام بخش است: فهم متن تمرین، ترتیب گام‌ها، راهکار اختصاصی، دلیل تمرین یا معیار انجام آن؟',
  ].join('\n\n');
  return result(response, { ...state, lastTopic: topic.slice(0, 100) }, text);
}
export function makeDailyExerciseGuidance(options = {}) {
  return makeDailyExerciseGuidanceTurn(options).response;
}
