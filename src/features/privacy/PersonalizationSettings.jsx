import React, { useEffect, useState } from 'react';
import {
  getConsentState,
  grantConsent,
  withdrawConsent,
} from './consentManager.js';
import {
  DEFAULT_PERSONALIZATION,
  clearPersonalizationPreferences,
  loadPersonalizationPreferences,
  savePersonalizationPreferences,
} from './personalizationPreferences.js';

const CONSENT_CONTEXT = {
  retention_period: 'Until the user withdraws consent; only non-sensitive interaction preferences are stored.',
  view_edit_delete_controls: 'This panel provides viewing, editing, clearing, and consent withdrawal controls.',
};

const JOURNEY_CONTEXT_CONSENT = {
  selected_data_categories: 'active journey day, completed day count, and an explicitly selected current goal only',
  retention_period: 'context package expires within 24 hours; no journey history is stored by this consent',
  view_edit_delete_controls: 'the user can review and withdraw this permission in this panel',
};

const OPTIONS = {
  response_detail: [['concise','مختصر'],['balanced','متعادل'],['detailed','مفصل']],
  communication_style: [['direct','مستقیم'],['supportive','حمایتگر'],['neutral','خنثی']],
  example_style: [['practical','کاربردی'],['conceptual','مفهومی'],['mixed','ترکیبی']],
};

const LABELS = {
  response_detail: 'میزان جزئیات پاسخ',
  communication_style: 'سبک ارتباطی',
  example_style: 'نوع مثال‌ها',
};

function notifyPreferencesChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('maseer28:personalization-changed'));
}

export default function PersonalizationSettings() {
  const [consent, setConsent] = useState(null);
  const [preferences, setPreferences] = useState({ ...DEFAULT_PERSONALIZATION });
  const [journeyContextEnabled, setJourneyContextEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const state = getConsentState();
      setConsent(state);
      setPreferences(loadPersonalizationPreferences());
      setJourneyContextEnabled(state?.purposes?.journey_context?.granted === true);
    } catch {
      setError('ذخیره‌سازی محلی در دسترس نیست؛ ترجیحات در این مرورگر ذخیره نمی‌شوند.');
    }
  }, []);

  const enabled = consent?.purposes?.long_term_ai_memory?.granted === true;

  function enable() {
    try {
      const next = grantConsent('long_term_ai_memory', {
        explicitAction: true,
        context: CONSENT_CONTEXT,
      });
      setConsent(next);
      setPreferences(loadPersonalizationPreferences());
      window.dispatchEvent(new Event('maseer28:consent-changed'));
      setError('');
      setMessage('رضایت ذخیره ترجیحات غیرحساس ثبت شد. هنوز هیچ متن گفتگو یا سابقه روان‌شناختی ذخیره نمی‌شود.');
    } catch (cause) {
      setError(cause?.message || 'ثبت رضایت انجام نشد.');
    }
  }


  function enableJourneyContext() {
    try {
      const next = grantConsent('journey_context', { explicitAction: true, context: JOURNEY_CONTEXT_CONSENT });
      setConsent(next);
      setJourneyContextEnabled(true);
      window.dispatchEvent(new Event('maseer28:consent-changed'));
      setError('');
      setMessage('رضایت مستقل زمینه مسیر ثبت شد. با رضایت فعال، فقط روز فعال و تعداد روزهای تکمیل‌شده در بسته موقت محلی به دستیار آزمایشی داده می‌شود؛ هیچ ارسال بیرونی انجام نمی‌شود.');
    } catch (cause) {
      setError(cause?.message || 'ثبت رضایت زمینه مسیر انجام نشد.');
    }
  }

  function withdrawJourneyContext() {
    try {
      const next = withdrawConsent('journey_context');
      setConsent(next);
      setJourneyContextEnabled(false);
      window.dispatchEvent(new Event('maseer28:consent-changed'));
      setError('');
      setMessage('رضایت استفاده از زمینه مسیر لغو شد. دستیار نباید این زمینه را دریافت کند.');
    } catch (cause) {
      setError(cause?.message || 'لغو رضایت زمینه مسیر انجام نشد.');
    }
  }

  function save() {
    try {
      const saved = savePersonalizationPreferences(preferences, { explicitAction: true });
      setPreferences(saved);
      notifyPreferencesChanged();
      setError('');
      setMessage('ترجیحات در همین مرورگر ذخیره شدند و در پرسش‌های غیرایمنی برای تنظیم لحن و میزان توضیح به کار می‌روند؛ ترتیب پرسش‌های ایمنی تغییر نمی‌کند.');
    } catch (cause) {
      setError(cause?.message || 'ذخیره ترجیحات انجام نشد.');
    }
  }

  function clear() {
    try {
      clearPersonalizationPreferences();
      setPreferences({ ...DEFAULT_PERSONALIZATION });
      notifyPreferencesChanged();
      setError('');
      setMessage('ترجیحات ذخیره‌شده از حافظه محلی برنامه پاک شدند.');
    } catch (cause) {
      setError(cause?.message || 'پاک‌کردن ترجیحات انجام نشد.');
    }
  }

  function withdraw() {
    try {
      const next = withdrawConsent('long_term_ai_memory');
      setConsent(getConsentState());
      setPreferences({ ...DEFAULT_PERSONALIZATION });
      notifyPreferencesChanged();
      window.dispatchEvent(new Event('maseer28:consent-changed'));
      setError('');
      setMessage(next.erasure_errors?.length
        ? 'رضایت لغو شد، اما حذف ترجیحات با خطا روبه‌رو شد. حذف کامل را نمی‌توان تأیید کرد.'
        : 'رضایت لغو شد و ترجیحات ذخیره‌شده برای حذف محلی ارسال شدند.');
    } catch (cause) {
      setError(cause?.message || 'لغو رضایت انجام نشد.');
    }
  }

  return <section className="sectionHint" aria-labelledby="personalization-settings-title">
    <div>
      <b id="personalization-settings-title">ترجیحات شخصی‌سازی و کنترل حافظه</b>
      <p className="muted">این بخش فقط ترجیحات غیرحساسِ شیوه تعامل را نگه می‌دارد؛ نه متن گفتگو، تشخیص، نشانه‌ها یا سابقه روان‌شناختی. ذخیره‌سازی فقط در حافظه محلی همین مرورگر است.</p>
      {!enabled
        ? <p className="muted">ذخیره بلندمدت خاموش است. تا وقتی رضایت ندهی، فقط تنظیمات پیش‌فرض موقت استفاده می‌شوند.</p>
        : <div>
          {Object.entries(OPTIONS).map(([key, options]) => <label key={key} className="fieldLabel">
            {LABELS[key]}
            <select className="small" value={preferences[key]} onChange={(event) => setPreferences((current) => ({ ...current, [key]: event.target.value }))}>
              {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>)}
          <div className="contactActions">
            <button className="primary" type="button" onClick={save}>ذخیره ترجیحات</button>
            <button className="secondary" type="button" onClick={clear}>پاک‌کردن ترجیحات</button>
            <button className="secondary" type="button" onClick={withdraw}>لغو رضایت و پاک‌سازی</button>
          </div>
        </div>}
      {!enabled && <button className="secondary" type="button" onClick={enable}>رضایت می‌دهم ترجیحات غیرحساس ذخیره شوند</button>}
      <div className="sectionHint" role="group" aria-labelledby="journey-context-consent-title">
        <b id="journey-context-consent-title">رضایت جداگانه برای زمینه مسیر</b>
        <p className="muted">این مجوز فقط می‌تواند روز فعال، تعداد روزهای تکمیل‌شده و هدفی را که خودت انتخاب کرده‌ای در یک بسته محلی با عمر حداکثر ۲۴ ساعت مجاز کند. پاسخ‌های روزانه، متن گفتگو، نام، تشخیص و آرشیو مسیر شامل این مجوز نیستند. در حال حاضر با رضایت فعال، فقط داده‌های مجاز در حافظه موقت همین جلسه به دستیار محلی داده می‌شوند.</p>
        {journeyContextEnabled
          ? <button className="secondary" type="button" onClick={withdrawJourneyContext}>لغو رضایت زمینه مسیر</button>
          : <button className="secondary" type="button" onClick={enableJourneyContext}>رضایت می‌دهم زمینه محدود مسیر مجاز باشد</button>}
      </div>

      <p className="muted">پردازش ابری، تحلیل محصول و پردازش داده حساس در این نسخه فعال نیستند و از این بخش قابل فعال‌سازی نیستند. زمینه مسیر و ترجیحات فقط به‌صورت محلی و با رضایت جداگانه استفاده می‌شوند. متن گفتگو، پاسخ‌ها و اطلاعات سلامت در این حافظه ذخیره نمی‌شوند. سرعت پرسش‌ها و زبان هنوز گزینه قابل تغییر نیستند، چون در موتور فعلی به‌طور کامل پشتیبانی نمی‌شوند.</p>
      {message && <p className="contactHelp" role="status" aria-live="polite">{message}</p>}
      {error && <p className="contactHelp" role="alert">{error}</p>}
    </div>
  </section>;
}
