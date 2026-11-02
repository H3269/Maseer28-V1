import React, { useState } from 'react';
import {
  createAssessmentSession,
  getCurrentQuestion,
  submitAssessmentAnswer,
  stopAssessment,
} from './assessmentEngine.js';
import topicRegistry from '../../../public/assistant/knowledge/topics.v1.json';

const topicNames = new Map(topicRegistry.topics.map((topic) => [topic.topic_id, topic.name]));

export default function AssessmentAssistant() {
  const [expanded, setExpanded] = useState(false);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  function start() {
    const next = createAssessmentSession();
    setSession(next);
    setMessages([{ role: 'assistant', text: getCurrentQuestion(next).prompt }]);
    setDraft('');
    setError('');
    setExpanded(true);
  }

  function send(event) {
    event.preventDefault();
    if (!session) return;
    try {
      const updated = submitAssessmentAnswer(session, draft);
      setMessages((previous) => [
        ...previous,
        { role: 'user', text: draft.trim() },
        ...(getCurrentQuestion(updated)
          ? [{ role: 'assistant', text: getCurrentQuestion(updated).prompt }]
          : updated.referral
            ? [{ role: 'assistant', text: updated.referral.instruction }]
            : updated.status === 'completed'
              ? [{ role: 'assistant', text: 'گفتگو در این مرحله کامل شد. خلاصه موقت را پایین همین بخش می‌بینی.' }]
              : updated.next_step?.message
                ? [{ role: 'assistant', text: updated.next_step.message }]
                : []),
      ]);
      setSession(updated);
      setDraft('');
      setError('');
    } catch (cause) {
      setError(cause?.message || 'ثبت پاسخ انجام نشد.');
    }
  }

  function stop() {
    setSession((previous) => stopAssessment(previous));
    setMessages([]);
    setDraft('');
    setError('');
  }

  function closeAndClear() {
    setSession((previous) => stopAssessment(previous));
    setSession(null);
    setMessages([]);
    setDraft('');
    setError('');
    setExpanded(false);
  }

  const summary = session?.summary;
  const active = session?.status === 'in_progress' && Boolean(getCurrentQuestion(session));

  return <section className="card" aria-labelledby="assistant-assessment-title">
    <span className="badge">نسخه آزمایشی</span>
    <h2 id="assistant-assessment-title">دستیار گفت‌وگوی مسیر۲۸</h2>
    <p className="muted">می‌توانی مسئله‌ات را با زبان خودت توضیح بدهی. این ابزار فقط یک دسته‌بندی اولیه و غیرتشخیصی انجام می‌دهد. بررسی ایمنی آن اعتبارسنجی بالینی نشده و نمی‌تواند خطر را رد یا تأیید کند؛ در خطر فوری به خدمات اورژانسی محل زندگی یا فرد قابل اعتماد مراجعه کن.</p>
    {!expanded && <button className="primary" type="button" onClick={start}>شروع گفت‌وگو</button>}
    {expanded && <>
      <div className="sectionHint" role="note">
        <span> <strong>i</strong> </span>
        <div><b>حریم خصوصی آزمایشی</b><small>پاسخ‌ها فقط در حافظه موقت همین صفحه نگهداری می‌شوند؛ در این نسخه ذخیره یا به سرور ارسال نمی‌شوند. اطلاعات شناسایی‌کننده ننویس.</small></div>
      </div>
      <div className="assistantTranscript" aria-live="polite">
        {messages.map((message, index) => <div className={message.role === 'assistant' ? 'assistantMessage' : 'userMessage'} key={index}>
          <b>{message.role === 'assistant' ? 'دستیار' : 'تو'}</b>
          <p>{message.text}</p>
        </div>)}
      </div>
      {active && <form onSubmit={send}>
        <label htmlFor="assistant-assessment-answer">پاسخ تو</label>
        <textarea id="assistant-assessment-answer" value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} maxLength={3000} placeholder="پاسخت را اینجا بنویس..." />
        {error && <p className="contactHelp" role="alert">{error}</p>}
        <div className="contactActions">
          <button className="primary" type="submit" disabled={!draft.trim()}>ارسال پاسخ</button>
          <button className="secondary" type="button" onClick={stop}>پایان و پاک‌کردن گفتگو</button>
        </div>
      </form>}
      {session?.status === 'paused_for_human_support' && <div className="sectionHint" role="alert"><span>!</span><div><b>اولویت با کمک انسانی است</b><small>ادامه ارزیابی خودکار متوقف شده است. از راهنمایی بالا برای دریافت کمک فوری استفاده کن و در صورت خطر قریب‌الوقوع با خدمات اورژانسی محل زندگی تماس بگیر.</small></div></div>}
      {summary && <div className="assistantSummary">
        <h3>خلاصه موقت برای بازبینی</h3>
        <p><b>آنچه گفتی:</b> {summary.user_report}</p>
        <p><b>اثر بر زندگی روزمره:</b> {summary.impact}</p>
        <p><b>مدت و تکرار:</b> {summary.duration}</p>
        <p><b>هدفت:</b> {summary.user_goal}</p>
        <p><b>موضوعات احتمالی، نه تشخیص:</b> {summary.candidate_topics.length
          ? summary.candidate_topics.map((item) => topicNames.get(item.topic_id) || item.topic_id).join('، ')
          : 'با واژه‌های فعلی موضوع مشخصی قابل پیشنهاد نیست؛ این به معنی رد هیچ موضوعی نیست.'}</p>
        <ul>{summary.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
        <p className="muted">هیچ تمرین یا درمانی به‌صورت خودکار پیشنهاد نمی‌شود؛ محتوای مناسب هنوز نیازمند تأیید علمی و تخصصی است.</p>
      </div>}
      {(session?.status === 'completed' || session?.status === 'information_request_not_supported' || session?.status === 'summary_needs_review') && <button className="secondary" type="button" onClick={start}>شروع گفت‌وگوی تازه</button>}
      {session?.status === 'stopped_by_user' && <button className="secondary" type="button" onClick={start}>شروع دوباره</button>}
      <button className="secondary" type="button" onClick={closeAndClear}>بستن و پاک‌کردن گفتگو</button>
    </>}
  </section>;
}
