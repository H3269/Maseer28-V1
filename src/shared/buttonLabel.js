import React from 'react';
import AppIcon from './components/AppIcon.jsx';

const BUTTON_ICONS = [
  ['شروع مسیر', 'rocket'], ['متوجه شدم', 'check'], ['ادامه به ارزیابی', 'arrow'],
  ['ثبت و شروع', 'save'], ['ادامه مسیر', 'play'], ['کتابخانه', 'book'],
  ['عضویت درکانال', 'megaphone'], ['پشتیبانی', 'headset'], ['ثبت امروز', 'save'],
  ['ثبت ارزیابی', 'save'], ['روز قبل', 'chevronLeft'], ['داشبورد', 'home'],
  ['مطالعه جلد', 'bookOpen'], ['بازگشت', 'chevronLeft'], ['شروع مسیر تازه', 'arrow'],
  ['مشاهده گزارش', 'chart'], ['آرشیو', 'archive'],
];

export function buttonLabel(text) {
  const value = String(text ?? '').trim();
  if (!value) return value;
  const hit = BUTTON_ICONS.find(([needle]) => value.includes(needle));
  return hit ? <><AppIcon name={hit[1]} size={17} className="buttonIcon" />{' '}{value}</> : value;
}
