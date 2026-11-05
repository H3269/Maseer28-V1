import { routeAssistantTurn } from './assistantTurnEngine.js';
import { answerPageAssistantQuestion, getPageAssistantContext } from './pageAssistantContext.js';

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
export function makePageAssistantTurn({ screen, text, conversationState = null } = {}) {
  const message = String(text ?? '').trim();
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

  const routed = routeAssistantTurn({ text: message });

  // Never let page guidance override safety, input guards, or personal intake.
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

  const pageReply = answerPageAssistantQuestion({ screen, message });
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
