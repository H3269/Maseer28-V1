import { fa } from '../../shared/utils.js';

export const LEGACY_BOOK_META = {
  1: { title: 'از حقیقت تا واقعیت', subtitle: 'جلد اول', note: 'شناخت خویشتن، تحول درونی و زندگی آگاهانه' },
  2: { title: 'از حقیقت تا واقعیت', subtitle: 'جلد دوم · دگردیسی', note: 'ذهن، ناخودآگاه و ساختن تغییر پایدار' },
  3: { title: 'از حقیقت تا واقعیت', subtitle: 'جلد سوم · موانع پنهان تحقق', note: 'فاصله میان دانستن و عمل؛ شناخت مانع و ساختن پاسخ تازه' },
  4: { title: 'کتابچه تکمیلی جلد سوم', subtitle: 'دفتر کار ۲۸ روزه · نقشه تغییر', note: 'کاربرگ‌ها، پیوست‌های شماره‌دار و تمرین‌های عملی جلد سوم' },
  5: { title: 'هنر شناخت و دگرگونی احساسات', subtitle: 'از واکنش‌های ناخودآگاه تا آرامش درونی', note: 'شناخت، درک و تنظیم احساسات انسان' },
};

export function legacySourceLabel(bookOrId, content) {
  const id = Number(typeof bookOrId === 'object' ? bookOrId?.legacyId : bookOrId) || 0;
  const book = typeof bookOrId === 'object' ? bookOrId : null;
  const item = LEGACY_BOOK_META[id];
  const title = item?.title || content?.title || book?.title || 'از حقیقت تا واقعیت';
  const subtitle = item?.subtitle || content?.subtitle || book?.subtitle || '';
  if (id >= 1 && id <= 3) return `منبع: ${title} — ${subtitle || `جلد ${fa(id)}`}`;
  if (id === 4 || id === 5) return `منبع: ${title}${subtitle ? ` — ${subtitle}` : ''}`;
  return `منبع: ${title}`;
}
