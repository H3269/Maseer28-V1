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

const OPTIONS = {
  response_detail: [['concise','مختصر'],['balanced','متعادل'],['detailed','مفصل']],
  communication_style: [['direct','مستقیم'],['supportive','حمایتگر'],['neutral','خنثی']],
  step_pacing: [['one_at_a_time','یک گام در هر نوبت'],['grouped','چند گام با هم']],
  example_style: [['practical','کاربردی'],['conceptual','مفهومی'],['mixed','ترکیبی']],
  language: [['fa','فارسی'],['en','انگلیسی'],['auto','خودکار']],
};

const LABELS = {
  response_detail: 'میزان جزئیات پاسخ',
  communication_style: 'سبک ارتباطی',
  step_pacing: 'سرعت ارائه راهنمایی',
  example_style: 'نوع مثال‌ها',
  language: 'زبان ترجیحی',
};

export default function PersonalizationSettings() {
  const [consent, setConsent] = useState(null);
  const [preferences, setPreferences] = useState({ ...DEFAULT_PERSONALIZATION });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const state = getConsentState();
      setConsent(state);
      setPreferences(loadPersonalizationPreferences());
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
      setError('');
      setMessage('رضایت ذخیره ترجیحات غیرحساس ثبت شد. هنوز هیچ متن گفتگو یا سابقه روان‌شناختی ذخیره نمی‌شود.');
    } catch (cause) {
      setError(cause?.message || 'ثبت رضایت انجام نشد.');
    }
  }

  function save() {
    try {
      const saved = savePersonalizationPreferences(preferences, { explicitAction: true });
      setPreferences(saved);
      setError('');
      setMessage('ترجیحات در همین مرورگر ذخیره شدند. این تنظیمات هنوز به رفتار موتور پاسخ‌گویی متصل نشده‌اند.');
    } catch (cause) {
      setError(cause?.message || 'ذخیره ترجیحات انجام نشد.');
    }
  }

  function clear() {
    try {
      clearPersonalizationPreferences();
      setPreferences({ ...DEFAULT_PERSONALIZATION });
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
      <p className="muted">پردازش ابری، تحلیل محصول و پردازش داده حساس در این نسخه فعال نیستند و از این بخش قابل فعال‌سازی نیستند. متن گفتگو، پاسخ‌ها و اطلاعات سلامت در این حافظه ذخیره نمی‌شوند. گزینه سرعت گام‌ها فعلاً به دلیل ثابت‌بودن ترتیب ایمنی، پرسش‌ها را گروهی نمی‌کند.</p>
      {message && <p className="contactHelp" role="status" aria-live="polite">{message}</p>}
      {error && <p className="contactHelp" role="alert">{error}</p>}
    </div>
  </section>;
}
