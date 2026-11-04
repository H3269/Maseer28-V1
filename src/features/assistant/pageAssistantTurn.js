import { routeAssistantTurn } from './assistantTurnEngine.js';
import { answerPageAssistantQuestion, getPageAssistantContext } from './pageAssistantContext.js';

const SAFETY_STATUSES = new Set([
  'urgent_human_support_required',
  'safety_clarification_required',
]);

/**
 * Routes one non-daily page turn locally.
 * Page help may answer only fixed UI questions; all other requests fall back
 * to the existing safety-first, approved-knowledge assistant turn engine.
 */
export function makePageAssistantTurn({ screen, text } = {}) {
  const message = String(text ?? '').trim();
  const routed = routeAssistantTurn({ text: message });

  // Safety, empty-input and input-bound outcomes always take precedence.
  if (
    SAFETY_STATUSES.has(routed.status)
    || routed.status === 'invalid_input'
    || routed.status === 'input_too_long'
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
