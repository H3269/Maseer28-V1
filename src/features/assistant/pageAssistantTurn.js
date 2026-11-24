import { routeAssistantTurn } from './assistantTurnEngine.js';
import { cleanPreparedAssistantTopicText } from './teacherStylePreparedAnswer.js';
import { answerPageAssistantQuestion, getPageAssistantContext } from './pageAssistantContext.js';
import { answerPageSpecificQuestion } from './pageAssistantPrompts.js';
import { makeDailyExerciseGuidanceTurn, selectDailyExerciseGuidanceData } from './dailyExerciseAssistantGuidance.js';
import { getRelationshipSafetyGate } from '../journey/relationshipSafetyGate.js';














import { buildPreparedDailyAssistantAnswer } from './preparedDailyAssistantAnswer.js';
import { getDailySafetyMode } from '../content/dailySafety.js';
import { LIBRARY_ASSISTANT_PROMPTS } from './libraryAssistantPrompts.js';
import { resolveDailyAssistantContext } from './dailyAssistantContext.js';

const SAFETY_STATUSES = new Set([
  'urgent_human_support_required',
  'safety_clarification_required',
]);

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
  if ((screen !== 'day' && SAFETY_STATUSES.has(inputProbe.status))
    || inputProbe.status === 'invalid_input'
    || inputProbe.status === 'input_too_long') {
    return Object.freeze({ ...inputProbe, conversationState: null });
  }

  if (screen === 'day') {
    if (message.length > 2000) {
      return Object.freeze({ status: 'input_too_long', message: 'پیام بیش از حد طولانی است؛ لطفاً آن را کوتاه‌تر کن.', knowledge: Object.freeze([]), conversationState: null });
    }

    // Daily assistants answer only the shared fourteen-question catalogue.
    // Validate canonical topic/day identity before answering; safety routing
    // remains available and takes precedence over every prepared question.
    const resolvedDailyContext = resolveDailyAssistantContext(dailyContext);
    const preparedDay = resolvedDailyContext.day;
    const preparedSource = resolvedDailyContext.source;
    const preparedVisibleContent = resolvedDailyContext.visibleContent;
    const preparedTopicId = resolvedDailyContext.topicId;
    const visibleTopicName = resolvedDailyContext.topicName;
    const hasSupportedPreparedTopic = resolvedDailyContext.supportedTopic;

    const answerPreparedQuestion = ({ day, message, dailyContent }) => buildPreparedDailyAssistantAnswer({
      topicId: preparedTopicId,
      topicName: visibleTopicName,
      day,
      message,
      dailyContent,
    });

    const hasCanonicalPreparedIdentity = resolvedDailyContext.canonicalIdentity;

    const hasPendingSafetyExchange = ['pending', 'handoff'].includes(conversationState?.dailyState?.safetyStatus);
    const isExtendedTopic = /^T(?:1[5-9]|2[0-9]|3[0-4])$/u.test(preparedTopicId || '');
    // Safety classification is a property of the daily record, not of a topic
    // range. Apply the same block to every prepared topic so legacy topics cannot
    // bypass risk_level and topic-specific safety rules.
    const blockedTopicSafetyMode = getDailySafetyMode(preparedSource);
    const hasExactBlockedTopicPreparedQuestion = Boolean(
      answerPreparedQuestion?.({ day: preparedDay, message, dailyContent: preparedVisibleContent }),
    );
    if (blockedTopicSafetyMode === 'blocked' && hasExactBlockedTopicPreparedQuestion) {
      return Object.freeze({
        status: 'daily_guidance_unavailable',
        message: 'به‌دلیل سطح خطر ثبت‌شده برای این روز، ارائه پاسخ تمرینی در این وضعیت ایمن نیست. اگر خطر فوری وجود دارد، از کمک انسانی و خدمات اورژانسی محل زندگی استفاده کن.',
        knowledge: Object.freeze([]),
        conversationState: null,
      });
    }
    const hasExplicitSafetyHandoff = inputProbe.intake?.safety_handoff?.handoff_required === true;
    const hasExactJealousyPreparedQuestion = preparedTopicId === 'T05'
      && Boolean(answerPreparedQuestion?.({ day: preparedDay, message, dailyContent: preparedVisibleContent }));
    const jealousyRelationshipGate = preparedTopicId === 'T05' ? getRelationshipSafetyGate(preparedSource) : null;
    if (jealousyRelationshipGate
      && hasExactJealousyPreparedQuestion
      && !hasPendingSafetyExchange
      && !hasExplicitSafetyHandoff
      && dailyContext?.relationshipSafetyConfirmed !== true) {
      return Object.freeze({
        status: dailyContext?.relationshipSafetyResponse === 'unsafe'
          ? 'relationship_safety_blocked'
          : 'relationship_safety_confirmation_required',
        message: dailyContext?.relationshipSafetyResponse === 'unsafe'
          ? jealousyRelationshipGate.blockedMessage
          : jealousyRelationshipGate.question + '\n\n' + jealousyRelationshipGate.disclaimer,
        knowledge: Object.freeze([]),
        page_context: 'day',
        conversationState: null,
      });
    }

    const hasExactGriefPreparedQuestion = preparedTopicId === 'T06'
      && Boolean(answerPreparedQuestion?.({ day: preparedDay, message, dailyContent: preparedVisibleContent }));
    const griefRelationshipGate = preparedTopicId === 'T06' ? getRelationshipSafetyGate(preparedSource) : null;
    const emotionalDependencyRelationshipGate = preparedTopicId === 'T08' ? getRelationshipSafetyGate(preparedSource) : null;
    const t12RelationshipGate = preparedTopicId === 'T12' ? getRelationshipSafetyGate(preparedSource) : null;
    if (t12RelationshipGate
      && Boolean(answerPreparedQuestion?.({ day: preparedDay, message, dailyContent: preparedVisibleContent }))
      && !hasPendingSafetyExchange
      && !hasExplicitSafetyHandoff
      && dailyContext?.relationshipSafetyConfirmed !== true) {
      return Object.freeze({
        status: dailyContext?.relationshipSafetyResponse === 'unsafe'
          ? 'relationship_safety_blocked'
          : 'relationship_safety_confirmation_required',
        message: dailyContext?.relationshipSafetyResponse === 'unsafe'
          ? t12RelationshipGate.blockedMessage
          : t12RelationshipGate.question + '\n\n' + t12RelationshipGate.disclaimer,
        knowledge: Object.freeze([]),
        page_context: 'day',
        conversationState: null,
      });
    }

    if (emotionalDependencyRelationshipGate
      && preparedTopicId === 'T08'
      && Boolean(answerPreparedQuestion?.({ day: preparedDay, message, dailyContent: preparedVisibleContent }))
      && !hasPendingSafetyExchange
      && !hasExplicitSafetyHandoff
      && dailyContext?.relationshipSafetyConfirmed !== true) {
      return Object.freeze({
        status: dailyContext?.relationshipSafetyResponse === 'unsafe'
          ? 'relationship_safety_blocked'
          : 'relationship_safety_confirmation_required',
        message: dailyContext?.relationshipSafetyResponse === 'unsafe'
          ? emotionalDependencyRelationshipGate.blockedMessage
          : emotionalDependencyRelationshipGate.question + '\n\n' + emotionalDependencyRelationshipGate.disclaimer,
        knowledge: Object.freeze([]),
        page_context: 'day',
        conversationState: null,
      });
    }
    if (griefRelationshipGate
      && hasExactGriefPreparedQuestion
      && !hasPendingSafetyExchange
      && !hasExplicitSafetyHandoff
      && dailyContext?.relationshipSafetyConfirmed !== true) {
      return Object.freeze({
        status: dailyContext?.relationshipSafetyResponse === 'unsafe'
          ? 'relationship_safety_blocked'
          : 'relationship_safety_confirmation_required',
        message: dailyContext?.relationshipSafetyResponse === 'unsafe'
          ? griefRelationshipGate.blockedMessage
          : griefRelationshipGate.question + '\n\n' + griefRelationshipGate.disclaimer,
        knowledge: Object.freeze([]),
        page_context: 'day',
        conversationState: null,
      });
    }

    const sharedRelationshipGate = isExtendedTopic ? getRelationshipSafetyGate(preparedSource) : null;
    const hasExactSharedRelationshipPreparedQuestion = Boolean(isExtendedTopic
      && answerPreparedQuestion?.({ day: preparedDay, message, dailyContent: preparedVisibleContent }));
    if (sharedRelationshipGate
      && hasExactSharedRelationshipPreparedQuestion
      && !hasPendingSafetyExchange
      && !hasExplicitSafetyHandoff
      && dailyContext?.relationshipSafetyConfirmed !== true) {
      return Object.freeze({
        status: dailyContext?.relationshipSafetyResponse === 'unsafe'
          ? 'relationship_safety_blocked'
          : 'relationship_safety_confirmation_required',
        message: dailyContext?.relationshipSafetyResponse === 'unsafe'
          ? sharedRelationshipGate.blockedMessage
          : sharedRelationshipGate.question + '\n\n' + sharedRelationshipGate.disclaimer,
        knowledge: Object.freeze([]),
        page_context: 'day',
        conversationState: null,
      });
    }


    // An exact, pre-authored FAQ is a question selected by the user, not a
    // first-person safety disclosure. Broad lexical safety cues inside its
    // wording must not replace its prepared answer. A real explicit-risk
    // declaration and an already-pending safety exchange still take priority.
    if (hasSupportedPreparedTopic
      && hasCanonicalPreparedIdentity
      && !hasPendingSafetyExchange
      && !hasExplicitSafetyHandoff) {
      const exactPreparedAnswer = answerPreparedQuestion?.({
        day: preparedDay,
        message,
        dailyContent: preparedVisibleContent,
      });
      if (exactPreparedAnswer) {
        return Object.freeze({
          status: 'daily_guidance_available',
          message: cleanPreparedAssistantTopicText(exactPreparedAnswer, visibleTopicName),
          knowledge: Object.freeze([]),
          page_context: 'day',
          conversationState: null,
        });
      }
    }

    // Explicit immediate-risk declarations and an active safety exchange
    // always take precedence over the prepared-question list.
    if (hasSupportedPreparedTopic
      && (SAFETY_STATUSES.has(inputProbe.status)
        || hasPendingSafetyExchange
        || hasExplicitSafetyHandoff)) {
      const safetyTurn = makeDailyExerciseGuidanceTurn({
        message,
        dayData: selectDailyExerciseGuidanceData({ guidanceData: dailyContext?.guidanceData, data: dailyContext?.data }),
        problem: dailyContext?.problem,
        day: dailyContext?.day,
        conversationState: conversationState?.dailyState || {},
      });
      const safetyStatus = safetyTurn.nextState?.safetyStatus === 'handoff'
        ? 'urgent_human_support_required'
        : safetyTurn.nextState?.safetyStatus === 'pending'
          ? 'safety_clarification_required'
          : 'daily_guidance_available';
      return Object.freeze({
        status: safetyStatus,
        message: cleanPreparedAssistantTopicText(safetyTurn.response, visibleTopicName),
        knowledge: Object.freeze([]),
        page_context: 'day',
        conversationState: Object.freeze({ dailyState: safetyTurn.nextState }),
      });
    }

    if (hasSupportedPreparedTopic) {
      if (!hasCanonicalPreparedIdentity) {
        return Object.freeze({
          status: 'daily_guidance_unavailable',
          message: 'محتوای معتبر روز جاری در دسترس نیست؛ برای جلوگیری از راهنمایی اشتباه، فعلاً پاسخ روزمحور نمی‌دهم.',
          knowledge: Object.freeze([]),
          conversationState: null,
        });
      }
      const preparedAnswer = answerPreparedQuestion?.({ day: preparedDay, message, dailyContent: preparedVisibleContent });
      if (preparedAnswer) {
        return Object.freeze({
          status: 'daily_guidance_available',
          message: cleanPreparedAssistantTopicText(preparedAnswer, visibleTopicName),
          knowledge: Object.freeze([]),
          page_context: 'day',
          conversationState: null,
        });
      }
      return Object.freeze({
        status: 'prepared_question_required',
        message: `این پرسش در فهرست راهنمای آماده موضوع ${visibleTopicName} نیست. لطفاً یکی از سؤال‌های آماده همین روز را انتخاب کن؛ گفت‌وگوی آزاد برای این موضوع فعال نیست.`,
        knowledge: Object.freeze([]),
        page_context: 'day',
        conversationState: null,
      });
    }

    // Do not fall back to general text reasoning for topics whose prepared
    // question catalogue is still being completed. The existing daily safety
    // clarification and handoff branches above remain unchanged.
    return Object.freeze({
      status: 'prepared_question_required',
      message: 'برای این موضوع هنوز فهرست سؤال‌های آماده فعال نشده است. پس از تکمیل فهرست، راهنمای همان روز در دسترس قرار می‌گیرد.',
      knowledge: Object.freeze([]),
      page_context: 'day',
      conversationState: null,
    });
  }

}
