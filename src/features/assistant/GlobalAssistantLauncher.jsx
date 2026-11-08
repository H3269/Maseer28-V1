import React, { useEffect, useRef, useState } from 'react';
import AppIcon from '../../shared/components/AppIcon.jsx';
import { makePageAssistantTurn } from './pageAssistantTurn.js';
import { libraryRepository } from '../library/libraryRepository.js';
import { answerLibraryBookTurn } from './libraryBookAssistant.js';
import { routeAssistantTurn } from './assistantTurnEngine.js';
import { requestLocalNeuralModel } from './localNeuralModelClient.js';
import { appendLocalSourceReferences, buildLocalAssistantMessages, isLocalModelInstallCommand, LOCAL_MODEL_CACHE_MESSAGE, LOCAL_MODEL_FAILURE_MESSAGE, LOCAL_MODEL_INSTALL_MESSAGE, shouldUseLocalNeuralModel } from './localNeuralAssistant.js';

export default function GlobalAssistantLauncher({ screen, visible = false, dailyContext = null, libraryContext = null }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
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
  }, [screen, dailyContext?.day, dailyContext?.problem, dailyContext?.relationshipSafetyConfirmed]);

  useEffect(() => {
    if (!open) return undefined;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
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
    let active = true;
    if (screen !== 'books') {
      setLoadedLibraryBooks([]);
      return undefined;
    }
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
    return () => { active = false; };
  }, [screen, libraryContext?.titles?.length]);

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

  async function send(event) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending) return;
    const turnId = ++turnSequenceRef.current;
    const responseId = `assistant-${turnId}`;
    const updateAssistantMessage = (text, knowledge = []) => {
      setMessages((current) => current.map((item) => item.id === responseId ? { ...item, text, knowledge } : item));
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
        await requestLocalNeuralModel('load', { allowDownload: true }, updateProgress);
        updateAssistantMessage('مدل زبانی عصبی محلی با موفقیت روی این دستگاه آماده شد. برای دریافت پاسخ، پرسش اصلی‌ات را دوباره بفرست.');
        return;
      }

      const intentGate = routeAssistantTurn({ text: message });
      const restrictedStatuses = new Set([
        'urgent_human_support_required', 'safety_clarification_required',
        'intent_scope_clarification_required', 'clarification_required',
        'personal_intake_required', 'invalid_input', 'input_too_long',
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
      if (shouldUseLocalNeuralModel({ screen, turn, intentStatus: intentGate.status, isLibraryTurn })) {
        try {
          await requestLocalNeuralModel('load', { allowDownload: false }, updateProgress);
          updateAssistantMessage('در حال تولید پاسخ با مدل زبانی عصبی محلی...', turn.knowledge || []);
          const modelMessages = buildLocalAssistantMessages({ question: message, context: turn.message, knowledge: turn.knowledge || [] });
          const generated = await requestLocalNeuralModel('generate', { messages: modelMessages });
          finalMessage = appendLocalSourceReferences(generated.text, turn.message);
        } catch (modelError) {
          if (modelError?.code === 'MODEL_NOT_INSTALLED') finalMessage += `\n\n${LOCAL_MODEL_INSTALL_MESSAGE}`;
          else if (modelError?.code === 'CACHE_UNAVAILABLE' || modelError?.code === 'STORAGE_QUOTA_LOW') finalMessage += `\n\n${LOCAL_MODEL_CACHE_MESSAGE}`;
          else finalMessage += `\n\n${LOCAL_MODEL_FAILURE_MESSAGE}`;
        }
      }
      updateAssistantMessage(finalMessage, turn.knowledge || []);
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
              <h2 id="global-assistant-title">دستیار هوشمند مسیر ۲۸</h2>
              <button ref={closeButtonRef} type="button" className="iconButton" onClick={() => setOpen(false)} aria-label="بستن پنجره دستیار">
                <AppIcon name="x" size={18} />
              </button>
            </div>
            <div className="assistantChatShell globalAssistantChat" dir="rtl" aria-label="گفت‌وگوی دستیار در صفحه جاری">
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
                    <p>{item.text}</p>
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
              <form className="assistantComposer" dir="rtl" onSubmit={send}>
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
                  placeholder="چطور میتونم کمکت کنم؟"
                />
                <button className="primary assistantSendButton" type="submit" aria-label="ارسال" title="ارسال پیام" disabled={!draft.trim() || sending} aria-busy={sending}><AppIcon name="arrowUp" size={19} /></button>
                {error && <p className="contactHelp assistantComposerError" role="alert">{error}</p>}
              </form>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
