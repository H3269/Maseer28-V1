import { routeAssistantTurn } from './assistantTurnEngine.js';
import { answerPageAssistantQuestion, getPageAssistantContext } from './pageAssistantContext.js';

const SAFETY_STATUSES = new Set([
  'urgent_human_support_required',
  'safety_clarification_required',
]);

/**
 * Routes one non-daily page turn locally.
 * Only fixed UI questions without detected personal-topic evidence may use
 * page guidance. Safety and personal-intake routes always retain precedence.
 */
export function makePageAssistantTurn({ screen, text } = {}) {
  const message = String(text ?? '').trim();
  const routed = routeAssistantTurn({ text: message });

  // Never let page guidance override safety, input guards, or personal intake.
  if (
    SAFETY_STATUSES.has(routed.status)
    || routed.status === 'invalid_input'
    || routed.status === 'input_too_long'
    || routed.status === 'intent_scope_clarification_required'
    || (Array.isArray(routed.intake?.topic_candidates) && routed.intake.topic_candidates.length > 0)
  ) {
    return routed;
  }

  const pageReply = answerPageAssistantQuestion({ screen, message });
  if (!pageReply) return routed;

  const context = getPageAssistantContext(screen);
  return Object.freeze({
    status: 'page_guidance_available',
    message: pageReply,
    knowledge: Object.freeze([]),
    page_context: context.screen,
  });
}
