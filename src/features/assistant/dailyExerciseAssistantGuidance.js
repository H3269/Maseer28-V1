import { routeSemanticIntake } from './intentContextRouter.js';

const SAFETY_QUESTION = 'آیا همین الآن خطر فوری، قصد یا برنامه عملی برای آسیب به خودت یا شخص دیگری وجود دارد؟ اگر پاسخ روشن نیست، بگو مطمئن نیستی.';
const SAFETY_HANDOFF = 'راهنمایی تمرین را متوقف می‌کنم. اگر احتمال خطر فوری وجود دارد یا مطمئن نیستی، همین الآن با خدمات اورژانسی محل زندگی یا یک فرد امن و قابل اعتماد تماس بگیر و تنها نمان. این گفت‌وگو جای کمک فوری انسانی را نمی‌گیرد.';
const MAX_CONTEXT_TEXT = 1200;

export function selectDailyExerciseGuidanceData({ guidanceData, data } = {}) {
  return guidanceData || data;
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
  if (/^(?:نه|خیر)(?:\s|$)/u.test(value)
      || /(?:خطر فوری ندارم|قصدی ندارم|برنامه ای ندارم|برنامه ندارم|الان امن هستم|الان در خطر نیستم)/u.test(value)) {
    return 'no_immediate_danger';
  }
  if (/(?:بله|آره|اره|دارم|ممکنه|ممکن است|احتمالش هست|مطمئن نیستم|نمی دانم|نمی دونم|شاید|قصد دارم|برنامه دارم)/u.test(value)) {
    return 'possible_or_uncertain_danger';
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

function followUpResponse(message, state) {
  const value = normalize(message);
  if (!state.lastAssistantMessage) return null;
  const paragraphs = state.lastAssistantMessage.split(/\n\s*\n/u).map((part) => part.trim()).filter(Boolean);
  let selected = null;
  let label = '';

  if (/(?:راهکار|اقدام اختصاصی|اقدام امروز)/u.test(value)) {
    selected = paragraphs.find((part) => /^راهکار اختصاصی همین روز:/u.test(part));
    label = 'راهکار اختصاصی';
  } else if (/(?:تمرین|دستورالعمل|مراحل انجام)/u.test(value)) {
    selected = paragraphs.find((part) => /^متن تمرین همین روز:/u.test(part));
    label = 'متن تمرین';
  } else {
    const ordinal = value.match(/(?:قسمت|بخش|مرحله)\s*(اول|یک|1|۱|دوم|دو|2|۲|سوم|سه|3|۳)/u);
    if (ordinal) {
      const number = /اول|یک|1|۱/u.test(ordinal[1]) ? 0 : /دوم|دو|2|۲/u.test(ordinal[1]) ? 1 : 2;
      selected = paragraphs[number];
      label = `بخش ${number + 1}`;
    }
  }

  if (selected) {
    return `این ${label} از پاسخ قبلی است:\n\n${selected}\n\nاگر هنوز مبهم است، همان جمله یا واژه را مشخص کن تا دقیق‌تر توضیح بدهم.`;
  }
  if (/(?:بیشتر توضیح|واضح تر|روشن تر|متوجه نشدم|نفهمیدم|همین بخش|بیشتر باز کن|منظورم)/u.test(value)) {
    const topic = state.lastTopic ? ` درباره «${state.lastTopic}»` : '';
    return `در ادامه همان گفت‌وگوی قبلی${topic} هستیم. نمی‌خواهم منظور تو را حدس بزنم؛ لطفاً جمله یا واژه‌ای از پاسخ قبلی را که مبهم است عیناً بنویس.`;
  }
  return null;
}

export function makeDailyExerciseGuidanceTurn({ message, dayData, problem, day, conversationState } = {}) {
  const text = String(message || '').trim();
  let state = boundedState(conversationState);
  const currentTopic = String(problem || 'موضوع انتخاب‌شده').trim().slice(0, 100);
  const currentDay = String(day ?? '').slice(0, 20);
  if ((state.contextDay && state.contextDay !== currentDay)
      || (state.contextTopic && state.contextTopic !== currentTopic)) {
    // Discard stale conversational references, but never clear an active safety state.
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

  // The current day already supplies a topic. Only ask topic disambiguation
  // when the user's message contains multiple actual topic candidates.
  if (routed.next_question?.purpose === 'topic_disambiguation' && routed.topic_candidates.length > 0) {
    return result(routed.next_question.text, { ...state, lastTopic: String(problem || '').slice(0, 100) }, text);
  }

  const exercise = String(dayData?.exercise || dayData?.instructions || '').trim();
  const action = String(dayData?.actionText || dayData?.action || '').trim();
  const topic = String(problem || 'موضوع انتخاب‌شده').trim();
  const asksHow = /چطور|چگونه|از کجا|چه جوری|نمی فهمم|متوجه نمی شوم|توضیح|منظور|سخته|سخت است|انجام بدم|انجام دهم/u.test(text);

  if (!exercise && !action) {
    return result('متن تمرین و راهکار این روز در دسترس نیست؛ نمی‌خواهم چیزی را حدس بزنم. از صفحه روز خارج نشو و بعداً دوباره تلاش کن.', state, text);
  }
  if (asksHow) {
    const response = [
      `داریم درباره «${topic}»، روز ${day} صحبت می‌کنیم.`,
      exercise ? `متن تمرین همین روز: ${exercise}` : '',
      action ? `راهکار اختصاصی همین روز: ${action}` : '',
      'برای اینکه دقیقاً همان چیزی را که لازم داری روشن کنم، لطفاً جمله یا مرحله‌ای از متن بالا را که مبهم است مشخص کن. من نباید بدون فهمیدن بخش مبهم، روش دیگری را جای تمرین اصلی جا بزنم.',
    ].filter(Boolean).join('\n\n');
    return result(response, { ...state, lastTopic: topic.slice(0, 100) }, text);
  }
  const response = [
    `پیامت را در زمینه «${topic}»، روز ${day} بررسی کردم.`,
    'برای اینکه پاسخ دقیقاً به تمرین امروز مربوط باشد، بگو پرسشت درباره کدام بخش است: فهم متن تمرین، مراحل انجام آن، یا منظور راهکار اختصاصی؟',
  ].join('\n\n');
  return result(response, { ...state, lastTopic: topic.slice(0, 100) }, text);
}

export function makeDailyExerciseGuidance(options = {}) {
  return makeDailyExerciseGuidanceTurn(options).response;
}
