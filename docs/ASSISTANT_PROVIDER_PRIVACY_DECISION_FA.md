# یادداشت تصمیم حریم خصوصی ارائه‌دهنده دستیار — 2026-11-04

## وضعیت تصمیم

**تصمیم ارائه‌دهنده هنوز گرفته نشده است.** هیچ درخواست کاربر به هیچ مدل ابری ارسال نمی‌شود. Worker اصلی عمداً endpoint مکالمه را با `503 assistant_not_configured` می‌بندد.

این یادداشت بررسی فنی است، نه نظر حقوقی یا تضمین انطباق با GDPR یا قوانین دیگر.

## گزینه ۱: Cloudflare Workers AI

### نکات مثبت مستند
- Cloudflare برای درخواست‌های استاندارد Workers AI که از قابلیت stateful استفاده نمی‌کنند، تعهد zero data retention اعلام کرده است: ورودی/خروجی پس از پایان پردازش و تحویل پاسخ نگهداری نمی‌شوند، با استثناهای مشخص.
- Cloudflare می‌گوید Customer Content پردازش‌شده توسط Workers AI برای آموزش مدل‌ها استفاده نمی‌شود.
- داده می‌تواند در صورت استفاده از storageهای Cloudflare، لاگ/کش برنامه، AI Gateway logging یا قابلیت‌های stateful ذخیره شود؛ بنابراین معماری برنامه باید از ثبت transcript جلوگیری کند.
- مدل `@cf/meta/llama-3.3-70b-instruct-fp8-fast` در مستندات فعلی در فهرست JSON Mode قرار دارد؛ اما Cloudflare تضمین نمی‌کند مدل در همه ورودی‌ها schema را رعایت کند و خطای عدم انطباق باید مدیریت شود.

### مانع تعیین‌کننده منطقه پردازش
- Workers AI در شبکه جهانی Cloudflare اجرا می‌شود و به نزدیک‌ترین محل شبکه برای inference متکی است.
- جدول سازگاری Data Localization Suite، برای Workers AI پشتیبانی Regional Services را نشان نمی‌دهد. Regional Services برای محدودکردن محل اجرای Worker روی custom domain، به‌تنهایی محل inference در Workers AI را محدود نمی‌کند.
- بنابراین نباید به کاربر وعده داد inference فقط در اتحادیه اروپا یا کشور خاص انجام می‌شود. در صورت انتخاب این گزینه، disclosure باید صریحاً بگوید پردازش inference در شبکه جهانی Cloudflare انجام می‌شود و منطقه واحد/ثابت تضمین نشده است.
- باید مدل دقیق، لایسنس/شرایط مدل ثالث و قرارداد/شرایط حساب Cloudflare نیز بازبینی شود.

### نتیجه
از نظر سادگی اتصال و کاهش پیچیدگی نگهداری متن، گزینه‌ای جذاب است؛ اما اگر شرط محصول، پردازش محدود به اتحادیه اروپا یا منطقه مشخص باشد، این گزینه با شواهد فعلی مناسب نیست.

## گزینه ۲: OpenAI API با پروژه منطقه‌ای اروپا

### نکات مثبت و شروط مستند
- OpenAI API از data residency اروپا برای endpointها و مدل‌های واجد شرایط پشتیبانی می‌کند. پروژه منطقه‌ای اروپا باید به‌عنوان پروژه جدید ساخته شود؛ پروژه موجود را نمی‌توان بعداً به پروژه منطقه‌ای تبدیل کرد.
- برای استفاده از data residency در منطقه‌ای غیر از آمریکا، مستندات فعلی تأیید کنترل‌های abuse monitoring و امضای Modified Retention amendment را لازم می‌دانند.
- Zero Data Retention یا Modified Abuse Monitoring به تأیید قبلی و پذیرش شروط اضافی نیاز دارد؛ نباید فرض کنیم حساب فعلی واجد شرایط است.
- در حالت پیش‌فرض، abuse monitoring logs ممکن است حاوی prompt/response باشند و تا ۳۰ روز نگهداری شوند؛ مگر کنترل retention مناسب برای سازمان/پروژه تأیید و فعال شده باشد.
- endpoint، مدل، ابزارها، prompt caching و هر قابلیت stateful باید جداگانه با جدول eligibility بررسی شوند. EU storage به‌تنهایی به معنی regional processing همه endpointها یا metadata نیست.
- داده API به‌صورت پیش‌فرض برای آموزش مدل استفاده نمی‌شود، مگر opt-in صریح؛ با این حال این موضوع جایگزین کنترل retention یا residency نیست.

### نتیجه
این گزینه مسیر مستندتری برای EU data residency و regional processing دارد، اما فعال‌سازی آن منوط به حساب/پروژه واجد شرایط، مدل و endpoint واجد شرایط، قراردادهای لازم و پذیرش هزینه است. تا وقتی eligibility و هزینه تأیید نشده، نباید کد را به آن متصل یا رضایت کاربر را درخواست کرد.

## منابع رسمی بررسی‌شده

1. Cloudflare Workers AI — Data usage: https://developers.cloudflare.com/workers-ai/platform/data-usage/
2. Cloudflare Workers AI — JSON Mode and supported models: https://developers.cloudflare.com/workers-ai/features/json-mode/
3. Cloudflare Data Localization Suite — Product compatibility: https://developers.cloudflare.com/data-localization/compatibility/
4. Cloudflare Data Localization Suite — Workers regional processing: https://developers.cloudflare.com/data-localization/how-to/workers/
5. OpenAI API — Data controls and regional processing: https://developers.openai.com/api/docs/guides/your-data
6. OpenAI — Data residency in Europe: https://openai.com/index/introducing-data-residency-in-europe/

## الزامات مشترک پیش از گرفتن رضایت

- هویت دقیق پردازشگر و در صورت لزوم زیرپردازشگر/ارائه‌دهنده مدل مشخص باشد.
- محل پردازش inference، محل ذخیره داده، و محل نگهداری metadata از هم تفکیک شوند.
- نوع داده‌های ارسالی و داده‌هایی که عمداً ارسال نمی‌شوند دقیقاً اعلام شوند.
- retention واقعی برای محتوا، abuse logs، metadata، لاگ برنامه و پشتیبان‌ها روشن شود.
- راه پس‌گرفتن رضایت و توقف پردازش آینده عملیاتی و آزموده شود.
- لاگ برنامه فقط metadata حداقلی داشته باشد؛ متن گفتگو، پاسخ مدل و payload سلامت ثبت نشود.
- هیچ حافظه بلندمدت، training opt-in، analytics یا storage مکالمه‌ای به‌طور ضمنی فعال نشود.
- privacy/security review و مشاوره حقوقی برای بازار هدف انجام شود.

## تصمیمی که از مالک محصول لازم است

پیش از ساخت consent UI یا اتصال inference، مالک باید این سه مورد را تعیین کند:
1. آیا پردازش inference روی شبکه جهانی Cloudflare قابل قبول است، یا محدودیت پردازش به EU/منطقه مشخص شرط قطعی است؟
2. آیا امکان/تمایل به استفاده از OpenAI API با پروژه جدید EU و پیگیری تأیید retention controls وجود دارد؟
3. سقف هزینه ماهانه/هر مکالمه و مدل مجاز چیست؟

تا قبل از پاسخ و تأیید، پیش‌فرض فنی همچنان **عدم ارسال پیام به سرویس بیرونی** است. این تصمیم مانع ساخت اجزای مستقل و آفلاین دستیار نیست، اما مانع فعال‌سازی چت ابری و گرفتن رضایت ناقص است.
