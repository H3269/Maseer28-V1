import { routeAssistantTurn } from './assistantTurnEngine.js';
import { answerPageAssistantQuestion, getPageAssistantContext } from './pageAssistantContext.js';
import { answerPageSpecificQuestion } from './pageAssistantPrompts.js';














import { LIBRARY_ASSISTANT_PROMPTS } from './libraryAssistantPrompts.js';
import { makeDailyAssistantTurn } from './dailyAssistantTurn.js';

const PAGE_PREPARED_QUESTIONS = new Set([
  'این صفحه برای چیست؟',
  'اینجا چه کارهایی می‌توانم انجام بدهم؟',
  'چطور به خانه برگردم؟',
  'امکانات برنامه چیست؟',
]);



/**
 * Routes only an explicitly selected prepared question.
 * Non-daily pages answer their fixed help catalogue directly; daily questions
 * retain their existing topic-specific and safety/assessment routing.
 */
export function makePageAssistantTurn({ screen, text, conversationState = null, dailyContext = null, libraryContext = null } = {}) {
  const message = String(text ?? '').trim();
  if (!message) {
    return Object.freeze({ status: 'invalid_input', message: 'پیام خالی است.', knowledge: Object.freeze([]), conversationState: null });
  }
  if (message.length > (screen === 'day' ? 2000 : 3000)) {
    return Object.freeze({ status: 'input_too_long', message: 'پیام بیش از حد طولانی است.', knowledge: Object.freeze([]), conversationState: null });
  }
  const isAllowedPreparedPageQuestion = screen === 'books'
    ? LIBRARY_ASSISTANT_PROMPTS.some((question) => question.value === message) || PAGE_PREPARED_QUESTIONS.has(message)
    : screen === 'day'
      ? true
      : Boolean(answerPageSpecificQuestion({ screen, message }) || PAGE_PREPARED_QUESTIONS.has(message));
  if (!isAllowedPreparedPageQuestion) {
    return Object.freeze({
      status: 'prepared_question_required',
      message: 'این دستیار فقط از فهرست سؤال‌های آماده همین بخش پاسخ می‌دهد.',
      knowledge: Object.freeze([]),
      page_context: screen || null,
      conversationState: null,
    });
  }
  // Non-daily page questions are fixed navigation/help choices. Answer them
  // directly without invoking semantic intake, safety classification,
  // knowledge retrieval, or conversation-state machinery.
  if (screen !== 'day') {
    const pageReply = answerPageSpecificQuestion({ screen, message })
      || answerPageAssistantQuestion({ screen, message, libraryContext });
    const context = getPageAssistantContext(screen);
    return Object.freeze({
      status: pageReply ? 'page_guidance_available' : 'prepared_question_required',
      message: pageReply || 'برای این بخش پاسخ آماده‌ای در دسترس نیست.',
      knowledge: Object.freeze([]),
      page_context: context.screen,
      conversationState: null,
    });
  }
  const inputProbe = routeAssistantTurn({ text: message });
  if (inputProbe.status === 'invalid_input' || inputProbe.status === 'input_too_long') {
    return Object.freeze({ ...inputProbe, conversationState: null });
  }

  return makeDailyAssistantTurn({ message, dailyContext, conversationState, inputProbe });
}
