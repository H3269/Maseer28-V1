import React, { useEffect, useState } from 'react';
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
  const isDailyExercise = screen === 'day';
  const pageLabel = SCREEN_LABELS[screen] || 'صفحه جاری';

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
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

  return (
    <>
      <button
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
            className="globalAssistantDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="global-assistant-title"
            aria-describedby="global-assistant-description"
          >
            <div className="globalAssistantDialogTop">
              <span className="badge">دسترسی آزمایشی</span>
              <button type="button" className="iconButton" onClick={() => setOpen(false)} aria-label="بستن پنجره دستیار">
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
