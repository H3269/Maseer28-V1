# دفتر تداوم جلسات دستیار مسیر۲۸

هدف: ساخت دستیار مکالمه‌ای هوشمند، زمینه‌محور و ایمن داخل اپ مسیر۲۸. مخزن مرجع `H3269/Maseer28-V1` و شاخه مجاز فقط `main` است. بخش موجود اپ، journey، پروفایل، ۳۴ موضوع و ۹۵۲ تمرین خارج از دامنه تغییرند.

## وضعیت زنده مخزن
- آخرین commit کد/تست semantic orchestration: `751b9196da863958738743b690c136683603193e`.
- CI run `41825332984` روی همین SHA: `success`.
- آخرین commit ثبت وضعیت/راهبرد Preview: `18356ca8e93d4dc3c982b34436cdf6fee366b52a`.
- بررسی provider و Preview در `docs/AI_PROVIDER_SELECTION_AND_DATA_BOUNDARY_FA.md`، commit `e8001a6a4795069912e9c5b26095908c152d2130`.
- برای شروع هر نشست بعدی، HEAD و CI را دوباره از GitHub بررسی کن؛ این دفتر جای بررسی زنده را نمی‌گیرد.

## بخش تکمیل‌شده قبلی: bootstrap end-to-end محلی
در runtime محلی Cloudflare Workers، مسیر Telegram initData verification → keyed replay fingerprint → SQLite Durable Object consume-once → signed session token با harness مستقل آزموده شد. ۱۲ درخواست هم‌زمان با یک initData معتبر، دقیقاً یک token موفق و ۱۱ پاسخ replay با 409 داشتند؛ token معتبر بود؛ امضای نامعتبر و initData منقضی با 401 رد شدند. credentialها و داده‌ها مصنوعی بودند. جزئیات در بخش ۱۸ سند `docs/PROJECT_EXECUTION_STATE_FA.md` ثبت شده است.

## آخرین بخش تکمیل‌شده: semantic conversation orchestrator و Workers AI adapter با mock
فایل‌های اصلی:
- `workers/assistant-api/src/semanticConversation.js`
- `workers/assistant-api/src/workersAiProvider.js`
- `tests/semanticConversation.test.js`
- `tests/workersAiProvider.test.js`
- `tests/workers/semanticConversationWorker.js`
- `tests/workers/semantic-conversation.wrangler.toml`
- `tests/workers/semanticConversation.integration.mjs`
- به‌روزرسانی `.github/workflows/validate-content.yml`

ارکستراتور provider-neutral است: تاریخچه کوتاه و محدود را می‌پذیرد، متن را به‌عنوان داده غیرقابل‌اعتماد بسته‌بندی می‌کند، topic ID را فقط از رجیستری T01–T34 می‌پذیرد، برای ابهام سؤال می‌پرسد و هیچ موضوعی را بدون تأیید کاربر انتخاب نمی‌کند. گیت ایمنی مستقل پیش از مدل اجرا می‌شود؛ خروجی مدل فقط می‌تواند هشدار را تشدید کند. اطلاعات عمومی بدون محتوای تأییدشده پاسخ factual نمی‌گیرد.

آداپتور Workers AI فقط مدل‌های دارای JSON Mode مستندشده را می‌پذیرد. در تست‌ها از AI.run ساختگی استفاده شده؛ هیچ inference واقعی یا هزینه AI ایجاد نشده است. consent gate به نتیجه server-side با هر دو هدف cloud AI و sensitive data و policy version نیاز دارد. redaction الگوهای رایج شناسه مستقیم را حذف می‌کند اما ناشناس‌سازی کامل نیست. تاریخچه کلاینت با نقش‌های جعلی به‌صورت بسته داده untrusted ارسال می‌شود.

CI run `41825332984` روی SHA `751b9196da863958738743b690c136683603193e` موفق شد: audit صفر آسیب‌پذیری، Worker/Wrangler dry-runها، سه integration محلی Worker، ۳۶۶ تست واحد بدون شکست، اعتبارسنجی topic/content، ممیزی کیفیت، build و آزمون‌های Chromium شامل ۱۰ سناریوی privacy migration، archive export و safety browser scenarios.

جزئیات و محدودیت‌ها در بخش ۱۹ سند `docs/PROJECT_EXECUTION_STATE_FA.md` و بررسی provider در `docs/AI_PROVIDER_SELECTION_AND_DATA_BOUNDARY_FA.md` ثبت شده‌اند.

## تصمیم Preview مرورگری
چون Worker از Durable Objects استفاده می‌کند، Cloudflare برای آن Version URL نمی‌سازد. مسیر درست، Worker Previews با `wrangler preview --name assistant-preview` است. این Preview namespace/storage مستقل Durable Object می‌گیرد و Production را فعال نمی‌کند. تنظیمات Preview باید در بخش `[previews]` فایل Wrangler تعریف شوند.

هیچ Preview واقعی ساخته نشده است. Build config فعلی هنوز root directory برابر `/workers/assistant-api` و deploy command برابر `wrangler versions upload` دارد. برای میزبانی UI در همان Worker Preview باید build از ریشه مخزن و assets پیکربندی شود. هیچ تنظیم Cloudflare Dashboard تغییر نکرده است. جزئیات در بخش ۲۰ سند وضعیت ثبت شده است.

## محدودیت‌های قطعی فعلی
- endpoint `/v1/assistant/turn` همچنان 503 و fail-closed است.
- `workers/assistant-api/wrangler.toml` فاقد AI binding است؛ آداپتور هنوز به Worker اصلی وصل نیست.
- هیچ model ID واقعی انتخاب نشده و هیچ inference واقعی اجرا نشده است.
- محل دقیق inference، شرایط منطقه‌ای، هزینه/سهمیه حساب و مجوز ارسال داده حساس تعیین نشده‌اند.
- consent verifier، session/auth مناسب برای مرورگر و mini-app، rate limit و کنترل هزینه عملیاتی هنوز وجود ندارند.
- UI موجود هنوز به orchestrator وصل نشده است؛ نسخه قابل تعامل مرورگری آماده نیست.
- Preview URL عمومی خواهد بود؛ کنترل دسترسی و رضایت قبل از داده واقعی لازم است.
- Telegram bootstrap آزموده شده؛ Bale هنوز با مستندات رسمی/آزمون مرجع مستقل راستی‌آزمایی نشده و نباید پشتیبانی امن آن ادعا شود.
- محتوای دانش تأییدشده هنوز برای پاسخ factual آماده نیست.
- هیچ deploy، upload واقعی Version، promote یا تغییر ترافیک Production انجام نشده است.
- فایل‌های journey/profile/content و داده‌های ۳۴ موضوع و ۹۵۲ تمرین تغییر نکرده‌اند.

## گام بعدی
پیاده‌سازی consent verifier سمت سرور، نشست و دسترسی preview، rate limit و سقف هزینه؛ سپس تکمیل build/static assets در Worker Preview و اتصال route/UI. مدل فارسی با مجموعه مصنوعی و معیارهای ثابت ارزیابی شود؛ اجرای inference واقعی به دلیل هزینه و ارسال داده به Cloudflare نیازمند مجوز صریح است.

## قاعده گزارش‌دهی به مالک
مالک برنامه‌نویس نیست و صریحاً خواسته تا وقتی یک بخش خروجی واقعی و قابل مشاهده در مرورگر ندارد، از او تست فنی، بازبینی فایل، کد یا تنظیمات نخواهیم. فقط وقتی نسخه مشخصی واقعاً در مرورگر قابل مشاهده و تعامل شد، با دستورالعمل ساده و یک گام روشن اطلاع بده. موفقیت CI یا local runtime به‌تنهایی «آماده مرورگر» نیست. هیچ Production deploy/activate بدون اجازه صریح مالک انجام نشود.


## ادامه 2026-11-04 — بررسی نشست Preview و آخرین CI
- HEAD زنده: `d8024690a51684e798b8edbd5fdf75c66bacbe06`؛ CI run `41826402818` موفق؛ ۳۷۴/۳۷۴ تست واحد، audit صفر آسیب‌پذیری و سه runtime integration محلی موفق. شکست اجرای قبل `41826362333` در semantic integration به علت عدم استفاده harness از نشست Bearer بود و در اجرای بعدی اصلاح شد.
- `previewSession.js` اکنون نشست stateless کوتاه‌عمر ۱۵ دقیقه‌ای با HMAC و رضایت دوگانه را فقط برای Preview پیاده می‌کند. این ماژول به route اصلی متصل نیست و harness از access code/secret/mock مصنوعی استفاده می‌کند؛ هیچ inference واقعی وجود ندارد.
- اصلاح فنی مهم: Worker Previews جدید Cloudflare برخلاف Version URL کلاسیک از Durable Objects پشتیبانی می‌کنند و برای هر Preview namespace/storage جدا می‌سازند؛ Wrangler 4.157.0 از حداقل 4.135.0 بالاتر است. Preview واقعی هنوز ساخته نشده.
- Worker اصلی همچنان 503 و fail-closed است؛ UI دستیار هنوز ساخته یا متصل نشده؛ هیچ انتشار واقعی یا تغییر ترافیک انجام نشده.
- آدرس قبلاً گزارش‌شده Worker: `https://still-firefly-9435maseer28-archive.has-ab3269.workers.dev`. وضعیت deployment فعلی در این نشست از Cloudflare قابل خواندن نبود؛ آخرین مشاهده تاریخی 6aa849b2/100% Production قدیمی است و نباید به‌عنوان وضعیت امروز بیان شود.
- جزئیات و اصلاح برداشت قدیمی Preview در بخش ۲۱ سند `docs/PROJECT_EXECUTION_STATE_FA.md` ثبت شد. گام بعدی: hardening دسترسی/لغو رضایت/rate limit برای Preview، سپس UI مستقل دستیار و مسیر Preview؛ بدون تغییر بخش موجود اپ و بدون Production activation.

- ممیزی workflow انتشار نشان داد رابط اصلی React/Vite با GitHub Pages منتشر می‌شود و انتشار دستی با `confirm_public_release=yes` و گیت تأیید تخصصی تمام ۹۵۲ روز انجام می‌شود. T16 و T17 هرکدام ۰/۲۸ روز تأییدشده دارند؛ پس گیت فعلی حداقل ۵۶ روز را رد می‌کند. تغییر گیت یا تأیید جعلی خارج از دامنه است.
- Worker URL شناخته‌شده فقط API است، نه آدرس رابط React. URL دقیق Pages در دسترس نشست نیست و وضعیت Pages/Worker از Dashboard قابل تأیید نشد. Worker Preview به‌تنهایی رابط را در همان URL Pages منتشر نمی‌کند.


## ادامه 2026-11-04 — Durable Object برای کنترل نشست Preview
- ماژول `previewSessionGuard.js` اضافه شد: یک DO مجزا برای هر نشست، سقف ۲۰ درخواست در ۵ دقیقه، لغو فوری و پاکسازی رکورد پس از انقضا با Alarm. transcript ذخیره نمی‌شود.
- `previewSession.js` اکنون ثبت سمت سرور و authorization guard را الزامی می‌کند؛ نبود guard یا ثبت ناموفق fail-closed است. Worker entrypoint کلاس DO را export و wrangler config binding/migration را تعریف می‌کند، ولی route اصلی هنوز از آن استفاده نمی‌کند و 503 باقی است.
- harness محلی به SQLite DO وصل شد. روی commit `410d86a` CI run `41828667148` موفق: ۳۷۶/۳۷۶ تست، صفر آسیب‌پذیری، سه runtime integration، build و Chromium privacy scenarios موفق.
- commit بعدی `4fc00c0` صدور token را به پاسخ صریح `created:true` محدود کرد؛ CI run `41828926831` هنگام ثبت در حال اجرا بود.
- محدودیت: rate limit فعلی per-session است و تلاش‌های ناموفق برای access code یا ساخت چند نشست را globally محدود نمی‌کند. احراز هویت واقعی/consent ledger وجود ندارد. AI واقعی وصل نیست. هیچ deployment یا تغییر Production انجام نشده است.
- جزئیات در بخش ۲۲ `docs/PROJECT_EXECUTION_STATE_FA.md` ثبت شد. گام بعدی: تکمیل CI، سپس رابط مستقل دستیار؛ عدم تغییر App/journey تا دریافت مجوز صریح در صورت نیاز به نقطه اتصال.


## ادامه 2026-11-04 — limiter سراسری Preview و تأیید CI
- HEAD کد/تست پیش از مستندسازی: 37a823a1300bce62ff9faa4dffceb0560bacacd4.
- ماژول previewAccessRateLimit.js و SQLite Durable Object مشترک افزوده شد: حداکثر ۵ تلاش ایجاد نشست در ۱۵ دقیقه برای هر مبدأ؛ تلاش ناموفق نیز شمرده می‌شود؛ فقط HMAC-SHA256 digest ذخیره می‌شود و IP خام ذخیره نمی‌شود؛ پاک‌سازی پس از ۲۴ ساعت.
- limiter در harness محلی مسیر /session وصل است، اما route اصلی Worker از آن استفاده نمی‌کند. binding/migration فقط در پیکربندی تعریف شده و deploy نشده است.
- decoder نشست Preview اکنون Base64URL canonical را الزام می‌کند؛ آزمون tampering با تغییر بیت مؤثر امضا اجرا می‌شود.
- CI run 41830911814 روی SHA بالا موفق: ۳۷۹/۳۷۹ تست، صفر vulnerability در npm audit، Wrangler dry-runs، سه runtime integration، validation موضوع/محتوا، ممیزی کیفیت، build و Chromium scenarios موفق.
- چند شکست میانی به‌ترتیب از syntax در harness، فرض نادرست درباره هدر IP در Wrangler localhost و تغییر padding bits به‌جای بیت امضا بود؛ همگی اصلاح شدند و فقط اجرای نهایی بالا مبنای پذیرش است.
- هیچ inference واقعی، deployment Preview، Production activation یا تغییر ترافیک انجام نشده است؛ API اصلی همچنان 503 و fail-closed است؛ UI مرورگری هنوز ساخته نشده است.
- گام بعدی: رابط مستقل assistant-only و مسیر Preview؛ بدون تغییر App/journey و بدون دور زدن گیت انتشار Pages. هر نیاز به تغییر App یا workflow اصلی قبل از اقدام برای اجازه صریح مالک متوقف می‌شود.
