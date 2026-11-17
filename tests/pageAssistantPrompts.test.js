import test from 'node:test';
import assert from 'node:assert/strict';
import {
  answerPageSpecificQuestion,
  getPageSpecificPromptGroups,
  PAGE_SPECIFIC_GUIDE_SCREENS,
} from '../src/features/assistant/pageAssistantPrompts.js';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';

const expectedScreens = [
  'home', 'howWorks', 'about', 'profile', 'pathSetup', 'assessment',
  'dashboard', 'dailyResult', 'support', 'final', 'done', 'report', 'archive',
];

test('every eligible non-library, non-daily page has its own prepared FAQ set', () => {
  assert.deepEqual([...PAGE_SPECIFIC_GUIDE_SCREENS], expectedScreens);
  const allQuestionLabels = new Set();
  for (const screen of expectedScreens) {
    const groups = getPageSpecificPromptGroups(screen);
    assert.equal(groups.length, 1, screen);
    assert.ok(groups[0].questions.length >= 10, `${screen} should cover its visible page topics with at least ten targeted questions`);
    const labels = groups[0].questions.map((item) => item.label);
    assert.equal(new Set(labels).size, labels.length, screen);
    for (const item of groups[0].questions) {
      assert.equal(item.value, item.label);
      assert.equal(allQuestionLabels.has(item.label), false, `duplicate prepared question: ${item.label}`);
      allQuestionLabels.add(item.label);
      const answer = answerPageSpecificQuestion({ screen, message: item.value });
      assert.ok(answer && answer.length >= 100, `${screen}: ${item.label}`);
      const turn = makePageAssistantTurn({ screen, text: item.value });
      assert.equal(turn.status, 'page_guidance_available', `${screen}: ${item.label}`);
      assert.ok(turn.message.length >= 100, `${screen}: ${item.label}`);
    }
  }
});

test('expanded guides cover concrete controls and page-specific states', () => {
  const requiredCoverage = {
    home: ['اگر هنوز پروفایل یا موضوع مسیر را ثبت نکرده‌ام، می‌توانم مستقیم وارد تمرین شوم؟', 'دکمه‌های آشنایی با برنامه چه تفاوتی دارند؟'],
    howWorks: ['در هر روز چه چیزهایی باید ثبت کنم؟', 'اگر یک روز به‌دلیل ایمنی یا بازبینی انسانی اجرا نشود، در مسیر چه می‌شود؟'],
    about: ['آیا محتوای روزها برای موضوعی که انتخاب کرده‌ام تنظیم می‌شود؟', 'آیا امتیازها و بازخوردهای برنامه ارزیابی تخصصی محسوب می‌شوند؟'],
    pathSetup: ['مدت درگیری را با سال و ماه چگونه ثبت کنم؟', 'آیا می‌توانم بدون نوشتن هدف مسیر ادامه بدهم؟'],
    dashboard: ['چرا ممکن است روز بعد هنوز قفل باشد؟', 'آیا روز ثبت‌شده همیشه به معنی تمرین انجام‌شده است؟'],
    support: ['اگر پیامک باز نشد، چطور با مرکز ارتباط بگیرم؟', 'پیوند تلگرام و کانال مرکز چه کاربردی دارند؟'],
    done: ['در صفحه پایان مسیر کدام بخش‌ها در دسترس من هستند؟', 'اگر گزینه شروع مسیر تازه غیرفعال باشد چه معنایی دارد؟'],
    profile: ['چه اطلاعاتی برای ذخیره پروفایل اجباری است؟', 'محدوده سن و قالب شماره تماس در این فرم چیست؟', 'پرسش مربوط به داروی ساعت‌دار و جلسه ۸ ساعته چه معنایی دارد؟'],
    assessment: ['چرا سؤال پنجم ارزیابی اولیه با چهار سؤال دیگر فرق دارد؟', 'امتیاز شدت از ده چگونه از پاسخ‌ها به دست می‌آید؟'],
    dailyResult: ['چرا ممکن است برای یک روز امتیاز نمایش داده نشود؟', 'پیشنهاد مطالعه کتاب در نتیجه روزانه چگونه نمایش داده می‌شود؟'],
    final: ['در هر بخش جمع‌بندی پایانی چند پاسخ باید بنویسم؟', 'چهار سؤال اول و سؤال پنجم ارزیابی پایانی چگونه نمره‌گذاری می‌شوند؟'],
    report: ['میانگین و شمارش بازخوردهای روزانه چگونه باید خوانده شوند؟', 'بخش پیشنهاد یا جمع‌بندی تخصصی گزارش چه جایگاهی دارد؟'],
    archive: ['حداکثر چند مسیر در آرشیو نگهداری می‌شود؟', 'خروجی آرشیو شامل چه فایل‌هایی است و چه محدودیتی دارد؟', 'اگر پیام بازیابی آرشیو لازم است نمایش داده شود چه کار کنم؟'],
  };
  for (const [screen, questions] of Object.entries(requiredCoverage)) {
    const labels = getPageSpecificPromptGroups(screen)[0].questions.map((item) => item.label);
    for (const question of questions) {
      assert.ok(labels.includes(question), `${screen} is missing coverage: ${question}`);
      const answer = answerPageSpecificQuestion({ screen, message: question });
      assert.ok(answer && answer.length >= 100, `${screen}: ${question}`);
    }
  }
});

test('page guide catalogues fail closed for unsupported screens and unsupported questions', () => {
  assert.equal(getPageSpecificPromptGroups('unknown-screen'), null);
  assert.equal(answerPageSpecificQuestion({ screen: 'report', message: 'آیا این گزارش تشخیص قطعی است؟' }), null);
  const unsupported = makePageAssistantTurn({ screen: 'report', text: 'آیا این گزارش تشخیص قطعی است؟' });
  assert.equal(unsupported.status, 'prepared_question_required');
});

test('daily exercise and library FAQ catalogues are not replaced by page-specific guides', () => {
  assert.equal(getPageSpecificPromptGroups('day'), null);
  assert.equal(getPageSpecificPromptGroups('books'), null);
  assert.equal(getPageSpecificPromptGroups('bookReader'), null);
  assert.equal(answerPageSpecificQuestion({ screen: 'day', message: 'هر سؤال' }), null);
  assert.equal(answerPageSpecificQuestion({ screen: 'books', message: 'هر سؤال' }), null);
});

test('existing library page guidance remains available and unchanged', () => {
  const legacyQuestion = 'اینجا چه کارهایی می‌توانم انجام بدهم؟';
  const result = makePageAssistantTurn({ screen: 'books', text: legacyQuestion });
  assert.equal(result.status, 'page_guidance_available');
  assert.match(result.message, /کتابخانه/);
  assert.match(result.message, /بازکردن کتاب/);
});

test('questions from one page cannot be used as prepared questions on another page', () => {
  const homeQuestion = getPageSpecificPromptGroups('home')[0].questions[0].value;
  const result = makePageAssistantTurn({ screen: 'archive', text: homeQuestion });
  assert.equal(result.status, 'prepared_question_required');
});
