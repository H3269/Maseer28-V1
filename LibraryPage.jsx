import React from 'react';
import { fa } from '../../shared/utils.js';
import { LEGACY_BOOK_META } from './legacyLibraryMeta.js';

const READER_PROGRESS_KEY = 'maseer28_reader_progress_v66';

function readProgress() {
  try { return JSON.parse(localStorage.getItem(READER_PROGRESS_KEY) || '{}') || {}; }
  catch { return {}; }
}

function Cover({ book }) {
  const src = book.coverDataUrl || book.coverUrl;
  return src ? <img className="libraryCover" src={src} alt={`جلد ${book.title}`} /> : (
    <div className="libraryCoverFallback" role="img" aria-label="جلد کتابچه تکمیلی جلد سوم">
      <small>از حقیقت تا واقعیت</small>
      <strong>کتابچه تکمیلی<br/>جلد سوم</strong>
      <span>کاربرگ‌ها و تمرین‌های عملی<br/>مرکز هیپنوتراپی شفا</span>
    </div>
  );
}

export default function LibraryPage({ books, loading, error, onOpenBook, onBack }) {
  const progress = readProgress();
  return (
    <section className="card libraryShell" id="books">
      <div className="libraryHeader">
        <div><span className="badge">کتابخانه اختصاصی</span><h2>کتابخانه مسیر</h2></div>
        <div className="libraryMark">📚</div>
      </div>
      {loading && <div className="muted">در حال آماده‌سازی کتابخانه…</div>}
      {error && <div className="feedback">{error}</div>}
      {!loading && !error && <div className="libraryGrid">
        {books.map((book) => {
          const legacy = LEGACY_BOOK_META[Number(book.legacyId)] || {};
          const title = book.customTitle ? book.title : (legacy.title || book.title);
          const subtitle = book.customSubtitle ? book.subtitle : (legacy.subtitle || book.subtitle || '');
          const note = book.note || legacy.note || book.description || '';
          const r = progress[book.legacyId] || progress[book.id];
          const pct = r?.total ? Math.round((Number(r.page) + 1) / Number(r.total) * 100) : 0;
          return <article className="libraryBook" key={book.id}>
            <div className="libraryCoverWrap">
              <Cover book={book}/>
              <span className="libraryBookBadge">{Number(book.legacyId) <= 3 ? `جلد ${fa(book.legacyId)}` : Number(book.legacyId) === 4 ? 'تکمیلی' : 'کتاب'}</span>
            </div>
            <div className="libraryBookInfo">
              <h3>{title}</h3>
              <p>{subtitle}<br/>{note}</p>
              <div className="libraryProgress"><span style={{width:`${Math.max(0,Math.min(100,pct))}%`}} /></div>
              <button onClick={() => onOpenBook(book)}>{r ? 'ادامه مطالعه' : 'شروع مطالعه'}</button>
            </div>
          </article>;
        })}
      </div>}
      <button className="secondary libraryBack" onClick={onBack}>بازگشت</button>
    </section>
  );
}
