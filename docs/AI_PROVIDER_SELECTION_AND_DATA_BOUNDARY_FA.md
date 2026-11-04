# بررسی ارائه‌دهنده مدل برای دستیار مسیر۲۸ — Cloudflare Workers AI

**تاریخ بررسی:** 2026-11-04  
**وضعیت تصمیم:** گزینه نامزد؛ انتخاب نهایی و فعال‌سازی انجام نشده است.  
**دامنه:** فقط امکان فنی، قالب خروجی، هزینه و مرز داده؛ نه تأیید حقوقی یا مجوز پردازش داده واقعی.

## 1. نتیجه فنی

Workers AI از طریق binding سمت Worker با `env.AI.run(model, input)` قابل فراخوانی است. بنابراین کلید مدل در مرورگر قرار نمی‌گیرد و می‌توان آداپتور را پشت API موجود نگه داشت. مستندات:
- https://developers.cloudflare.com/workers-ai/configuration/bindings/
- https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/

Cloudflare JSON Mode و `response_format.type = json_schema` را برای مدل‌های مشخص پشتیبانی می‌کند. آداپتور پروژه فقط این شناسه‌های مستندشده را می‌پذیرد:
- `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
- `@cf/meta/llama-3.1-8b-instruct`
- `@cf/meta/llama-3-8b-instruct`
- `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b`

مستندات JSON Mode: https://developers.cloudflare.com/workers-ai/features/json-mode/

مدل `@cf/qwen/qwen3-30b-a3b-fp8` در کاتالوگ به‌عنوان چندزبانه معرفی شده، اما در فهرست JSON Mode فعلی قرار ندارد؛ بنابراین آداپتور JSON Schema فعلی آن را رد می‌کند. اگر ارزیابی فارسی نشان دهد Qwen گزینه بهتری است، باید آداپتور جداگانه با parse/validation سخت‌گیرانه طراحی شود، نه اینکه محدودیت فعلی دور زده شود.

## 2. حریم خصوصی و نگهداری

طبق سند رسمی Cloudflare:
- برای inference استاندارد و بدون قابلیت stateful، Cloudflare تعهد zero data retention دارد؛ ورودی و خروجی پس از پردازش و تحویل پاسخ نگهداری نمی‌شوند.
- Cloudflare اعلام می‌کند Customer Content در Workers AI برای آموزش مدل‌ها استفاده نمی‌شود.
- metadata عملیاتی مانند شناسه مدل/حساب، زمان، اندازه درخواست/پاسخ، تعداد token/neuron، latency و کد وضعیت ممکن است نگهداری شود.
- اگر برنامه از ذخیره‌سازی‌هایی مانند R2/KV/Durable Objects/Vectorize استفاده کند، یا AI Gateway logging/caching را فعال کند، محتوای ارسالی ممکن است طبق همان قابلیت ذخیره شود.
- مدل‌های شخص ثالث ممکن است مجوزها و شرایط مستقل داشته باشند و باید جداگانه بررسی شوند.

منبع: https://developers.cloudflare.com/workers-ai/platform/data-usage/

**نتیجه اجرایی:** در صورت انتخاب این سرویس، هیچ log یا cache محتوایی در AI Gateway فعال نمی‌شود؛ مکالمه در Backend ذخیره نمی‌شود؛ فقط تاریخچه محدود و موقت همان جلسه در درخواست inference قرار می‌گیرد. این محدودیت‌ها هنوز در Worker اصلی پیاده‌سازی نشده‌اند.

## 3. هزینه و محدودیت آزمون

- درخواست‌های Workers AI در توسعه محلی Wrangler نیز به حساب Cloudflare وصل می‌شوند و مصرف آن‌ها هزینه/سهمیه دارد.
- محدودیت عمومی Text Generation در مستندات فعلی ۳۰۰ درخواست در دقیقه است، مگر مدل‌هایی که محدودیت جداگانه دارند.
- قیمت‌ها برحسب مدل و token متفاوت‌اند و ممکن است تغییر کنند.

منابع:
- https://developers.cloudflare.com/workers-ai/platform/limits/
- https://developers.cloudflare.com/workers-ai/platform/pricing/

**قاعده پروژه:** هیچ inference واقعی حتی با داده مصنوعی اجرا نمی‌شود تا هزینه/سهمیه حساب مشخص و مجوز اجرای آزمون مدل دریافت شود. آزمون‌های فعلی فقط از mock استفاده می‌کنند و هیچ مصرف Workers AI ایجاد نکرده‌اند.

## 4. محل پردازش و اقامت داده

مستندات Workers Placement و Regional Services، محل اجرای Worker را توضیح می‌دهند؛ اما از آن‌ها به‌تنهایی نمی‌توان نتیجه گرفت که inference مدل Workers AI نیز در همان منطقه پردازش می‌شود. Regional Services روی اجرای Worker و termination دامنه مشخص اثر دارد و محدودیت‌هایی برای subrequestهای خروجی دارد.

منابع:
- https://developers.cloudflare.com/workers/configuration/placement/
- https://developers.cloudflare.com/data-localization/how-to/workers/

**وضعیت:** محل دقیق پردازش inference و امکان تضمین منطقه‌ای آن برای این حساب/مدل هنوز اثبات نشده است. تا روشن‌شدن بازار هدف، الزامات حقوقی، محل inference و قرارداد پردازش، داده واقعی یا حساس نباید ارسال شود.

## 5. انتخاب مدل و ارزیابی فارسی

هیچ مدل به‌عنوان مدل نهایی انتخاب نشده است. شناسه Llama 3.3 70B که در تست‌های mock استفاده شده، فقط fixture فنی برای آزمون قرارداد JSON است؛ این موضوع به معنی انتخاب یا ارزیابی کیفیت فارسی آن نیست.

پیش از انتخاب باید با مجموعه مصنوعی فارسی و معیارهای ثابت، حداقل این موارد مقایسه شوند:
1. فهم نفی، نقل‌قول، اصلاح پیام و تغییر موضوع؛
2. حفظ زمینه در چند نوبت و تفکیک چند مسئله هم‌زمان؛
3. دقت نگاشت به شناسه‌های واقعی T01–T34؛
4. تشخیص ابهام و پرسیدن سؤال به‌جای حدس؛
5. نرخ false negative در نشانه‌های ایمنی و عدم پایین‌آوردن هشدار مستقل؛
6. انطباق schema، latency، هزینه و پایداری.

اعتماد مدل به خودش معیار صحت نیست. تا زمان ارزیابی انسانی و آزمون red-team فارسی، خروجی مدل فقط فرضیه مسیریابی است و کاربر باید موضوع را تأیید کند.

## 6. وضعیت پیاده‌سازی در مخزن

- آداپتور `workers/assistant-api/src/workersAiProvider.js` اضافه شده و فقط مدل‌های دارای JSON Mode مستندشده را می‌پذیرد.
- آداپتور به Worker اصلی وصل نشده است.
- `[ai]` binding به `workers/assistant-api/wrangler.toml` اضافه نشده است.
- هیچ model ID یا AI credential واقعی در تنظیمات یا secrets ثبت نشده است.
- هیچ درخواست inference واقعی ارسال نشده است.
- AI Gateway logging/caching، storage مکالمه و حافظه بلندمدت فعال نیستند.
- انتخاب نهایی provider/model، محل پردازش و مجوز هزینه همچنان باز است.

**تصمیم:** Workers AI فعلاً یک آداپتور آماده‌سازی‌شده و گزینه نامزد است؛ نه provider فعال یا تأییدشده برای داده حساس کاربران.


## 7. مسیر Preview مرورگری بدون فعال‌سازی Production

Worker این پروژه از Durable Objects استفاده می‌کند. طبق محدودیت مستند Cloudflare، برای Workerهایی که Durable Object پیاده‌سازی می‌کنند Version URL تولید نمی‌شود؛ بنابراین `wrangler versions upload` به‌تنهایی URL قابل آزمایش مرورگری نمی‌دهد.

راه درست برای این پروژه، Worker Previews است:
- `npx wrangler preview --name assistant-preview` یک Preview مستقل ایجاد/به‌روزرسانی می‌کند.
- هر Preview برای Durable Objects namespace و storage مستقل می‌گیرد؛ داده و state آن با Production یا Previewهای دیگر مشترک نیست.
- تنظیمات Preview از Production به ارث نمی‌رسند؛ باید در بخش `[previews]` تعریف شوند.
- Wrangler مورد استفاده پروژه `4.157.0` است و از حداقل نسخه لازم برای Previews (`4.135.0`) جدیدتر است.
- URL Preview روی `workers.dev` عمومی است؛ برای داده واقعی باید کنترل دسترسی جداگانه (ترجیحاً Cloudflare Access روی hostname مناسب) و consent پیاده‌سازی شود.
- چون مالک فقط شاخه `main` را مجاز دانسته، نباید برای Preview شاخه جدید ساخت. مسیر قابل بررسی، اجرای دستی `wrangler preview --name assistant-preview` از همان main پس از آماده‌شدن UI/API است؛ این فرمان Production را deploy یا promote نمی‌کند.

منابع:
- https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/
- https://developers.cloudflare.com/workers/previews/get-started/
- https://developers.cloudflare.com/workers/previews/resources/
- https://developers.cloudflare.com/workers/previews/configuration/

**وضعیت فعلی:** هیچ Preview واقعی ایجاد نشده است. Build configuration فعلی کاربر هنوز روی root directory `/workers/assistant-api` و deploy command `wrangler versions upload` است؛ تغییر آن تا آماده‌شدن Preview مرورگری انجام نمی‌شود.
