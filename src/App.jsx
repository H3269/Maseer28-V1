import React, { useEffect, useMemo, useState } from 'react';
import LibraryPage from './features/library/LibraryPage.jsx';
import Reader from './features/library/Reader.jsx';
import { legacySourceLabel } from './features/library/legacyLibraryMeta.js';
import { previewPageText } from './features/library/readerEngine.js';
import { libraryRepository } from './features/library/libraryRepository.js';
import { useLibrary } from './features/library/useLibrary.js';
import {
  APP_CONFIG,
  COPYRIGHT_KEY,
  burdenScoreFromAnswers,
  cloneForArchive,
  createClientCode,
  createPathId,
  defaultJourneyState,
  getTrustedNowMs,
  isDayUnlockedAt,
  loadJourneyState,
  loadUserProfile,
  migrateUserProfileFromJourney,
  nextRequiredDay,
  recordTrustedStart,
  saveJourneyState,
  saveUserProfile,
} from './features/journey/journeyStore.js';
import {
  Archive,
  AssessmentScreen,
  BookPreviewModal,
  BottomNav,
  CopyrightModal,
  DailyResult,
  Dashboard,
  DayScreen,
  Done,
  FinalAssessment,
  Header,
  Home,
  HowWorks,
  AboutProgram,
  PathSetupScreen,
  ProfileScreen,
  Report,
  Support,
  ValidationModal,
} from './features/journey/JourneyScreens.jsx';
import { fa } from './shared/utils.js';

function initialSnapshot() {
  const state = loadJourneyState();
  const user = migrateUserProfileFromJourney(state) || loadUserProfile();
  // Restart policy: after onboarding is complete, every fresh app launch opens
  // the dashboard. Reading progress is saved per book and is restored only
  // after the user intentionally opens that book again.
  let screen = 'dashboard';
  if (!state.started) screen = 'home';
  else if (!user) screen = 'profile';
  else if (!state.profile) screen = 'pathSetup';
  else if (!state.assessment) screen = 'assessment';
  return { state, user, screen };
}

export default function App() {
  return <MainApp />;
}

function MainApp() {
  const initial = useMemo(initialSnapshot, []);
  const [content, setContent] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loadingReady, setLoadingReady] = useState(false);
  const [journey, setJourney] = useState(initial.state);
  const [userProfile, setUserProfileState] = useState(initial.user);
  const [screen, setScreen] = useState(initial.screen);
  const [profileReturn, setProfileReturn] = useState('dashboard');
  const [profileEditing, setProfileEditing] = useState(false);
  const [libraryReturn, setLibraryReturn] = useState('dashboard');
  const [supportReturn, setSupportReturn] = useState('dashboard');
  const [currentDay, setCurrentDay] = useState(() => Math.min(28, nextRequiredDay(initial.state)));
  const [resultDay, setResultDay] = useState(() => initial.screen === 'dailyResult' ? initial.state.completed.length : null);
  const [validation, setValidation] = useState(null);
  const [incompleteArchiveNoticeOpen, setIncompleteArchiveNoticeOpen] = useState(false);
  const [allowArchiveRestartAfterNotice, setAllowArchiveRestartAfterNotice] = useState(false);
  const [copyrightOpen, setCopyrightOpen] = useState(() => {
    try { return localStorage.getItem(COPYRIGHT_KEY) !== '1'; } catch { return true; }
  });
  const [readerState, setReaderState] = useState(null);
  const [preview, setPreview] = useState(null);
  const { books, loading: libraryLoading, error: libraryError } = useLibrary();

  useEffect(() => {
    const loadingStartedAt = Date.now();
    let cancelled = false;
    let revealTimer = null;
    let completionTimer = null;

    fetch(`${import.meta.env.BASE_URL}content/path-content.json?v=20261023-fast-open`, { cache: 'default' })
      .then((response) => { if (!response.ok) throw new Error('فایل محتوای مسیر پیدا نشد.'); return response.json(); })
      .then((data) => {
        const remaining = Math.max(0, 2800 - (Date.now() - loadingStartedAt));
        revealTimer = window.setTimeout(() => {
          if (cancelled) return;
          setLoadingReady(true);
          completionTimer = window.setTimeout(() => {
            if (!cancelled) setContent(data);
          }, 360);
        }, remaining);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error?.message || 'خطا در بارگذاری برنامه');
      });

    return () => {
      cancelled = true;
      if (revealTimer !== null) window.clearTimeout(revealTimer);
      if (completionTimer !== null) window.clearTimeout(completionTimer);
    };
  }, []);

  useEffect(() => {
    saveJourneyState({ ...journey, lastView: screen });
  }, [journey, screen]);

  useEffect(() => {
    document.body.classList.toggle('reader-mode', screen === 'bookReader');
    return () => document.body.classList.remove('reader-mode');
  }, [screen]);

  // Ask supported Android browsers to enter immersive fullscreen on the first
  // real interaction. Installed PWAs also use display=fullscreen from manifest.
  useEffect(() => {
    let requested = false;
    const enterFullscreen = () => {
      if (requested) return;
      requested = true;
      const root = document.documentElement;
      if (!document.fullscreenElement && typeof root.requestFullscreen === 'function') {
        Promise.resolve(root.requestFullscreen({ navigationUI: 'hide' })).catch(() => {});
      }
      window.removeEventListener('pointerdown', enterFullscreen, true);
      window.removeEventListener('touchstart', enterFullscreen, true);
      window.removeEventListener('keydown', enterFullscreen, true);
    };
    if (window.matchMedia?.('(display-mode: fullscreen)').matches || document.fullscreenElement) requested = true;
    else {
      window.addEventListener('pointerdown', enterFullscreen, { capture: true, passive: true });
      window.addEventListener('touchstart', enterFullscreen, { capture: true, passive: true });
      window.addEventListener('keydown', enterFullscreen, true);
    }
    return () => {
      window.removeEventListener('pointerdown', enterFullscreen, true);
      window.removeEventListener('touchstart', enterFullscreen, true);
      window.removeEventListener('keydown', enterFullscreen, true);
    };
  }, []);

  const category = content?.categories?.[journey.profileData?.problem] || content?.categories?.['مشکل دیگر'] || null;
  const activeDay = category?.days?.find((row) => Number(row.day) === Number(currentDay)) || category?.days?.[currentDay - 1] || null;
  const resultData = category?.days?.find((row) => Number(row.day) === Number(resultDay || currentDay)) || null;
  const headerDay = screen === 'day' ? currentDay : screen === 'dailyResult' ? (resultDay || journey.completed.length) : journey.completed.length;

  function showValidation(items, title = 'چند بخش هنوز نیاز به تکمیل دارد') {
    setValidation({ title, items: Array.isArray(items) ? items : [items] });
  }

  
function navigate(next) {
  // اجازه شروع مسیر تازه فقط تا زمانی معتبر است
  // که کاربر در صفحه آرشیو باقی مانده باشد.
  if (screen === 'archive' && next !== 'archive') {
    setAllowArchiveRestartAfterNotice(false);
  }

  setScreen(next);

  if (next !== 'bookReader') {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}

  function patchJourney(updater) {
    setJourney((previous) => typeof updater === 'function' ? updater(previous) : { ...previous, ...updater });
  }

  function start() {
    const nextState = { ...journey, started: true, pathId: journey.pathId || createPathId() };
    setJourney(nextState);
    if (!userProfile) {
      setProfileEditing(false);
      setProfileReturn('pathSetup');
      navigate('profile');
    } else if (!nextState.profile) navigate('pathSetup');
    else if (!nextState.assessment) navigate('assessment');
    else navigate('dashboard');
  }

  function openProfileEditor(returnTo = 'dashboard') {
    // فقط بعد از تکمیل اولین پروفایل اجازه ویرایش و برگشت داده می‌شود
    setProfileEditing(Boolean(userProfile));
    setProfileReturn(returnTo === 'profile' ? 'dashboard' : (returnTo || 'dashboard'));
    navigate('profile');
  }

  function saveProfile(profile) {
    saveUserProfile(profile);
    try { localStorage.setItem('profile_completed', '1'); } catch {}
    setUserProfileState(profile);
    const wasEditing = profileEditing;
    const nextJourney = journey.profileData
      ? { ...journey, profileData: { ...journey.profileData, ...profile, code: journey.profileData.code || createClientCode() } }
      : journey;
    setJourney(nextJourney);
    setProfileEditing(false);
    if (wasEditing && nextJourney.profile) navigate(profileReturn || 'dashboard');
    else navigate('pathSetup');
  }

  function savePathSetup(path) {
    if (!userProfile) return showValidation(['پروفایل شخصی'], 'اطلاعات مسیر هنوز کامل نشده است');
    patchJourney((previous) => ({
      ...previous,
      started: true,
      profile: true,
      profileData: { ...(previous.profileData || {}), ...userProfile, ...path, code: previous.profileData?.code || createClientCode() },
      pathId: previous.pathId || createPathId(),
    }));
    navigate('assessment');
  }

  async function saveAssessment(answers) {
    const trustedNow = APP_CONFIG.TIME_LOCK_ENABLED ? await getTrustedNowMs() : Date.now();
    if (trustedNow == null) {
      return showValidation(
        ['فعلاً امکان شروع مسیر وجود ندارد.', 'لطفاً چند لحظه دیگر دوباره تلاش کن.'],
        'امکان شروع مسیر نیست'
      );
    }

    const score = burdenScoreFromAnswers(answers);
    const pathId = journey.pathId || createPathId();
    const startedAt = journey.startedAt || new Date(trustedNow).toISOString();
    if (!journey.startedAt) recordTrustedStart(pathId, trustedNow);

    patchJourney((previous) => ({
      ...previous,
      assessment: true,
      assessmentData: { ...(previous.assessmentData || {}), answers, total: answers.slice(0, 4).reduce((a, b) => a + b, 0), score, motivation: answers[4], scaleMax: 4, version: 2 },
      pathId,
      startedAt,
    }));
    setCurrentDay(1);
    navigate('dashboard');
  }

  async function openDay(value) {
    if (!journey.assessment) return navigate('assessment');
    const day = Number(value), required = nextRequiredDay(journey);
    const allowed = !journey.completed.includes(day) && day === required;
    if (!allowed) return showValidation([journey.completed.includes(day) ? 'این روز قبلاً ثبت نهایی شده و امکان ویرایش آن وجود ندارد.' : `روز ${fa(required)} هنوز باید تکمیل شود.`], 'این روز در دسترس نیست');
    const trustedNow = APP_CONFIG.TIME_LOCK_ENABLED ? await getTrustedNowMs() : Date.now();
    if (trustedNow == null) {
      return showValidation(
        ['فعلاً امکان بررسی این مرحله وجود ندارد.', 'لطفاً چند لحظه دیگر دوباره تلاش کن.'],
        'امکان ادامه مسیر نیست'
      );
    }
    if (!isDayUnlockedAt(journey, day, trustedNow)) {
      return showValidation(
        ['هر روز فقط یک مرحله از مسیر باز می‌شود.', 'فردا دوباره برگرد و مسیرت را ادامه بده.'],
        'این روز هنوز فعال نشده است'
      );
    }
    setCurrentDay(day);
    navigate('day');
  }

  function normalizeSearchText(value) {
    return String(value || '').toLowerCase().replace(/[\u0640\u200c]/g, ' ').replace(/[ي]/g, 'ی').replace(/[ك]/g, 'ک').replace(/[^\u0600-\u06ff\d\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  async function findRelevantBook(dayData, answer, feedback, score) {
    // Never recommend the same source page or a page containing a paragraph
    // already recommended in this user's current or archived paths.
    const usedKeys = new Set();
    const usedParagraphs = new Set();
    const versions = await Promise.all(books.map(async (book) => {
      try { return await libraryRepository.getVersion(book.activeVersionId); } catch { return null; }
    }));
    const normalizeParagraph = (value) => normalizeSearchText(value).replace(/\s+/g, ' ').trim();
    const pageText = (page) => normalizeParagraph(`${page?.title || ''} ${(page?.blocks || []).map((b) => `${b.text || ''} ${(b.rows || []).flat().join(' ')}`).join(' ')} ${page?.text || ''}`);
    const addUsedRecommendation = async (recommendation) => {
      if (!recommendation) return;
      const bookId = Number(recommendation.bookId), pageNo = Number(recommendation.page);
      if (!Number.isInteger(bookId) || bookId < 1 || bookId > 5 || !Number.isInteger(pageNo) || pageNo < 1) return;
      usedKeys.add(`${bookId}:${pageNo}`);
      const bookIndex = books.findIndex((item) => Number(item.legacyId) === bookId);
      const version = versions[bookIndex >= 0 ? bookIndex : bookId - 1];
      const page = version?.content?.pages?.find((row) => Number(row.sourcePage || row.page) === pageNo);
      if (!page) return;
      const rawParts = [page.title, page.text, ...(page.blocks || []).map((block) => block.text || ''), ...(page.blocks || []).flatMap((block) => block.rows || []).flat()];
      for (const part of rawParts) {
        const paragraph = normalizeParagraph(part);
        if (paragraph.length >= 35) usedParagraphs.add(paragraph);
      }
    };
    const paths = [journey, ...(journey.archive || [])];
    for (const path of paths) {
      const daily = path?.daily || {};
      for (const record of Object.values(daily)) {
        if (record?.bookRec) await addUsedRecommendation(record.bookRec);
      }
      // Older versions showed authored recommendations when no dynamic result
      // existed. Include those completed days, even in legacy states with no
      // daily record, so an old suggestion cannot reappear.
      const problemKey = path?.profileData?.problem;
      for (const dayNumber of path?.completed || []) {
        if (daily[dayNumber]?.bookRec) continue;
        const authoredDay = content?.categories?.[problemKey]?.days?.find((row) => Number(row.day) === Number(dayNumber));
        const authored = authoredDay?.legacyBookRec || authoredDay?.bookRec;
        if (authored) await addUsedRecommendation(authored);
      }
    }

    const stop = new Set('برای از به با که را این آن در و یا اگر اما چون تا روی یک هم من تو ما شما او آنها است بود شد می شود خیلی بیشتر کمتر امروز دیروز خود خودم'.split(' '));
    const feedbackContext = feedback === 'better' ? 'پیشرفت عامل کمک کننده حفظ مهارت' : feedback === 'worse' ? 'فشار کاهش شدت امنیت کمک تخصصی تنظیم هیجان' : feedback === 'hard' ? 'گام کوچک تمرین تدریجی تحمل دشواری' : 'مانع تداوم تغییر مشاهده';
    const scoreContext = score >= 8 ? 'شدت بالا تنظیم فشار آرام سازی ایمنی' : score <= 3 ? 'پایداری تعمیم مهارت پیشگیری' : 'خودمشاهده شناخت رفتار';
    const topicText = normalizeSearchText(`${journey.profileData?.problem || ''} ${dayData?.title || ''} ${dayData?.exercise || ''}`);
    const queryText = normalizeSearchText(`${topicText} ${answer || ''} ${journey.profileData?.goal || ''} ${feedbackContext} ${scoreContext}`);
    const tokens = [...new Set(queryText.split(' ').filter((w) => w.length >= 3 && !stop.has(w)))].slice(0, 80);
    const topicTokens = [...new Set(topicText.split(' ').filter((w) => w.length >= 3 && !stop.has(w)))];
    const candidates = [];
    // Build this once, not once per page: the old placement multiplied work by every book page.
    const priorParagraphs = [...usedParagraphs];
    for (let bookIndex = 0; bookIndex < books.length; bookIndex += 1) {
      const book = books[bookIndex];
      try {
        const version = versions[bookIndex];
        const pages = version?.content?.pages || [];
        for (const page of pages) {
          const pageNo = Number(page.sourcePage || page.page) || 1;
          const key = `${Number(book.legacyId)}:${pageNo}`;
          if (usedKeys.has(key)) continue;
          const text = pageText(page);
          if (text.length < 100) continue;
          const paragraphs = [page.title, page.text, ...(page.blocks || []).map((block) => block.text || ''), ...(page.blocks || []).flatMap((block) => block.rows || []).flat()]
            .map(normalizeParagraph).filter((part) => part.length >= 35);
          // A source page is unavailable if it repeats any substantial paragraph
          // that has already been offered, even when the book/page number differs.
          if (paragraphs.some((paragraph) => priorParagraphs.some((prior) => paragraph === prior || paragraph.includes(prior) || prior.includes(paragraph)))) continue;
          let scoreMatch = 0;
          let matchCount = 0;
          let topicMatchCount = 0;
          for (const token of tokens) {
            if (text.includes(token)) {
              scoreMatch += token.length >= 5 ? 2 : 1;
              matchCount += 1;
            }
          }
          for (const token of topicTokens) if (text.includes(token)) topicMatchCount += 1;
          // A long page alone is not evidence of relevance. Require a topic match
          // and at least two distinct matching terms before considering a passage.
          if (topicMatchCount > 0 && matchCount >= 2) {
            scoreMatch += Math.min(3, Math.floor(text.length / 1800));
            candidates.push({ bookId: Number(book.legacyId), page: pageNo, scoreMatch, title: book.title });
          }
        }
      } catch { /* A missing local book must not block daily completion. */ }
    }
    candidates.sort((a, b) => b.scoreMatch - a.scoreMatch || a.bookId - b.bookId || a.page - b.page);
    const best = candidates[0];
    if (best) return { bookId: best.bookId, page: best.page, reason: `این بخش از «${best.title}» با موضوع روز، هدف مسیر و نوشته ثبت‌شده امروز ارتباط بیشتری دارد. این پیشنهاد از بخش‌هایی انتخاب شده که قبلاً در مسیرهای ثبت‌شده به تو پیشنهاد نشده‌اند.` };
    // No fallback to authored suggestions here: repeating a suggestion is worse
    // than showing no book suggestion when every eligible source was used.
    return null;
  }

  async function completeDay({ answer, score, feedback }) {
    const alreadyCompleted = (journey.completed || []).includes(currentDay);
    if (alreadyCompleted) return showValidation(['نتیجه این روز قبلاً ثبت نهایی شده و قابل ویرایش نیست.'], 'این روز قبلاً تکمیل شده است');
    if (currentDay !== nextRequiredDay(journey)) {
      return showValidation(['روزهای مسیر باید به ترتیب تکمیل شوند.'], 'ثبت روز مجاز نیست');
    }

    const trustedNow = APP_CONFIG.TIME_LOCK_ENABLED ? await getTrustedNowMs() : Date.now();
    if (trustedNow == null) {
      return showValidation(
        ['فعلاً امکان ثبت این مرحله وجود ندارد.', 'لطفاً چند لحظه دیگر دوباره تلاش کن.'],
        'امکان ثبت مرحله نیست'
      );
    }
    if (!isDayUnlockedAt(journey, currentDay, trustedNow)) {
      return showValidation(
        ['هر روز فقط یک مرحله از مسیر قابل انجام است.', 'فردا دوباره برگرد و مسیرت را ادامه بده.'],
        'این مرحله هنوز فعال نشده است'
      );
    }

    const chosen = activeDay;
    const completedDay = currentDay;
    const activePathId = journey.pathId;
    // Persist the user's result and open it immediately. Book-page matching is
    // expensive, so it runs after the result screen is painted.
    const record = { score: Number(score), feedback, feedbackText: makeFeedback(feedback, score, chosen, category?.name, completedDay), exerciseId: chosen?.id || '', bookRecPending: true, updatedAt: new Date(trustedNow).toISOString() };
    patchJourney((previous) => ({ ...previous, completed: [...new Set([...(previous.completed || []), completedDay])].sort((a, b) => a - b), answers: { ...(previous.answers || {}), [completedDay]: answer }, daily: { ...(previous.daily || {}), [completedDay]: record } }));
    setResultDay(completedDay);
    navigate('dailyResult');
    setTimeout(() => {
      findRelevantBook(chosen, answer, feedback, Number(score))
        .then((bookRec) => patchJourney((previous) => {
          if (previous.pathId !== activePathId || !previous.daily?.[completedDay]) return previous;
          return { ...previous, daily: { ...previous.daily, [completedDay]: { ...previous.daily[completedDay], bookRec: bookRec || undefined, bookRecPending: false } } };
        }))
        .catch(() => patchJourney((previous) => {
          if (previous.pathId !== activePathId || !previous.daily?.[completedDay]) return previous;
          return { ...previous, daily: { ...previous.daily, [completedDay]: { ...previous.daily[completedDay], bookRecPending: false } } };
        }));
    }, 0);
  }

  function openCurrentDay() {
    if (journey.completed.length === 28) return navigate(journey.final ? 'report' : 'final');
    openDay(nextRequiredDay(journey));
  }

  function openBooks(returnTo = 'dashboard') {
    setLibraryReturn(returnTo || 'dashboard');
    navigate('books');
  }

  function openSupport(returnTo = 'dashboard') {
    setSupportReturn(returnTo || 'dashboard');
    navigate('support');
  }

  function openBook(book, sourcePage = null, target = null) {
    setReaderState({ book, sourcePage, target });
    navigate('bookReader');
  }

  async function openRecommendedBook(day, recommendation) {
    if (!recommendation?.bookId) return;
    const book = books.find((item) => Number(item.legacyId) === Number(recommendation.bookId)) || books[Number(recommendation.bookId) - 1];
    if (!book) return;
    try {
      const version = await libraryRepository.getVersion(book.activeVersionId);
      if (!version?.content) throw new Error('book missing');
      const sourcePage = Number(recommendation.page) || 1;
      const page = version.content.pages?.find((row) => Number(row.sourcePage || row.page) === sourcePage) || version.content.pages?.[0];
      const sourceTitle = legacySourceLabel(book, version.content);
      setPreview({
        day,
        book,
        sourcePage,
        reason: recommendation.reason || 'این بخش برای تعمیق موضوع امروز پیشنهاد شده است.',
        sourceTitle,
        meta: `${sourceTitle} · صفحه مرجع ${fa(sourcePage)}`,
        text: previewPageText(page),
      });
    } catch {
      showValidation(['متن کتاب بارگذاری نشد.'], 'خطا در کتابخانه');
    }
  }

  function finishFinal({ answers, changes, awareness, actions, remaining }) {
    if (journey.completed.length !== 28 || nextRequiredDay(journey) !== 29) return showValidation(['تمام ۲۸ روز باید به ترتیب کامل شده باشد.'], 'ارزیابی نهایی هنوز فعال نیست');
    const score = burdenScoreFromAnswers(answers), total = answers.slice(0, 4).reduce((a, b) => a + b, 0);
    patchJourney((previous) => ({ ...previous, final: { score, total, answers, motivation: answers[4], scaleMax: 4, version: 2, f1: changes.join('\n---\n'), f2: awareness.join('\n---\n'), f3: actions.join('\n---\n'), f4: remaining, completedAt: new Date().toISOString() } }));
    navigate('done');
  }

  function startNewPath() {
    const hasCurrentPath = Boolean(journey.started && (journey.profile || journey.assessment || journey.completed.length || journey.final));
    const pathIsComplete = journey.completed?.length === 28 && Boolean(journey.final);
    // GitHub test mode may archive incomplete paths for testing. Live builds must archive completed paths only.
    const shouldArchiveCurrentPath = hasCurrentPath && (APP_CONFIG.TEST_MODE || pathIsComplete);
    const archive = shouldArchiveCurrentPath
      ? [cloneForArchive(journey), ...(journey.archive || [])].slice(0, 20)
      : (journey.archive || []);
    const fresh = defaultJourneyState();
    fresh.archive = archive;
    fresh.started = true;
    fresh.pathId = createPathId();
    fresh.startedAt = null;
    setJourney(fresh);
    setCurrentDay(1);
    setResultDay(null);
    setProfileEditing(false);
    navigate('pathSetup');
  }

  function startNewPathFromArchive() {
    const hasCurrentPath = Boolean(journey.started && (journey.profile || journey.assessment || journey.completed.length || journey.final));
    const pathIsComplete = journey.completed?.length === 28 && Boolean(journey.final);
    // Show the warning in test and live builds alike. The separate startNewPath()
    // logic still preserves each build's archive-storage policy.
    if (hasCurrentPath && !pathIsComplete && !allowArchiveRestartAfterNotice) {
      setIncompleteArchiveNoticeOpen(true);
      return;
    }
    setAllowArchiveRestartAfterNotice(false);
    startNewPath();
  }

  function closeIncompleteArchiveNotice() {
    setIncompleteArchiveNoticeOpen(false);
    setAllowArchiveRestartAfterNotice(true);
  }

  function acceptCopyright() {
    try { localStorage.setItem(COPYRIGHT_KEY, '1'); } catch { /* storage unavailable */ }
    setCopyrightOpen(false);
  }

  if (loadError) return <div className="validationModal"><div className="validationCard"><h2>خطا در بارگذاری برنامه</h2><p className="muted">{loadError}</p></div></div>;
  if (!content) return <div className="app appLoading" role="status" aria-live="polite"><div className="loadingBrand"><img src={`${import.meta.env.BASE_URL}assets/Logo m24.png`} alt="لوگوی برنامه مسیر" /><h1>مسیر ۲۸ روزه بازسازی ذهن</h1><p>در حال آماده‌سازی مسیر تو…</p><div className={`loadingProgress${loadingReady ? ' isComplete' : ''}`} role="progressbar" aria-label="پیشرفت بارگذاری" aria-valuemin="0" aria-valuemax="100" aria-valuenow={loadingReady ? 100 : undefined}><span /></div></div></div>;

  const onboardingComplete = Boolean(userProfile && journey.profile && journey.assessment);

  if (screen === 'bookReader' && readerState) {
    // The book reader intentionally uses only its own reading controls.
    // The app-wide bottom navigation is hidden here to preserve a distraction-free page.
    return <Reader book={readerState.book} initialSourcePage={readerState.sourcePage} initialPage={readerState.initialPage} target={readerState.target} returnTo={libraryReturn} onClose={() => { setReaderState(null); navigate('books'); }} />;
  }

  // Main navigation is intentionally hidden only during the user's very first
  // onboarding flow. Once profile + path setup + baseline assessment exist,
  // it remains available on every app screen so the user never feels trapped.
  const navVisible = onboardingComplete;
  const resultBookRec = journey.daily?.[resultDay || currentDay]?.bookRec || null;
  const recommendationSource = resultBookRec ? legacySourceLabel(resultBookRec.bookId) : '';

  return (
    <div className="app">
      <Header activeDay={headerDay} />
      {screen === 'home' && <Home onStart={start} onHow={() => navigate('howWorks')} onAbout={() => navigate('about')} />}
      {screen === 'howWorks' && <HowWorks onBack={() => navigate('home')} />}
      {screen === 'about' && <AboutProgram onBack={() => navigate('home')} />}
      {screen === 'profile' && <ProfileScreen initial={userProfile || journey.profileData} editing={profileEditing} onSave={saveProfile} onCancel={() => navigate(profileReturn || 'dashboard')} onValidation={showValidation} />}
      {screen === 'pathSetup' && <PathSetupScreen initial={journey.profileData} problems={Object.keys(content.categories || {})} onSave={savePathSetup} onEditProfile={() => openProfileEditor('pathSetup')} onValidation={showValidation} />}
      {screen === 'assessment' && <AssessmentScreen initial={journey.assessmentData?.answers} onSave={saveAssessment} onValidation={showValidation} />}
      {screen === 'dashboard' && <Dashboard journey={journey} userProfile={userProfile} onEditProfile={() => openProfileEditor('dashboard')} onCurrent={openCurrentDay} onBooks={() => openBooks('dashboard')} onArchive={() => navigate('archive')} onSupport={() => openSupport('dashboard')} onChannel={() => window.open(content.channelUrl, '_blank', 'noopener,noreferrer')} />}
      {screen === 'day' && <DayScreen day={currentDay} problem={journey.profileData?.problem || ''} data={activeDay} record={journey.daily?.[currentDay]} savedAnswer={journey.answers?.[currentDay] || ''} previousRecord={journey.daily?.[currentDay - 1]} previousAnswer={journey.answers?.[currentDay - 1] || ''} history={journey.daily || {}} onDashboard={() => navigate('dashboard')} onPrevious={() => currentDay <= 1 ? navigate('dashboard') : openDay(currentDay - 1)} onComplete={completeDay} onNext={() => openDay(currentDay + 1)} completed={journey.completed.includes(currentDay)} onValidation={showValidation} />}
      {screen === 'dailyResult' && <DailyResult day={resultDay || journey.completed.length || currentDay} journey={journey} data={resultData} problem={category?.name} sourceLabel={recommendationSource} onDashboard={() => navigate('dashboard')} onNext={openDay} onFinal={() => navigate('final')} onBook={(rec) => openRecommendedBook(resultDay || currentDay, rec)} />}
      {screen === 'books' && <LibraryPage books={books} loading={libraryLoading} error={libraryError} onOpenBook={(book) => openBook(book)} onBack={() => navigate(libraryReturn)} />}
      {screen === 'support' && <Support content={content} onBack={() => navigate(supportReturn)} />}
      {screen === 'final' && <FinalAssessment initial={journey.final} onSave={finishFinal} onValidation={showValidation} />}
      {screen === 'done' && <Done onReport={() => navigate('report')} onBooks={() => openBooks('done')} onSupport={() => openSupport('done')} onArchive={() => navigate('archive')} onNew={startNewPath} />}
      {screen === 'report' && <Report journey={journey} content={content} onBooks={() => openBooks('report')} onSupport={() => openSupport('report')} onDashboard={() => navigate('dashboard')} onArchive={() => navigate('archive')} onNew={startNewPath} />}
      {screen === 'archive' && <Archive journey={journey} content={content} onBack={() => navigate('dashboard')} onNew={startNewPathFromArchive} />}
      {navVisible && <BottomNav screen={screen} onHome={() => navigate('dashboard')} onProfile={() => openProfileEditor(screen)} onBooks={() => openBooks(screen)} onSupport={() => openSupport(screen)} />}
      {preview && <BookPreviewModal preview={preview} onClose={() => setPreview(null)} onOpen={() => { const item = preview; setPreview(null); openBook(item.book, item.sourcePage, { day: item.day, sourcePage: item.sourcePage, reason: item.reason, sourceTitle: item.sourceTitle }); }} />}
      {copyrightOpen && <CopyrightModal onAccept={acceptCopyright} />}
      {validation && <ValidationModal data={validation} onClose={() => setValidation(null)} />}
      {incompleteArchiveNoticeOpen && <div className="validationModal" role="dialog" aria-modal="true" aria-labelledby="incompleteArchiveNoticeTitle"><section className="validationCard"><span className="badge">یادآوری مهم</span><h2 id="incompleteArchiveNoticeTitle">مسیر ناتمام</h2><p className="muted">{APP_CONFIG.TEST_MODE ? 'مسیر قبلی هنوز کامل نشده است؛ در نسخه آزمایشی ممکن است برای بررسی در آرشیو ذخیره شود. اگر می‌خواهی مسیر تازه‌ای آغاز کنی، پس از بستن این پیام دوباره دکمه شروع مسیر تازه را بزن.' : 'مسیر قبلی هنوز کامل نشده است؛ بنابراین در آرشیو ذخیره نمی‌شود. اگر می‌خواهی مسیر تازه‌ای آغاز کنی، پس از بستن این پیام دوباره دکمه شروع مسیر تازه را بزن.'}</p><button className="primary" onClick={closeIncompleteArchiveNotice}>متوجه شدم</button></section></div>}
    </div>
  );
}

function makeFeedback(feedback, score, dayData, problem, day) {
  const topic = String(problem || 'موضوع امروز').trim();
  const title = String(dayData?.title || 'تمرین امروز').split('·')[0].trim();
  const stage = Number(day) <= 7
    ? 'فعلاً هدف اصلی شناخت دقیق الگوست، نه تغییر فوری آن.'
    : Number(day) <= 14
      ? 'یک تغییر کوچک و قابل مشاهده را امتحان کن.'
      : Number(day) <= 21
        ? 'بررسی کن این مهارت در موقعیت دیگری هم به کارت می‌آید یا نه.'
        : 'روی حفظ مهارت و برنامه‌ریزی برای روزهای دشوار تمرکز کن.';
  const messages = {
    better: 'نشانه‌ای از بهبود ثبت کردی. بررسی کن چه رفتار یا شرایطی احتمالاً به آن کمک کرد؛ نتیجه را به یک علت قطعی نسبت نده.',
    same: 'فعلاً تغییر محسوسی ثبت نشده است. یک مانع مشخص را جدا کن و ببین چه چیزی هنوز مثل قبل پیش می‌رود.',
    worse: 'دشواری بیشتر را جدی بگیر و فشار تمرین را بالا نبر. به گام کوچک‌تر و امن‌تر برگرد؛ اگر بدترشدن ادامه دارد یا نگران‌کننده است، کمک حرفه‌ای بگیر.',
    hard: 'شاید اندازه یا زمان تمرین مناسب نبوده است. فعلاً به مشاهده و نوشتن کوتاه بسنده کن و خودت را مجبور به موقعیت دشوار نکن.',
  };
  return `در مسیر «${topic}»، تمرین «${title}» را با امتیاز ${fa(score)} از ۱۰ ثبت کردی. ${messages[feedback] || 'نتیجه امروز را بدون قضاوت ثبت کن.'} ${stage}`;
}
