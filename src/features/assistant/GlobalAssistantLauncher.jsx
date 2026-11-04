import React, { useEffect, useRef, useState } from 'react';
import AppIcon from '../../shared/components/AppIcon.jsx';

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
  const launcherRef = useRef(null);
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const isDailyExercise = screen === 'day';
  const pageLabel = SCREEN_LABELS[screen] || 'صفحه جاری';

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
              <span className="badge">دسترسی آزمایشی</span>
              <button ref={closeButtonRef} type="button" className="iconButton" onClick={() => setOpen(false)} aria-label="بستن پنجره دستیار">
                <AppIcon name="x" size={18} />
              </button>
            </div>
            <h2 id="global-assistant-title">دستیار مسیر۲۸</h2>
            <p className="globalAssistantPageContext">صفحه فعلی: <b>{pageLabel}</b></p>
            <p id="global-assistant-description">
              دکمه دستیار در این صفحه قرار گرفته است، اما هنوز محتوای این بخش به موتور پاسخ‌گویی متصل نیست.
              در حال حاضر راهنمای متنی محلی فقط داخل صفحه تمرین روزانه فعال است؛ بنابراین این پنجره فعلاً پیام دریافت نمی‌کند و پاسخی حدس نمی‌زند.
            </p>
            <p className="muted globalAssistantPrivacyNote">
              هیچ پیام یا محتوایی از این صفحه به سرویس ابری ارسال نمی‌شود.
            </p>
            <button type="button" className="primary globalAssistantCloseAction" onClick={() => setOpen(false)}>
              متوجه شدم
            </button>
          </section>
        </div>
      )}
    </>
  );
}
