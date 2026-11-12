import React, { useEffect, useRef, useState } from 'react';
import { formatAssistantMessageText } from './assistantMessageFormatting.js';
import AppIcon from '../../shared/components/AppIcon.jsx';
import { makePageAssistantTurn } from './pageAssistantTurn.js';
import { libraryRepository } from '../library/libraryRepository.js';
import { answerLibraryBookTurn } from './libraryBookAssistant.js';
import { routeAssistantTurn } from './assistantTurnEngine.js';
import { isLocalNeuralModelInstalled, requestLocalNeuralModel } from './localNeuralModelClient.js';
import { LIBRARY_ASSISTANT_PROMPT_GROUPS } from './libraryAssistantPrompts.js';
import { getCanonicalTopicIdForCategory, getRelationshipSafetyGate } from '../journey/relationshipSafetyGate.js';
import { getAngerDailyAssistantPromptGroups } from './angerDailyAssistantPrompts.js';
import { getAnxietyDailyAssistantPromptGroups } from './anxietyDailyAssistantPrompts.js';
import { getFearDailyAssistantPromptGroups } from './fearDailyAssistantPrompts.js';
import { getHatredDailyAssistantPromptGroups } from './hatredDailyAssistantPrompts.js';
import { getJealousyDailyAssistantPromptGroups } from './jealousyDailyAssistantPrompts.js';
import { getGriefDailyAssistantPromptGroups } from './griefDailyAssistantPrompts.js';
import { getGuiltDailyAssistantPromptGroups } from './guiltDailyAssistantPrompts.js';
import { appendLocalSourceReferences, buildLocalAssistantMessages, isLocalModelInstallCommand, LOCAL_MODEL_CACHE_MESSAGE, LOCAL_MODEL_FAILURE_MESSAGE, LOCAL_MODEL_INSTALL_MESSAGE, shouldUseLocalNeuralModel } from './localNeuralAssistant.js';
import { DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN } from './dailyAssistantSafetyReminder.js';

export default function GlobalAssistantLauncher({ screen, visible = false, dailyContext = null, libraryContext = null, onRelationshipSafetyResponse = null }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [libraryPromptOpen, setLibraryPromptOpen] = useState(false);
  const libraryPromptTriggerRef = useRef(null);
  const libraryPromptDialogRef = useRef(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [localModelUnavailable, setLocalModelUnavailable] = useState(false);
  const [localModelInstalled, setLocalModelInstalled] = useState(false);
  const [localModelStatusChecked, setLocalModelStatusChecked] = useState(false);
  const turnSequenceRef = useRef(0);
  const [loadedLibraryBooks, setLoadedLibraryBooks] = useState([]);
  const conversationStateRef = useRef(null);
  const launcherRef = useRef(null);
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const endRef = useRef(null);
  const messageInputRef = useRef(null);

  useEffect(() => {
    setMessages([]);
    setDraft('');
    setError('');
    setSending(false);
    conversationStateRef.current = null;
    setOpen(false);
    setLibraryPromptOpen(false);
  }, [screen, dailyContext?.day, dailyContext?.problem]);

  useEffect(() => {
    if (!open) return undefined;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        if (document.getElementById('library-assistant-prompt-dialog')) return;
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      launcherRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    if (!libraryPromptOpen) return undefined;
    libraryPromptDialogRef.current?.querySelector('[data-prompt-option]')?.focus();
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setLibraryPromptOpen(false);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      libraryPromptTriggerRef.current?.focus();
    };
  }, [libraryPromptOpen]);

  useEffect(() => {
    let active = true;
    if (screen !== 'books') {
      setLoadedLibraryBooks([]);
    } else {
      (async () => {
        try {
          const rows = await libraryRepository.listBooks();
          const hydrated = await Promise.all(rows.map(async (book) => {
            if (!book.activeVersionId) return null;
            const version = await libraryRepository.getVersion(book.activeVersionId);
            return version?.content ? { title: book.title, legacyId: book.legacyId, content: version.content } : null;
          }));
          if (active) setLoadedLibraryBooks(hydrated.filter(Boolean));
        } catch {
          if (active) setLoadedLibraryBooks([]);
        }
      })();
    }
    const shouldCheckModel = screen === 'books' || (screen === 'day' && Boolean(dailyContext));
    if (!shouldCheckModel) {
      setLocalModelInstalled(false);
      setLocalModelStatusChecked(false);
      return () => { active = false; };
    }
    setLocalModelStatusChecked(false);
    isLocalNeuralModelInstalled().then((installed) => {
      if (active) {
        setLocalModelInstalled(installed);
        setLocalModelStatusChecked(true);
      }
    }).catch(() => {
      if (active) {
        setLocalModelInstalled(false);
        setLocalModelStatusChecked(true);
      }
    });
    return () => { active = false; };
  }, [screen, libraryContext?.titles?.length, dailyContext?.day, dailyContext?.problem]);

  const dailyProblemText = String(dailyContext?.problem || '').trim();
  const dailyProblemTopicId = getCanonicalTopicIdForCategory(dailyProblemText);
  const dailyRecordTopicId = dailyContext?.data?.topic_id || dailyContext?.data?.topicId || null;
  const hasConflictingDailyTopic = Boolean(
    (dailyProblemTopicId && dailyRecordTopicId && dailyProblemTopicId !== dailyRecordTopicId)
    || (dailyProblemTopicId && !['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07'].includes(dailyProblemTopicId) && dailyRecordTopicId)
    || (dailyRecordTopicId && !['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07'].includes(dailyRecordTopicId) && dailyProblemTopicId),
  );
  const isAngerDailyPromptContext = Boolean(dailyContext)
    && !hasConflictingDailyTopic
    && (dailyProblemTopicId === 'T01' || dailyRecordTopicId === 'T01' || dailyProblemText.includes('خشم'));
  const isAnxietyDailyPromptContext = Boolean(dailyContext)
    && !hasConflictingDailyTopic
    && (dailyProblemTopicId === 'T02' || dailyRecordTopicId === 'T02' || dailyProblemText.includes('اضطراب'));
  const isFearDailyPromptContext = Boolean(dailyContext)
    && !hasConflictingDailyTopic
    && (dailyProblemTopicId === 'T03' || dailyRecordTopicId === 'T03' || dailyProblemText === 'ترس');
  const isHatredDailyPromptContext = Boolean(dailyContext) && !hasConflictingDailyTopic
    && (dailyProblemTopicId === 'T04' || dailyRecordTopicId === 'T04' || dailyProblemText === 'نفرت');
  const isJealousyDailyPromptContext = Boolean(dailyContext) && !hasConflictingDailyTopic
    && (dailyProblemTopicId === 'T05' || dailyRecordTopicId === 'T05' || dailyProblemText === 'حسادت');
  const isGriefDailyPromptContext = Boolean(dailyContext) && !hasConflictingDailyTopic
    && (dailyProblemTopicId === 'T06' || dailyRecordTopicId === 'T06' || dailyProblemText === 'غم و سوگ' || dailyProblemText === 'سوگ و فقدان');
  const isGuiltDailyPromptContext = Boolean(dailyContext) && !hasConflictingDailyTopic
    && (dailyProblemTopicId === 'T07' || dailyRecordTopicId === 'T07' || dailyProblemText === 'احساس گناه');
  const isTopicDailyPromptContext = isAngerDailyPromptContext || isAnxietyDailyPromptContext || isFearDailyPromptContext || isHatredDailyPromptContext || isJealousyDailyPromptContext || isGriefDailyPromptContext || isGuiltDailyPromptContext;
  const isPreparedOnlyDailyPromptContext = isTopicDailyPromptContext;
  const jealousyRelationshipGate = isJealousyDailyPromptContext ? getRelationshipSafetyGate(dailyContext?.data) : null;
  const jealousyRelationshipGatePending = Boolean(jealousyRelationshipGate && dailyContext?.relationshipSafetyConfirmed !== true);
  const jealousyRelationshipGateBlocked = jealousyRelationshipGatePending && dailyContext?.relationshipSafetyResponse === 'unsafe';
  const griefRelationshipGate = isGriefDailyPromptContext ? getRelationshipSafetyGate(dailyContext?.data) : null;
  const griefRelationshipGatePending = Boolean(griefRelationshipGate && dailyContext?.relationshipSafetyConfirmed !== true);
  const griefRelationshipGateBlocked = griefRelationshipGatePending && dailyContext?.relationshipSafetyResponse === 'unsafe';
  const guiltRelationshipGate = isGuiltDailyPromptContext ? getRelationshipSafetyGate(dailyContext?.data) : null;
  const guiltRelationshipGatePending = Boolean(guiltRelationshipGate && dailyContext?.relationshipSafetyConfirmed !== true);
  const guiltRelationshipGateBlocked = guiltRelationshipGatePending && dailyContext?.relationshipSafetyResponse === 'unsafe';
  const activePromptGroups = screen === 'books'
    ? LIBRARY_ASSISTANT_PROMPT_GROUPS
    : isAngerDailyPromptContext
      ? getAngerDailyAssistantPromptGroups(dailyContext?.day)
      : isAnxietyDailyPromptContext
        ? getAnxietyDailyAssistantPromptGroups(dailyContext?.day)
        : isFearDailyPromptContext
          ? getFearDailyAssistantPromptGroups(dailyContext?.day)
          : isHatredDailyPromptContext
            ? getHatredDailyAssistantPromptGroups(dailyContext?.day)
            : isJealousyDailyPromptContext
              ? getJealousyDailyAssistantPromptGroups(dailyContext?.day)
              : isGriefDailyPromptContext
                ? getGriefDailyAssistantPromptGroups(dailyContext?.day)
                : isGuiltDailyPromptContext
                  ? getGuiltDailyAssistantPromptGroups(dailyContext?.day)
                  : [];
  if (!visible || screen === 'bookReader') return null;

  function resizeComposerInput(element) {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(128, Math.max(54, element.scrollHeight))}px`;
  }

  function updateDraft(event) {
    const nextValue = event.target.value;
    setDraft(nextValue);
    resizeComposerInput(event.currentTarget);
  }

  function activate() {
    setOpen(true);
  }

  async function send(event, overrideMessage = null) {
    event.preventDefault();
    const message = String(overrideMessage ?? draft).trim();
    if (!message || sending) return;
    if (jealousyRelationshipGatePending || griefRelationshipGatePending || guiltRelationshipGatePending) {
      setError('پیش از ادامه، بررسی ایمنی گفت‌وگو را کامل کن یا تمرین ارتباطی را متوقف کن.');
      return;
    }
    const selectedDailyQuestion = isPreparedOnlyDailyPromptContext
      ? activePromptGroups.flatMap((group) => group.questions).find((question) => question.value === message)
      : null;
    if (isPreparedOnlyDailyPromptContext && !selectedDailyQuestion) {
      const rejectedId = ++turnSequenceRef.current;
      setMessages((current) => [...current,
        { id: `user-rejected-${rejectedId}`, role: 'user', text: message, knowledge: [] },
        { id: `assistant-rejected-${rejectedId}`, role: 'assistant', text: 'این دستیار فقط برای سؤال‌های آماده همین روز پاسخ دارد. لطفاً یکی از سؤال‌های فهرست را انتخاب کن.', knowledge: [] },
      ]);
      setDraft('');
      return;
    }
    const isDailySafetyQuestion = Boolean(selectedDailyQuestion
      && ['anger_increased', 'anxiety_increased', 'fear_increased', 'hostility_increased', 'guilt_increased', 'talk_other', 'success', 'stop'].includes(selectedDailyQuestion.kind));
    const turnId = ++turnSequenceRef.current;
    const responseId = `assistant-${turnId}`;
    const updateAssistantMessage = (text, knowledge = [], dailySafetyReminder = false) => {
      setMessages((current) => current.map((item) => item.id === responseId ? { ...item, text, knowledge, dailySafetyReminder } : item));
    };
    setMessages((current) => [...current,
      { id: `user-${turnId}`, role: 'user', text: message, knowledge: [] },
      { id: responseId, role: 'assistant', text: 'در حال بررسی پرسش...', knowledge: [] },
    ]);
    setDraft('');
    resizeComposerInput(messageInputRef.current);
    setError('');
    setSending(true);

    const updateProgress = (progress) => {
      if (progress?.stage === 'generation') {
        updateAssistantMessage('در حال تولید پاسخ با مدل زبانی عصبی محلی...');
        return;
      }
      const percent = Number.isFinite(progress?.progress) ? Math.max(0, Math.min(100, Math.round(progress.progress))) : null;
      updateAssistantMessage(percent === null
        ? 'در حال آماده‌سازی فایل‌های مدل محلی...'
        : `در حال بارگیری مدل محلی روی همین دستگاه: ${percent}٪`);
    };

    try {
      if (screen !== 'day' && isLocalModelInstallCommand(message)) {
        updateAssistantMessage('درخواست بارگیری دریافت شد. مدل فقط روی همین دستگاه آماده می‌شود...');
        try {
          await requestLocalNeuralModel('load', { allowDownload: true }, updateProgress);
          setLocalModelUnavailable(false);
          setLocalModelInstalled(true);
          updateAssistantMessage('مدل زبانی عصبی محلی با موفقیت روی این دستگاه آماده شد. برای دریافت پاسخ، پرسش اصلی‌ات را دوباره بفرست.');
        } catch (installError) {
          if (installError?.code === 'MODEL_DOWNLOAD_OFFLINE') {
            updateAssistantMessage('برای دریافت اولیه فایل مدل، اتصال اینترنت لازم است. پس از ذخیره مدل، تولید پاسخ به اینترنت نیاز ندارد و هیچ پرسشی به سرویس بیرونی ارسال نمی‌شود.');
            setLocalModelUnavailable(true);
            setLocalModelInstalled(false);
          } else if (installError?.code === 'CACHE_UNAVAILABLE' || installError?.code === 'STORAGE_QUOTA_LOW') {
            setLocalModelUnavailable(true);
            setLocalModelInstalled(false);
            updateAssistantMessage(LOCAL_MODEL_CACHE_MESSAGE + ' دستیار پایه همچنان فعال است و می‌توانی به پرسش‌هایت ادامه بدهی.');
          } else {
            setLocalModelUnavailable(true);
            setLocalModelInstalled(false);
            updateAssistantMessage('این گوشی یا مرورگر نتوانست مدل محلی را اجرا کند. دستیار پایه همچنان فعال است و می‌توانی به پرسش‌هایت ادامه بدهی.');
          }
        }
        return;
      }

      const intentGate = routeAssistantTurn({ text: message });
      const restrictedStatuses = new Set([
        // Safety handoff must always precede book retrieval. Ordinary ambiguity
        // and personal-intake clarification must not pre-empt the library engine:
        // doing so discards its pending context and blocks explicit book questions.
        'urgent_human_support_required', 'safety_clarification_required',
      ]);
      let turn;
      let isLibraryTurn = false;
      if (screen === 'books' && restrictedStatuses.has(intentGate.status)) {
        turn = { ...intentGate, conversationState: null };
      } else if (screen === 'books' && !loadedLibraryBooks.length) {
        turn = { message: 'متن کتاب‌ها هنوز بارگذاری نشده است. چند لحظه صبر کن و دوباره پرسشت را بفرست.', knowledge: [], conversationState: null };
      } else if (screen === 'books') {
        const libraryTurn = answerLibraryBookTurn({ books: loadedLibraryBooks, message, conversationState: conversationStateRef.current });
        if (libraryTurn) {
          turn = { ...libraryTurn, knowledge: [] };
          isLibraryTurn = true;
        } else {
          turn = makePageAssistantTurn({ screen, text: message, conversationState: conversationStateRef.current, dailyContext, libraryContext });
        }
      } else {
        turn = makePageAssistantTurn({ screen, text: message, conversationState: conversationStateRef.current, dailyContext, libraryContext });
      }

      conversationStateRef.current = turn.conversationState || null;
      let finalMessage = turn.message || 'برای این پرسش پاسخ قابل اتکایی در دسترس نیست.';
      if (!isPreparedOnlyDailyPromptContext && !localModelUnavailable && shouldUseLocalNeuralModel({ screen, turn, intentStatus: intentGate.status, isLibraryTurn })) {
        try {
          await requestLocalNeuralModel('load', { allowDownload: false }, updateProgress);
          updateAssistantMessage('در حال تولید پاسخ با مدل زبانی عصبی محلی...', turn.knowledge || []);
          const modelMessages = buildLocalAssistantMessages({ question: message, context: turn.message, knowledge: turn.knowledge || [] });
          const generated = await requestLocalNeuralModel('generate', { messages: modelMessages });
          finalMessage = appendLocalSourceReferences(generated.text, turn.message);
        } catch (modelError) {
          setLocalModelUnavailable(true);
          setLocalModelInstalled(false);
          if (modelError?.code === 'MODEL_NOT_INSTALLED') finalMessage += '\n\nپاسخ پایه همین حالا در دسترس است.';
          else if (modelError?.code === 'CACHE_UNAVAILABLE' || modelError?.code === 'STORAGE_QUOTA_LOW') finalMessage += `\n\n${LOCAL_MODEL_CACHE_MESSAGE} پاسخ‌گویی پایه همچنان فعال است.`;
          else finalMessage += '\n\nمدل محلی روی این دستگاه اجرا نشد؛ پاسخ بالا از دستیار پایه است و می‌توانی به پرسش‌هایت ادامه بدهی.';
        }
      }
      updateAssistantMessage(finalMessage, turn.knowledge || [], isDailySafetyQuestion);
    } catch {
      updateAssistantMessage('پاسخ آماده نشد. دوباره تلاش کن.');
    } finally {
      setSending(false);
    }
  }

  function containDialogTab(event) {
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable?.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <button
        ref={launcherRef}
        className="globalAssistantLauncher"
        type="button"
        onClick={activate}
        aria-label="باز کردن دستیار مسیر۲۸"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <AppIcon name="message" size={20} />
        <span>دستیار</span>
      </button>
      {open && (
        <div className="globalAssistantBackdrop">
          <section
            ref={dialogRef}
            className="globalAssistantDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="global-assistant-title"
            onKeyDown={containDialogTab}
          >
            <div className="globalAssistantDialogTop">
              <h2 id="global-assistant-title">دستیار راهنمای مسیر ۲۸</h2>
              <button ref={closeButtonRef} type="button" className="iconButton" onClick={() => setOpen(false)} aria-label="بستن پنجره دستیار">
                <AppIcon name="x" size={18} />
              </button>
            </div>
      {open && libraryPromptOpen && (screen === 'books' || isTopicDailyPromptContext) && (
        <div
          className="validationModal libraryAssistantPromptModal"
          onClick={(event) => {
            if (event.target === event.currentTarget) setLibraryPromptOpen(false);
          }}
        >
          <section
            ref={libraryPromptDialogRef}
            id="library-assistant-prompt-dialog"
            className="validationCard libraryAssistantPromptCard"
            role="dialog"
            aria-modal="true"
            aria-labelledby="library-assistant-prompt-title"
            onKeyDown={(event) => {
              if (event.key !== 'Tab') return;
              const options = libraryPromptDialogRef.current?.querySelectorAll('[data-prompt-option]');
              if (!options?.length) {
                event.preventDefault();
                event.stopPropagation();
                return;
              }
              const first = options[0];
              const last = options[options.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
              event.stopPropagation();
            }}
          >
            <span className="badge">پرسش‌های پیشنهادی</span>
            <h2 id="library-assistant-prompt-title">{screen === "books" ? "سؤال آماده دستیار کتابخانه" : `سؤال‌های آماده روز ${dailyContext?.day} ${isHatredDailyPromptContext ? "نفرت" : isFearDailyPromptContext ? "ترس" : isAnxietyDailyPromptContext ? "اضطراب" : isJealousyDailyPromptContext ? "حسادت" : isGriefDailyPromptContext ? "غم و سوگ" : isGuiltDailyPromptContext ? "احساس گناه" : "خشم"}`}</h2>
            <p className="muted">برای انتخاب، روی سؤال موردنظرت بزن تا برای همین روز ارسال شود.</p>
            <div className="libraryAssistantPromptOptions">
              {activePromptGroups.map((group) => (
                <section className="libraryAssistantPromptGroup" key={group.label}>
                  <h3>{group.label}</h3>
                  {group.questions.map((question) => (
                    <button
                      key={question.value}
                      type="button"
                      data-prompt-option
                      onClick={() => {
                        setDraft(question.value);
                        setLibraryPromptOpen(false);
                      }}
                    >
                      {question.label}
                    </button>
                  ))}
                </section>
              ))}
            </div>
          </section>
        </div>
      )}
            <div className="assistantChatShell globalAssistantChat" dir="rtl" aria-label="گفت‌وگوی دستیار در صفحه جاری">
              {jealousyRelationshipGatePending && jealousyRelationshipGate && (
                <section className="dailyAssistantSafetyActions" role="group" aria-label="بررسی ایمنی گفت‌وگوی رابطه‌ای" data-testid="jealousy-relationship-safety-gate">
                  <p role="alert">{jealousyRelationshipGateBlocked ? jealousyRelationshipGate.blockedMessage : jealousyRelationshipGate.question}</p>
                  {!jealousyRelationshipGateBlocked && (
                    <>
                      <p className="safetyNote">{jealousyRelationshipGate.disclaimer}</p>
                      <button type="button" data-testid="jealousy-relationship-safety-safe" disabled={sending}
                        onClick={() => onRelationshipSafetyResponse?.('safe')}>بله؛ هر دو نفر می‌توانند آزادانه گفت‌وگو را رد یا متوقف کنند.</button>
                      <button type="button" data-testid="jealousy-relationship-safety-unsafe" disabled={sending}
                        onClick={() => onRelationshipSafetyResponse?.('unsafe')}>نه، مطمئن نیستم یا یکی از ما تحت فشار است.</button>
                    </>
                  )}
                </section>
              )}
              {griefRelationshipGatePending && griefRelationshipGate && (
                <section className="dailyAssistantSafetyActions" role="group" aria-label="بررسی ایمنی درخواست حمایت" data-testid="grief-relationship-safety-gate">
                  <p role="alert">{griefRelationshipGateBlocked ? griefRelationshipGate.blockedMessage : griefRelationshipGate.question}</p>
                  {!griefRelationshipGateBlocked && (
                    <>
                      <p className="safetyNote">{griefRelationshipGate.disclaimer}</p>
                      <button type="button" data-testid="grief-relationship-safety-safe" disabled={sending}
                        onClick={() => onRelationshipSafetyResponse?.('safe')}>بله؛ هر دو نفر می‌توانند آزادانه گفت‌وگو را رد یا متوقف کنند.</button>
                      <button type="button" data-testid="grief-relationship-safety-unsafe" disabled={sending}
                        onClick={() => onRelationshipSafetyResponse?.('unsafe')}>نه، مطمئن نیستم یا یکی از ما تحت فشار است.</button>
                    </>
                  )}
                </section>
              )}
              {guiltRelationshipGatePending && guiltRelationshipGate && (
                <section className="dailyAssistantSafetyActions" role="group" aria-label="بررسی ایمنی عذرخواهی یا تماس" data-testid="guilt-relationship-safety-gate">
                  <p role="alert">{guiltRelationshipGateBlocked ? guiltRelationshipGate.blockedMessage : guiltRelationshipGate.question}</p>
                  {!guiltRelationshipGateBlocked && (
                    <>
                      <p className="safetyNote">{guiltRelationshipGate.disclaimer}</p>
                      <button type="button" data-testid="guilt-relationship-safety-safe" disabled={sending}
                        onClick={() => onRelationshipSafetyResponse?.('safe')}>بله؛ هر دو نفر می‌توانند آزادانه گفت‌وگو را رد یا متوقف کنند.</button>
                      <button type="button" data-testid="guilt-relationship-safety-unsafe" disabled={sending}
                        onClick={() => onRelationshipSafetyResponse?.('unsafe')}>نه، مطمئن نیستم یا یکی از ما تحت فشار است.</button>
                    </>
                  )}
                </section>
              )}

              <div className="assistantTranscript" dir="rtl" aria-live="polite" aria-label="پیام‌های گفت‌وگو">
                {messages.map((item, index) => (
                  <div className={item.role === 'user' ? 'userMessage' : 'assistantMessage'} key={item.id || index}>
                    <b className="globalAssistantSpeakerIcon" aria-label={item.role === 'user' ? 'شما' : 'دستیار مسیر۲۸'}>
                      {item.role === 'user' ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                          <circle cx="12" cy="12" r="9" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                          <path fillRule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 3.1a6.9 6.9 0 1 1 0 13.8 6.9 6.9 0 0 1 0-13.8Z" />
                          <path d="M10.65 1.5h2.7v21h-2.7zM1.5 10.65h21v2.7h-21z" />
                        </svg>
                      )}
                    </b>
                    <p>{formatAssistantMessageText(
                      item.dailySafetyReminder && item.text.endsWith(DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN)
                        ? item.text.slice(0, -DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN.length).trimEnd()
                        : item.text,
                    ).map((line, lineIndex) => (
                      <React.Fragment key={lineIndex}>
                        {lineIndex > 0 ? <br /> : null}
                        {line.map((part, partIndex) => part.type === 'strong'
                          ? <strong key={partIndex}>{part.text}</strong>
                          : <React.Fragment key={partIndex}>{part.text}</React.Fragment>)}
                      </React.Fragment>
                    ))}</p>
                    {item.dailySafetyReminder && (
                      <aside className="dailyAssistantSafetyReminder" role="note" data-testid="daily-assistant-safety-reminder">
                        <h3>یادآوری مهم درباره ایمنی شما</h3>
                        <p>در طول انجام تمرین‌ امروز، به احساسات و وضعیت روانی خود توجه کنید. اگر احساس کردید فشار روانی شما بیشتر شده، حالتان رو به وخامت است یا ادامه تمرین برایتان آزاردهنده شده، تمرین را متوقف کنید و به خودتان فرصت آرام‌شدن بدهید.</p>
                        <p>در چنین شرایطی، می‌توانید از یک فرد مورد اعتماد یا متخصص سلامت روان کمک بگیرید. اگر احتمال آسیب به خودتان یا فرد دیگری وجود دارد، موضوع را جدی بگیرید و از خدمات اورژانسی محل زندگی خود کمک فوری دریافت کنید.</p>
                        <p className="dailyAssistantSafetyReminderShafa">مرکز هیپنوتراپی شفا با شماره تماس ۰۹۱۹۰۸۸۹۰۶۲ همیشه در کل مسیر همراه شماست</p>
                        <p>به یاد داشته باشید: سلامت و امنیت شما از انجام هر تمرینی مهم‌تر است.</p>
                      </aside>
                    )}
                    {(item.knowledge || []).map((entry) => (
                      <div className="globalAssistantKnowledge" key={entry.item_id}>
                        <b>{entry.title}</b>
                        <p>{entry.excerpt}</p>
                        <small>منبع: {entry.source?.title || 'منبع تأییدشده'} · {entry.source?.locator || ''}</small>
                      </div>
                    ))}
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <form className={'assistantComposer' + (isPreparedOnlyDailyPromptContext || ((screen === 'books' || isTopicDailyPromptContext) && !localModelInstalled) ? ' libraryAssistantGuidedComposer' : '')} dir="rtl" data-anger-daily-prompt={String(isAngerDailyPromptContext)} data-anxiety-daily-prompt={String(isAnxietyDailyPromptContext)} data-fear-daily-prompt={String(isFearDailyPromptContext)} data-hatred-daily-prompt={String(isHatredDailyPromptContext)} data-jealousy-daily-prompt={String(isJealousyDailyPromptContext)} data-grief-daily-prompt={String(isGriefDailyPromptContext)} data-guilt-daily-prompt={String(isGuiltDailyPromptContext)} onSubmit={send}>
                {(isPreparedOnlyDailyPromptContext || ((screen === 'books' || isTopicDailyPromptContext) && !localModelInstalled)) ? (
                  <div className="libraryAssistantPromptRow">
                    <button
                      ref={libraryPromptTriggerRef}
                      className="libraryAssistantPromptTrigger"
                      data-testid={isAngerDailyPromptContext ? "anger-daily-prompt-trigger" : isAnxietyDailyPromptContext ? "anxiety-daily-prompt-trigger" : isFearDailyPromptContext ? "fear-daily-prompt-trigger" : isHatredDailyPromptContext ? "hatred-daily-prompt-trigger" : isJealousyDailyPromptContext ? "jealousy-daily-prompt-trigger" : isGriefDailyPromptContext ? "grief-daily-prompt-trigger" : isGuiltDailyPromptContext ? "guilt-daily-prompt-trigger" : "library-assistant-prompt-trigger"}
                      type="button"
                      aria-label={isTopicDailyPromptContext
                        ? `باز کردن سؤال‌های آماده روز ${dailyContext?.day} ${isHatredDailyPromptContext ? "نفرت" : isFearDailyPromptContext ? "ترس" : isAnxietyDailyPromptContext ? "اضطراب" : isJealousyDailyPromptContext ? "حسادت" : isGriefDailyPromptContext ? "غم و سوگ" : isGuiltDailyPromptContext ? "احساس گناه" : "خشم"}`
                        : "باز کردن سؤال‌های آماده دستیار کتابخانه"}
                      aria-haspopup="dialog"
                      aria-expanded={libraryPromptOpen}
                      aria-controls="library-assistant-prompt-dialog"
                      disabled={sending || !localModelStatusChecked || jealousyRelationshipGatePending || griefRelationshipGatePending || guiltRelationshipGatePending}
                      onClick={() => setLibraryPromptOpen(true)}
                    >
                      {draft.trim() || (isTopicDailyPromptContext ? `انتخاب سؤال آماده روز ${dailyContext?.day} ${isHatredDailyPromptContext ? "نفرت" : isFearDailyPromptContext ? "ترس" : isAnxietyDailyPromptContext ? "اضطراب" : isJealousyDailyPromptContext ? "حسادت" : isGriefDailyPromptContext ? "غم و سوگ" : isGuiltDailyPromptContext ? "احساس گناه" : "خشم"}...` : 'انتخاب سؤال آماده...')}
                    </button>
                    <button className="primary assistantSendButton" type="submit" aria-label="ارسال" title="ارسال سؤال انتخاب‌شده" disabled={!localModelStatusChecked || !draft.trim() || sending} aria-busy={sending}><AppIcon name="arrowUp" size={19} /></button>
                  </div>
                ) : (
                  <>
                    <label className="assistantSrOnly" htmlFor="global-assistant-message">پیام شما</label>
                    <textarea
                      id="global-assistant-message"
                      ref={messageInputRef}
                      dir="rtl"
                      rows={1}
                      maxLength={dailyContext ? 2000 : 3000}
                      value={draft}
                      onChange={updateDraft}
                      disabled={sending}
                      placeholder={screen === 'books' ? 'سؤال پیشرفته‌ات را اینجا بنویس...' : 'چطور میتونم کمکت کنم؟'}
                    />
                    <button className="primary assistantSendButton" type="submit" aria-label="ارسال" title="ارسال پیام" disabled={!draft.trim() || sending} aria-busy={sending}><AppIcon name="arrowUp" size={19} /></button>
                  </>
                )}
                {error && <p className="contactHelp assistantComposerError" role="alert">{error}</p>}
              </form>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
