import React from 'react';
import { fa } from '../../shared/utils.js';
import { LEGACY_BOOK_META } from './legacyLibraryMeta.js';

function StudyOpenBookIcon({ size = 20 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M12 6.5C9.5 4.8 6.5 4 3 4v14c3.5 0 6.5.8 9 2.5" />
    <path d="M12 6.5C14.5 4.8 17.5 4 21 4v14c-3.5 0-6.5.8-9 2.5" />
    <path d="M12 6.5v14" />
  </svg>;
}

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
        <div className="libraryMark"><StudyOpenBookIcon size={25} /></div>
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
              <button onClick={() => onOpenBook(book)}><StudyOpenBookIcon size={17} /> {r ? 'ادامه مطالعه' : 'شروع مطالعه'}</button>
            </div>
          </article>;
        })}
      </div>}
      <button className="secondary libraryBack" onClick={onBack}><StudyOpenBookIcon size={17} /> بازگشت</button>
    </section>
  );
}
