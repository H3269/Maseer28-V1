import React, { useEffect, useRef, useState } from 'react';
import SmartSelect from '../../shared/components/SmartSelect.jsx';
import AppIcon from '../../shared/components/AppIcon.jsx';
import { buttonLabel } from '../../shared/buttonLabel.jsx';
import { fa, formatDate, normalizeDigits } from '../../shared/utils.js';
import { burdenScoreFromAnswers, safeText, validDailyAnswer, validName, validPersianText, validPhone } from './journeyStore.js';

export const SCALE_QUESTIONS = [
  'این مشکل در حال حاضر چقدر شدت دارد؟',
  'این مشکل چقدر در زندگی روزمره تو اختلال ایجاد می‌کند؟',
  'چقدر احساس می‌کنی کنترل این مشکل برایت دشوار است؟',
  'چقدر این مشکل باعث اجتناب، تنش یا واکنش ناخواسته می‌شود؟',
  'چقدر می‌خواهی در این ۲۸ روز روی تغییر آن کار کنی؟',
];

export const GENDER_OPTIONS = [{ value: '', label: 'انتخاب کنید' }, { value: 'زن', label: 'زن' }, { value: 'مرد', label: 'مرد' }, { value: 'ترجیح می‌دهم نگویم', label: 'ترجیح می‌دهم نگویم' }];
export const MEDICAL_OPTIONS = [{ value: '', label: 'انتخاب کنید' }, { value: 'none', label: 'موردی ندارم' }, { value: 'epilepsy', label: 'صرع' }, { value: 'seizure', label: 'سابقه تشنج' }, { value: 'panic', label: 'پانیک' }, { value: 'bipolar', label: 'اختلال دو قطبی' }, { value: 'speech_hearing', label: 'مشکل گفتاری یا شنوایی' }, { value: 'other', label: 'سایر موارد مهم' }];
export const MEDICATION_OPTIONS = [{ value: '', label: 'انتخاب کنید' }, { value: 'no', label: 'خیر' }, { value: 'yes_fixed', label: 'بله، ساعت مصرف مشخص دارد' }, { value: 'yes_flexible', label: 'بله، ساعت مصرف مشخص ندارد' }];
export const RISK_OPTIONS = [{ value: '', label: 'انتخاب کنید' }, { value: 'no', label: 'خیر' }, { value: 'yes', label: 'بله' }, { value: 'unknown', label: 'نمی‌دانم' }];
export const FEEDBACK_OPTIONS = [{ value: '', label: 'انتخاب کنید' }, { value: 'better', label: 'بهتر شدم' }, { value: 'same', label: 'تقریباً مثل قبل' }, { value: 'worse', label: 'بدتر شدم' }, { value: 'hard', label: 'تمرین برایم سخت بود' }];

export function Header({ activeDay = 0 }) {
  const n = Math.max(0, Math.min(28, Number(activeDay) || 0));
  const progress = Math.round((n / 28) * 100);
  const [headerHidden, setHeaderHidden] = useState(false);
  const previousYRef = useRef(0);

  useEffect(() => {
    previousYRef.current = window.scrollY;

    let frameId = 0;
    const handleScroll = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        const currentY = Math.max(0, window.scrollY);
        const delta = currentY - previousYRef.current;

        // Keep the header visible at the top. Scrolling down hides it;
        // scrolling back up reveals it. Programmatic scrolls use the same path.
        if (currentY < 40) {
          setHeaderHidden(false);
        } else if (delta > 3) {
          setHeaderHidden(true);
        } else if (delta < -3) {
          setHeaderHidden(false);
        }

        previousYRef.current = currentY;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <header className={`header${headerHidden ? ' header-hidden' : ''}`}>
      <div className="brand">
        <img className="logo" src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="لوگوی مرکز هیپنوتراپی شفا" />
        <div><div className="subtitle">مرکز هیپنوتراپی شفا</div><h1>مسیر ۲۸ روزه بازسازی ذهن</h1><div className="subtitle">یک قدم کوچک، هر روز</div></div>
      </div>
      <div className="progress"><div className="bar" id="bar" style={{ width: `${progress}%` }} /></div>
      <div className="stats"><span id="progressText">روز {fa(n)} از ۲۸</span><span id="percent">{fa(progress)}٪</span></div>
    </header>
  );
}

export function Home({ onStart, onHow }) {
  return <section className="card" id="home"><div className="welcome"><span className="badge">مسیر اختصاصی شما</span><h2>به مسیر ۲۸ روزه بازسازی ذهن خوش آمدید</h2><p className="muted">یک مسیر ساختاریافته برای خودمشاهده، تمرین روزانه و پیگیری تغییرات؛ هر روز فقط یک قدم مشخص.</p><div className="introBox"><b>قبل از شروع</b><br/><span className="muted">ابتدا اطلاعات پرونده و ارزیابی اولیه را ثبت می‌کنی. سپس هر روز یک تمرین و یک اقدام عملی دریافت می‌کنی و نتیجه همان روز را ثبت می‌کنی.</span></div><button className="primary" onClick={onStart}>{buttonLabel('شروع مسیر ۲۸ روزه بازسازی ذهن')}</button><button className="secondary" onClick={onHow}><AppIcon name="info" size={17} /> مسیر ۲۸ روزه چگونه کار می‌کند؟</button></div></section>;
}

export function HowWorks({ onBack }) {
  return <section className="card" id="howWorks"><span className="badge">راهنمای مسیر</span><h2>مسیر ۲۸ روزه چگونه کار می‌کند؟</h2><div className="introBox"><p><b>۱. ثبت اطلاعات و ارزیابی اولیه</b><br/><span className="muted">اطلاعات لازم را ثبت می‌کنی، مسئله اصلی و وضعیت شروع خودت را مشخص می‌کنی.</span></p><p><b>۲. هر روز یک تمرین و یک اقدام</b><br/><span className="muted">هر روز یک تمرین متناسب با مسیرت و یک اقدام عملی مشخص دریافت می‌کنی.</span></p><p><b>۳. ثبت عملکرد همان روز</b><br/><span className="muted">پس از انجام تمرین، شدت درگیری را از <b>۰ تا ۱۰</b> ثبت می‌کنی و تجربه امروزت را می‌نویسی.</span></p><p><b>۴. بازخورد و تنظیم ادامه مسیر</b><br/><span className="muted">بازخوردهای تو برای تنظیم ادامه مسیر استفاده می‌شوند تا تمرین‌ها متناسب‌تر شوند.</span></p><p><b>۵. یک قدم کوچک در هر روز</b><br/><span className="muted">هدف، تغییر یک‌باره نیست؛ هدف این است که در هر روز یک گام واقعی برداری.</span></p><p><b>۶. ارزیابی نهایی</b><br/><span className="muted">پس از روز <b>۲۸</b>، وضعیت پایان مسیر با نقطه شروع مقایسه می‌شود.</span></p><p><b>۷. گزارش و پیشنهاد ادامه مسیر</b><br/><span className="muted">گزارش نهایی عملکردت را نشان می‌دهد و بر اساس نتیجه و اطلاعات پرونده، پیشنهاد مناسب برای ادامه مسیر ارائه می‌شود.</span></p><p><b>۸. کتابخانه اختصاصی و آرشیو</b><br/><span className="muted">در طول مسیر به پنج کتاب داخل برنامه دسترسی داری و پس از پایان مسیر می‌توانی مسیرهای قبلی را در آرشیو ببینی.</span></p></div><button className="primary" onClick={onBack}>{buttonLabel('متوجه شدم و بازمی‌گردم')}</button></section>;
}

export function ProfileScreen({ initial, editing, onSave, onCancel, onValidation }) {
  const [form, setForm] = useState({ name: '', age: '', gender: '', phone: '', medical: '', medicalNote: '', medication: '', medicationRisk: '' });
  useEffect(() => setForm({ name: initial?.name || '', age: initial?.age || '', gender: initial?.gender || '', phone: initial?.phone || '', medical: initial?.medical || '', medicalNote: initial?.medicalNote || '', medication: initial?.medication || '', medicationRisk: initial?.medicationRisk || '' }), [initial]);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  function submit() {
    const name = form.name.trim(), age = Number(normalizeDigits(form.age)), phone = normalizeDigits(form.phone.trim()), missing = [];
    if (!validName(name)) missing.push('نام و نام خانوادگی');
    if (!Number.isInteger(age) || age < 12 || age > 100) missing.push('سن بین ۱۲ تا ۱۰۰');
    if (!form.gender) missing.push('جنسیت');
    if (!validPhone(phone)) missing.push('شماره موبایل ۱۱ رقمی با ۰۹');
    if (!form.medical) missing.push('بیماری یا وضعیت پزشکی');
    if (form.medical === 'other' && !safeText(form.medicalNote, 1000)) missing.push('توضیح سایر بیماری‌ها/وضعیت‌ها');
    if (!form.medication) missing.push('وضعیت مصرف دارو');
    if (!form.medicationRisk) missing.push('خطر احتمالی داروی ساعت‌دار');
    if (missing.length) return onValidation(missing, 'پروفایل هنوز کامل نشده است');
    onSave({ ...form, name, age, phone, medicalNote: form.medicalNote.trim(), updatedAt: new Date().toISOString() });
  }
  return <section className="card" id="profile"><span className="badge">پروفایل من</span><h2>اطلاعات شخصی و ثابت</h2><p className="muted">اطلاعات شخصی تو برای مسیرهای بعدی ذخیره می‌شود. پس از تکمیل اولیه، هر زمان بخواهی می‌توانی آن را ویرایش کنی.</p><div className="sectionHint"><span>۱</span><div><b>پروفایل مستقل</b><small>اطلاعات شخصی از مسئله‌ای که روی آن کار می‌کنی جدا نگه داشته می‌شود.</small></div></div><label>نام و نام خانوادگی</label><input autoComplete="name" id="pName" maxLength={80} placeholder="نام و نام خانوادگی" value={form.name} onChange={(e) => set('name', e.target.value)} /><label>سن</label><input id="pAge" inputMode="numeric" maxLength={3} pattern="[0-9۰-۹٠-٩]{2,3}" placeholder="مثلاً ۳۸" type="text" value={form.age} onChange={(e) => set('age', e.target.value)} /><label>جنسیت</label><SmartSelect id="pGender" value={form.gender} onChange={(v) => set('gender', v)} options={GENDER_OPTIONS} /><label>شماره تماس</label><input autoComplete="tel" id="pPhone" inputMode="numeric" maxLength={11} placeholder="شماره تماس" value={form.phone} onChange={(e) => set('phone', e.target.value)} /><label>بیماری یا وضعیت پزشکی مهم</label><SmartSelect id="pMedical" value={form.medical} onChange={(v) => set('medical', v)} options={MEDICAL_OPTIONS} /><label>توضیح سایر بیماری‌ها/وضعیت‌های مهم</label><textarea className="small" id="pMedicalNote" maxLength={1000} placeholder="در صورت انتخاب سایر موارد، توضیح کوتاه بنویسید." value={form.medicalNote} onChange={(e) => set('medicalNote', e.target.value)} /><label>داروی منظم مصرف می‌کنم</label><SmartSelect id="pMedication" value={form.medication} onChange={(v) => set('medication', v)} options={MEDICATION_OPTIONS} /><label>اگر داروی ساعت‌دار مصرف نشود، آیا احتمال تشدید بیماری/علائم در طول جلسه ۸ ساعته وجود دارد؟</label><SmartSelect id="pMedicationRisk" value={form.medicationRisk} onChange={(v) => set('medicationRisk', v)} options={RISK_OPTIONS} /><button className="primary" onClick={submit}>{editing ? 'ذخیره تغییرات پروفایل' : 'ذخیره پروفایل و ادامه'}</button>{editing && <button className="secondary" id="profileCancelEdit" onClick={onCancel}>بازگشت بدون تغییر</button>}</section>;
}

export function PathSetupScreen({ initial, problems, onSave, onEditProfile, onValidation }) {
  const [form, setForm] = useState({ problem: '', durationYears: 0, durationMonths: 0, goal: '' });
  useEffect(() => setForm({ problem: initial?.problem || '', durationYears: initial?.durationYears ?? 0, durationMonths: initial?.durationMonths ?? 0, goal: initial?.goal || '' }), [initial]);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  function submit() {
    const missing = [];
    if (!form.problem) missing.push('مهم‌ترین مسئله');
    if (!safeText(form.goal, 1000)) missing.push('نتیجه ارزشمند مورد انتظار');
    if (Number(form.durationYears) < 0 || Number(form.durationMonths) < 0 || Number(form.durationMonths) > 11) missing.push('مدت درگیری');
    if (missing.length) return onValidation(missing, 'اطلاعات مسیر هنوز کامل نشده است');
    onSave({ problem: form.problem, durationYears: Number(form.durationYears), durationMonths: Number(form.durationMonths), goal: form.goal.trim() });
  }
  const years = Array.from({ length: 31 }, (_, i) => ({ value: String(i), label: i === 0 ? 'کمتر از یک سال' : `${fa(i)} سال` }));
  const months = Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: i === 0 ? 'بدون ماه اضافه' : `${fa(i)} ماه` }));
  return <section className="card" id="pathSetup"><span className="badge">مسیر جدید · مرحله دوم</span><h2>موضوع این مسیر</h2><p className="muted">پروفایل تو ثابت می‌ماند؛ برای هر مسئله می‌توانی یک مسیر ۲۸ روزه مستقل بسازی.</p><div className="sectionHint"><span>۲</span><div><b>انتخاب مسئله</b><small>این اطلاعات فقط به مسیر فعلی تعلق دارد و در آرشیو همان مسیر ذخیره می‌شود.</small></div></div><label>مهم‌ترین مسئله‌ای که می‌خواهی روی آن کار کنی</label><SmartSelect id="pProblem" value={form.problem} onChange={(v) => set('problem', v)} options={[{ value: '', label: 'انتخاب کنید' }, ...problems.map((p) => ({ value: p, label: p }))]} /><div className="durationGrid"><div><label>مدت درگیری · سال</label><SmartSelect id="pDurationYears" value={String(form.durationYears)} onChange={(v) => set('durationYears', v)} options={years} /></div><div><label>مدت درگیری · ماه</label><SmartSelect id="pDurationMonths" value={String(form.durationMonths)} onChange={(v) => set('durationMonths', v)} options={months} /></div></div><label>از این مسیر چه نتیجه‌ای برای خودت ارزشمند می‌دانی؟</label><textarea className="small" id="pGoal" maxLength={1000} placeholder="در پایان این مسیر دوست دارم..." value={form.goal} onChange={(e) => set('goal', e.target.value)} /><button className="primary" onClick={submit}>{buttonLabel('ادامه به ارزیابی اولیه')}</button><button className="secondary" onClick={onEditProfile}>مشاهده یا ویرایش پروفایل</button></section>;
}

function AssessmentScale({ prefix, values, setValues }) {
  const selected = values.filter((v) => v !== '' && v != null).length;
  const complete = selected === 5;
  const burden = complete ? burdenScoreFromAnswers(values.map(Number)) : null;
  const motivation = complete ? Number(values[4]) : null;
  return <>{SCALE_QUESTIONS.map((question, qIndex) => <div className="scaleQuestion" key={`${prefix}-${qIndex}`}><div className="scaleQuestionTitle"><b>{fa(qIndex + 1)}.</b><span>{question}</span></div><div className="scaleOptions" role="group" aria-label={question}>{[0,1,2,3,4].map((n) => <button type="button" key={n} className={`scaleOption ${Number(values[qIndex]) === n && values[qIndex] !== '' ? 'selected' : ''}`} data-scale={`${prefix}-${qIndex + 1}`} data-value={n} aria-pressed={Number(values[qIndex]) === n && values[qIndex] !== '' ? 'true' : 'false'} onClick={() => setValues(values.map((v, i) => i === qIndex ? n : v))}>{fa(n)}</button>)}</div><div className="scaleLegend"><span>۰ = اصلاً</span><span>۴ = بسیار زیاد</span></div><input id={`${prefix}Q${qIndex + 1}`} type="hidden" value={values[qIndex]} readOnly data-touched={values[qIndex] === '' ? '0' : '1'} /></div>)}<div className={`assessmentSummary ${complete ? 'complete' : ''}`} id={`${prefix}ScaleSummary`}>{complete ? `ارزیابی کامل است · شاخص شدت: ${fa(burden)} از ۱۰ · انگیزه تغییر: ${fa(motivation)} از ۴` : `${fa(selected)} از ۵ پاسخ انتخاب شده`}</div><input id={`${prefix}Score`} type="hidden" value={complete ? burden : 0} readOnly data-touched={complete ? '1' : '0'} /></>;
}

export function AssessmentScreen({ initial, onSave, onValidation }) {
  const [values, setValues] = useState(() => Array.isArray(initial) && initial.length === 5 ? initial : ['', '', '', '', '']);
  useEffect(() => setValues(Array.isArray(initial) && initial.length === 5 ? initial : ['', '', '', '', '']), [initial]);
  function submit() {
    if (values.some((v) => v === '')) return onValidation(values.map((v, i) => v === '' ? `سؤال ${fa(i + 1)} ارزیابی اولیه` : null).filter(Boolean), 'ارزیابی اولیه هنوز کامل نشده است');
    onSave(values.map(Number));
  }
  return <section className="card assessmentCard" id="assessment"><span className="badge">روز صفر · ارزیابی اولیه</span><h2>نقطه شروع مسیر را ثبت کن</h2><p className="muted">این ۵ سؤال همان خط پایه مسیر هستند. پاسخ درست یا غلطی وجود ندارد؛ فقط وضعیت واقعی امروزت را از ۰ تا ۴ انتخاب کن تا در پایان روز ۲۸ بتوانیم تغییر را دقیق مقایسه کنیم.</p><div className="assessmentIntro"><span>۰</span><div><b>اصلاً / بسیار کم</b><small>هرچه عدد به ۴ نزدیک‌تر شود، شدت یا میزان تجربه بیشتر است.</small></div><span>۴</span></div><AssessmentScale prefix="a" values={values} setValues={setValues} /><button className="primary heroAction" onClick={submit}>{buttonLabel('ثبت ارزیابی و شروع روز ۱')}</button></section>;
}

export function Dashboard({ journey, userProfile, onEditProfile, onCurrent, onBooks, onArchive, onSupport, onChannel }) {
  const p = journey.profileData || {}, u = userProfile || p, next = nextRequiredDayLocal(journey), pct = Math.round((journey.completed.length / 28) * 100);
  return <section className="card" id="dashboard"><div className="dashboardHero"><div><span className="badge">داشبورد شخصی</span><h2 id="dashTitle">مسیر «{p.problem || 'بدون عنوان'}»</h2><p className="muted dashboardLead" id="dashLead">{next > 28 ? '۲۸ روز کامل شده؛ ارزیابی نهایی آماده است.' : `قدم بعدی: روز ${fa(next)} از ۲۸`}</p></div><button aria-label="ویرایش پروفایل" className="iconButton" onClick={onEditProfile}><AppIcon name="edit" size={19} /></button></div><div id="profileSummary"><div className="profile"><div className="profileBox"><span>پروفایل</span><b>{u?.name || '-'}</b></div><div className="profileBox"><span>کد مراجع</span><b>{p.code || '-'}</b></div><div className="profileBox"><span>مسئله این مسیر</span><b>{p.problem || '-'}</b></div><div className="profileBox"><span>مدت درگیری</span><b>{fa(p.durationYears || 0)} سال و {fa(p.durationMonths || 0)} ماه</b></div></div></div><div className="metric"><div className="metricBox"><strong id="dashProgress">{fa(pct)}٪</strong><span>پیشرفت مسیر</span></div><div className="metricBox"><strong id="dashDays">{fa(journey.completed.length)}/۲۸</strong><span>روز تکمیل‌شده</span></div></div><button className="primary heroAction" onClick={onCurrent}>{buttonLabel('ادامه مسیر امروز')}</button><div className="quickGrid"><button className="quickAction" onClick={onBooks}><span><AppIcon name="bookOpen" size={24} /></span><b>کتابخانه</b><small>مطالعه هدفمند</small></button><button className="quickAction" onClick={onArchive}><span><AppIcon name="archive" size={24} /></span><b>آرشیو</b><small>مسیرهای قبلی</small></button><button className="quickAction" onClick={onSupport}><span><AppIcon name="message" size={24} /></span><b>پشتیبانی</b><small>ارتباط با مرکز</small></button><button className="quickAction" onClick={onChannel}><span><AppIcon name="megaphone" size={24} /></span><b>کانال مرکز</b><small>محتوای تکمیلی</small></button></div><p className="muted dashboardNote">هر روز فقط یک مرحله اصلی داری. نتیجه روز بعد از انجام تمرین باز می‌شود تا صفحه خلوت و متمرکز بماند.</p></section>;
}

function nextRequiredDayLocal(state) { for (let i = 1; i <= 28; i += 1) if (!(state.completed || []).includes(i)) return i; return 29; }
const DAILY_EXERCISES = [
  'یک «نقشه کوتاه» بکش: موقعیت، فکر، احساس و واکنش را در چهار خانه جدا بنویس؛ فعلاً فقط مشاهده کن و چیزی را تغییر نده.',
  'دو ستون با عنوان «چیزی که می‌دانم» و «چیزی که حدس می‌زنم» بساز و یک نمونه از تجربه مرتبط با موضوع را در آن‌ها تفکیک کن.',
  'آخرین بارِ فعال‌شدن موضوع را به سه بخش تقسیم کن: درست قبل از آن، لحظه شروع، و چند دقیقه بعد؛ فقط واقعیت‌های قابل مشاهده را ثبت کن.',
  'برای تجربه امروز سه واژه جدا انتخاب کن: یک فکر، یک احساس و یک حس بدنی؛ آن‌ها را با هم یکی نکن.',
  'یک رفتار مرتبط را بررسی کن و برای آن فایده فوری، هزینه بعدی و یک راه جایگزین کم‌خطر بنویس.',
  'یک هدف بسیار کوچک و قابل مشاهده تعریف کن؛ جمله را با «وقتی …، فقط … را انجام می‌دهم» کامل کن.',
  'دو نمونه از موقعیت‌های مشابه را کنار هم بگذار و تفاوت‌های واقعی‌شان را پیدا کن؛ از نتیجه‌گیری کلی درباره خودت پرهیز کن.',
  'مرور کوتاه انجام بده: سه چیزی که این هفته درباره الگو فهمیدی و یک پرسش که هنوز پاسخ ندارد بنویس.',
  'پیش از واکنش، مکث کوتاهی کن و پنج چیز قابل مشاهده در محیط را نام ببر؛ فقط اگر موقعیت امن و قابل تحمل است.',
  'یک باور یا پیش‌بینی را بنویس و برای آن یک شاهد موافق، یک شاهد مخالف و یک توضیح جایگزین منصفانه پیدا کن.',
  'نقشه محرک‌ها را کامل کن: زمان، مکان، افراد، خستگی و اتفاق پیش از تجربه را بررسی کن و فقط یک عامل را مشخص کن.',
  'یک جمله مهربانانه و واقع‌بینانه بنویس که اگر دوستت همین تجربه را داشت به او می‌گفتی؛ سپس آن را برای خودت بازنویسی کن.',
  'از صفر تا ده میزان دشواری موقعیت را تخمین بزن و یک نسخه کم‌فشارتر انتخاب کن که دست‌کم دو درجه آسان‌تر باشد.',
  'یک مرز یا درخواست روشن را در یک جمله تمرین کن؛ آن را کوتاه، محترمانه و بدون توضیح اضافه بنویس.',
  'یک تجربه را از دید ناظر بی‌طرف توصیف کن؛ به‌جای «همیشه» و «هرگز»، از زمان و رفتار مشخص استفاده کن.',
  'یک راهبرد قبلی را ارزیابی کن: چه چیزی کمک کرد، چه چیزی کمک نکرد و کدام بخش را می‌توانی ساده‌تر کنی؟',
  'یک قدم عملی را به سه گام کوچک تقسیم کن و فقط گام اول را مشخص کن؛ لازم نیست همه گام‌ها را امروز انجام دهی.',
  'برای یک موقعیت دشوار، برنامه «اگر… آنگاه…» بنویس و یک گزینه جایگزین برای زمانی که برنامه اول مناسب نبود اضافه کن.',
  'یک نمونه از پیشرفت کوچک یا تلاش قابل‌قدردانی را ثبت کن؛ نتیجه کامل شرط ارزشمند بودن تلاش نیست.',
  'یک گفت‌وگوی فرضی را روی کاغذ بنویس: حرفی که می‌خواهی بگویی، نیاز پشت آن و پاسخ محترمانه احتمالی.',
  'به تجربه از زاویه نیازها نگاه کن: اکنون به امنیت، استراحت، ارتباط، وضوح یا حمایت نیاز داری؟ یک مورد را انتخاب کن.',
  'یک چرخه تکراری را با پیکان رسم کن و فقط یک نقطه کوچک را علامت بزن که تغییرش واقع‌بینانه‌تر است.',
  'برای موقعیت مشابه بعدی یک یادآور ساده طراحی کن؛ نشانه یادآور، جمله کوتاه و رفتار موردنظر را مشخص کن.',
  'یک تمرین قبلی را با شرایط متفاوت اما امن مقایسه کن و بنویس چه چیزی باید ثابت بماند و چه چیزی قابل تغییر است.',
  'از خودت بپرس «چه اطلاعاتی هنوز ندارم؟»؛ یک سؤال قابل بررسی بنویس و آن را از قضاوت درباره خودت جدا کن.',
  'یک برنامه پشتیبان بنویس: اگر تمرین سخت شد، چه نسخه آسان‌تری انجام می‌دهی و از چه کسی یا کجا کمک می‌گیری؟',
  'مرور پیشرفت انجام بده: یک الگوی شناخته‌شده، یک مهارت قابل استفاده و یک نشانه که می‌گوید باید سرعت را کمتر کنی ثبت کن.',
  'برای ادامه مسیر یک برنامه کوچک و قابل تکرار بنویس؛ نشانه شروع، مدت کوتاه، معیار توقف و راه دریافت حمایت را مشخص کن.'
];

function fillProblem(text, problem) {
  return String(text).replaceAll('«موضوع»', `«${problem || 'موضوع انتخاب‌شده'}»`);
}

function cleanDailyCopy(value, categoryName = '') {
  let text = String(value || '');
  if (categoryName) text = text.replace(/\{\s*(?:cat|category|problem)\s*\}/gi, categoryName);
  // Internal authoring/program labels must never be visible in the daily exercise.
  text = text
    .replace(/نسخه\s+(?:سبک|سبک‌تر|کم‌فشار|کم فشار)(?:\s+و\s+کم‌فشار)?\s+برای\s+[^\s،؛.]+/giu, '')
    .replace(/تمرکز\s+امروز\s*:\s*[^\n؛.]+/giu, '')
    .replace(/اقدام\s+اختصاصی\s+امروز\s*:\s*/giu, '')
    .replace(/روش\s+اختصاصی\s+این\s+مسئله\s*:\s*[^\n]+/giu, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+([،؛.!؟])/g, '$1')
    .replace(/([،؛.!؟])(?=\S)/g, '$1 ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return text;
}

export function splitDayContent(d, problem, previousRecord, history = {}) {
  const categoryName = String(problem || '').trim() || 'موضوع انتخاب‌شده';
  const dayNo = Math.min(28, Math.max(1, Number(d?.day) || 1));
  const rawExercise = String(d?.exercise || '');
  const exerciseSource = rawExercise.split(/\n\s*\n\s*(?:اقدام\s+اختصاصی\s+امروز|روش\s+اختصاصی\s+این\s+مسئله)\s*:/u)[0].trim();
  const historyRecords = Object.entries(history || {}).map(([n, rec]) => ({ day: Number(n), ...rec }))
    .filter((x) => x.day < dayNo && x.feedback).sort((a, b) => a.day - b.day);
  const streak = (predicate) => {
    let count = 0;
    for (let i = historyRecords.length - 1; i >= 0; i -= 1) {
      if (predicate(historyRecords[i])) count += 1; else break;
    }
    return count;
  };
  const difficultStreak = streak((x) => x.feedback === 'worse' || x.feedback === 'hard' || Number(x.score) >= 8);
  const worseningStreak = streak((x) => x.feedback === 'worse' || Number(x.score) >= 8);
  const positiveStreak = streak((x) => x.feedback === 'better' && Number(x.score) < 8);
  const previousDifficult = Boolean(previousRecord && (previousRecord.feedback === 'worse' || previousRecord.feedback === 'hard' || Number(previousRecord.score) >= 8));
  const sustainedImprovement = positiveStreak >= 2;
  let exercise = cleanDailyCopy(exerciseSource, categoryName);
  const contextualAction = (value) => {
    const text = cleanDailyCopy(String(value || ''), categoryName);
    return text && !text.includes(categoryName) ? `برای مسئله «${categoryName}»، ${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
  };
  let action = contextualAction(d?.actionText);
  let adaptation = '';
  if (difficultStreak >= 2 || worseningStreak >= 2) {
    exercise = cleanDailyCopy(d.restExerciseText || d.lightExerciseText || exercise, categoryName);
    action = contextualAction(d.restActionText || d.lightActionText || action);
    adaptation = 'در چند روز اخیر انجام تمرین دشوار بوده یا وضعیت سخت‌تر شده است؛ امروز فقط همین گام سبک را انجام بده. لازم نیست وارد موقعیت دشوار شوی. اگر همین گام هم فشار زیادی ایجاد می‌کند، متوقف شو و از حمایت مناسب کمک بگیر.';
  } else if (previousDifficult) {
    exercise = cleanDailyCopy(d.lightExerciseText || exercise, categoryName);
    action = contextualAction(d.lightActionText || action);
    adaptation = 'با توجه به نتیجه روز گذشته، امروز فقط بخش ساده‌تر را انجام بده. لازم نیست موقعیت دشوار را تجربه کنی؛ اگر فشار بیشتر شد، مکث کن یا تمرین را متوقف کن.';
  } else if (sustainedImprovement) {
    exercise = [exercise, 'چون در چند روز اخیر بهبود ثبت کرده‌ای، اگر آمادگی داری مهارت را در موقعیتی امن و کمی متفاوت بررسی کن؛ دشواری را ناگهانی افزایش نده.'].filter(Boolean).join('\n\n');
    action = contextualAction(d.progressActionText || action);
    adaptation = 'بهبود در چند روز اخیر دیده می‌شود؛ گام بعدی کمی متفاوت است، اما انجام آن اختیاری است و باید در محدوده امن و قابل‌تحمل بماند.';
  } else if (previousRecord?.feedback === 'same') {
    adaptation = 'تغییر محسوسی ثبت نشده است؛ امروز فشار را افزایش نده. به‌جای تکرار، یک مانع مشخص را بررسی کن.';
  }
  const title = cleanDailyCopy(String(d?.title || 'موضوع امروز').replace(/\s*[·•-]?\s*روز\s*\d+\s*$/i, '').trim(), categoryName);
  return { exercise, action, title, adaptation };
}

function structuredText(value) {
  return fa(cleanDailyCopy(value)).split(/(?<=[.!؟])\s+/u).map((line) => line.trim()).filter(Boolean);
}

function DailyText({ id, label, value }) {
  const lines = structuredText(value);
  const preview = lines[0] || '';
  const rest = lines.slice(1);
  return <div id={id} className="dailyText"><p className="dailyTextPreview">{preview}</p>{rest.length > 0 && <details className="dailyTextDisclosure"><summary>نمایش ادامه و مراحل ({fa(rest.length)} بخش)</summary><div className="dailyTextFull">{rest.map((line, index) => <p key={index}>{line}</p>)}</div></details>}</div>;
}

export function severityText(n) { return n <= 2 ? '۰ تا ۲ = بسیار کم یا تقریباً بدون درگیری' : n <= 4 ? '۳ تا ۴ = خفیف' : n <= 6 ? '۵ تا ۶ = متوسط' : n <= 8 ? '۷ تا ۸ = زیاد' : '۹ تا ۱۰ = بسیار شدید و درگیرکننده'; }

export function adaptiveGuidance(previousRecord, previousAnswer, problem, history = {}) {
  if (!previousRecord) return '';
  const reflection = String(previousAnswer || '').trim();
  const recent = Object.entries(history || {}).map(([day, rec]) => ({ day: Number(day), ...rec }))
    .filter((row) => row.feedback).sort((a, b) => a.day - b.day).slice(-7);
  const countStreak = (predicate) => {
    let count = 0;
    for (let i = recent.length - 1; i >= 0; i -= 1) {
      if (predicate(recent[i])) count += 1; else break;
    }
    return count;
  };
  const difficultStreak = countStreak((row) => row.feedback === 'worse' || row.feedback === 'hard' || Number(row.score) >= 8);
  const worseningStreak = countStreak((row) => row.feedback === 'worse' || Number(row.score) >= 8);
  const positiveStreak = countStreak((row) => row.feedback === 'better' && Number(row.score) < 8);
  const feedback = previousRecord.feedback;
  const score = Number(previousRecord.score);
  let base;
  if (difficultStreak >= 2 || worseningStreak >= 2) {
    base = 'چند روز اخیر دشوار بوده یا شدت درگیری بالا مانده است. امروز فشار را کمتر کن و فقط بخش ساده‌تر را انجام بده؛ لازم نیست وارد موقعیت دشوار شوی. اگر فشار همچنان زیاد است، تمرین را متوقف کن و از حمایت مناسب کمک بگیر.';
  } else if (feedback === 'worse' || feedback === 'hard' || score >= 8) {
    base = 'نتیجه روز گذشته نشان می‌دهد امروز بهتر است فشار را کمتر کنی. فقط بخش ساده‌تر را انجام بده و اگر فشار بیشتر شد، مکث کن یا متوقف شو.';
  } else if (positiveStreak >= 2) {
    base = 'در چند روز اخیر بهبود دیده می‌شود. اگر آمادگی داری، یک گام کمی متفاوت و امن را امتحان کن؛ دشواری را ناگهانی افزایش نده.';
  } else if (feedback === 'better') {
    base = 'یک روز بهتر ثبت شده است؛ برای نتیجه‌گیری درباره روند، به چند روز دیگر هم نیاز داریم. فعلاً همین سطح را حفظ کن و ببین چه چیزی کمک کرده است.';
  } else if (feedback === 'same') {
    base = 'تغییر محسوسی ثبت نشده است. فشار را افزایش نده؛ یک مانع مشخص را بررسی کن و فقط یک عامل کوچک را تغییر بده.';
  } else {
    base = 'تمرین را با سرعتی انجام بده که برایت قابل‌تحمل باشد. اگر شرایط یا احساس تو تغییر کرد، می‌توانی مکث کنی یا از حمایت مناسب کمک بگیری.';
  }
  const note = reflection ? ' پاسخ روز گذشته‌ات هم در نظر گرفته شده است؛ لازم نیست نوشته قبلی را دوباره بنویسی.' : '';
  return cleanDailyCopy(`${base}${note}`, problem);
}

export function DayScreen({ day, problem, data, record, savedAnswer, previousRecord, previousAnswer, history = {}, onDashboard, onPrevious, onComplete, onNext, completed, onValidation }) {
  const parts = splitDayContent(data, problem, previousRecord, history), guidance = parts.adaptation || adaptiveGuidance(previousRecord, previousAnswer, problem, history), [entryOpen, setEntryOpen] = useState(Boolean(record?.score != null || savedAnswer || record?.feedback)), [score, setScore] = useState(record?.score ?? 0), [touched, setTouched] = useState(record?.score != null), [feedback, setFeedback] = useState(record?.feedback || ''), [answer, setAnswer] = useState(savedAnswer || '');const entryPanelRef = React.useRef(null);
  useEffect(() => { setEntryOpen(Boolean(record?.score != null || savedAnswer || record?.feedback)); setScore(record?.score ?? 0); setTouched(record?.score != null); setFeedback(record?.feedback || ''); setAnswer(savedAnswer || ''); }, [day, record, savedAnswer]);useEffect(() => {
  if (!entryOpen) return;

  const frame = requestAnimationFrame(() => {
    entryPanelRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  });

  return () => cancelAnimationFrame(frame);
}, [entryOpen]);
  if (!data) return null;
  const bubblePos = Math.min(96, Math.max(4, (10 - Number(score)) * 10));
  const guidanceLines = structuredText(guidance);
  function submit() { const missing = []; if (!touched || Number(score) < 0 || Number(score) > 10) missing.push('شدت یا میزان درگیری از ۰ تا ۱۰'); if (!feedback) missing.push('بازخورد امروز'); if (!validDailyAnswer(answer)) missing.push('پاسخ یا تجربه امروز (فقط کلمات فارسی و نشانه‌های مجاز)'); if (missing.length) return onValidation(missing, 'نتیجه امروز هنوز کامل نشده است'); onComplete({ answer: answer.trim(), score: Number(score), feedback }); }
  return <section className="card dayCard" id="day"><div className="dayTopline"><span className="badge" id="dayBadge">روز {fa(day)} از ۲۸ · {problem}</span><button aria-label="داشبورد" className="iconButton subtle" onClick={onDashboard}><AppIcon name="home" size={19} /></button></div><h2 id="dayTitle">{parts.title}</h2><p className="muted" id="dayIntro">امروز روی «{fa(parts.title)}» تمرکز می‌کنی.</p>{guidance && <div className="recommendation adaptiveGuidance"><b>چرا تمرین امروز این‌طور تنظیم شده؟</b><div className="muted">{guidanceLines.map((line, index) => <p key={index} style={{ margin: index === guidanceLines.length - 1 ? '0' : '0 0 8px' }}>{line}</p>)}</div></div>}<div className="dailyStep"><span className="stepNumber">۱</span><div className="exercise"><b>تمرین امروز</b><DailyText id="dayExercise" label="تمرین امروز" value={parts.exercise} /></div></div><div className="dailyStep"><span className="stepNumber">۲</span><div className="action"><b>اقدام اختصاصی امروز</b><DailyText id="dayAction" label="اقدام اختصاصی امروز" value={parts.action} /></div></div><div className="safetyNote"><span><AppIcon name="info" size={18} /></span><p className="muted" id="dayClosing">{fa(data.closing || '')}</p></div>{!entryOpen && <button className="primary heroAction" id="openDailyEntryBtn" onClick={() => setEntryOpen(true)}>انجام دادم؛ ثبت نتیجه امروز</button>}{entryOpen && <div ref={entryPanelRef} aria-live="polite" className="dailyEntryPanel" id="dailyEntryPanel"><div className="entryHeader"><span className="stepNumber">۳</span><div><b>ثبت نتیجه</b><small>کمتر از یک دقیقه</small></div></div><label>شدت یا میزان درگیری امروز</label><div className="severityWrap"><div className="severityValue" id="severityValue" style={{ left: `${bubblePos}%` }}>{touched ? `${fa(score)} از ۱۰` : 'انتخاب نشده'}</div><div className="severityThumb" id="severityThumb" /><input aria-label="شدت درگیری" className="severityRange" id="dayScore" max="10" min="0" step="1" type="range" value={score} data-touched={touched ? '1' : '0'} onChange={(e) => { setScore(Number(e.target.value)); setTouched(true); }} /></div><div className="stats" style={{ color: 'var(--muted)', marginTop: 0 }}><span>۰ = بدون درگیری</span><span>۵ = متوسط</span><span>۱۰ = بسیار شدید</span></div><p className="muted" id="severityText" style={{ fontSize: 11, marginTop: 5 }}>{severityText(Number(score))}</p><label>بازخورد امروز</label><SmartSelect id="dayFeedbackChoice" value={feedback} onChange={setFeedback} options={FEEDBACK_OPTIONS} /><label>پاسخ یا تجربه امروزت</label><textarea id="answer" maxLength={3000} placeholder="کوتاه و واقعی بنویس؛ چه اتفاقی افتاد و چه چیزی یاد گرفتی؟" value={answer} onChange={(e) => setAnswer(e.target.value)} /><button className="primary" onClick={submit}>{buttonLabel('ثبت امروز و دریافت نتیجه')}</button><button className="ghostButton" onClick={() => setEntryOpen(false)}>فعلاً می‌خواهم تمرین را ادامه بدهم</button></div>}<div className="feedback hidden" id="dailyFeedback"/><div className="recommendation hidden" id="dailyRecommendation"/><div className="navrow compactNav"><button className="secondary" onClick={onDashboard}>{buttonLabel('داشبورد')}</button></div><div id="nextButtonWrap">{day < 28 && completed && <button className="primary" onClick={onNext}>ادامه به روز {fa(day + 1)}</button>}</div></section>;
}

export function nextStepText(n, d, rec, problem) {
  const title = String(d?.title || 'این مرحله').split('·')[0].trim();
  const category = String(problem || 'مسئله انتخاب‌شده').trim();
  const phase = n <= 7
    ? 'در این مرحله، هدف شناخت الگوست؛ لازم نیست همه‌چیز را فوراً تغییر بدهی.'
    : n <= 14
      ? 'حالا یک تغییر کوچک و قابل مشاهده را امتحان کن.'
      : n <= 21
        ? 'اکنون بررسی کن این مهارت در موقعیت دیگری هم به کارت می‌آید یا نه.'
        : 'در روزهای پایانی، برای ادامه تمرین و روزهای دشوار برنامه‌ای واقع‌بینانه بساز.';
  const feedback = rec?.feedback === 'better'
    ? 'بهبودی را ثبت کن و ببین چه شرایط یا رفتاری احتمالاً به آن کمک کرده است.'
    : rec?.feedback === 'worse'
      ? 'فشار را بیشتر نکن؛ به گام کوچک‌تر و امن‌تر برگرد و در صورت تداوم دشواری از متخصص کمک بگیر.'
      : rec?.feedback === 'hard'
        ? 'اندازه یا زمان تمرین را کوچک‌تر کن و فقط بخشی را انجام بده که برایت قابل تحمل و امن است.'
        : 'اگر هنوز تغییری نمی‌بینی، یک مانع مشخص را پیدا کن و در روز بعد فقط همان را بررسی کن.';
  return `در مسیر «${category}»، تمرین «${title}» را مرور کن. ${phase} ${feedback}`;
}

export function DailyResult({ day, journey, data, problem, sourceLabel, onDashboard, onNext, onFinal, onBook }) {
  const rec = journey.daily?.[day] || {}, recommendedBook = rec.bookRec || null, labels = { better: 'بهتر شدم', same: 'تقریباً مثل قبل', worse: 'بدتر شدم', hard: 'تمرین برایم سخت بود' };
  return <section className="card" id="dailyResult"><span className="badge" id="resultBadge">نتیجه روز {fa(day)} از ۲۸</span><h2 id="resultTitle">عملکرد روز {fa(day)}</h2><div className="metric"><div className="metricBox"><strong id="resultScore">{fa(rec.score)}/۱۰</strong><span>امتیاز امروز</span></div><div className="metricBox"><strong id="resultFeedback">{labels[rec.feedback] || 'ثبت شد'}</strong><span>بازخورد</span></div></div><div className="feedback"><b>جمع‌بندی امروز</b><p className="muted" id="resultText">{rec.feedbackText}</p></div><div className="recommendation"><b>قدم بعدی</b><p className="muted" id="resultNext">{day === 28 ? 'روز ۲۸ کامل شد. اکنون ارزیابی نهایی فعال است.' : nextStepText(day, data, rec, problem)}</p></div><div id="resultNextWrap">{recommendedBook ? <><div className="bookRecommendationSource">{sourceLabel}</div><button className="gold" onClick={() => onBook(recommendedBook)}><AppIcon name="bookOpen" size={17} /> مطالعه پیشنهاد کتاب امروز</button></> : rec.bookRecPending ? <p className="muted" id="bookRecommendationPending" aria-live="polite">نتیجه ثبت شد؛ در حال بررسی پیشنهاد مطالعه مرتبط…</p> : <p className="muted" id="noNewBookRecommendation">در میان بخش‌های مرتبط و استفاده‌نشده کتاب‌ها، پیشنهاد تازه‌ای پیدا نشد؛ برای جلوگیری از تکرار، پیشنهاد نامرتبط یا تکراری نمایش داده نمی‌شود.</p>}{day === 28 ? <button className="primary" onClick={onFinal}>رفتن به ارزیابی نهایی →</button> : <button className="primary" onClick={() => onNext(day + 1)}>رفتن به روز {fa(day + 1)} →</button>}</div><div className="navrow"><button className="secondary" onClick={onDashboard}>{buttonLabel('بازگشت به داشبورد')}</button></div></section>;
}

export function Support({ content, onBack }) {
  const [help, setHelp] = useState('اگر اپ شما اجازه باز کردن مستقیم پیامک را ندهد، شماره با یک لمس کپی می‌شود.');
  const number = '09190889062';
  function legacyCopy(text, done) { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done?.(); } catch { /* noop */ } ta.remove(); }
  function copySupportNumber() { const done = () => setHelp('شماره ۰۹۱۹۰۸۸۹۰۶۲ کپی شد.'); if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(number).then(done).catch(() => legacyCopy(number, done)); else legacyCopy(number, done); }
  function sendSms() { const body = 'سلام، برای نوبت‌دهی و دریافت راهنمایی پیام می‌دهم.'; try { if (window.Android && typeof window.Android.openSms === 'function') { window.Android.openSms(number, body); setHelp('برنامه پیامک باز شد.'); return; } if (window.webkit?.messageHandlers?.openSms) { window.webkit.messageHandlers.openSms.postMessage({ number, body }); setHelp('برنامه پیامک باز شد.'); return; } const ua = navigator.userAgent || '', sep = /iPhone|iPad|iPod/i.test(ua) ? '&' : '?', a = document.createElement('a'); a.href = `sms:${number}${sep}body=${encodeURIComponent(body)}`; a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => setHelp('اگر پیامک باز نشد، «کپی شماره» را بزنید. در WebView اپ باید scheme پیامک به سیستم تحویل داده شود.'), 900); } catch { copySupportNumber(); } }
  return <section className="card" id="support"><span className="badge">پشتیبانی مرکز</span><h2>نیاز به راهنمایی داری؟</h2><p className="muted">اگر در انجام تمرین‌ها، ادامه مسیر یا استفاده از برنامه نیاز به راهنمایی داری، می‌توانی با مرکز هیپنوتراپی شفا ارتباط بگیری.</p><div className="support"><h3><AppIcon name="phone" size={18} /> نوبت‌دهی پیامکی</h3><p className="muted">شماره مرکز: <b>۰۹۱۹۰۸۸۹۰۶۲</b></p><div className="contactActions"><button className="sms" onClick={sendSms}>باز کردن پیامک</button><button className="copyAction" onClick={copySupportNumber}>کپی شماره</button></div><p className="contactHelp" id="smsHelp">{help}</p><hr/><h3><AppIcon name="message" size={18} /> نوبت‌دهی تلگرامی</h3><p className="muted">پشتیبانی و نوبت‌دهی تلگرامی مرکز</p><a className="telegram" href={content.supportUrl || content.bookSupportUrl || 'https://t.me/Hypnotherapy_admin'} rel="noopener" target="_blank">ورود به پشتیبانی تلگرام</a></div><button className="secondary" onClick={onBack}>{buttonLabel('بازگشت')}</button></section>;
}

function reflectionValues(value) { const rows = String(value || '').split('\n---\n').slice(0, 3); return [...rows, '', '', ''].slice(0, 3); }
function ReflectionFields({ prefix, values, setValues }) { return <>{values.map((value, i) => <textarea key={`${prefix}-${i}`} className="small" id={`${prefix}_${i + 1}`} maxLength={2000} placeholder={`مورد ${fa(i + 1)} را بنویس...`} value={value} onChange={(e) => setValues(values.map((row, j) => j === i ? e.target.value : row))} />)}</>; }

export function FinalAssessment({ initial, onSave, onValidation }) {
  const [values, setValues] = useState(() => Array.isArray(initial?.answers) ? initial.answers : ['', '', '', '', '']), [changes, setChanges] = useState(() => reflectionValues(initial?.f1)), [awareness, setAwareness] = useState(() => reflectionValues(initial?.f2)), [actions, setActions] = useState(() => reflectionValues(initial?.f3)), [remaining, setRemaining] = useState(initial?.f4 || '');
  useEffect(() => { setValues(Array.isArray(initial?.answers) ? initial.answers : ['', '', '', '', '']); setChanges(reflectionValues(initial?.f1)); setAwareness(reflectionValues(initial?.f2)); setActions(reflectionValues(initial?.f3)); setRemaining(initial?.f4 || ''); }, [initial]);
  function submit() { const missing = []; if (values.some((v) => v === '')) missing.push('پنج سؤال ارزیابی نهایی'); if (changes.some((v) => !validPersianText(v))) missing.push('سه تغییر واقعی'); if (awareness.some((v) => !validPersianText(v))) missing.push('سه آگاهی مهم'); if (actions.some((v) => !validPersianText(v))) missing.push('سه اقدام ۳۰ روز آینده'); if (!validPersianText(remaining)) missing.push('مهم‌ترین موضوع نیازمند کار'); if (missing.length) return onValidation(missing, 'ارزیابی نهایی هنوز کامل نشده است'); onSave({ answers: values.map(Number), changes: changes.map((v) => v.trim()), awareness: awareness.map((v) => v.trim()), actions: actions.map((v) => v.trim()), remaining: remaining.trim() }); }
  return <section className="card assessmentCard" id="final"><span className="badge">روز ۲۸ · ارزیابی نهایی</span><h2>مسیر را کامل کردی؛ حالا تغییر را اندازه بگیر</h2><p className="muted">همان ۵ سؤال شروع مسیر را دوباره پاسخ بده تا مقایسه قبل و بعد معنی‌دار و قابل فهم باشد.</p><AssessmentScale prefix="f" values={values} setValues={setValues} /><div className="finalReflection"><h3>جمع‌بندی کوتاه مسیر</h3><details className="finalAnswerDisclosure" id="f1Disclosure"><summary><span>سه تغییر واقعی که در خودم مشاهده کردم</span><small>{fa(changes.filter((v) => v.trim()).length)} از ۳ پاسخ</small></summary><div className="finalAnswerFields" id="f1Fields"><p className="muted">هر تغییر را در یک کادر جداگانه بنویس.</p><ReflectionFields prefix="f1" values={changes} setValues={setChanges}/></div></details><details className="finalAnswerDisclosure" id="f2Disclosure"><summary><span>سه آگاهی مهمی که به دست آوردم</span><small>{fa(awareness.filter((v) => v.trim()).length)} از ۳ پاسخ</small></summary><div className="finalAnswerFields" id="f2Fields"><p className="muted">هر آگاهی را در یک کادر جداگانه بنویس.</p><ReflectionFields prefix="f2" values={awareness} setValues={setAwareness}/></div></details><details className="finalAnswerDisclosure" id="f3Disclosure"><summary><span>سه اقدام مشخص برای ۳۰ روز آینده</span><small>{fa(actions.filter((v) => v.trim()).length)} از ۳ پاسخ</small></summary><div className="finalAnswerFields" id="f3Fields"><p className="muted">هر اقدام را در یک کادر جداگانه بنویس.</p><ReflectionFields prefix="f3" values={actions} setValues={setActions}/></div></details><label>مهم‌ترین چیزی که هنوز نیاز به کار دارد</label><textarea className="small" id="f4" maxLength={2000} value={remaining} onChange={(e) => setRemaining(e.target.value)} /></div><button className="primary heroAction" onClick={submit}>{buttonLabel('ثبت ارزیابی نهایی')}</button></section>;
}

export function Done({ onReport, onBooks, onSupport, onArchive, onNew }) { return <section className="card" id="done"><div className="welcome"><span className="badge">مسیر تکمیل شد</span><h2>۲۸ روز را به پایان رساندی.</h2><p className="muted">پایان این برنامه، پایان یادگیری نیست؛ شروع مرحله‌ای است که باید آگاهی‌ها را به رفتارهای پایدار تبدیل کنی.</p><button className="primary" onClick={onReport}><AppIcon name="chart" size={17} /> مشاهده گزارش نهایی</button><button className="gold" onClick={onBooks}><AppIcon name="bookOpen" size={17} /> کتابخانه اختصاصی</button><button className="secondary" onClick={onSupport}><AppIcon name="phone" size={17} /> ارتباط با مرکز</button><button className="secondary" onClick={onArchive}><AppIcon name="archive" size={17} /> آرشیو مسیرهای قبلی</button><button className="primary" onClick={onNew}>{buttonLabel('شروع مسیر تازه →')}</button></div></section>; }

export function buildFinalAnalysis(s) { const days = []; for (let i = 1; i <= 28; i += 1) if (s.daily?.[i]) days.push({ ...s.daily[i], day: i }); const scores = days.map((x) => Number(x.score)).filter(Number.isFinite), counts = { better: 0, same: 0, worse: 0, hard: 0 }; days.forEach((x) => { if (counts[x.feedback] !== undefined) counts[x.feedback] += 1; }); const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0, first = Number(s.daily?.[1]?.score), last = Number(s.daily?.[28]?.score); return { count: days.length, avg, first: Number.isFinite(first) ? first : null, last: Number.isFinite(last) ? last : null, improvement: Number.isFinite(first) && Number.isFinite(last) ? first - last : 0, counts, persistent: days.filter((x) => Number(x.score) >= 7).length, assessmentStart: Number(s.assessmentData?.score || 0), finalScore: Number(s.final?.score || 0), problem: s.profileData?.problem || '', age: s.profileData?.age || '', medical: s.profileData?.medical || '', medication: s.profileData?.medication || '', medicationRisk: s.profileData?.medicationRisk || '' }; }
function hypnoEligibility(p) { const reasons = []; if (!p || !Number.isInteger(Number(p.age))) reasons.push('سن ثبت نشده است'); else if (Number(p.age) < 23 || Number(p.age) > 63) reasons.push('سن خارج از محدوده مجاز PQHT (۲۳ تا ۶۳ سال)'); const blocked = { epilepsy: 'صرع', seizure: 'سابقه تشنج', panic: 'پانیک', bipolar: 'اختلال دو قطبی', speech_hearing: 'مشکل گفتاری یا شنوایی' }; if (blocked[p.medical]) reasons.push(blocked[p.medical]); if (p.medication === 'yes_fixed' && ['yes', 'unknown'].includes(p.medicationRisk)) reasons.push(p.medicationRisk === 'yes' ? 'داروی ساعت‌دار که نخوردن آن ممکن است در جلسه ۸ ساعته باعث تشدید بیماری/علائم شود' : 'وضعیت خطر داروی ساعت‌دار برای جلسه ۸ ساعته نامشخص است'); if (p.medical === 'other' && p.medicalNote) reasons.push('سابقه/وضعیت پزشکی دیگری ثبت شده که نیازمند بررسی تخصصی است'); return { eligible: reasons.length === 0, reasons }; }
function Recommendation({ journey }) { const p = journey.profileData || {}, r = hypnoEligibility(p), a = buildFinalAnalysis(journey), trend = a.improvement > 0 ? `امتیاز شدت درگیری از ${fa(a.first)} به ${fa(a.last)} رسیده است.` : a.improvement < 0 ? `امتیاز شدت درگیری از ${fa(a.first)} به ${fa(a.last)} رسیده و نیاز به توجه بیشتری دارد.` : 'امتیاز شدت درگیری در ابتدا و انتهای مسیر تغییر محسوسی نداشته است.'; return <div className="recommendation"><b>🎯 پیشنهاد ادامه مسیر</b><br/>{r.eligible ? <><span>با توجه به <b>سن و پاسخ‌های غربالگری پزشکی و دارویی ثبت‌شده</b>، از نظر قواعد اولیه این برنامه امکان بررسی ادامه مسیر با <b>جلسات مشاوره آنلاین به همراه ارزیابی و در صورت تأیید نهایی درمانگر، جلسه هیپنوتراپی PQHT</b> پیشنهاد می‌شود.</span><br/><span className="muted">{trend}</span><br/><small>این پیشنهاد غربالگری برنامه است و تصمیم نهایی درباره انجام جلسه PQHT فقط پس از ارزیابی تخصصی مرکز گرفته می‌شود.</small></> : <><span>با توجه به <b>سن و پاسخ‌های غربالگری پزشکی و دارویی ثبت‌شده</b>، در حال حاضر <b>جلسات مشاوره آنلاین</b> پیشنهاد می‌شود و جلسه PQHT بدون بررسی تخصصی پیشنهاد نمی‌شود.</span><br/><b>دلیل:</b> {r.reasons.join('، ')}<br/><span className="muted">{trend}</span><br/><small>این سامانه تشخیص پزشکی نمی‌دهد و جایگزین ارزیابی تخصصی نیست.</small></>}</div>; }

export function Report({ journey, content, onBooks, onSupport, onDashboard, onArchive, onNew }) { const p = journey.profileData || {}, a = buildFinalAnalysis(journey), start = Number(journey.assessmentData?.score || 0), end = Number(journey.final?.score || 0), diff = end - start, f = journey.final || {}, cat = content.categories?.[p.problem]; return <section className="card" id="report"><span className="badge">گزارش نهایی مسیر</span><h2>گزارش شخصی مسیر ۲۸ روزه</h2><div id="reportProfile"><div className="profile"><div className="profileBox"><span>نام</span><b>{p.name || ''}</b></div><div className="profileBox"><span>مسئله</span><b>{p.problem || ''}</b></div><div className="profileBox"><span>سن</span><b>{fa(p.age || 0)} سال</b></div></div></div><div className="metric"><div className="metricBox"><strong id="startScore">{fa(start)}/۱۰</strong><span>امتیاز شروع</span></div><div className="metricBox"><strong id="endScore">{fa(end)}/۱۰</strong><span>امتیاز پایان</span></div></div><div className="feedback"><b>نتیجه تغییر</b><p className="muted" id="scoreChange">{diff > 0 ? `امتیاز وضعیت کلی ${fa(diff)} نمره بالاتر شده است.` : diff < 0 ? `امتیاز وضعیت کلی ${fa(Math.abs(diff))} نمره پایین‌تر شده است.` : 'امتیاز وضعیت کلی تغییر نکرده است.'}</p></div><div className="recommendation"><b>جمع‌بندی مسیر</b><p className="muted" id="reportSummary">مسیر ۲۸ روزه برای «{p.problem || ''}» کامل شد. از {fa(a.count)} بازخورد ثبت‌شده، {fa(a.counts.better)} مورد «بهتر شدم»، {fa(a.counts.same)} مورد «تقریباً مثل قبل»، {fa(a.counts.worse)} مورد «بدتر شدم» و {fa(a.counts.hard)} مورد «تمرین برایم سخت بود» ثبت شده است. میانگین شدت درگیری روزانه {fa(Math.round(a.avg * 10) / 10)} از ۱۰ بوده است.</p></div><div id="hypnoReportRecommendation"><Recommendation journey={journey}/></div><hr/><ReportBlock title="سه تغییر من" id="rf1" text={fa(f.f1 || '')}/><ReportBlock title="سه آگاهی من" id="rf2" text={fa(f.f2 || '')}/><ReportBlock title="سه اقدام ۳۰ روز آینده" id="rf3" text={fa(f.f3 || '')}/><ReportBlock title="موضوع نیازمند توجه" id="rf4" text={fa(f.f4 || '')}/><hr/><h3>پاسخ‌های ثبت‌شده</h3><div id="answersList">{Object.entries(journey.answers || {}).sort(([x], [y]) => Number(x) - Number(y)).map(([d, ans]) => { const day = cat?.days?.find((x) => Number(x.day) === Number(d)); return <div className="answerItem" key={d}><b>روز {fa(d)} · {fa(String(day?.title || '').replace(/\s*[·•-]?\s*روز\s*\d+\s*$/i, ''))}</b><p>{fa(ans)}</p><small>شدت: {fa(journey.daily?.[d]?.score ?? 0)} از ۱۰ · بازخورد: {journey.daily?.[d]?.feedbackText || ''}</small></div>; })}</div><button className="gold" onClick={onBooks}><AppIcon name="bookOpen" size={17} /> کتابخانه اختصاصی</button><button className="secondary" onClick={onSupport}><AppIcon name="phone" size={17} /> پشتیبانی مرکز</button><button className="secondary" onClick={onDashboard}>{buttonLabel('بازگشت به داشبورد')}</button><button className="secondary" onClick={onArchive}><AppIcon name="archive" size={17} /> آرشیو مسیرهای قبلی</button><button className="primary" onClick={onNew}>{buttonLabel('شروع مسیر تازه →')}</button></section>; }
function ReportBlock({ title, id, text }) { return <><h3>{title}</h3><div className="answerItem"><p id={id} style={{ whiteSpace: 'pre-wrap' }}>{fa(text || '')}</p></div></>; }

export function Archive({ journey, content, onBack, onNew }) {
  const [selected, setSelected] = useState(null);
  const list = journey.archive || [];
  const selectedArchive = selected == null ? null : list[selected];
  return <section className="card" id="archive"><span className="badge">آرشیو مسیرها</span><h2>مسیرهای قبلی</h2><p className="muted">هر بار که مسیر تازه‌ای شروع شود، پرونده مسیر قبلی اینجا نگهداری می‌شود.</p>

    <div id="archiveList" className={selectedArchive ? 'hidden' : ''}>{!list.length ? <div className="muted">هنوز مسیر قبلی در آرشیو وجود ندارد.</div> : list.map((a, i) => { const p = a.profileData || {}, completed = Array.isArray(a.completed) ? a.completed.length : 0; return <div className="answerItem" key={`${a.pathId}-${i}`}><b>مسیر {fa(i + 1)} · {p.problem || 'بدون عنوان'}</b><p>پیشرفت: {fa(completed)}/۲۸ · امتیاز شروع: {a.assessmentData?.score == null ? '-' : `${fa(a.assessmentData.score)}/۱۰`} · امتیاز پایان: {a.final?.score == null ? '-' : `${fa(a.final.score)}/۱۰`}<br/>تاریخ شروع: {formatDate(a.startedAt)}<br/>تاریخ بایگانی: {formatDate(a.archivedAt)}</p><button className="secondary" onClick={() => { setSelected(i); window.scrollTo({ top: 0, behavior: 'auto' }); }}><AppIcon name="eye" size={17} /> مشاهده جزئیات مسیر</button></div>; })}</div><div id="archiveDetail" className={selectedArchive ? '' : 'hidden'}>{selectedArchive && <ArchiveDetail archive={selectedArchive} content={content} onClose={() => setSelected(null)} />}</div><button className="primary" onClick={onNew}>{buttonLabel('شروع مسیر تازه →')}</button><button className="secondary" onClick={onBack}>{buttonLabel('بازگشت به داشبورد')}</button></section>;
}

function ArchiveDetail({ archive, content, onClose }) { const p = archive.profileData || {}, cat = content.categories?.[p.problem]; return <><div className="feedback"><b><AppIcon name="archive" size={17} /> جزئیات مسیر آرشیوشده</b><p className="muted">مسئله: {p.problem || '-'} · نام: {p.name || '-'} · کد: {p.code || '-'}</p><p className="muted">شروع: {formatDate(archive.startedAt)} · آرشیو: {formatDate(archive.archivedAt)}</p></div>{Object.entries(archive.answers || {}).sort(([x], [y]) => Number(x) - Number(y)).map(([d, ans]) => { const day = cat?.days?.find((x) => Number(x.day) === Number(d)); const daily = archive.daily?.[d]; return <div className="answerItem" key={d}><b>روز {fa(d)} · {fa(String(day?.title || '').replace(/\s*[·•-]?\s*روز\s*\d+\s*$/i, '').split('·')[0].trim())}</b><p>{fa(ans)}</p><small>شدت: {daily?.score == null ? '-' : `${fa(daily.score)} از ۱۰`} · {daily?.feedbackText || ''}</small></div>; })}<button className="secondary" onClick={onClose}><AppIcon name="chevronLeft" size={17} /> بازگشت به فهرست آرشیوها</button></>; }

function NavIcon({ name }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false' };
  const paths = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/></>,
    profile: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    books: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 5.5v12"/><path d="M8 7h8M8 11h8M8 15h5"/></>,
    support: <><path d="M21 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-5 2v-6.5A7.5 7.5 0 1 1 21 11.5Z"/><path d="M8 11h8M8 14.5h5"/></>
  };
  return <svg {...common}>{paths[name]}</svg>;
}

export function BottomNav({ screen, onHome, onProfile, onBooks, onSupport }) {
  const active = screen === 'profile'
    ? 'profile'
    : ['books', 'bookReader'].includes(screen)
      ? 'books'
      : screen === 'support'
        ? 'support'
        : 'dashboard';
  return <nav className="bottomNav" id="bottomNav" aria-label="ناوبری اصلی"><button data-view="dashboard" className={active === 'dashboard' ? 'active' : ''} aria-current={active === 'dashboard' ? 'page' : undefined} onClick={onHome}><span className="navIcon"><NavIcon name="home" /></span><b>خانه</b></button><button data-view="profile" className={active === 'profile' ? 'active' : ''} aria-current={active === 'profile' ? 'page' : undefined} onClick={onProfile}><span className="navIcon"><NavIcon name="profile" /></span><b>پروفایل</b></button><button data-view="books" className={active === 'books' ? 'active' : ''} aria-current={active === 'books' ? 'page' : undefined} onClick={onBooks}><span className="navIcon"><NavIcon name="books" /></span><b>مطالعه</b></button><button data-view="support" className={active === 'support' ? 'active' : ''} aria-current={active === 'support' ? 'page' : undefined} onClick={onSupport}><span className="navIcon"><NavIcon name="support" /></span><b>ارتباط</b></button></nav>;
}
export function Footer() {
  return <aside className="footerNotice" role="note" aria-label="یادآوری مهم">
    <div className="footerNoticeTitle">
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>
      <strong>یادآوری مهم</strong>
    </div>
    <p>این برنامه یک مسیر آموزشی برای خودمشاهده‌گری و تمرین روزانه است. با آرامش و به‌اندازه توان خود پیش بروید و از تمرین‌ها برای شناخت بهتر افکار، احساسات و الگوهای رفتاری خود استفاده کنید. این برنامه جایگزین تشخیص یا درمان تخصصی نیست.</p>
  </aside>;
}

export function CopyrightModal({ onAccept }) { return <div className="copyrightModal" id="copyrightModal"><div className="copyrightCard"><div className="copyrightIcon"><AppIcon name="lock" size={24} /></div><h2>احترام به حقوق اثر</h2><p className="muted">محتوای کتاب‌ها، تمرین‌ها و مطالب آموزشی این برنامه متعلق به مرکز هیپنوتراپی شفا و صاحب اثر است و استفاده از آن برای کاربر مجاز برنامه در نظر گرفته شده است.</p><p className="muted">کپی، انتشار، بازنشر، فروش، ارسال برای دیگران یا استفاده تجاری از محتوای کتاب‌ها و مطالب برنامه بدون اجازه صاحب اثر مجاز نیست.</p><p className="muted">برای مطالعه و استفاده قانونی از آثار، لطفاً نسخه اصلی کتاب‌ها را از مرکز هیپنوتراپی شفا تهیه کنید.</p><button className="primary" onClick={onAccept}>{buttonLabel('متوجه شدم و ورود به مسیر را ادامه می‌دهم')}</button></div></div>; }
export function ValidationModal({ data, onClose }) {
  const isDailyLock = data.title === 'این روز هنوز فعال نشده است' || data.title === 'این مرحله هنوز فعال نشده است';

  return <div className="validationModal" id="validationModal"><div className="validationCard">
    <span className="badge">{isDailyLock ? 'یادآوری مهم' : 'تکمیل اطلاعات'}</span>
    <h2 id="validationTitle">{isDailyLock ? 'هنوز زمان مرحله بعدی نرسیده است' : data.title}</h2>
    {isDailyLock ? <>
      <p className="muted">مسیر ۲۸ روزه برای برداشتن قدم‌های کوچک و پیوسته طراحی شده است. هر مرحله پس از تکمیل مرحله قبلی و رسیدن روز تقویمی بعد، در دسترس قرار می‌گیرد.</p>
      <ul id="validationList">
        <li>در هر روز فقط یک مرحله جدید از مسیر فعال می‌شود.</li>
        <li>مرحله بعدی از روز آینده و بر اساس ساعت رسمی ایران باز خواهد شد.</li>
      </ul>
      <p className="muted">عجله‌ای نیست؛ به تمرین امروز فرصت بده تا در زندگی‌ات اثر بگذارد. فردا با آمادگی بیشتر، قدم بعدی را بردار.</p>
    </> : <>
      <p className="muted">موارد زیر را بررسی کن تا بتوانی ادامه بدهی:</p>
      <ul id="validationList">{data.items.map((item, i) => <li key={`${item}-${i}`}>{item}</li>)}</ul>
    </>}
    <button className="primary" onClick={onClose}>{buttonLabel('متوجه شدم')}</button>
  </div></div>;
}
export function BookPreviewModal({ preview, onClose, onOpen }) { return <div className="bookPreviewModal" id="bookPreviewModal"><div className="bookPreviewCard"><span className="badge">مطالعه پیشنهادی · اختیاری</span><h2 id="bookPreviewTitle"><AppIcon name="bookOpen" size={19} /> مطالعه پیشنهادی روز {fa(preview.day)}</h2><p className="muted" id="bookPreviewMeta">{fa(preview.meta)}</p><article className="bookPreviewText" id="bookPreviewText">{fa(preview.text)}</article><button className="primary" onClick={onOpen}><AppIcon name="bookOpen" size={17} /> رفتن به کتابخانه اختصاصی</button><button className="secondary" onClick={onClose}><AppIcon name="chevronLeft" size={17} /> فعلاً نمی‌خوانم</button></div></div>; }
