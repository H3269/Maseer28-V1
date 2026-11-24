import { useEffect, useState } from 'react';
import { DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN } from './dailyAssistantSafetyReminder.js';

/**
 * Owns the reveal lifecycle for the latest completed assistant response.
 * Message production and safety decisions stay outside this presentation hook.
 */
export function useAssistantTypewriter(messages, sending) {
  const [typingProgress, setTypingProgress] = useState(null);

  useEffect(() => {
    if (sending) return undefined;
    const latestAssistantMessage = [...messages].reverse().find((item) =>
      item.role === 'assistant' && item.text && !/^در حال بررسی پرسش[.…]*$/u.test(item.text),
    );
    if (!latestAssistantMessage) {
      setTypingProgress(null);
      return undefined;
    }

    const revealText = latestAssistantMessage.dailySafetyReminder
      && latestAssistantMessage.text.endsWith(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN)
      ? latestAssistantMessage.text.slice(0, -DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN.length).trimEnd()
      : latestAssistantMessage.text;
    const words = revealText.match(/\S+\s*/gu) || [revealText];
    const responseId = latestAssistantMessage.id;
    const reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (reducedMotionQuery?.matches) {
      setTypingProgress({ id: responseId, text: revealText, active: false });
      return undefined;
    }

    let visibleCount = 0;
    let visibleText = '';
    setTypingProgress({ id: responseId, text: '', active: words.length > 0 });
    const timer = window.setInterval(() => {
      visibleText += words[visibleCount] || '';
      visibleCount += 1;
      const active = visibleCount < words.length;
      setTypingProgress({ id: responseId, text: visibleText, active });
      if (!active) window.clearInterval(timer);
    }, 42);
    const finishForReducedMotion = (event) => {
      if (!event.matches) return;
      window.clearInterval(timer);
      setTypingProgress({ id: responseId, text: revealText, active: false });
    };
    if (reducedMotionQuery?.addEventListener) {
      reducedMotionQuery.addEventListener('change', finishForReducedMotion);
    } else {
      reducedMotionQuery?.addListener?.(finishForReducedMotion);
    }
    return () => {
      window.clearInterval(timer);
      if (reducedMotionQuery?.removeEventListener) {
        reducedMotionQuery.removeEventListener('change', finishForReducedMotion);
      } else {
        reducedMotionQuery?.removeListener?.(finishForReducedMotion);
      }
    };
  }, [messages, sending]);

  return { typingProgress, resetTypingProgress: () => setTypingProgress(null) };
}
