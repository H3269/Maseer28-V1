import React, { useEffect, useMemo, useState } from 'react';
import LibraryPage from './features/library/LibraryPage.jsx';
import Reader from './features/library/Reader.jsx';
import { legacySourceLabel } from './features/library/legacyLibraryMeta.js';
import { previewPageText } from './features/library/readerEngine.js';
import { libraryRepository } from './features/library/libraryRepository.js';
import { useLibrary } from './features/library/useLibrary.js';
import {
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
  Footer,
  Header,
  Home,
  HowWorks,
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
  const [copyrightOpen, setCopyrightOpen] = useState(() => {
    try { return localStorage.getItem(COPYRIGHT_KEY) !== '1'; } catch { return true; }
  });
  const [readerState, setReaderState] = useState(null);
  const [preview, setPreview] = useState(null);
  const { books, loading: libraryLoading, error: libraryError } = useLibrary();

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}content/path-content.json`)
      .then((response) => { if (!response.ok) throw new Error('فایل محتوای مسیر پیدا نشد.'); return response.json(); })
      .then(setContent)
      .catch((error) => setLoadError(error?.message || 'خطا در بارگذاری برنامه'));
  }, []);

  useEffect(() => {
    saveJourneyState({ ...journey, lastView: screen });
  }, [journey, screen]);

  useEffect(() => {
    document.body.classList.toggle('reader-mode', screen === 'bookReader');
    return () => document.body.classList.remove('reader-mode');
  }, [screen]);

  const category = content?.categories?.[journey.profileData?.problem] || content?.categories?.['مشکل دیگر'] || null;
  const activeDay = category?.days?.find((row) => Number(row.day) === Number(currentDay)) || category?.days?.[currentDay - 1] || null;
  const resultData = category?.days?.find((row) => Number(row.day) === Number(resultDay || currentDay)) || null;
  const nextResultData = category?.days?.find((row) => Number(row.day) === Number(resultDay || currentDay) + 1) || null;
  const headerDay = screen === 'day' ? currentDay : screen === 'dailyResult' ? (resultDay || journey.completed.length) : journey.completed.length;

  function showValidation(items, title = 'چند بخش هنوز نیاز به تکمیل دارد') {
    setValidation({ title, items: Array.isArray(items) ? items : [items] });
  }

  function navigate(next) {
    setScreen(next);
    if (next !== 'bookReader') window.scrollTo({ top: 0, behavior: 'auto' });
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
    const trustedNow = await getTrustedNowMs();
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
    const allowed = journey.completed.includes(day) || day === required;
    if (!allowed) return showValidation([`روز ${fa(required)} هنوز باید تکمیل شود.`], 'این روز هنوز فعال نشده است');
    const trustedNow = await getTrustedNowMs();
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

  async function completeDay({ answer, score, feedback }) {
    const alreadyCompleted = (journey.completed || []).includes(currentDay);
    if (!alreadyCompleted && currentDay !== nextRequiredDay(journey)) {
      return showValidation(['روزهای مسیر باید به ترتیب تکمیل شوند.'], 'ثبت روز مجاز نیست');
    }

    const trustedNow = await getTrustedNowMs();
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
    const record = { score: Number(score), feedback, feedbackText: makeFeedback(feedback, score, chosen), exerciseId: chosen?.id || '', updatedAt: new Date(trustedNow).toISOString() };
    patchJourney((previous) => ({ ...previous, completed: [...new Set([...(previous.completed || []), currentDay])].sort((a, b) => a - b), answers: { ...(previous.answers || {}), [currentDay]: answer }, daily: { ...(previous.daily || {}), [currentDay]: record } }));
    setResultDay(currentDay);
    navigate('dailyResult');
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
    const archive = journey.started && (journey.profile || journey.assessment || journey.completed.length || journey.final)
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

  function acceptCopyright() {
    try { localStorage.setItem(COPYRIGHT_KEY, '1'); } catch { /* storage unavailable */ }
    setCopyrightOpen(false);
  }

  if (loadError) return <div className="validationModal"><div className="validationCard"><h2>خطا در بارگذاری برنامه</h2><p className="muted">{loadError}</p></div></div>;
  if (!content) return <div className="app"><section className="card"><p className="muted">در حال بارگذاری برنامه…</p></section>{copyrightOpen && <CopyrightModal onAccept={acceptCopyright} />}</div>;

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
  const recommendationSource = resultData?.bookRec ? legacySourceLabel(resultData.bookRec.bookId) : '';

  return (
    <div className="app">
      <Header activeDay={headerDay} />
      {screen === 'home' && <Home onStart={start} onHow={() => navigate('howWorks')} />}
      {screen === 'howWorks' && <HowWorks onBack={() => navigate('home')} />}
      {screen === 'profile' && <ProfileScreen initial={userProfile || journey.profileData} editing={profileEditing} onSave={saveProfile} onCancel={() => navigate(profileReturn || 'dashboard')} onValidation={showValidation} />}
      {screen === 'pathSetup' && <PathSetupScreen initial={journey.profileData} problems={Object.keys(content.categories || {})} onSave={savePathSetup} onEditProfile={() => openProfileEditor('pathSetup')} onValidation={showValidation} />}
      {screen === 'assessment' && <AssessmentScreen initial={journey.assessmentData?.answers} onSave={saveAssessment} onValidation={showValidation} />}
      {screen === 'dashboard' && <Dashboard journey={journey} userProfile={userProfile} onEditProfile={() => openProfileEditor('dashboard')} onCurrent={openCurrentDay} onBooks={() => openBooks('dashboard')} onArchive={() => navigate('archive')} onSupport={() => openSupport('dashboard')} onChannel={() => window.open(content.channelUrl, '_blank', 'noopener,noreferrer')} />}
      {screen === 'day' && <DayScreen day={currentDay} problem={journey.profileData?.problem || ''} data={activeDay} record={journey.daily?.[currentDay]} savedAnswer={journey.answers?.[currentDay] || ''} onDashboard={() => navigate('dashboard')} onPrevious={() => currentDay <= 1 ? navigate('dashboard') : openDay(currentDay - 1)} onComplete={completeDay} onNext={() => openDay(currentDay + 1)} completed={journey.completed.includes(currentDay)} onValidation={showValidation} />}
      {screen === 'dailyResult' && <DailyResult day={resultDay || journey.completed.length || currentDay} journey={journey} data={resultData} nextData={nextResultData} problem={journey.profileData?.problem || ''} sourceLabel={recommendationSource} onDashboard={() => navigate('dashboard')} onNext={openDay} onFinal={() => navigate('final')} onBook={(rec) => openRecommendedBook(resultDay || currentDay, rec)} />}
      {screen === 'books' && <LibraryPage books={books} loading={libraryLoading} error={libraryError} onOpenBook={(book) => openBook(book)} onBack={() => navigate(libraryReturn)} />}
      {screen === 'support' && <Support content={content} onBack={() => navigate(supportReturn)} />}
      {screen === 'final' && <FinalAssessment initial={journey.final} onSave={finishFinal} onValidation={showValidation} />}
      {screen === 'done' && <Done onReport={() => navigate('report')} onBooks={() => openBooks('done')} onSupport={() => openSupport('done')} onArchive={() => navigate('archive')} onNew={startNewPath} />}
      {screen === 'report' && <Report journey={journey} content={content} onBooks={() => openBooks('report')} onSupport={() => openSupport('report')} onDashboard={() => navigate('dashboard')} onArchive={() => navigate('archive')} onNew={startNewPath} />}
      {screen === 'archive' && <Archive journey={journey} content={content} onBack={() => navigate('dashboard')} onNew={startNewPath} />}
      {navVisible && <BottomNav screen={screen} onHome={() => navigate('dashboard')} onProfile={() => openProfileEditor(screen)} onBooks={() => openBooks(screen)} onSupport={() => openSupport(screen)} />}
      {preview && <BookPreviewModal preview={preview} onClose={() => setPreview(null)} onOpen={() => { const item = preview; setPreview(null); openBook(item.book, item.sourcePage, { day: item.day, sourcePage: item.sourcePage, reason: item.reason, sourceTitle: item.sourceTitle }); }} />}
      {copyrightOpen && <CopyrightModal onAccept={acceptCopyright} />}
      {validation && <ValidationModal data={validation} onClose={() => setValidation(null)} />}
      <Footer />
    </div>
  );
}

function makeFeedback(feedback, score, dayData = null) {
  const parts = String(dayData?.title || '').split('·').map((part) => part.trim());
  const stage = parts[0] || 'تمرین امروز';
  const category = parts[1] || 'مسئله انتخاب‌شده';
  const day = Math.max(1, Math.min(28, Number(dayData?.day || 1)));
  const phase = (day - 1) % 7;
  const summaries = {
    better: [
      `در «${stage}» درباره «${category}»، امروز بهبود گزارش کردی. آن را سرنخی برای بررسی بدان، نه مدرک قطعی علت؛ امتیاز درگیری ثبت‌شده ${fa(score)} از ۱۰ است.`,
      `گزارش امروزت درباره «${category}» امیدوارکننده‌تر بوده است. بررسی کن چه چیزی واقعاً فرق داشت؛ از یک روز به‌تنهایی نتیجه قطعی نگیر. امتیاز ثبت‌شده: ${fa(score)} از ۱۰.`,
      `برای «${category}» امروز وضعیت بهتری ثبت کردی. این تجربه را نگه دار و در روزهای بعد ببین آیا در شرایط مشابه هم تکرار می‌شود؛ امتیاز امروز ${fa(score)} از ۱۰ است.`,
      `در تمرین «${stage}»، تغییر مثبتی احساس کردی. لازم نیست فوراً دلیلش را مشخص کنی؛ فقط شرایط و رفتارهای همان روز را با دقت به خاطر بسپار. امتیاز: ${fa(score)} از ۱۰.`,
      `بهتر بودن امروز درباره «${category}» اطلاعات مفیدی است، اما تضمین نمی‌کند هر روز همین‌طور باشد. ببین چه چیزی قابل مشاهده بود و آن را ثبت‌شده نگه دار. امتیاز: ${fa(score)} از ۱۰.`,
      `امروز در مسیر «${category}» احساس بهتری داشتی. به جای فشار برای حفظ این حالت، به رفتار یا شرایط کمک‌کننده توجه کن؛ امتیاز درگیری ${fa(score)} از ۱۰ است.`,
      `نتیجه امروز برای «${category}» بهتر بوده است. این را یک مشاهده واقعی بدان و برای فهمیدن الگو، آن را با تجربه روزهای بعد مقایسه کن. امتیاز: ${fa(score)} از ۱۰.`
    ],
    same: [
      `در «${stage}» درباره «${category}»، تغییر محسوسی گزارش نکردی. این به‌تنهایی به معنی بی‌فایده بودن تمرین نیست؛ فعلاً به مشاهده دقیق ادامه بده. امتیاز: ${fa(score)} از ۱۰.`,
      `وضعیت امروزت تقریباً مثل قبل بوده است. لازم نیست خودت را سرزنش کنی یا چند روش را هم‌زمان عوض کنی؛ یک نشانه مشخص را دنبال کن. امتیاز: ${fa(score)} از ۱۰.`,
      `برای «${category}» هنوز تغییر روشنی دیده نمی‌شود. این داده‌ای برای ادامه بررسی است، نه حکم درباره توانایی تو؛ امتیاز ثبت‌شده ${fa(score)} از ۱۰ است.`,
      `امروز تفاوت زیادی احساس نکردی. تغییر بعضی الگوها زمان می‌برد؛ به جای حدس‌زدن، ببین چه کاری انجام شد و چه چیزی هنوز دشوار بود. امتیاز: ${fa(score)} از ۱۰.`,
      `گزارش امروز نشان می‌دهد وضعیت تقریباً ثابت مانده است. همین را دقیق ثبت کن؛ لازم نیست برای اثبات پیشرفت، تغییری را که ندیده‌ای اعلام کنی. امتیاز: ${fa(score)} از ۱۰.`,
      `در مسیر «${category}»، امروز تغییر قابل توجهی ثبت نشد. فعلاً هدف، جمع‌آوری اطلاعات روشن‌تر است؛ اگر مشکل پایدار یا مختل‌کننده است، کمک تخصصی را هم در نظر بگیر. امتیاز: ${fa(score)} از ۱۰.`,
      `نتیجه امروز نزدیک به روزهای قبل بوده است. یک روز ثابت چیزی را قطعی نمی‌کند؛ به روند چند روز و اثر مسئله بر زندگی روزمره توجه کن. امتیاز: ${fa(score)} از ۱۰.`
    ],
    worse: [
      `در «${stage}» درباره «${category}»، امروز دشواری بیشتری گزارش کردی. فشار تمرین را بیشتر نکن؛ اگر وضعیت شدید یا ادامه‌دار است از متخصص کمک بگیر. امتیاز: ${fa(score)} از ۱۰.`,
      `امروز شرایط سخت‌تر بوده است. این تجربه را نادیده نگیر و تمرین را فقط در حد امن و قابل‌تحمل ادامه بده؛ در صورت تشدید قابل‌توجه، متوقف شو و کمک بگیر. امتیاز: ${fa(score)} از ۱۰.`,
      `درگیری مربوط به «${category}» امروز بیشتر شده است. یک روز برای قضاوت درباره کل مسیر کافی نیست، اما ایمنی و حمایت از خودت در اولویت است. امتیاز: ${fa(score)} از ۱۰.`,
      `نتیجه امروز سخت‌تر از انتظار بوده است. به خودت فشار اضافه نکن؛ اگر تمرین ناراحتی را بیشتر کرده، آن را کنار بگذار و با فرد امن یا متخصص مشورت کن. امتیاز: ${fa(score)} از ۱۰.`,
      `گزارش امروزت نشان می‌دهد تحمل این مسئله دشوارتر شده است. لازم نیست به‌تنهایی از پس آن بربیایی؛ در صورت تداوم یا شدت زیاد، کمک حرفه‌ای بگیر. امتیاز: ${fa(score)} از ۱۰.`,
      `برای «${category}»، امروز کاهش ناراحتی دیده نشد و وضعیت سخت‌تر بود. فعلاً گام را کوچک کن و از هر تمرینی که خطر یا فشار شدید ایجاد می‌کند فاصله بگیر. امتیاز: ${fa(score)} از ۱۰.`,
      `امروز نسبت به قبل دشواری بیشتری ثبت کردی. این نشانه‌ای برای بازبینی شدت و مناسب‌بودن تمرین است؛ اگر احساس خطر می‌کنی، از کمک فوری مناسب استفاده کن. امتیاز: ${fa(score)} از ۱۰.`
    ],
    hard: [
      `تمرین «${stage}» درباره «${category}» برایت سخت بود. این می‌تواند نشان دهد گام فعلی بزرگ است؛ آن را کوچک‌تر کن و در صورت ناایمن بودن متوقف شو. امتیاز: ${fa(score)} از ۱۰.`,
      `سخت بودن تمرین به معنی ناتوانی تو نیست. پیش از تکرار آن، مشخص کن کدام بخش دشوار بود و فقط بخش امن و قابل‌تحمل را نگه دار. امتیاز: ${fa(score)} از ۱۰.`,
      `امروز اجرای تمرین آسان نبود. لازم نیست آن را به زور کامل کنی؛ اندازه یا زمان تمرین را تغییر بده و اگر ناراحتی شدید شد، کمک مناسب بگیر. امتیاز: ${fa(score)} از ۱۰.`,
      `برای «${category}»، سختی امروز اطلاعات مهمی است. بررسی کن مانع اصلی زمان، ابهام، احساس شدید یا شرایط بیرونی بود؛ بعد فقط یک تغییر کوچک بده. امتیاز: ${fa(score)} از ۱۰.`,
      `اگر تمرین امروز بیش از توانت بود، ادامه‌دادن به هر قیمت هدف نیست. آن را ساده‌تر کن یا با راهنمایی فرد واجد صلاحیت پیش برو. امتیاز: ${fa(score)} از ۱۰.`,
      `امروز با دشواری روبه‌رو شدی؛ این را به عنوان اطلاعاتی درباره خود تمرین ببین، نه قضاوتی درباره شخصیتت. گام بعدی باید امن‌تر و روشن‌تر باشد. امتیاز: ${fa(score)} از ۱۰.`,
      `تمرین مربوط به «${category}» فشار ایجاد کرد. اگر علت را می‌دانی، آن را یادداشت کن؛ اگر نمی‌دانی، لازم نیست حدس بزنی. بخش دشوار را سبک‌تر یا متوقف کن. امتیاز: ${fa(score)} از ۱۰.`
    ]
  };
  const choices = summaries[feedback] || summaries.same;
  return choices[phase];
}
