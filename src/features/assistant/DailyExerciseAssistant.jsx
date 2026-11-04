import React, { useEffect, useRef, useState } from 'react';
import { makeDailyExerciseGuidanceTurn, selectDailyExerciseGuidanceData } from './dailyExerciseAssistantGuidance.js';
import { getDailyAssistantAccess } from './dailyAssistantAccess.js';

export default function DailyExerciseAssistant({ day, problem, data, guidanceData, relationshipSafetyConfirmed = false }) {
  const access = getDailyAssistantAccess({ day: data, relationshipSafetyConfirmed });
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [conversationState, setConversationState] = useState({ safetyStatus: 'none' });
  const endRef = useRef(null);

  useEffect(() => {
    setMessages([]);
    setDraft('');
    setError('');
    // A day/topic change clears ordinary chat references, not an unresolved safety gate.
    setConversationState((current) => ({
      safetyStatus: current.safetyStatus,
      lastUserMessage: '',
      lastAssistantMessage: '',
      lastTopic: '',
      contextDay: String(day ?? ''),
      contextTopic: String(problem || 'موضوع انتخاب‌شده').trim().slice(0, 100),
    }));
  }, [day, problem]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  function send(event) {
    event.preventDefault();
    const message = draft.trim();
    if (!message) return;
    try {
      const turn = makeDailyExerciseGuidanceTurn({
        message,
        dayData: selectDailyExerciseGuidanceData({ guidanceData, data }),
        problem,
        day,
        conversationState,
      });
      setMessages((current) => [...current, { role: 'user', text: message }, { role: 'assistant', text: turn.response }]);
      setConversationState(turn.nextState);
      setDraft('');
      setError('');
    } catch {
      setError('پاسخ آماده نشد. متن تمرین را دوباره باز کن و تلاش کن.');
    }
  }

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
      <span className="badge">راهنمای متنی آزمایشی</span>
      <h2 id="daily-exercise-assistant-title">دستیار تمرین امروز</h2>
      <p className="muted">می‌توانی درباره تمرین و راهکار همین روز سؤال کنی. این نسخه از متن روز جاری و قواعد محدود استفاده می‌کند؛ هنوز مدل هوش مصنوعی متصل نیست و هیچ پیام یا اطلاعاتی به مدل ابری ارسال نمی‌شود. پاسخ آن تشخیص یا توصیه درمانی نیست.</p>
      {access.requiresCaution && <div className="safetyNote" role="note"><b>این روز نیازمند احتیاط است</b><p>{data?.when_to_seek_human_support || 'فقط در موقعیتی امن و قابل‌تحمل پیش برو و اگر فشار یا خطر بیشتر شد، تمرین را متوقف کن و از حمایت انسانی مناسب کمک بگیر.'}</p>{Array.isArray(data?.stop_conditions) && data.stop_conditions.length > 0 && <ul>{data.stop_conditions.map((item, index) => <li key={`assistant-stop-${index}`}>{item}</li>)}</ul>}</div>}
      <div className="dailyAssistantContext">
        <b>موضوع: {problem || 'موضوع انتخاب‌شده'} · روز {day}</b>
        {(guidanceData?.title || data?.title) && <p>{guidanceData?.title || data.title}</p>}
      </div>
      <div className="assistantChatShell" aria-label="گفت‌وگوی راهنمای تمرین">
        <div className="assistantTranscript" aria-live="polite" aria-label="پیام‌های گفت‌وگو">
          {!messages.length && <div className="assistantMessage"><b>دستیار مسیر۲۸</b><p>اگر بخشی از تمرین یا راهکار امروز برایت روشن نیست، همان بخش را بپرس یا عین عبارت مبهم را بنویس.</p></div>}
          {messages.map((item, index) => <div className={item.role === 'user' ? 'userMessage' : 'assistantMessage'} key={index}><b>{item.role === 'user' ? 'شما' : 'دستیار مسیر۲۸'}</b><p>{item.text}</p></div>)}
          <div ref={endRef} />
        </div>
        <form className="assistantComposer" onSubmit={send}>
          <label className="assistantSrOnly" htmlFor="daily-exercise-assistant-message">پیام شما</label>
          <textarea id="daily-exercise-assistant-message" rows={2} maxLength={2000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="درباره تمرین امروز بپرس..." />
          <button className="primary assistantSendButton" type="submit" disabled={!draft.trim()}>ارسال</button>
          {error && <p className="contactHelp assistantComposerError" role="alert">{error}</p>}
        </form>
      </div>
    </section>
  );
}
