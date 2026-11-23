import { routeAssistantTurn } from './assistantTurnEngine.js';
import { cleanPreparedAssistantTopicText } from './teacherStylePreparedAnswer.js';
import { answerPageAssistantQuestion, getPageAssistantContext } from './pageAssistantContext.js';
import { answerPageSpecificQuestion } from './pageAssistantPrompts.js';
import { makeDailyExerciseGuidanceTurn, selectDailyExerciseGuidanceData } from './dailyExerciseAssistantGuidance.js';
import { getRelationshipSafetyGate } from '../journey/relationshipSafetyGate.js';














import { getCanonicalTopicIdForCategory } from '../journey/relationshipSafetyGate.js';
import { buildPreparedDailyAssistantAnswer } from './preparedDailyAssistantAnswer.js';
import { getCanonicalDailyRecordId } from '../content/dailyContentSelector.js';
import { getDailySafetyMode } from '../content/dailySafety.js';
import { LIBRARY_ASSISTANT_PROMPTS } from './libraryAssistantPrompts.js';
import { getSharedDailyAssistantQuestion } from './sharedDailyAssistantEngine.js';

const SAFETY_STATUSES = new Set([
  'urgent_human_support_required',
  'safety_clarification_required',
]);


function normalizeVisibleDailySourceText(value) {
  return String(value ?? '').normalize('NFKC')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

function preserveVisibleDailySources(answer, questionKind, dailyContent) {
  const requiredSources = [];
  if (['exercise_meaning', 'exercise_example', 'exercise_action_difference', 'success'].includes(questionKind)) {
    requiredSources.push(['متن دقیق تمرین امروز', dailyContent?.exercise || dailyContent?.instructions]);
  }
  if (['action_meaning', 'action_example', 'exercise_action_difference'].includes(questionKind)) {
    requiredSources.push(['متن دقیق اقدام اختصاصی امروز', dailyContent?.actionText || dailyContent?.action]);
  }

  let result = String(answer || '');
  let normalizedResult = normalizeVisibleDailySourceText(result);
  for (const [label, rawSource] of requiredSources) {
    const source = String(rawSource || '').trim();
    const normalizedSource = normalizeVisibleDailySourceText(source);
    if (!normalizedSource || normalizedResult.includes(normalizedSource)) continue;
    // Keep the UI's adapted daily text authoritative even if a topic adapter
    // falls back to its static guide. This is a display-only source safeguard;
    // it does not change routing, identity validation, or safety decisions.
    result += (result ? '\n\n' : '') + label + ': ' + source;
    normalizedResult = normalizeVisibleDailySourceText(result);
  }
  return result;
}

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
    const preparedDay = Number(dailyContext?.day);
    const preparedSource = dailyContext?.data;
    const preparedTopicId = getCanonicalTopicIdForCategory(dailyContext?.problem) || preparedSource?.topic_id || null;
    // Prepared FAQ answers must quote the exact transformed daily content shown
    // in DayScreen (including adaptation and display normalization), while
    // canonical identity validation continues to use the untouched source.
    // Some legacy canonical records omit topic_id; once their category and
    // canonical record identity are validated below, carry the resolved topic
    // into the prepared content so topic-specific adapters (notably T01) use
    // the visible day text instead of silently falling back to stale guide text.
    const preparedVisibleContent = dailyContext?.guidanceData
      ? {
        ...preparedSource,
        ...dailyContext.guidanceData,
        id: preparedSource?.id,
        topic_id: preparedTopicId,
        day: preparedSource?.day,
        title: dailyContext.guidanceData.title || preparedSource?.title,
        sourceExercise: preparedSource?.exercise || preparedSource?.instructions,
        sourceActionText: preparedSource?.actionText || preparedSource?.action,
        exercise: dailyContext.guidanceData.exercise || preparedSource?.exercise,
        actionText: dailyContext.guidanceData.action || preparedSource?.actionText,
        lightExerciseText: preparedSource?.lightExerciseText || dailyContext.guidanceData.lightExerciseText,
        lightActionText: preparedSource?.lightActionText || dailyContext.guidanceData.lightActionText,
        progressActionText: preparedSource?.progressActionText || dailyContext.guidanceData.progressActionText,
        restExerciseText: preparedSource?.restExerciseText || dailyContext.guidanceData.restExerciseText,
        restActionText: preparedSource?.restActionText || dailyContext.guidanceData.restActionText,
      }
      : preparedSource;
    const visibleTopicName = ({ T01: 'خشم', T02: 'اضطراب', T03: 'ترس', T04: 'نفرت', T05: 'حسادت', T06: 'غم و سوگ', T07: 'احساس گناه', T08: 'وابستگی عاطفی', T09: 'اهمال‌کاری', T10: 'بی‌خوابی و مشکلات خواب', T11: 'عادت‌های تکراری', T12: 'مرزبندی و نه گفتن', T13: 'تنهایی', T14: 'کمبود انگیزه', T15: 'اعتمادبه‌نفس پایین', T16: 'افکار منفی و نشخوار فکری', T17: 'مشکلات رابطه', T18: 'نفرت از خود', T19: 'خودسرزنشی', T20: 'کمال‌گرایی', T21: 'اجتناب', T22: 'استرس', T23: 'احساس بی‌ارزشی', T24: 'مشکل در کنترل هیجان', T25: 'رنجش و کینه', T26: 'شرم', T27: 'ترس از قضاوت', T28: 'ترس از شکست', T29: 'ترس از طرد شدن', T30: 'شک و تردید', T31: 'کنترل‌گری', T32: 'بی‌انگیزگی', T33: 'خودانتقادی', T34: 'مشکل دیگر' })[preparedTopicId];
    const answerPreparedQuestion = ({ day, message, dailyContent }) => buildPreparedDailyAssistantAnswer({
      topicId: preparedTopicId,
      topicName: visibleTopicName,
      day,
      message,
      dailyContent,
    });

    const guidanceSourceIdentityMismatch = Boolean(
      dailyContext?.guidanceData
      && (
        (dailyContext.guidanceData.id && dailyContext.guidanceData.id !== preparedSource?.id)
        || (dailyContext.guidanceData.day != null && Number(dailyContext.guidanceData.day) !== preparedDay)
        || (dailyContext.guidanceData.topic_id && dailyContext.guidanceData.topic_id !== preparedTopicId)
      ),
    );
    const hasCanonicalPreparedIdentity = ['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16', 'T17', 'T18', 'T19', 'T20', 'T21', 'T22', 'T23', 'T24', 'T25', 'T26', 'T27', 'T28', 'T29', 'T30', 'T31', 'T32', 'T33', 'T34'].includes(preparedTopicId)
      && Number.isInteger(preparedDay)
      && preparedDay >= 1
      && preparedDay <= 28
      && preparedSource
      && typeof preparedSource === 'object'
      && preparedSource.id === getCanonicalDailyRecordId(dailyContext?.problem, preparedDay)
      && Number(preparedSource.day) === preparedDay
      && (!Object.prototype.hasOwnProperty.call(preparedSource, 'topic_id')
        || preparedSource.topic_id == null
        || preparedSource.topic_id === preparedTopicId)
      && !guidanceSourceIdentityMismatch;

    const hasPendingSafetyExchange = ['pending', 'handoff'].includes(conversationState?.dailyState?.safetyStatus);
    const isExtendedTopic = /^T(?:1[5-9]|2[0-9]|3[0-4])$/u.test(preparedTopicId || '');
    const usesExplicitDailySafetyBlock = ['T13', 'T14'].includes(preparedTopicId) || isExtendedTopic;
    const blockedTopicSafetyMode = usesExplicitDailySafetyBlock ? getDailySafetyMode(preparedSource) : null;
    const hasExactBlockedTopicPreparedQuestion = Boolean(usesExplicitDailySafetyBlock
      && answerPreparedQuestion?.({ day: preparedDay, message, dailyContent: preparedVisibleContent }));
    if (usesExplicitDailySafetyBlock
      && blockedTopicSafetyMode === 'blocked'
      && hasExactBlockedTopicPreparedQuestion) {
      return Object.freeze({
        status: 'daily_guidance_unavailable',
        message: 'به‌دلیل سطح خطر ثبت‌شده برای این روز، ارائه پاسخ تمرینی در این وضعیت ایمن نیست. اگر خطر فوری وجود دارد، از کمک انسانی و خدمات اورژانسی محل زندگی استفاده کن.',
        knowledge: Object.freeze([]),
        conversationState: null,
      });
    }
    const hasExplicitSafetyHandoff = inputProbe.intake?.safety_handoff?.handoff_required === true;
    // Apply the same registered relationship-safety gate to every topic/day.
    // A gate must protect the prepared answer path, not only selected topic adapters.
    const relationshipSafetyGate = getRelationshipSafetyGate(preparedSource);
    const hasExactRelationshipPreparedQuestion = Boolean(
      hasCanonicalPreparedIdentity
      && relationshipSafetyGate
      && answerPreparedQuestion?.({ day: preparedDay, message, dailyContent: preparedVisibleContent }),
    );
    if (relationshipSafetyGate
      && hasExactRelationshipPreparedQuestion
      && !hasPendingSafetyExchange
      && !hasExplicitSafetyHandoff
      && dailyContext?.relationshipSafetyConfirmed !== true) {
      return Object.freeze({
        status: dailyContext?.relationshipSafetyResponse === 'unsafe'
          ? 'relationship_safety_blocked'
          : 'relationship_safety_confirmation_required',
        message: dailyContext?.relationshipSafetyResponse === 'unsafe'
          ? relationshipSafetyGate.blockedMessage
          : relationshipSafetyGate.question + '\n\n' + relationshipSafetyGate.disclaimer,
        knowledge: Object.freeze([]),
        page_context: 'day',
        conversationState: null,
      });
    }

    // An exact, pre-authored FAQ is a question selected by the user, not a
    // first-person safety disclosure. Broad lexical safety cues inside its
    // wording must not replace its prepared answer. A real explicit-risk
    // declaration and an already-pending safety exchange still take priority.
    if (['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16', 'T17', 'T18', 'T19', 'T20', 'T21', 'T22', 'T23', 'T24', 'T25', 'T26', 'T27', 'T28', 'T29', 'T30', 'T31', 'T32', 'T33', 'T34'].includes(preparedTopicId)
      && hasCanonicalPreparedIdentity
      && !hasPendingSafetyExchange
      && !hasExplicitSafetyHandoff) {
      const exactPreparedAnswer = answerPreparedQuestion?.({
        day: preparedDay,
        message,
        dailyContent: preparedVisibleContent,
      });
      if (exactPreparedAnswer) {
        const preparedQuestion = getSharedDailyAssistantQuestion(preparedTopicId, message);
        const cleanedAnswer = cleanPreparedAssistantTopicText(exactPreparedAnswer, visibleTopicName);
        const sourceFaithfulAnswer = preserveVisibleDailySources(
          cleanedAnswer,
          preparedQuestion?.kind,
          preparedVisibleContent,
        );
        return Object.freeze({
          status: 'daily_guidance_available',
          message: sourceFaithfulAnswer,
          knowledge: Object.freeze([]),
          page_context: 'day',
          conversationState: null,
        });
      }
    }

    // Explicit immediate-risk declarations and an active safety exchange
    // always take precedence over the prepared-question list.
    if (['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16', 'T17', 'T18', 'T19', 'T20', 'T21', 'T22', 'T23', 'T24', 'T25', 'T26', 'T27', 'T28', 'T29', 'T30', 'T31', 'T32', 'T33', 'T34'].includes(preparedTopicId)
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

    if (['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16', 'T17', 'T18', 'T19', 'T20', 'T21', 'T22', 'T23', 'T24', 'T25', 'T26', 'T27', 'T28', 'T29', 'T30', 'T31', 'T32', 'T33', 'T34'].includes(preparedTopicId)) {
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
        const preparedQuestion = getSharedDailyAssistantQuestion(preparedTopicId, message);
        const cleanedAnswer = cleanPreparedAssistantTopicText(preparedAnswer, visibleTopicName);
        const sourceFaithfulAnswer = preserveVisibleDailySources(
          cleanedAnswer,
          preparedQuestion?.kind,
          preparedVisibleContent,
        );
        return Object.freeze({
          status: 'daily_guidance_available',
          message: sourceFaithfulAnswer,
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
