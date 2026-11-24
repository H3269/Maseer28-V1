import React from 'react';
import { formatAssistantMessageText } from './assistantMessageFormatting.js';

/**
 * Pure transcript renderer. It receives already-produced messages and reveal
 * state; it does not own sending, safety routing, or timer lifecycle.
 */
export default function AssistantTranscript({ messages, sending, typingProgress, latestAssistantRef }) {
  return (
<div className="assistantTranscript" dir="rtl" aria-live="polite" aria-label="پیام‌های گفت‌وگو">
                {messages.map((item, index) => {
                  const isLatestAssistant = item.role === 'assistant' && index === messages.length - 1;
                  const revealNotInitialized = isLatestAssistant && !sending && typingProgress?.id !== item.id;
                  const isLatestAssistantTyping = isLatestAssistant && (
                    sending || revealNotInitialized || (typingProgress?.id === item.id && typingProgress.active)
                  );
                  const visibleMessageText = item.role === 'assistant' && typingProgress?.id === item.id
                    ? typingProgress.text
                    : revealNotInitialized ? '' : item.text;
                  return (
                  <div
                    className={item.role === 'user' ? 'userMessage' : 'assistantMessage'}
                    key={item.id || index}
                    ref={item.role === 'assistant' && index === messages.length - 1 ? latestAssistantRef : null}
                    data-testid={item.role === 'assistant' && index === messages.length - 1 ? 'latest-assistant-message' : undefined}
                  >
                    <b
                      className="globalAssistantSpeakerIcon"
                      aria-label={item.role === 'user' ? 'شما' : 'دستیار مسیر۲۸'}
                      data-assistant-state={item.role === 'assistant' && index === messages.length - 1
                        ? (sending ? 'thinking' : typingProgress?.id === item.id && typingProgress.active ? 'typing' : 'idle')
                        : 'idle'}
                    >
                      {item.role === 'user' ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                          <circle cx="12" cy="12" r="9" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                          <path d="M12 2.8 14.25 9.75 21.2 12l-6.95 2.25L12 21.2l-2.25-6.95L2.8 12l6.95-2.25L12 2.8Z" />
                          <path d="m19 2 .7 2.3L22 5l-2.3.7L19 8l-.7-2.3L16 5l2.3-.7L19 2Z" />
                          <circle cx="5" cy="19" r="1" />
                        </svg>
                      )}
                    </b>
                    <p>{formatAssistantMessageText(visibleMessageText).map((line, lineIndex) => (
                      <React.Fragment key={lineIndex}>
                        {lineIndex > 0 ? <br /> : null}
                        {line.map((part, partIndex) => part.type === 'strong'
                          ? <strong key={partIndex}>{part.text}</strong>
                          : <React.Fragment key={partIndex}>{part.text}</React.Fragment>)}
                      </React.Fragment>
                    ))}</p>
                    {item.dailySafetyReminder && !isLatestAssistantTyping && (
                      <aside className="dailyAssistantSafetyReminder" role="note" data-testid="daily-assistant-safety-reminder">
                        <h3>یادآوری مهم درباره ایمنی شما</h3>
                        <p>در طول انجام تمرین‌ امروز، به احساسات و وضعیت روانی خود توجه کنید. اگر احساس کردید فشار روانی شما بیشتر شده، حالتان رو به وخامت است یا ادامه تمرین برایتان آزاردهنده شده، تمرین را متوقف کنید و به خودتان فرصت آرام‌شدن بدهید.</p>
                        <p>در چنین شرایطی، می‌توانید از یک فرد مورد اعتماد یا متخصص سلامت روان کمک بگیرید. اگر احتمال آسیب به خودتان یا فرد دیگری وجود دارد، موضوع را جدی بگیرید و از خدمات اورژانسی محل زندگی خود کمک فوری دریافت کنید.</p>
                        <p>به یاد داشته باشید: سلامت و امنیت شما از انجام هر تمرینی مهم‌تر است.</p>
                      </aside>
                    )}
                    {(item.knowledge || []).map((entry) => (
                      <div className="globalAssistantKnowledge" key={entry.item_id}>
                        <b>{entry.title}</b>
                        <p>{entry.excerpt}</p>
                        <small>منبع: {entry.source?.title || 'منبع تأییدشده'} · {entry.source?.locator || ''}</small>
                      </div>
                    ))}
                  </div>
                  );
                })}
              </div>
  );
}
