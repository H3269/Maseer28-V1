import { routeSemanticIntake } from './intentContextRouter.js';
import { retrieveApprovedKnowledge } from './knowledgeGateway.js';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

/**
 * Local-only turn router. It does not generate clinical advice or compose new
 * factual claims; knowledge answers are limited to approved source excerpts.
 */
export function routeAssistantTurn({ text, knowledgeItems = [], requestId = 'assistant-turn' } = {}) {
  const intake = routeSemanticIntake({ text, requestId });

  if (intake.safety_handoff.handoff_required) {
    return deepFreeze({
      status: 'urgent_human_support_required',
      intake,
      message: 'نشانه‌ای از خطر فوری یا تهدید جاری دیده شده است. پاسخ‌گویی عادی متوقف می‌شود؛ از خدمات اورژانسی محل زندگی یا یک فرد/مرکز حمایتی امن کمک بگیر.',
      knowledge: [],
    });
  }

  if (intake.next_question?.purpose === 'safety_clarification') {
    return deepFreeze({
      status: 'safety_clarification_required',
      intake,
      message: intake.next_question.text,
      knowledge: [],
    });
  }

  if (intake.intent.label === 'general_information') {
    const retrieval = retrieveApprovedKnowledge({ query: text, items: knowledgeItems, limit: 3 });
    if (retrieval.status !== 'results_found') {
      return deepFreeze({
        status: 'knowledge_unavailable',
        intake,
        message: 'این یک درخواست اطلاعات عمومی است؛ برای این پرسش هنوز محتوای تأییدشده و قابل استناد در پایگاه دانش دستیار پیدا نشد. به‌جای حدس‌زدن، فعلاً پاسخ قطعی نمی‌دهم.',
        knowledge: [],
        retrieval_status: retrieval.status,
      });
    }
    return deepFreeze({
      status: 'approved_knowledge_available',
      intake,
      message: 'گزیده‌های زیر از منابعی بازیابی شده‌اند که برای استفاده دستیار تأیید شده‌اند. این گزیده‌ها تشخیص یا توصیه درمانی نیستند.',
      knowledge: retrieval.results,
      retrieval_status: retrieval.status,
    });
  }

  if (intake.intent.ambiguity === 'high' || intake.topic_candidates.length !== 1) {
    return deepFreeze({
      status: 'clarification_required',
      intake,
      message: intake.next_question?.text || 'برای اینکه موضوع را اشتباه برداشت نکنم، یک نمونه مشخص و اخیر از تجربه‌ات می‌گویی؟',
      knowledge: [],
    });
  }

  return deepFreeze({
    status: 'personal_intake_required',
    intake,
    message: 'موضوع فعلاً فقط یک فرضیه اولیه است. پیش از هر توضیح یا پیشنهاد، باید زمینه، اثر و هدف تو روشن شود.',
    knowledge: [],
  });
}
