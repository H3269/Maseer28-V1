export const DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN = "یادآوری مهم درباره ایمنی شما\n\nدر طول انجام تمرین‌ امروز، به احساسات و وضعیت روانی خود توجه کنید. اگر احساس کردید فشار روانی شما بیشتر شده، حالتان رو به وخامت است یا ادامه تمرین برایتان آزاردهنده شده، تمرین را متوقف کنید و به خودتان فرصت آرام‌شدن بدهید.\n\nدر چنین شرایطی، می‌توانید از یک فرد مورد اعتماد یا متخصص سلامت روان کمک بگیرید. اگر احتمال آسیب به خودتان یا فرد دیگری وجود دارد، موضوع را جدی بگیرید و از خدمات اورژانسی محل زندگی خود کمک فوری دریافت کنید.\n\nبه یاد داشته باشید: سلامت و امنیت شما از انجام هر تمرینی مهم‌تر است.";

export const DAILY_ASSISTANT_SAFETY_QUESTION_KINDS = new Set([
  'anger_increased',
  'anxiety_increased',
  'fear_increased',
  'hostility_increased',
  'jealousy_increased',
  'grief_increased',
  'dependency_increased',
  'procrastination_increased',
  'boundary_distress',
  'sleep_distress',
  'motivation_distress',
  't11_distress',
  'loneliness_increased',
  'guilt_increased',
  'confidence_distress',
  'rumination_distress',
  'relationship_distress',
  'self_hatred_distress',
  'self_blame_distress',
  'perfectionism_distress',
  'avoidance_distress',
  'stress_distress',
  'worthlessness_distress',
  'emotion_regulation_distress',
  'resentment_distress',
  'shame_distress',
  'judgment_fear_distress',
  'failure_fear_distress',
  'rejection_fear_distress',
  'doubt_distress',
  'control_distress',
  'demotivation_distress',
  'self_criticism_distress',
  'other_topic_distress',
  'talk_other',
  'success',
  'stop',
]);

export function appendDailyAssistantSafetyReminder(answer, questionKind) {
  if (typeof answer !== 'string' || !answer.trim() || !DAILY_ASSISTANT_SAFETY_QUESTION_KINDS.has(questionKind)) return answer;
  return answer.trimEnd() + '\n\n' + DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN;
}
