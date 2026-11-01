import { DEFAULT_PERSONALIZATION } from '../privacy/personalizationPreferences.js';

const CONCISE_PROMPTS = Object.freeze({
  open_problem: 'دوست داری درباره چه مسئله‌ای صحبت کنیم؟ با زبان خودت بگو.',
  impact: 'این مسئله چه اثری بر زندگی روزمره‌ات گذاشته است؟ یک نمونه بگو.',
  duration: 'این وضعیت از چه زمانی شروع شده و هر چند وقت رخ می‌دهد؟',
  goal: 'از این گفتگو چه می‌خواهی: فهم مسئله، راهکار یا تصمیم درباره کمک تخصصی؟',
  clarify_example: 'یک موقعیت مشخص و اخیر را تعریف می‌کنی؟ چه اتفاقی افتاد، چه فکری کردی و چه احساسی داشتی؟',
  summary_confirmation: 'این خلاصه تجربه‌ات را درست بازتاب می‌دهد؟ چه چیزی را اصلاح کنم؟',
  summary_revision: 'کدام بخش برداشت من نادرست بود و به‌جای آن چه چیزی باید بفهمم؟',
});

const DETAIL_NOTES = Object.freeze({
  open_intent: 'این پرسش کمک می‌کند گفتگو از مسئله‌ای شروع شود که خودت مهم می‌دانی.',
  context_and_impact: 'هدف، فهم زمینه و اثر واقعی مسئله است؛ نه قضاوت یا تشخیص.',
  differential_clarification: 'مثال مشخص کمک می‌کند برداشت عجولانه و صرفاً مبتنی بر یک واژه کمتر شود.',
  collaborative_summary: 'خلاصه فقط یک برداشت موقت است و اصلاح تو بر آن اولویت دارد.',
  user_correction: 'اصلاح تو جای برداشت قبلی را می‌گیرد؛ تا روشن‌شدن دوباره، موضوع تازه‌ای نتیجه‌گیری نمی‌شود.',
});

export function getPersonalizedQuestionText(question, preferences = DEFAULT_PERSONALIZATION) {
  if (!question?.prompt) return '';
  // Safety questions are deliberately invariant: personalization must not soften or obscure them.
  if (question.stage === 'safety_check') return question.prompt;
  const prompt = preferences.response_detail === 'concise'
    ? (CONCISE_PROMPTS[question.id] ?? question.prompt)
    : question.prompt;
  const tone = preferences.communication_style === 'supportive'
    ? 'هرقدر که برایت راحت است پاسخ بده؛ لازم نیست چیزی را کامل یا بی‌نقص توضیح بدهی. '
    : preferences.communication_style === 'direct'
      ? ''
      : '';
  const example = question.id === 'clarify_example'
    ? preferences.example_style === 'practical'
      ? '\nمثال کاربردی: یک گفت‌وگوی اخیر را انتخاب کن و بگو چه گفته شد و تو چه واکنشی داشتی.'
      : preferences.example_style === 'conceptual'
        ? '\nمی‌توانی پاسخ را در چهار بخش بنویسی: موقعیت، فکر، احساس و واکنش.'
        : '\nمثال: یک موقعیت اخیر را با موقعیت، فکر، احساس و واکنشت توضیح بده.'
    : '';
  const detail = preferences.response_detail === 'detailed'
    ? '\n' + (DETAIL_NOTES[question.stage] ?? 'این پرسش برای روشن‌ترشدن تجربه توست؛ پاسخ درست یا غلطی وجود ندارد.')
    : '';
  return tone + prompt + example + detail;
}

export function getConversationOverview(preferences = DEFAULT_PERSONALIZATION) {
  if (preferences.step_pacing !== 'grouped') return '';
  return 'نمای کلی گفتگو: شناخت مسئله، بررسی اثر و زمینه، روشن‌سازی ابهام‌ها و بازبینی خلاصه. پرسش‌های ایمنی همیشه جدا و مقدم بر مراحل دیگر مطرح می‌شوند.';
}
