export const DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN = "یادآوری مهم درباره ایمنی شما\n\nدر طول انجام تمرین‌ امروز، به احساسات و وضعیت روانی خود توجه کنید. اگر احساس کردید فشار روانی شما بیشتر شده، حالتان رو به وخامت است یا ادامه تمرین برایتان آزاردهنده شده، تمرین را متوقف کنید و به خودتان فرصت آرام‌شدن بدهید.\n\nدر چنین شرایطی، می‌توانید از یک فرد مورد اعتماد یا متخصص سلامت روان کمک بگیرید. اگر احتمال آسیب به خودتان یا فرد دیگری وجود دارد، موضوع را جدی بگیرید و از خدمات اورژانسی محل زندگی خود کمک فوری دریافت کنید.\n\n**مرکز هیپنوتراپی شفا با شماره تماس ۰۹۱۹۰۸۸۹۰۶۲ همیشه در کل مسیر همراه شماست**\n\nبه یاد داشته باشید: سلامت و امنیت شما از انجام هر تمرینی مهم‌تر است.";

const SAFETY_QUESTION_KINDS = new Set([
  'anger_increased',
  'anxiety_increased',
  'fear_increased',
  'hostility_increased',
  'grief_increased',
  'dependency_increased',
  'procrastination_increased',
  'guilt_increased',
  'talk_other',
  'success',
  'stop',
]);

export function appendDailyAssistantSafetyReminder(answer, questionKind) {
  if (typeof answer !== 'string' || !answer.trim() || !SAFETY_QUESTION_KINDS.has(questionKind)) return answer;
  return answer.trimEnd() + '\n\n' + DAILY_ASSISTANT_SAFETY_REMINDER_MARKDOWN;
}
