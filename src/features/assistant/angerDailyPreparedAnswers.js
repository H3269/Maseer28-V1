import { ANGER_DAILY_PREPARED_ANSWERS_01_07 } from './angerDailyPreparedAnswers01_07.js';
import { ANGER_DAILY_PREPARED_ANSWERS_08_14 } from './angerDailyPreparedAnswers08_14.js';
import { ANGER_DAILY_PREPARED_ANSWERS_15_21 } from './angerDailyPreparedAnswers15_21.js';
import { ANGER_DAILY_PREPARED_ANSWERS_22_28 } from './angerDailyPreparedAnswers22_28.js';

const merged = {
  ...ANGER_DAILY_PREPARED_ANSWERS_01_07,
  ...ANGER_DAILY_PREPARED_ANSWERS_08_14,
  ...ANGER_DAILY_PREPARED_ANSWERS_15_21,
  ...ANGER_DAILY_PREPARED_ANSWERS_22_28,
};

// The source records intentionally do not prescribe a duration. Remove legacy wording
// that could imply editorial approval or a clinically validated time estimate.
for (const day of Object.keys(merged)) {
  merged[day] = Object.freeze({
    ...merged[day],
    q14: String(merged[day].q14 || '')
      .replace(/زمان استاندارد و تأییدشده‌ای/g, 'زمان استانداردی')
      .replace(/مدت استاندارد و تأییدشده‌ای/g, 'مدت استانداردی'),
  });
}

export const ANGER_DAILY_PREPARED_ANSWERS = Object.freeze(merged);
