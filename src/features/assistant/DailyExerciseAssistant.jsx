import React from 'react';
import { getDailyAssistantAccess } from './dailyAssistantAccess.js';

export default function DailyExerciseAssistant({ day, problem, data, relationshipSafetyConfirmed = false }) {
  const access = getDailyAssistantAccess({ day: data, problem, relationshipSafetyConfirmed });

  if (!access.available) {
    const blocked = access.reason === 'daily_content_blocked';
    const message = blocked
      ? 'این محتوای روز به‌دلیل نیاز به بازبینی ایمنی برای اجرا یا راهنمایی دستیار فعال نیست. لطفاً آن را از مسیر دستیار دور نزن.'
      : access.reason === 'relationship_safety_unconfirmed'
        ? 'پیش از نمایش راهنمای این تمرین، بررسی ایمنی همین روز را در بخش تمرین کامل کن. اگر پاسخ تو «نه» یا «مطمئن نیستم» است، تمرین و راهنمای آن فعال نمی‌شوند.'
        : 'محتوای روز جاری در دسترس نیست؛ بنابراین راهنمایی روزمحور فعال نمی‌شود.';
    return (
      <section className="card dailyExerciseAssistant" aria-labelledby="daily-exercise-assistant-title">
        <h2 id="daily-exercise-assistant-title">دستیار تمرین امروز</h2>
        <p className="safetyNote" role="note">{message}</p>
      </section>
    );
  }

  return (
    <section className="card dailyExerciseAssistant" aria-labelledby="daily-exercise-assistant-title">
      <h2 id="daily-exercise-assistant-title">دستیار تمرین امروز</h2>
      <div className="dailyAssistantContext">
        <b>موضوع: {problem || 'موضوع انتخاب‌شده'} · روز {day}</b>
        {data?.title && <p>{data.title}</p>}
      </div>
      {access.requiresCaution && <div className="safetyNote" role="note">
        <b>این روز نیازمند احتیاط است</b>
        <p>{data?.when_to_seek_human_support || 'فقط در موقعیتی امن و قابل‌تحمل پیش برو و اگر فشار یا خطر بیشتر شد، تمرین را متوقف کن و از حمایت انسانی مناسب کمک بگیر.'}</p>
        {Array.isArray(data?.stop_conditions) && data.stop_conditions.length > 0 && <ul>{data.stop_conditions.map((item, index) => <li key={`assistant-stop-${index}`}>{item}</li>)}</ul>}
      </div>}
      <p className="muted" role="status">این بخش فقط با انتخاب سؤال‌های آماده کار می‌کند. امکان نوشتن یا ارسال سؤال آزاد فعال نیست.</p>
    </section>
  );
}
