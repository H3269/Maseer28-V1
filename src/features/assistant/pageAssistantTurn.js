import { routeAssistantTurn } from './assistantTurnEngine.js';
import { answerPageAssistantQuestion, getPageAssistantContext } from './pageAssistantContext.js';
import { getDailyAssistantAccess } from './dailyAssistantAccess.js';
import { makeDailyExerciseGuidanceTurn, selectDailyExerciseGuidanceData } from './dailyExerciseAssistantGuidance.js';
import { answerAngerDailyPreparedQuestion } from './angerDailyAssistantPrompts.js';
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

    // Exact, pre-authored T01 FAQs are a separate bounded educational route.
    // Validate the canonical topic/day identity, then answer before exercise
    // safety/review gates; those gates continue to protect free-form guidance
    // and the actual daily exercise content.
    const preparedAngerDay = Number(dailyContext?.day);
    const preparedAngerSource = dailyContext?.data;
    const hasCanonicalAngerIdentity = getCanonicalTopicIdForCategory(dailyContext?.problem) === 'T01'
      && Number.isInteger(preparedAngerDay)
      && preparedAngerDay >= 1
      && preparedAngerDay <= 28
      && preparedAngerSource
      && typeof preparedAngerSource === 'object'
      && preparedAngerSource.id === getCanonicalDailyRecordId(dailyContext?.problem, preparedAngerDay)
      && Number(preparedAngerSource.day) === preparedAngerDay
      && (!Object.prototype.hasOwnProperty.call(preparedAngerSource, 'topic_id')
        || preparedAngerSource.topic_id === 'T01');
    if (hasCanonicalAngerIdentity) {
      // Prepared FAQ answers are fixed, pre-authored educational content.
      // They are independent of the daily exercise's review and relationship
      // gates; only canonical topic/day identity and exact catalog membership
      // are required. Free-form and exercise guidance retain their own gates.
      const preparedAnswer = answerAngerDailyPreparedQuestion({
        day: preparedAngerDay,
        message,
      });
      if (preparedAnswer) {
        return Object.freeze({
          status: 'daily_guidance_available',
          message: preparedAnswer,
          knowledge: Object.freeze([]),
          page_context: 'day',
          conversationState: null,
        });
      }
    }

    const access = getDailyAssistantAccess({
      day: dailyContext?.data,
      problem: dailyContext?.problem,
      relationshipSafetyConfirmed: dailyContext?.relationshipSafetyConfirmed === true,
    });
    if (!access.available) {
      // Prepared FAQs for every day of the anger path are bounded educational
      // explanations, not instructions to initiate contact or perform an exercise.
      // Permit only an exact catalogued FAQ after re-validating source identity;
      // keep the interpersonal gate for free-form advice and unsafe/blocked content.
      const angerDay = Number(dailyContext?.day);
      let denialReason = access.reason;
      if (access.reason === 'relationship_safety_unconfirmed'
        && getCanonicalTopicIdForCategory(dailyContext?.problem) === 'T01'
        && Number.isInteger(angerDay)
        && angerDay >= 1
        && angerDay <= 28) {
        const identityCheck = getDailyAssistantAccess({
          day: dailyContext?.data,
          problem: dailyContext?.problem,
          relationshipSafetyConfirmed: true,
        });
        // The re-check is authoritative for content identity and blocking.
        // If it passes but the message is not an exact prepared FAQ, the
        // original interpersonal gate still applies to this free-form turn.
        const preparedAnswer = identityCheck.available
          ? answerAngerDailyPreparedQuestion({ day: angerDay, message })
          : null;
        if (preparedAnswer) {
          return Object.freeze({
            status: 'daily_guidance_available',
            message: preparedAnswer,
            knowledge: Object.freeze([]),
            page_context: 'day',
            conversationState: null,
          });
        }
        denialReason = identityCheck.available
          ? 'relationship_safety_unconfirmed'
          : identityCheck.reason;
      }
      const messageText = denialReason === 'daily_content_blocked'
        ? 'این محتوای روز به‌دلیل نیاز به بازبینی ایمنی برای راهنمایی دستیار فعال نیست. لطفاً این محدودیت را دور نزن.'
        : denialReason === 'relationship_safety_unconfirmed'
          ? 'برای راهنمایی این تمرین، پنجره دستیار را ببند و بررسی ایمنی همین روز را در بخش تمرین کامل کن. تا آن زمان متن تمرین و راهکار را از این مسیر توضیح نمی‌دهم.'
          : 'محتوای معتبر روز جاری در دسترس نیست؛ برای جلوگیری از راهنمایی اشتباه، فعلاً پاسخ روزمحور نمی‌دهم.';
      return Object.freeze({ status: 'daily_guidance_unavailable', message: messageText, knowledge: Object.freeze([]), conversationState: null });
    }
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
