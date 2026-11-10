import { routeAssistantTurn } from './assistantTurnEngine.js';
import { answerPageAssistantQuestion, getPageAssistantContext } from './pageAssistantContext.js';
import { makeDailyExerciseGuidanceTurn, selectDailyExerciseGuidanceData } from './dailyExerciseAssistantGuidance.js';
import { answerAngerDailyPreparedQuestion } from './angerDailyAssistantPrompts.js';
import { answerAnxietyDailyPreparedQuestion } from './anxietyDailyAssistantPrompts.js';
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

    // Exact, pre-authored T01/T02 FAQs are bounded educational routes.
    // Validate canonical topic/day identity before answering; free-form
    // guidance continues through the separate safety and review gates.
    const preparedDay = Number(dailyContext?.day);
    const preparedSource = dailyContext?.data;
    const preparedTopicId = getCanonicalTopicIdForCategory(dailyContext?.problem);
    const answerPreparedQuestion = preparedTopicId === 'T01'
      ? answerAngerDailyPreparedQuestion
      : preparedTopicId === 'T02'
        ? answerAnxietyDailyPreparedQuestion
        : null;
    const preparedAnswer = answerPreparedQuestion?.({ day: preparedDay, message });
    if (preparedAnswer) {
      const hasCanonicalPreparedIdentity = ['T01', 'T02'].includes(preparedTopicId)
        && Number.isInteger(preparedDay)
        && preparedDay >= 1
        && preparedDay <= 28
        && preparedSource
        && typeof preparedSource === 'object'
        && preparedSource.id === getCanonicalDailyRecordId(dailyContext?.problem, preparedDay)
        && Number(preparedSource.day) === preparedDay
        && (!Object.prototype.hasOwnProperty.call(preparedSource, 'topic_id')
          || preparedSource.topic_id === preparedTopicId);
      if (!hasCanonicalPreparedIdentity) {
        return Object.freeze({
          status: 'daily_guidance_unavailable',
          message: 'محتوای معتبر روز جاری در دسترس نیست؛ برای جلوگیری از راهنمایی اشتباه، فعلاً پاسخ روزمحور نمی‌دهم.',
          knowledge: Object.freeze([]),
          conversationState: null,
        });
      }
      return Object.freeze({
        status: 'daily_guidance_available',
        message: preparedAnswer,
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
      message: dailyTurn.response,
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
