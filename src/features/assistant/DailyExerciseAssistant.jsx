import React, { useEffect, useRef, useState } from 'react';
import { routeSemanticIntake } from './intentContextRouter.js';

function makeGuidance({ message, dayData, problem, day }) {
  const routed = routeSemanticIntake({ text: message });
  if (routed.safety_handoff.handoff_required) {
    return 'از روی این پیام نشانه‌ای از خطر فوری برداشت می‌شود. راهنمایی تمرین را متوقف می‌کنم. همین الآن از خدمات اورژانسی محل زندگی یا یک فرد امن و قابل اعتماد کمک بگیر.';
  }
  if (routed.next_question?.purpose === 'safety_clarification') return routed.next_question.text;
  if (routed.next_question?.purpose === 'topic_disambiguation') return routed.next_question.text;

  const exercise = String(dayData?.exercise || '').trim();
  const action = String(dayData?.actionText || '').trim();
  const topic = String(problem || 'موضوع انتخاب‌شده').trim();
  const asksHow = /چطور|چگونه|از کجا|چه جوری|نمی فهمم|متوجه نمی شوم|توضیح|منظور|سخته|سخت است|انجام بدم|انجام دهم/u.test(message);
  if (!exercise && !action) {
    return 'متن تمرین و راهکار این روز در دسترس نیست؛ نمی‌خواهم چیزی را حدس بزنم. از صفحه روز خارج نشو و بعداً دوباره تلاش کن.';
  }
  if (asksHow) {
    return [
      `داریم درباره «${topic}»، روز ${day} صحبت می‌کنیم.`,
      exercise ? `متن تمرین همین روز: ${exercise}` : '',
      action ? `راهکار اختصاصی همین روز: ${action}` : '',
      'برای اینکه دقیقاً همان چیزی را که لازم داری روشن کنم، لطفاً جمله یا مرحله‌ای از متن بالا را که مبهم است مشخص کن. من نباید بدون فهمیدن بخش مبهم، روش دیگری را جای تمرین اصلی جا بزنم.',
    ].filter(Boolean).join('\n\n');
  }
  return [
    `پیامت را در زمینه «${topic}»، روز ${day} بررسی کردم.`,
    'برای اینکه پاسخ دقیقاً به تمرین امروز مربوط باشد، بگو پرسشت درباره کدام بخش است: فهم متن تمرین، مراحل انجام آن، یا منظور راهکار اختصاصی؟',
  ].join('\n\n');
}

export default function DailyExerciseAssistant({ day, problem, data }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    setMessages([]);
    setDraft('');
    setError('');
  }, [day, problem]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  function send(event) {
    event.preventDefault();
    const message = draft.trim();
    if (!message) return;
    try {
      const response = makeGuidance({ message, dayData: data, problem, day });
      setMessages((current) => [...current, { role: 'user', text: message }, { role: 'assistant', text: response }]);
      setDraft('');
      setError('');
    } catch {
      setError('پاسخ آماده نشد. متن تمرین را دوباره باز کن و تلاش کن.');
    }
  }

  return (
    <section className="card dailyExerciseAssistant" aria-labelledby="daily-exercise-assistant-title">
      <span className="badge">راهنمای متنی آزمایشی</span>
      <h2 id="daily-exercise-assistant-title">دستیار تمرین امروز</h2>
      <p className="muted">می‌توانی درباره تمرین و راهکار همین روز سؤال کنی. این نسخه از متن روز جاری و قواعد محدود استفاده می‌کند؛ هنوز مدل هوش مصنوعی متصل نیست و پاسخ آن تشخیص یا توصیه درمانی نیست.</p>
      <div className="dailyAssistantContext">
        <b>موضوع: {problem || 'موضوع انتخاب‌شده'} · روز {day}</b>
        {data?.title && <p>{data.title}</p>}
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
