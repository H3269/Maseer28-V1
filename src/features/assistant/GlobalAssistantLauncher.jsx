import React, { useEffect, useRef, useState } from 'react';
import AppIcon from '../../shared/components/AppIcon.jsx';
import { makePageAssistantTurn } from './pageAssistantTurn.js';

const SCREEN_LABELS = {
  dashboard: 'خانه',
  profile: 'پروفایل',
  pathSetup: 'تنظیم مسیر',
  day: 'تمرین روزانه',
  dailyResult: 'نتیجه تمرین',
  books: 'کتابخانه',
  bookReader: 'مطالعه کتاب',
  support: 'پشتیبانی',
  final: 'ارزیابی پایانی',
  done: 'پایان مسیر',
  report: 'گزارش مسیر',
  archive: 'آرشیو',
};

export default function GlobalAssistantLauncher({ screen, visible = false }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const launcherRef = useRef(null);
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const endRef = useRef(null);
  const isDailyExercise = screen === 'day';
  const pageLabel = SCREEN_LABELS[screen] || 'صفحه جاری';

  useEffect(() => {
    setMessages([]);
    setDraft('');
    setError('');
  }, [screen]);

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

  if (!visible || screen === 'bookReader') return null;

  function activate() {
    if (isDailyExercise) {
      const target = document.querySelector('.dailyExerciseAssistant');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
    setOpen(true);
  }

  function send(event) {
    event.preventDefault();
    const message = draft.trim();
    if (!message) return;
    try {
      const turn = makePageAssistantTurn({ screen, text: message });
      setMessages((current) => [
        ...current,
        { role: 'user', text: message, knowledge: [] },
        { role: 'assistant', text: turn.message, knowledge: turn.knowledge || [] },
      ]);
      setDraft('');
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
        aria-haspopup={isDailyExercise ? undefined : 'dialog'}
        aria-expanded={isDailyExercise ? undefined : open}
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
            aria-describedby="global-assistant-description"
            onKeyDown={containDialogTab}
          >
            <div className="globalAssistantDialogTop">
              <span className="badge">راهنمای محلی محدود</span>
              <button ref={closeButtonRef} type="button" className="iconButton" onClick={() => setOpen(false)} aria-label="بستن پنجره دستیار">
                <AppIcon name="x" size={18} />
              </button>
            </div>
            <h2 id="global-assistant-title">دستیار مسیر۲۸</h2>
            <p className="globalAssistantPageContext">صفحه فعلی: <b>{pageLabel}</b></p>
            <p id="global-assistant-description">
              این نسخه فقط به پرسش‌های ثابت درباره کاربرد صفحه، گزینه‌های همان صفحه و راه بازگشت پاسخ می‌دهد. درخواست‌های شخصی به موتور محدود فعلی ارجاع می‌شوند؛ پاسخ آن تشخیص یا توصیه درمانی نیست. هنوز مدل هوش مصنوعی یا گفت‌وگوی پیوسته فعال نشده است.
            </p>
            <p className="muted globalAssistantPrivacyNote">
              پردازش این نسخه در مرورگر انجام می‌شود؛ پیام‌ها به سرویس ابری ارسال نمی‌شوند و با تغییر صفحه، گفت‌وگوی این پنجره پاک می‌شود.
            </p>
            <div className="assistantChatShell globalAssistantChat" aria-label="گفت‌وگوی دستیار در صفحه جاری">
              <div className="assistantTranscript" aria-live="polite" aria-label="پیام‌های گفت‌وگو">
                {!messages.length && (
                  <div className="assistantMessage">
                    <b>دستیار مسیر۲۸</b>
                    <p>می‌توانی بپرسی «اینجا چه کارهایی می‌توانم انجام بدهم؟» یا «این صفحه برای چیست؟»</p>
                  </div>
                )}
                {messages.map((item, index) => (
                  <div className={item.role === 'user' ? 'userMessage' : 'assistantMessage'} key={index}>
                    <b>{item.role === 'user' ? 'شما' : 'دستیار مسیر۲۸'}</b>
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
              <form className="assistantComposer" onSubmit={send}>
                <label className="assistantSrOnly" htmlFor="global-assistant-message">پیام شما</label>
                <textarea
                  id="global-assistant-message"
                  rows={2}
                  maxLength={3000}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="درباره همین صفحه بپرس..."
                />
                <button className="primary assistantSendButton" type="submit" disabled={!draft.trim()}>ارسال</button>
                {error && <p className="contactHelp assistantComposerError" role="alert">{error}</p>}
              </form>
            </div>
            <button type="button" className="primary globalAssistantCloseAction" onClick={() => setOpen(false)}>
              متوجه شدم
            </button>
          </section>
        </div>
      )}
    </>
  );
}
