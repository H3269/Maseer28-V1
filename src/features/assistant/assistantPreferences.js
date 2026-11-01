export function formatAssistantPrompt(question, preferences = {}) {
  if (!question) return '';
  if (question.stage === 'safety_check') return question.prompt;
  let prompt = question.prompt;
  if (preferences.communication_style === 'supportive') prompt = `می‌توانیم با آرامش و به‌اندازه‌ای که برایت راحت است پیش برویم. ${prompt}`;
  else if (preferences.communication_style === 'direct') prompt = `پاسخ کوتاه و مشخص هم کافی است. ${prompt}`;
  if (question.stage === 'differential_clarification') {
    if (preferences.example_style === 'practical') prompt += ' روی یک نمونه واقعی و مشخص تمرکز کن.';
    else if (preferences.example_style === 'conceptual') prompt += ' اگر نمونه مشخصی نداری، الگوی کلی یا موقعیت تکرارشونده را توضیح بده.';
  }
  if (preferences.response_detail === 'balanced') prompt += ' اگر لازم است، یک نمونه کوتاه هم اضافه کن.';
  else if (preferences.response_detail === 'detailed') prompt += ' اگر بخشی را نمی‌دانی یا مطمئن نیستی، همان را صریح بگو؛ لازم نیست حدس بزنی.';
  return prompt;
}
