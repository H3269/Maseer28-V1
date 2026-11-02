import React, { useEffect, useRef, useState } from 'react';
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
  const transcriptEndRef = useRef(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages]);

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
    if (!session || !draft.trim()) return;
    try {
      const answer = draft.trim();
      const updated = submitAssessmentAnswer(session, answer);
      setMessages((previous) => [
        ...previous,
        { role: 'user', text: answer },
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

  function handleComposerKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) {
      event.preventDefault();
      if (draft.trim() && active) send(event);
    }
  }

  function stop() {
    setSession((previous) => stopAssessment(previous));
    setMessages([]);
    setDraft('');
    setError('');
  }

  const summary = session?.summary;
  const knowledgeResponse = session?.knowledge_response;
  const active = session?.status === 'in_progress' && Boolean(getCurrentQuestion(session));
  const ended = session?.status === 'stopped_by_user';

  return <section className="card assistantCard" aria-labelledby="assistant-assessment-title">
    <span className="badge">نسخه آزمایشی</span>
    <h2 id="assistant-assessment-title">دستیار گفت‌وگوی مسیر۲۸</h2>
    <p className="muted">می‌توانی مسئله‌ات را با زبان خودت توضیح بدهی. این ابزار فقط یک دسته‌بندی اولیه و غیرتشخیصی انجام می‌دهد. بررسی ایمنی آن اعتبارسنجی بالینی نشده و نمی‌تواند خطر را رد یا تأیید کند؛ در خطر فوری به خدمات اورژانسی محل زندگی یا فرد قابل اعتماد مراجعه کن.</p>
    {!expanded && <button className="primary" type="button" onClick={start}>شروع گفت‌وگو</button>}
    {expanded && <>
      <div className="sectionHint" role="note">
        <span><strong>i</strong></span>
        <div><b>حریم خصوصی آزمایشی</b><small>پاسخ‌ها فقط در حافظه موقت همین صفحه نگهداری می‌شوند؛ در این نسخه ذخیره یا به سرور ارسال نمی‌شوند. اطلاعات شناسایی‌کننده ننویس.</small></div>
      </div>
      <div className="assistantChatShell" aria-label="فضای مکالمه دستیار مسیر۲۸">
        <div className="assistantTranscript" aria-label="پیام‌های مکالمه" aria-live="polite">
          {messages.map((message, index) => <div className={message.role === 'assistant' ? 'assistantMessage' : 'userMessage'} key={index}>
            <b>{message.role === 'assistant' ? 'دستیار مسیر۲۸' : 'شما'}</b>
            <p>{message.text}</p>
          </div>)}
          <div ref={transcriptEndRef} />
          {!messages.length && ended && <p className="assistantEndedNotice" role="status">گفتگو پایان یافت و متن‌های این جلسه از حافظه موقت صفحه پاک شدند.</p>}
        </div>
        {active && <form className="assistantComposer" onSubmit={send}>
          <label className="assistantSrOnly" htmlFor="assistant-assessment-answer">پیام شما</label>
          <textarea id="assistant-assessment-answer" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} rows={2} maxLength={3000} placeholder="پیامت را بنویس..." />
          <button className="primary assistantSendButton" type="submit" disabled={!draft.trim()} aria-label="ارسال پیام">ارسال</button>
          {error && <p className="contactHelp assistantComposerError" role="alert">{error}</p>}
        </form>}
      </div>
      {session && <div className="assistantConversationActions">
        {active || session.status === 'paused_for_human_support' || session.status === 'completed'
          ? <button className="secondary" type="button" onClick={stop}>پایان گفتگو</button>
          : null}
        {(ended || session.status === 'completed' || session.status === 'information_request_not_supported' || session.status === 'summary_needs_review' || session.status === 'intent_scope_unclear' || session.status === 'information_answer_available') && <button className="primary" type="button" onClick={start}>شروع گفت‌وگوی تازه</button>}
      </div>}
      {session?.status === 'paused_for_human_support' && <div className="sectionHint" role="alert"><span>!</span><div><b>اولویت با کمک انسانی است</b><small>ادامه ارزیابی خودکار متوقف شده است. از راهنمایی بالا برای دریافت کمک فوری استفاده کن و در صورت خطر قریب‌الوقوع با خدمات اورژانسی محل زندگی تماس بگیر.</small></div></div>}
      {knowledgeResponse && <div className="assistantKnowledgeResponse">
        <h3>پاسخ مستند از پایگاه دانش</h3>
        <p>{knowledgeResponse.message}</p>
        <ol>
          {knowledgeResponse.results.map((item) => <li key={item.item_id}>
            <b>{item.title}</b>
            <p>{item.excerpt}</p>
            <small>منبع: {item.source.title} | شناسه منبع: {item.source.source_id} | محل ارجاع: {item.source.locator}</small>
            <small>بازبینی: {item.approval.reviewer_role} | شناسه بازبینی: {item.approval.review_record_id} | نسخه: {item.approval.version}</small>
          </li>)}
        </ol>
      </div>}
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
    </>}
  </section>;
}
