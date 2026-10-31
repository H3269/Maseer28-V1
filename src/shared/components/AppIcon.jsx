import React from 'react';

const shapes = {
  rocket: <><path d="M4.5 15.5c-1.5 1.2-2 4-2 4s2.8-.5 4-2l2-2-2-2z"/><path d="M12 15l-3-3c1.2-4.5 5.3-8.2 11-9-0.8 5.7-4.5 9.8-9 11Z"/><path d="M13 7h.01"/><path d="M9 12l-4 1 2-4"/></>,
  check: <><path d="m5 12 4 4L19 6"/></>,
  arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
  save: <><path d="M5 3h12l4 4v14H3V3z"/><path d="M7 3v6h10V3M7 21v-7h10v7"/></>,
  play: <><path d="m8 5 11 7-11 7z"/></>,
  book: <><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H21v17H5.5A2.5 2.5 0 0 1 3 17.5z"/><path d="M3 5.5v12M7 7h10M7 11h10M7 15h7"/></>,
  megaphone: <><path d="m3 11 17-7v16L3 13z"/><path d="M7 14l2 6h4l-3-7M22 9v6"/></>,
  headset: <><path d="M3 13v-2a9 9 0 0 1 18 0v2"/><rect x="3" y="12" width="4" height="7" rx="2"/><rect x="17" y="12" width="4" height="7" rx="2"/><path d="M17 20h-4"/></>,
  chevronLeft: <><path d="m15 18-6-6 6-6"/></>,
  home: <><path d="m3 10 9-7 9 7"/><path d="M5 9.5V21h14V9.5M9 21v-7h6v7"/></>,
  bookOpen: <><path d="M12 7v14"/><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3c2.5 0 5 1 6.5 3 1.5-2 4-3 6.5-3A2.5 2.5 0 0 1 21 5.5V19a2 2 0 0 1-2 2c-2.5 0-5-1-7-3-2 2-4.5 3-7 3a2 2 0 0 1-2-2z"/></>,
  fileText: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></>,
  archive: <><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9M9 13h6"/></>,
  message: <><path d="M21 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-5 2v-6.5A7.5 7.5 0 1 1 21 11.5Z"/><path d="M8 11h8M8 14.5h5"/></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  edit: <><path d="m4 16-.8 4.8L8 20l11-11-4-4z"/><path d="m12.5 6.5 4 4"/></>,
  eraser: <><path d="m7 21-4.3-4.3a2.4 2.4 0 0 1 0-3.4l9.2-9.2a2.4 2.4 0 0 1 3.4 0l4.6 4.6a2.4 2.4 0 0 1 0 3.4L11 21z"/><path d="M22 21H7"/><path d="m5 11 9 9"/></>,
  dashboard: <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 15h3v3H7zM14 7h3v11h-3zM7 7h3v4H7z"/></>,
  phone: <><path d="M5 3h4l2 5-3 2a15 15 0 0 0 6 6l2-3 5 2v4c0 1-1 2-2 2C10 20 4 14 3 5c0-1 1-2 2-2z"/></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7h.01"/></>,
  x: <><path d="m6 6 12 12M18 6 6 18"/></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></>,
  minus: <><path d="M5 12h14"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  volume: <><path d="M4 10v4h3l5 4V6l-5 4H4Z"/><path d="M16 9a5 5 0 0 1 0 6M18.5 6.5a9 9 0 0 1 0 11"/></>,
  volumeX: <><path d="M4 10v4h3l5 4V6l-5 4H4Z"/><path d="m17 9 5 6m0-6-5 6"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></>,
  moon: <><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 8.5 8.5 0 1 0 20.5 14.5Z"/></>,
  contrast: <><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18Z"/></>,
  chevronRight: <><path d="m9 18 6-6-6-6"/></>,
  chevronDown: <><path d="m6 9 6 6 6-6"/></>,
  copy: <><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3"/></>,
  userRound: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  circle: <><circle cx="12" cy="12" r="8"/></>,
  checkCircle: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16.5 9"/></>,
};
const aliases = { 'شروع مسیر':'rocket','متوجه شدم':'check','ادامه به ارزیابی':'arrow','ثبت و شروع':'save','ادامه مسیر':'play','کتابخانه':'bookOpen','عضویت درکانال':'megaphone','پشتیبانی':'headset','ثبت امروز':'save','ثبت ارزیابی':'save','روز قبل':'chevronLeft','داشبورد':'home','مطالعه جلد':'bookOpen','بازگشت':'chevronLeft','شروع مسیر تازه':'arrow','مشاهده گزارش':'chart','آرشیو':'archive' };
export default function AppIcon({ name, size = 20, className = '', title }) {
  const common = { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': title ? undefined : true, role: title ? 'img' : undefined, className, focusable: 'false' };
  return <svg {...common}>{title && <title>{title}</title>}{shapes[aliases[name] || name] || shapes.info}</svg>;
}
export { aliases };
