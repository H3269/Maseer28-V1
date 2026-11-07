import React, { useEffect, useRef, useState } from 'react';
import AppIcon from '../../shared/components/AppIcon.jsx';
import { makePageAssistantTurn } from './pageAssistantTurn.js';
import { libraryRepository } from '../library/libraryRepository.js';
import { answerLibraryBookTurn } from './libraryBookAssistant.js';

export default function GlobalAssistantLauncher({ screen, visible = false, dailyContext = null, libraryContext = null }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
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
    if (!message) return;
    try {
      let turn;
      if (screen === 'books' && !loadedLibraryBooks.length) {
        turn = { message: 'متن کتاب‌ها هنوز بارگذاری نشده است. چند لحظه صبر کن و دوباره پرسشت را بفرست.', knowledge: [], conversationState: null };
      } else {
        const libraryTurn = screen === 'books'
          ? answerLibraryBookTurn({ books: loadedLibraryBooks, message, conversationState: conversationStateRef.current })
          : null;
        if (libraryTurn) {
          turn = { ...libraryTurn, knowledge: [] };
        } else {
          turn = makePageAssistantTurn({ screen, text: message, conversationState: conversationStateRef.current, dailyContext, libraryContext });
        }
      }
      conversationStateRef.current = turn.conversationState || null;
      setMessages((current) => [
        ...current,
        { role: 'user', text: message, knowledge: [] },
        { role: 'assistant', text: turn.message, knowledge: turn.knowledge || [] },
      ]);
      setDraft('');
      resizeComposerInput(messageInputRef.current);
      setError('');
    } catch {
      setError('پاسخ آماده نشد. دوباره تلاش کن.');
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
                  <div className={item.role === 'user' ? 'userMessage' : 'assistantMessage'} key={index}>
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
                  placeholder="چطور میتونم کمکت کنم؟"
                />
                <button className="primary assistantSendButton" type="submit" aria-label="ارسال" title="ارسال پیام" disabled={!draft.trim()}><AppIcon name="arrowUp" size={19} /></button>
                {error && <p className="contactHelp assistantComposerError" role="alert">{error}</p>}
              </form>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
