import { routeAssistantTurn } from './assistantTurnEngine.js';
import { cleanPreparedAssistantTopicText } from './teacherStylePreparedAnswer.js';
import { answerPageAssistantQuestion, getPageAssistantContext } from './pageAssistantContext.js';
import { answerPageSpecificQuestion } from './pageAssistantPrompts.js';
import { makeDailyExerciseGuidanceTurn, selectDailyExerciseGuidanceData } from './dailyExerciseAssistantGuidance.js';
import { getRelationshipSafetyGate } from '../journey/relationshipSafetyGate.js';
import { answerAngerDailyPreparedQuestion } from './angerDailyAssistantPrompts.js';
import { answerAnxietyDailyPreparedQuestion } from './anxietyDailyAssistantPrompts.js';
import { answerFearDailyPreparedQuestion } from './fearDailyAssistantPrompts.js';
import { answerHatredDailyPreparedQuestion } from './hatredDailyAssistantPrompts.js';
import { answerJealousyDailyPreparedQuestion } from './jealousyDailyAssistantPrompts.js';
import { answerGriefDailyPreparedQuestion } from './griefDailyAssistantPrompts.js';
import { answerGuiltDailyPreparedQuestion } from './guiltDailyAssistantPrompts.js';
import { answerEmotionalDependencyDailyPreparedQuestion } from './emotionalDependencyDailyAssistantPrompts.js';
import { answerT09DailyPreparedQuestion } from './t09DailyAssistantPrompts.js';
import { answerT10DailyPreparedQuestion } from './t10DailyAssistantPrompts.js';
import { answerT11DailyPreparedQuestion } from './t11DailyAssistantPrompts.js';
import { answerT12DailyPreparedQuestion } from './t12DailyAssistantPrompts.js';
import { answerT13DailyPreparedQuestion } from './t13DailyAssistantPrompts.js';
import { answerT14DailyPreparedQuestion } from './t14DailyAssistantPrompts.js';
import { getCanonicalTopicIdForCategory } from '../journey/relationshipSafetyGate.js';
import { getCanonicalDailyRecordId } from '../content/dailyContentSelector.js';
import { getDailySafetyMode } from '../content/dailySafety.js';
import { LIBRARY_ASSISTANT_PROMPTS } from './libraryAssistantPrompts.js';

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

    // Current topic assistants answer only exact, pre-authored day-specific FAQs.
    // Validate canonical topic/day identity before answering; safety routing
    // remains available and takes precedence over every prepared question.
    const preparedDay = Number(dailyContext?.day);
    const preparedSource = dailyContext?.data;
    // Prepared FAQ answers must quote the exact transformed daily content shown
    // in DayScreen (including adaptation and display normalization), while
    // canonical identity validation continues to use the untouched source.
    const preparedVisibleContent = dailyContext?.guidanceData
      ? {
        ...preparedSource,
        ...dailyContext.guidanceData,
        id: preparedSource?.id,
        topic_id: preparedSource?.topic_id,
        day: preparedSource?.day,
        title: dailyContext.guidanceData.title || preparedSource?.title,
        sourceExercise: preparedSource?.exercise,
        sourceActionText: preparedSource?.actionText,
        exercise: dailyContext.guidanceData.exercise || preparedSource?.exercise,
        actionText: dailyContext.guidanceData.action || preparedSource?.actionText,
        lightExerciseText: preparedSource?.lightExerciseText || dailyContext.guidanceData.lightExerciseText,
        lightActionText: preparedSource?.lightActionText || dailyContext.guidanceData.lightActionText,
        progressActionText: preparedSource?.progressActionText || dailyContext.guidanceData.progressActionText,
        restExerciseText: preparedSource?.restExerciseText || dailyContext.guidanceData.restExerciseText,
        restActionText: preparedSource?.restActionText || dailyContext.guidanceData.restActionText,
      }
      : preparedSource;
    const preparedTopicId = getCanonicalTopicIdForCategory(dailyContext?.problem) || preparedSource?.topic_id || null;
    const visibleTopicName = ({ T01: 'خشم', T02: 'اضطراب', T03: 'ترس', T04: 'نفرت', T05: 'حسادت', T06: 'غم و سوگ', T07: 'احساس گناه', T08: 'وابستگی عاطفی', T09: 'اهمال‌کاری', T10: 'بی‌خوابی و مشکلات خواب', T11: 'عادت‌های تکراری', T12: 'مرزبندی و نه گفتن', T13: 'تنهایی', T14: 'کمبود انگیزه' })[preparedTopicId];
    const answerPreparedQuestion = preparedTopicId === 'T01'
      ? answerAngerDailyPreparedQuestion
      : preparedTopicId === 'T02'
        ? answerAnxietyDailyPreparedQuestion
        : preparedTopicId === 'T03'
          ? answerFearDailyPreparedQuestion
          : preparedTopicId === 'T04'
            ? answerHatredDailyPreparedQuestion
            : preparedTopicId === 'T05'
              ? answerJealousyDailyPreparedQuestion
              : preparedTopicId === 'T06'
                ? answerGriefDailyPreparedQuestion
                : preparedTopicId === 'T07'
                  ? answerGuiltDailyPreparedQuestion
                  : preparedTopicId === 'T08'
                    ? answerEmotionalDependencyDailyPreparedQuestion
                    : preparedTopicId === 'T09'
                      ? answerT09DailyPreparedQuestion
                      : preparedTopicId === 'T10'
                        ? answerT10DailyPreparedQuestion
                        : preparedTopicId === 'T11'
                          ? answerT11DailyPreparedQuestion
                          : preparedTopicId === 'T12'
                            ? answerT12DailyPreparedQuestion
                            : preparedTopicId === 'T13'
                              ? answerT13DailyPreparedQuestion
                              : preparedTopicId === 'T14'
                                ? answerT14DailyPreparedQuestion
                                : null;
    const hasCanonicalPreparedIdentity = ['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10', 'T11', 'T12', 'T13', 'T14'].includes(preparedTopicId)
      && Number.isInteger(preparedDay)
      && preparedDay >= 1
      && preparedDay <= 28
      && preparedSource
      && typeof preparedSource === 'object'
      && preparedSource.id === getCanonicalDailyRecordId(dailyContext?.problem, preparedDay)
      && Number(preparedSource.day) === preparedDay
      && (!Object.prototype.hasOwnProperty.call(preparedSource, 'topic_id')
        || preparedSource.topic_id == null
        || preparedSource.topic_id === preparedTopicId);

    const hasPendingSafetyExchange = ['pending', 'handoff'].includes(conversationState?.dailyState?.safetyStatus);
    const t13SafetyMode = preparedTopicId === 'T13' ? getDailySafetyMode(preparedSource) : null;
    const hasExactT13PreparedQuestion = preparedTopicId === 'T13'
      && Boolean(answerPreparedQuestion?.({ day: preparedDay, message, dailyContent: preparedVisibleContent }));
    if (preparedTopicId === 'T13' && t13SafetyMode === 'blocked' && hasExactT13PreparedQuestion) {
      return Object.freeze({
        status: 'daily_guidance_unavailable',
        message: 'تمرین این روز تا زمان بازبینی ایمنی تخصصی در دسترس نیست؛ برای جلوگیری از راهنمایی ناایمن، پاسخ روزمحور ارائه نمی‌شود.',
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

    // An exact, pre-authored FAQ is a question selected by the user, not a
    // first-person safety disclosure. Broad lexical safety cues inside its
    // wording must not replace its prepared answer. A real explicit-risk
    // declaration and an already-pending safety exchange still take priority.
    if (['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10', 'T11', 'T12', 'T13', 'T14'].includes(preparedTopicId)
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
    if (['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10', 'T11', 'T12', 'T13', 'T14'].includes(preparedTopicId)
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

    if (['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10', 'T11', 'T12', 'T13', 'T14'].includes(preparedTopicId)) {
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
