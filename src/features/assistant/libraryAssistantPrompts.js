export const LIBRARY_ASSISTANT_PROMPT_GROUPS = [
  {
    label: 'شناخت کتابخانه',
    questions: [
      { label: 'این کتابخانه چه کتاب‌هایی دارد؟', value: 'این کتابخانه چه کتاب‌هایی دارد؟' },
      { label: 'برای شروع مطالعه از کدام کتاب شروع کنم؟', value: 'برای شروع مطالعه از کدام کتاب شروع کنم؟' },
      { label: 'تفاوت موضوعی این پنج کتاب چیست؟', value: 'تفاوت موضوعی این پنج کتاب چیست؟' },
    ],
  },
  ...[
    ['اول', 'جلد اول'],
    ['دوم', 'جلد دوم'],
    ['سوم', 'جلد سوم'],
    ['چهارم', 'کتابچه تکمیلی جلد سوم (کتاب چهارم)'],
    ['پنجم', 'جلد پنجم'],
  ].map(([ordinal, title]) => ({
    label: title,
    questions: [
      { label: 'موضوع اصلی کتاب ' + ordinal + ' چیست؟', value: 'موضوع اصلی کتاب ' + ordinal + ' چیست؟' },
      { label: 'خلاصه کتاب ' + ordinal + ' را بگو.', value: 'خلاصه کتاب ' + ordinal + ' را بگو' },
      { label: 'مهم‌ترین نکات کتاب ' + ordinal + ' کدام‌اند؟', value: 'مهم‌ترین نکات کتاب ' + ordinal + ' کدام‌اند؟' },
      { label: 'مفهوم اصلی کتاب ' + ordinal + ' را ساده توضیح بده.', value: 'مفهوم اصلی کتاب ' + ordinal + ' را ساده و قابل فهم توضیح بده' },
      { label: 'دو مفهوم مهم کتاب ' + ordinal + ' را مقایسه کن.', value: 'دو مفهوم مهم کتاب ' + ordinal + ' را با هم مقایسه کن' },
    ],
  })),
];

export const LIBRARY_ASSISTANT_PROMPTS = LIBRARY_ASSISTANT_PROMPT_GROUPS.flatMap((group) => group.questions);
