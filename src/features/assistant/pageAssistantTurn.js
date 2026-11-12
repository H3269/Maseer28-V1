import { routeAssistantTurn } from './assistantTurnEngine.js';
import { cleanPreparedAssistantTopicText } from './teacherStylePreparedAnswer.js';
import { answerPageAssistantQuestion, getPageAssistantContext } from './pageAssistantContext.js';
import { makeDailyExerciseGuidanceTurn, selectDailyExerciseGuidanceData } from './dailyExerciseAssistantGuidance.js';
import { getRelationshipSafetyGate } from '../journey/relationshipSafetyGate.js';
import { answerAngerDailyPreparedQuestion } from './angerDailyAssistantPrompts.js';
import { answerAnxietyDailyPreparedQuestion } from './anxietyDailyAssistantPrompts.js';
import { answerFearDailyPreparedQuestion } from './fearDailyAssistantPrompts.js';
import { answerHatredDailyPreparedQuestion } from './hatredDailyAssistantPrompts.js';
import { answerJealousyDailyPreparedQuestion } from './jealousyDailyAssistantPrompts.js';
import { answerGriefDailyPreparedQuestion } from './griefDailyAssistantPrompts.js';
import { getCanonicalTopicIdForCategory } from '../journey/relationshipSafetyGate.js';
import { getCanonicalDailyRecordId } from '../content/dailyContentSelector.js';

const SAFETY_STATUSES = new Set([
  'urgent_human_support_required',
  'safety_clarification_required',
]);

function resolveRequestScopeReply(value) {
  const normalized = String(value ?? '').normalize('NFKC')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/[.!؟?،؛:]+/g, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();

  if (/^(?:برای )?(?:خودم|وضعیت شخصی خودم|تجربه شخصی خودم)(?: (?:است|هست|می خواهم|میخوام))?$/.test(normalized)
    || /^(?:شخصی|تجربه شخصی)(?: است| هست)?$/.test(normalized)) return 'personal';
  if (/^(?:اطلاعات عمومی|عمومی|برای آگاهی عمومی|صرفا اطلاعات عمومی|برای اطلاعات عمومی)(?: (?:می خواهم|میخوام|است|هست))?$/.test(normalized)) return 'general';
  return null;
}

/**
 * Routes one non-daily page turn locally.
 * A single scope clarification may carry the original question for one turn;
 * the pending text stays in volatile component memory and is never persisted.
 * Safety and personal-intake routes always retain precedence over page help.
 */
export function makePageAssistantTurn({ screen, text, conversationState = null, dailyContext = null, libraryContext = null } = {}) {
  const message = String(text ?? '').trim();
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
        ...dailyContext.guidanceData,
        lightExerciseText: preparedSource?.lightExerciseText || dailyContext.guidanceData.lightExerciseText,
        lightActionText: preparedSource?.lightActionText || dailyContext.guidanceData.lightActionText,
        progressActionText: preparedSource?.progressActionText || dailyContext.guidanceData.progressActionText,
        restExerciseText: preparedSource?.restExerciseText || dailyContext.guidanceData.restExerciseText,
        restActionText: preparedSource?.restActionText || dailyContext.guidanceData.restActionText,
      }
      : preparedSource;
    const preparedTopicId = getCanonicalTopicIdForCategory(dailyContext?.problem);
    const visibleTopicName = ({ T01: 'خشم', T02: 'اضطراب', T03: 'ترس', T04: 'نفرت', T05: 'حسادت', T06: 'غم و سوگ' })[preparedTopicId];
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
                : null;
    const hasCanonicalPreparedIdentity = ['T01', 'T02', 'T03', 'T04', 'T05', 'T06'].includes(preparedTopicId)
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
    if (['T01', 'T02', 'T03', 'T04', 'T05', 'T06'].includes(preparedTopicId)
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
    if (['T01', 'T02', 'T03', 'T04', 'T05', 'T06'].includes(preparedTopicId)
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

    if (['T01', 'T02', 'T03', 'T04', 'T05', 'T06'].includes(preparedTopicId)) {
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

    // The in-path assistant is a bounded local guidance surface. Do not apply
    // the general daily-content or relationship safety gates to its prepared
    // Q&A and structured day guidance; canonical topic/day identity remains
    // required for prepared FAQs above.
    const dayData = selectDailyExerciseGuidanceData({ guidanceData: dailyContext?.guidanceData, data: dailyContext?.data });
    const dailyTurn = makeDailyExerciseGuidanceTurn({
      message,
      dayData,
      problem: dailyContext?.problem,
      day: dailyContext?.day,
      conversationState: conversationState?.dailyState || {},
    });
    return Object.freeze({
      status: 'daily_guidance_available',
      message: visibleTopicName
        ? cleanPreparedAssistantTopicText(dailyTurn.response, visibleTopicName)
        : dailyTurn.response,
      knowledge: Object.freeze([]),
      page_context: 'day',
      conversationState: Object.freeze({ dailyState: dailyTurn.nextState }),
    });
  }
  const pending = conversationState?.pendingScope;

  if (pending?.screen === screen && typeof pending.text === 'string') {
    const safetyProbe = routeAssistantTurn({ text: message });
    if (SAFETY_STATUSES.has(safetyProbe.status)) {
      return Object.freeze({ ...safetyProbe, conversationState: null });
    }
    if (safetyProbe.status === 'invalid_input' || safetyProbe.status === 'input_too_long') {
      return Object.freeze({ ...safetyProbe, conversationState: null });
    }

    const scope = resolveRequestScopeReply(message);
    if (scope) {
      const resumed = routeAssistantTurn({ text: pending.text, requestScope: scope });
      return Object.freeze({ ...resumed, conversationState: null, scope_resolution: scope });
    }

    // Allow one explicit retry, then discard the pending question to prevent loops.
    if ((pending.clarificationAttempts || 0) < 1) {
      return Object.freeze({
        status: 'intent_scope_clarification_required',
        message: 'برای ادامه، فقط مشخص کن منظورت تجربه و وضعیت شخصی خودت است یا اطلاعات عمومی می‌خواهی. اگر هنوز مطمئن نیستی، می‌توانی پرسش را از نو مطرح کنی.',
        knowledge: Object.freeze([]),
        conversationState: Object.freeze({
          pendingScope: Object.freeze({ ...pending, clarificationAttempts: 1 }),
        }),
      });
    }
  }

  const routed = inputProbe;

  if (screen !== 'dashboard') {
    const pageReply = answerPageAssistantQuestion({ screen, message, libraryContext });
    const context = getPageAssistantContext(screen);
    if (pageReply) {
      return Object.freeze({
        status: 'page_guidance_available',
        message: pageReply,
        knowledge: Object.freeze([]),
        page_context: context.screen,
        conversationState: null,
      });
    }
    return Object.freeze({
      status: 'page_scope_required',
      message: `در صفحه «${context.label}» فقط درباره محتوای همین صفحه راهنمایی می‌دهم. پرسش تو در اطلاعات قابل‌دسترسی این صفحه نیست؛ برای پرسش عمومی به خانه برگرد.`,
      knowledge: Object.freeze([]),
      page_context: context.screen,
      conversationState: null,
    });
  }

  // Deterministic app facts (such as the registered topic/subtopic index) are
  // served locally before the empty approved-knowledge catalog can reject them.
  // Personal-intake, ambiguity, safety and scope-clarification routes keep precedence.
  if (['knowledge_unavailable', 'approved_knowledge_available'].includes(routed.status)) {
    const appKnowledgeReply = answerPageAssistantQuestion({ screen, message, libraryContext });
    if (appKnowledgeReply) {
      return Object.freeze({
        status: 'page_guidance_available',
        message: appKnowledgeReply,
        knowledge: Object.freeze([]),
        page_context: 'dashboard',
        conversationState: null,
      });
    }
  }

  // On the dashboard only, preserve the general assistant router and its scope clarification.
  if (
    SAFETY_STATUSES.has(routed.status)
    || routed.status === 'invalid_input'
    || routed.status === 'input_too_long'
    || routed.status === 'intent_scope_clarification_required'
    || (Array.isArray(routed.intake?.topic_candidates) && routed.intake.topic_candidates.length > 0)
  ) {
    const nextState = routed.status === 'intent_scope_clarification_required'
      ? Object.freeze({ pendingScope: Object.freeze({ screen, text: message }) })
      : null;
    return Object.freeze({ ...routed, conversationState: nextState });
  }

  const pageReply = answerPageAssistantQuestion({ screen, message, libraryContext });
  if (!pageReply) return Object.freeze({ ...routed, conversationState: null });

  const context = getPageAssistantContext(screen);
  return Object.freeze({
    status: 'page_guidance_available',
    message: pageReply,
    knowledge: Object.freeze([]),
    page_context: context.screen,
    conversationState: null,
  });
}
