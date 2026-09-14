import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fa } from '../../shared/utils.js';
import { libraryRepository } from './libraryRepository.js';
import {
  READER_LINES_PER_PAGE,
  buildLegacyReaderLayout,
  currentChapter,
  endsSentence,
  pageForSource,
} from './readerEngine.js';

const READER_SETTINGS_KEY = 'maseer28_reader_settings_v64';
const READER_PROGRESS_KEY = 'maseer28_reader_progress_v66';

const LEGACY_META = {
  1: { title: 'از حقیقت تا واقعیت', subtitle: 'جلد اول' },
  2: { title: 'از حقیقت تا واقعیت', subtitle: 'جلد دوم · دگردیسی' },
  3: { title: 'از حقیقت تا واقعیت', subtitle: 'جلد سوم · موانع پنهان تحقق' },
  4: { title: 'کتابچه تکمیلی جلد سوم', subtitle: 'دفتر کار ۲۸ روزه · نقشه تغییر' },
};

function loadSettings() {
  try {
    const x = JSON.parse(localStorage.getItem(READER_SETTINGS_KEY) || '{}');
    return {
      fontStep: Math.max(-2, Math.min(4, Number(x.fontStep) || 0)),
      theme: ['light', 'sepia', 'night'].includes(x.theme) ? x.theme : 'light',
    };
  } catch {
    return { fontStep: 0, theme: 'light' };
  }
}

function progressMap() {
  try { return JSON.parse(localStorage.getItem(READER_PROGRESS_KEY) || '{}') || {}; }
  catch { return {}; }
}

function bookKey(book) { return book.legacyId || book.id; }

function saveProgress(book, page, total, source) {
  try {
    const map = progressMap();
    map[bookKey(book)] = { page, total, source: Number(source) || 1, updatedAt: new Date().toISOString() };
    localStorage.setItem(READER_PROGRESS_KEY, JSON.stringify(map));
  } catch { /* storage can be unavailable in embedded browsers */ }
}


function sourceLabel(book, content) {
  const id = Number(book.legacyId) || 0;
  const legacy = LEGACY_META[id];
  const title = legacy?.title || book.title || content?.title || 'از حقیقت تا واقعیت';
  const subtitle = legacy?.subtitle || book.subtitle || content?.subtitle || '';
  if (id >= 1 && id <= 3) return `منبع: ${title} — ${subtitle || `جلد ${fa(id)}`}`;
  if (id === 4) return `منبع: ${title}${subtitle ? ` — ${subtitle}` : ''}`;
  return `منبع: ${title}`;
}

function calcMetrics(root, article, fontStep, targetVisible) {
  if (!root || !article) return null;
  const selectors = ['.readerTopbar', '.readerProgressTrack', '.readerTools', '.readerBottombar'];
  let fixed = 0;
  selectors.forEach((selector) => {
    const el = root.querySelector(selector);
    if (el) fixed += el.getBoundingClientRect().height;
  });
  const target = root.querySelector('#bookTarget');
  if (targetVisible && target) fixed += target.getBoundingClientRect().height + 5;
  const spare = Math.max(260, root.clientHeight - fixed - 14);
  const linePx = Math.max(20, Math.min(52, Math.floor(spare / READER_LINES_PER_PAGE)));
  const base = Math.max(15, Math.min(22, Math.round(linePx * 0.47)));
  const fontPx = Math.max(13, base + fontStep);
  root.style.setProperty('--reader-line-px', `${linePx}px`);
  root.style.setProperty('--reader-font-size', `${fontPx}px`);
  article.style.height = `${linePx * READER_LINES_PER_PAGE}px`;
  const family = getComputedStyle(root).fontFamily || 'Tahoma, Arial, sans-serif';
  return { width: Math.max(1, article.clientWidth), linePx, fontPx, family };
}

function lineClass(line) {
  const classes = ['readerFixedLine', line?.kind || 'blank'];
  if (line?.paraStart) classes.push('paraStart');
  if (line?.paraEnd) classes.push('lineEnd');
  else if (line?.sentenceEnd || endsSentence(line?.text)) classes.push('sentenceEnd');
  else if (line?.lineContinue) classes.push('lineContinue');
  return classes.join(' ');
}

export default function Reader({ book, onClose, initialSourcePage = null, target = null, initialPage = null }) {
  const [version, setVersion] = useState(null);
  const [layout, setLayout] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const [settings, setSettings] = useState(loadSettings);
  const [error, setError] = useState('');
  const rootRef = useRef(null);
  const articleRef = useRef(null);
  const touchRef = useRef(null);
  const suppressClickUntil = useRef(0);
  const activePointer = useRef(null);
  const preserveSourceRef = useRef(null);
  const firstLayoutRef = useRef(true);

  useEffect(() => {
    let alive = true;
    setVersion(null); setLayout(null); setError(''); firstLayoutRef.current = true;
    libraryRepository.getVersion(book.activeVersionId).then((row) => {
      if (!row) throw new Error('نسخه فعال کتاب پیدا نشد.');
      if (alive) setVersion(row);
    }).catch((e) => { if (alive) setError(e?.message || 'متن کتاب بارگذاری نشد.'); });
    return () => { alive = false; };
  }, [book]);

  const rebuild = useCallback((preserveSource = null) => {
    if (!version?.content || !rootRef.current || !articleRef.current) return;
    const metrics = calcMetrics(rootRef.current, articleRef.current, settings.fontStep, Boolean(target));
    if (!metrics) return;
    const nextLayout = buildLegacyReaderLayout({
      book: version.content,
      bookId: book.legacyId || book.id,
      cover: book.coverDataUrl || book.coverUrl || '',
      width: metrics.width,
      fontPx: metrics.fontPx,
      fontFamily: metrics.family,
    });
    setLayout(nextLayout);

    let nextPage = 0;
    if (firstLayoutRef.current) {
      const explicit = Number(initialSourcePage);
      if (target?.sourcePage) nextPage = pageForSource(nextLayout, target.sourcePage);
      else if (Number.isFinite(explicit) && explicit > 1) nextPage = pageForSource(nextLayout, explicit);
      else if (initialPage != null && Number.isFinite(Number(initialPage))) nextPage = Math.max(0, Math.min(nextLayout.pageCount - 1, Number(initialPage)));
      else {
        const stored = progressMap()[bookKey(book)];
        nextPage = stored?.source ? pageForSource(nextLayout, stored.source) : 0;
      }
      firstLayoutRef.current = false;
    } else if (preserveSource != null && Number(preserveSource) > 0) nextPage = pageForSource(nextLayout, preserveSource);
    else nextPage = 0;
    setPageIndex(Math.max(0, Math.min(nextLayout.pageCount - 1, nextPage)));
  }, [version, settings.fontStep, target, initialSourcePage, initialPage, book]);

  useLayoutEffect(() => {
    if (!version) return undefined;
    const frame = requestAnimationFrame(() => rebuild(preserveSourceRef.current));
    preserveSourceRef.current = null;
    return () => cancelAnimationFrame(frame);
  }, [version, settings.fontStep, rebuild]);

  useEffect(() => {
    const onResize = () => {
      clearTimeout(onResize.timer);
      onResize.timer = setTimeout(() => {
        const current = layout?.pages?.[pageIndex];
        preserveSourceRef.current = ['cover', 'frontispiece'].includes(current?.type) ? 0 : Number(current?.sourcePage) || 1;
        rebuild(preserveSourceRef.current);
      }, 160);
    };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); clearTimeout(onResize.timer); };
  }, [layout, pageIndex, rebuild]);

  useEffect(() => {
    try { localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify(settings)); } catch { /* noop */ }
  }, [settings]);

  const current = layout?.pages?.[pageIndex] || null;
  const chapter = useMemo(() => currentChapter(layout, pageIndex), [layout, pageIndex]);

  useEffect(() => {
    if (!layout || !current) return;
    const source = ['cover', 'frontispiece'].includes(current.type) ? 0 : Number(current.sourcePage) || 1;
    saveProgress(book, pageIndex, layout.pageCount, source || 1);
  }, [book, layout, current, pageIndex]);

  const next = useCallback(() => {
    if (!layout || pageIndex >= layout.pageCount - 1) return;
    setPageIndex((value) => value + 1);
  }, [layout, pageIndex]);

  const prev = useCallback(() => {
    if (!layout || pageIndex <= 0) return;
    setPageIndex((value) => value - 1);
  }, [layout, pageIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const node = e.target;
      const tag = String(node?.tagName || '').toLowerCase();
      if (node?.isContentEditable || tag === 'textarea' || tag === 'select') return;
      if (tag === 'input' && node?.id !== 'readerPageRange') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); next(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); prev(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [next, prev]);

  function changeFont(delta) {
    preserveSourceRef.current = ['cover', 'frontispiece'].includes(current?.type) ? 0 : Number(current?.sourcePage) || 1;
    setSettings((s) => ({ ...s, fontStep: Math.max(-2, Math.min(4, s.fontStep + Number(delta || 0))) }));
  }

  function cycleTheme() {
    setSettings((s) => ({ ...s, theme: s.theme === 'light' ? 'sepia' : s.theme === 'sepia' ? 'night' : 'light' }));
  }

  if (error) {
    return <section id="bookReader" className="bookReaderFull"><div className="validationModal"><div className="validationCard"><span className="badge">خطا در کتابخانه</span><h2>خطا در کتابخانه</h2><ul><li>{error}</li></ul><button className="primary" onClick={onClose}>متوجه شدم</button></div></div></section>;
  }

  const total = layout?.pageCount || 1;
  const pct = layout ? ((pageIndex + 1) / total) * 100 : 0;
  const source = ['cover', 'frontispiece'].includes(current?.type) ? 0 : Number(current?.sourcePage) || 1;
  const title = version?.content?.title || book.title || '-';
  const meta = current?.type === 'cover'
    ? `${fa(pageIndex + 1)} از ${fa(total)} · جلد اصلی`
    : current?.type === 'frontispiece'
      ? `${fa(pageIndex + 1)} از ${fa(total)} · صفحه آغازین`
      : `${fa(pageIndex + 1)} از ${fa(total)} · مرجع ${fa(source)}`;
  const chapterLabel = current?.type === 'cover'
    ? 'جلد کتاب'
    : current?.type === 'frontispiece'
      ? 'صفحه آغازین'
      : (chapter?.title || version?.content?.subtitle || book.subtitle || 'مطالعه');
  const rootClass = `bookReaderFull${settings.theme === 'sepia' ? ' theme-sepia' : ''}${settings.theme === 'night' ? ' theme-night' : ''}`;

  return (
    <section id="bookReader" ref={rootRef} className={rootClass}>
      <span id="bookReaderBadge" className="hidden">کتاب‌خوان</span>
      <div className="readerTopbar">
        <button className="readerIcon" onClick={onClose} aria-label="خروج از مطالعه">×</button>
        <div className="readerTitleWrap"><b id="bookReaderTitle">{title}</b><small id="bookReaderMeta">{layout ? meta : ''}</small></div>
        <button className="readerIcon" onClick={() => setTocOpen((value) => !value)} aria-label="فهرست مطالب">☰</button>
      </div>
      <div className="readerProgressTrack" aria-hidden="true"><span id="readerProgressBar" style={{ width: `${pct}%` }} /></div>
      <div className="readerTools">
        <button type="button" onClick={() => changeFont(-1)} aria-label="کوچک کردن متن">A−</button>
        <div id="readerChapterLabel" className="readerChapterLabel">{layout ? chapterLabel : 'مطالعه'}</div>
        <button type="button" onClick={() => changeFont(1)} aria-label="بزرگ کردن متن">A+</button>
        <button id="readerThemeButton" type="button" onClick={cycleTheme} aria-label="تغییر زمینه مطالعه">{settings.theme === 'light' ? '◐' : settings.theme === 'sepia' ? '☀' : '☾'}</button>
      </div>
      <div id="bookTarget" className={`readerTarget${target ? '' : ' hidden'}`}>
        {target && <><span className="readerSourceTitle">{target.sourceTitle || sourceLabel(book, version?.content)}</span><b>📌 مطالعه پیشنهادی روز {fa(target.day)}</b> · {target.reason || 'این بخش برای تعمیق موضوع امروز پیشنهاد شده است.'}</>}
      </div>
      <article
        id="bookReaderText"
        ref={articleRef}
        className={`bookPage${current?.type === 'table' ? ' tablePageActive' : ''}`}
        aria-label="صفحه کتاب"
        style={{ touchAction: current?.type === 'table' ? 'auto' : 'pan-y' }}
        onPointerDown={(e) => {
          if (e.target.closest?.('.readerTableScroll')) return;
          if (e.button !== undefined && e.button !== 0) return;
          activePointer.current = e.pointerId;
          touchRef.current = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, horizontal: false };
          try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
        }}
        onPointerMove={(e) => {
          const touch = touchRef.current;
          if (!touch || (activePointer.current !== null && e.pointerId !== activePointer.current)) return;
          touch.lastX = e.clientX; touch.lastY = e.clientY;
          const dx = touch.lastX - touch.x; const dy = touch.lastY - touch.y;
          if (!touch.horizontal && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.05) touch.horizontal = true;
          if (touch.horizontal) e.preventDefault();
        }}
        onPointerUp={(e) => {
          const touch = touchRef.current;
          if (!touch || (activePointer.current !== null && e.pointerId !== activePointer.current)) return;
          const dx = (e.clientX ?? touch.lastX) - touch.x; const dy = (e.clientY ?? touch.lastY) - touch.y;
          touchRef.current = null; activePointer.current = null;
          if (Math.abs(dx) >= 42 && Math.abs(dx) > Math.abs(dy) * 1.12) {
            suppressClickUntil.current = Date.now() + 500;
            if (dx > 0) next(); else prev();
          }
        }}
        onPointerCancel={() => { touchRef.current = null; activePointer.current = null; }}
        onClick={(e) => {
          if (Date.now() < suppressClickUntil.current || e.target.closest?.('.bookTocPanel') || e.target.closest?.('.readerTableScroll')) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          if (x > rect.width * 0.78) next(); else if (x < rect.width * 0.22) prev();
        }}
      >
        {!layout && <div className="readerFixedLine body">در حال بارگذاری کتاب…</div>}
        {layout && current?.type === 'cover' && <section className="readerCoverPage"><img src={current.cover || book.coverDataUrl || book.coverUrl || ''} alt={`جلد اصلی ${title}`} decoding="async" /></section>}
        {layout && current?.type === 'frontispiece' && <section className="readerFrontispiecePage"><img src={current.image} alt={current.alt || 'صفحه آغازین کتاب'} decoding="async" /></section>}
        {layout && current?.type === 'chapter' && <section className={`readerChapterPage${current.chapterKind === 'section' ? ' readerSectionPage' : ''}`}><div className="chapterEyebrow">{current.chapter.eyebrow}</div><div className="chapterTitle">{current.chapter.title}</div><div className="chapterRule" /></section>}
        {layout && current?.type === 'text' && current.lines.map((line, index) => <div className={lineClass(line)} key={`${pageIndex}-${index}`}>{line?.text || '\u00a0'}</div>)}
        {layout && current?.type === 'table' && <section className="readerTablePage" aria-label="جدول کتاب">
          <div className="readerTableHeader"><b>{current.title || 'جدول'}</b>{current.continued ? <span>ادامه جدول</span> : <span>برای دیدن همه ستون‌ها، جدول را افقی جابه‌جا کن</span>}</div>
          <div className="readerTableScroll" role="region" aria-label="جدول قابل پیمایش" tabIndex="0">
            <table style={{ minWidth: `${Math.max(300, Number(current.columns || 1) * 128)}px` }}>
              <tbody>
                {(current.rows || []).map((row, rowIndex) => <tr key={`${pageIndex}-r-${rowIndex}`}>
                  {(row || []).map((cell, cellIndex) => rowIndex === 0
                    ? <th scope="col" key={`${pageIndex}-c-${rowIndex}-${cellIndex}`}>{cell || '—'}</th>
                    : <td key={`${pageIndex}-c-${rowIndex}-${cellIndex}`}>{cell || '—'}</td>)}
                </tr>)}
              </tbody>
            </table>
          </div>
        </section>}
        {layout && current?.type !== 'table' && <><span className="readerSwipeCue next">‹</span><span className="readerSwipeCue prev">›</span></>}
      </article>
      {tocOpen && <div id="bookTocPanel" className="bookTocPanel open">
        <h3>{Number(book.legacyId) === 4 ? 'پیوست‌ها' : 'فهرست مطالب'}</h3>
        {(layout?.chapterAnchors || []).map((entry) => <div className="bookTocEntry" key={`${entry.page}-${entry.title}`} onClick={() => { setPageIndex(entry.page); setTocOpen(false); }}><b>{entry.title}</b><span>صفحه {fa(entry.page + 1)}</span></div>)}
        {layout && !(layout.chapterAnchors || []).length && <p className="muted">فهرست مطالب در دسترس نیست.</p>}
        <button className="bookTocClose" onClick={() => setTocOpen(false)}>بستن فهرست</button>
      </div>}
      <div className="readerBottombar">
        <button className="readerPageArrow readerNextArrow" type="button" onClick={next} disabled={!layout || pageIndex >= total - 1} aria-label="صفحه بعد" title="صفحه بعد">←</button>
        <button className="readerBottomIcon" onClick={() => setTocOpen((value) => !value)} aria-label="فهرست مطالب">☷</button>
        <input id="readerPageRange" dir="rtl" style={{ direction: 'rtl' }} className="readerPageRange" type="range" min="1" max={Math.max(1, total)} value={Math.min(total, pageIndex + 1)} step="1" onChange={(e) => setPageIndex(Math.max(0, Math.min(total - 1, Number(e.target.value) - 1)))} aria-label="جابجایی بین صفحات" />
        <button id="readerPageCounter" className="readerPageCounter" onClick={() => setTocOpen((value) => !value)}>{fa(pageIndex + 1)} / {fa(total)}</button>
        <button className="readerPageArrow readerPrevArrow" type="button" onClick={prev} disabled={!layout || pageIndex <= 0} aria-label="صفحه قبل" title="صفحه قبل">→</button>
      </div>
    </section>
  );
}
