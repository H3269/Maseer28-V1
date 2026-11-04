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
مالک برنامه‌نویس نیست؛ از او تست فنی، بازبینی کد/فایل یا تنظیمات پیچیده نخواه. بااین‌حال مخزن `H3269/Maseer28-V1` روی `main` محیط اصلی مشاهده و تست زنده اوست: هر commit منسجم باید بلافاصله قابل رصد باشد و مالک می‌تواند هر build منتشرشده با Action دستی خودش را در هر مرحله تست کند؛ لازم نیست منتظر تکمیل کل بخش یا سبزشدن همه آزمون‌ها بماند. بعد از هر commit، SHA، تغییرات، وضعیت دقیق CI و آنچه قابل مشاهده/تست است را گزارش بده. تست انسانی کیفیت محصول را با سناریو و معیار روشن پیشنهاد کن، اما زمان آن با مالک است. موفقیت CI یا local runtime به‌تنهایی «آماده مرورگر» نیست. هیچ Production deploy/activate یا اجرای Action انتشار توسط دستیار انجام نشود.


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


## ادامه 2026-11-04 — ممیزی منطقه inference و retention
- مستند رسمی Cloudflare نشان می‌دهد Workers AI inference در شبکه جهانی انجام می‌شود و در ماتریس Data Localization Suite، Regional Services برای Workers AI پشتیبانی نمی‌شود؛ منطقه‌ای‌کردن اجرای Worker به‌تنهایی inference را منطقه‌ای نمی‌کند.
- OpenAI API گزینه EU data residency/regional processing برای endpointها و مدل‌های واجد شرایط دارد؛ اما پروژه EU جدید، تأیید کنترل‌های abuse monitoring، Modified Retention amendment و بررسی eligibility/هزینه لازم است. retention پیش‌فرض abuse logs می‌تواند تا ۳۰ روز باشد؛ ZDR/MAM خودکار یا تضمین‌شده نیست.
- سند مقایسه: `docs/ASSISTANT_PROVIDER_PRIVACY_DECISION_FA.md` (commit `3c4e840f49148a19b2fddba16a26f4baa748e9ca`).
- تا تصمیم مالک درباره پردازش جهانی در برابر منطقه مشخص، provider، eligibility و سقف هزینه، consent UI و inference فعال نمی‌شوند. Worker اصلی همچنان 503 و fail-closed است؛ هیچ داده کاربر به مدل ارسال نشده است.
- کار مستقل بعدی: آزمون‌های عمیق‌تر intent/context و طراحی UI مستقل بدون ارسال داده و بدون تغییر App/journey. هیچ deploy یا تغییر Production انجام نشده است.

## ادامه 2026-11-04 — سخت‌گیری روی نفی و اصلاح گفته در router فارسی

- مبنای شروع: `cbbc88be8467789c806b30aa1902bb25c548fa46`.
- نقص اصلی: عبارت‌هایی مانند «من از آینده نمی‌ترسم» ممکن بود به‌دلیل تطبیق زیررشته «می‌ترسم» به‌عنوان ترس مثبت شناسایی شوند.
- اصلاح نهایی در `src/features/assistant/intentContextRouter.js`: تشخیص نفی پیشوندی «نمی»، نفی پس از عبارت موضوعی با فهرست محدود فعل‌ها، و ملاک‌گرفتن آخرین وقوع عبارت برای حل اصلاح/بازگشت کاربر.
- محدودیت مهمی که در تست آشکار شد: نفی عمومی و بیش‌ازحد گسترده باعث می‌شد «من می‌ترسم و نمی‌دانم چه کار کنم» اشتباهاً فاقد موضوع ترس شود. الگو محدود شد تا «نمی‌دانم» مستقل، نفی موضوع قبلی محسوب نشود.
- آزمون مستقل `tests/intentContextRouter.negation.test.js` با ۷ سناریو افزوده شد: نفی فعل، نفی با عبارت واسط، نفی رفتار، حفظ عبارت مثبت، تغییر قطبیت در جمله چندبخشی، نقل‌قول منتسب به شخص ثالث و تمایز «می‌ترسم» از «نمی‌دانم».
- HEAD کد/تست: `d118caedcf5761ab813d987d433783ce1c2c82f8`.
- CI نهایی: run `41834475297`، نتیجه `success`؛ ۳۸۹/۳۸۹ تست واحد، audit، Wrangler dry-runs، سه runtime integration، اعتبارسنجی registry/محتوا، build و Chromium scenarios موفق.
- CIهای میانی که روی نسخه‌های ناقص شکست خوردند، به‌عنوان موفقیت شمرده نشدند؛ رگرسیون‌ها رفع و اجرای نهایی کامل تأیید شد.
- فقط فایل router و تست مستقل آن تغییر کردند. هیچ تغییر در App، journey، ۳۴ موضوع، ۹۵۲ تمرین، انتشار یا Production انجام نشد.
- وضعیت این بخش: `automated_tests_passed`; این نتیجه تأیید کیفیت معنایی/بالینی یا آمادگی تست انسانی نیست.
- گام بعد: آزمون‌های انتساب نقل‌قول، اصلاح جمله، نفی چندبخشی و تغییر موضوع؛ حفظ قفل privacy/provider و fail-closed بودن Worker.

## ادامه 2026-11-04 — انتساب گفتار ثالث و اصلاح گفته در router

- نقص‌ها: پوشش ناقص گویندگان ثالث/قالب‌های «گفت که» و «گفت:»، حذف احتمالی نقل‌قول خود کاربر، و انتخاب اولین نشانگر «منظورم» به‌جای آخرین اصلاح.
- `intentContextRouter.js` اکنون گویندگان ثالث بیشتری را می‌شناسد، نقل‌قول منتسب و گزارش غیرنقل‌قولی را از گفته کاربر جدا می‌کند و نقل‌قول خود کاربر را حذف نمی‌کند.
- آخرین نشانگر اصلاح انتخاب می‌شود؛ بند پس از «منظورم این نبود که» یا «نه اینکه» که صریحاً رد شده از شواهد جاری کنار می‌رود. انکار ساده «منظورم این نبود؛ ...» متن مثبت بعدی را حفظ می‌کند.
- آزمون مستقل `tests/intentContextRouter.attribution-corrections.test.js` با ۷ سناریو اضافه شد.
- در اجرای اولیه، یک تست نشان داد regex نشانگر اصلاح «نبود» را نمی‌پذیرفت. مورد اصلاح شد؛ اجرای نهایی فقط پس از سبز شدن کامل پذیرفته شد.
- HEAD: `32239ebb52e4572be0de157ff0a1283cf9a0dccd`; CI run `41836118892`: `success`; ۳۹۶/۳۹۶ تست واحد و تمام مراحل audit، dry-run، runtime integration، validation، build و Chromium موفق.
- نسبت به checkpoint قبلی فقط router و فایل آزمون جدید تغییر کردند. بخش اصلی اپ، journey، ۳۴ موضوع و ۹۵۲ تمرین تغییر نکردند.
- provider، consent UI و inference فعال نشده‌اند؛ endpoint مکالمه Worker همچنان 503 و fail-closed است. هیچ deploy یا Production activation انجام نشد.
- وضعیت: `automated_tests_passed`; نه تأیید کیفیت معنایی/بالینی است و نه مجوز تست انسانی.
- گام بعد: ممیزی نفی چندبخشی و تغییر موضوع/اصلاح متعارض در مکالمه، بدون دست‌زدن به اپ اصلی.


## ادامه 2026-11-04 — اصلاح مرزهای زمینه و نقل‌قول فارسی

- برای نقل‌قول شخص ثالث، «استادم» و چند صورت استاد راهنما/دانشگاه افزوده شد؛ فعل «گفت» طوری محدود شد که «گفتم» کاربر را اشتباهاً گفتار شخص ثالث تلقی نکند.
- آزمون‌ها ثابت می‌کنند نقل‌قول استاد/درمانگر به کاربر نسبت داده نمی‌شود، اما نقل‌قولی که کاربر خودش به درمانگر گفته و هنوز آن را تجربه می‌کند، شواهد کاربر باقی می‌ماند.
- «منظورم این نیست که...» به نشانگر اصلاح افزوده شد؛ بند ردشده از شواهد فعلی حذف می‌شود و موضوع جایگزین باقی می‌ماند.
- «در واقع» به‌تنهایی اصلاح موضوع نیست. در روشن‌سازی و اصلاح خلاصه، جمله‌ای با این آغاز می‌تواند موضوع دوم را اضافه کند؛ شواهد دوباره ارزیابی می‌شوند تا موضوع تازه گم نشود.
- فایل‌های کد: `intentContextRouter.js` و `assessmentEngine.js`. فایل‌های آزمون: `intentContextRouter.negation.test.js` و `assessmentEngine.test.js`.
- مجموعه آزمون به ۴۰۳ سناریو رسید. اجرای کامل CI روی پیاده‌سازی SHA `13ecf1a2176822a004ae58aa9c7a3e1f88337a64` با run `41842614206` موفق شد: ۴۰۳/۴۰۳ تست، audit بدون آسیب‌پذیری، dry-runهای Wrangler، runtime integration، اعتبارسنجی محتوا، build و Chromium موفق.
- سپس فقط متن یک fixture آزمون برای جلوگیری از تداخل موضوعی در SHA `97db8081b213b2ddcc590e592e31d5718879f5e7` تغییر کرد؛ مرحله unit tests این SHA نیز موفق بود، اما workflow کامل آن هنگام این یادداشت هنوز در حال اجرا بود. این وضعیت باید پیش از اعلام نهایی دوباره بررسی شود.
- هیچ تغییر در App، journey، ۳۴ موضوع یا ۹۵۲ تمرین رخ نداد. هیچ deploy، upload واقعی، promote یا تغییر ترافیک Production انجام نشد.
- Worker مکالمه هنوز 503 و fail-closed است؛ provider، رضایت ابری و UI واقعی دستیار فعال نیستند. تست انسانی مرورگر هنوز قابل درخواست نیست.
- گام بعدی: بررسی نتیجه کامل CI روی HEAD و سپس ممیزی دقیق رفتار پس از یک دور روشن‌سازی، بدون انتخاب خودکار موضوع.


- تکمیل نهایی CI پس از fixture و مستندسازی: run `41843435731` روی SHA `9b3ebb64c4467da4c2f80b1d6bb6db10765bf551`، نتیجه `success`.
- شواهد run نهایی: **۴۰۳/۴۰۳ تست واحد، صفر شکست**؛ npm audit صفر آسیب‌پذیری؛ Wrangler bundle و version-upload dry-run؛ سه runtime integration محلی؛ topic registry و content validation؛ daily content quality audit؛ build؛ Chromium privacy migration scenarios — همگی موفق.
- در مقایسه با SHA اجرای کامل قبلی، تغییرات پس از آن فقط یک fixture آزمون و دو سند وضعیت/پیوستگی بودند؛ هیچ کد اجرایی دیگری تغییر نکرد. بنابراین نتیجه کامل CI روی HEAD مستندشده تأیید شد.
- آخرین commit مستندشده در این نقطه: `0fa298766fa66e4e871b0f2a2315f342e01e7b24` (به‌روزرسانی وضعیت CI؛ اجرای CI همین commit پس از ثبت این یادداشت باید بررسی شود).
- وضعیت این بخش: `automated_tests_passed`. این تأیید به معنی تست انسانی دستیار یا تأیید متخصص نیست.

## دستور صریح مالک — main محیط تست زنده و ممنوعیت شاخه‌سازی (2026-11-04)

این دستور بر رویه‌های قدیمی گزارش‌دهی/تحویل که مشاهده را تا پایان یک بخش یا سبزشدن کامل CI عقب می‌انداختند مقدم است:

1. فقط مخزن `H3269/Maseer28-V1` و فقط شاخه `main`؛ هیچ branch فرعی، مخزن موازی یا محیط جایگزین برای دورزدن تست ساخته نشود.
2. تغییرات کوچک و منسجم به‌محض آماده‌شدن روی `main` commit شوند. لازم نیست یک بخش کامل شده یا CI سبز شده باشد تا مالک بتواند آن commit را ببیند. وضعیت ناتمام/آزمون‌نشده باید صریح برچسب بخورد.
3. پس از هر commit، گزارش قابل اقدام شامل SHA، فایل‌ها، هدف تغییر، وضعیت CI و محدوده‌ای که مالک می‌تواند با Action دستی خودش بررسی کند ارائه شود. گزارش فقط به پایان یک milestone موکول نشود.
4. مالک می‌تواند به انتخاب خودش هر commit/build قابل دسترس را تست کند. دستیار نباید او را وادار به تست کد، خط فرمان، یا تنظیمات فنی کند؛ فقط لینک و دستورالعمل ساده در صورت نیاز.
5. هیچ‌یک از این موارد مجوز اجرای Action انتشار، deploy، promote، تغییر Production، تغییر ترافیک، یا دستکاری اپ موجود نیست. این اقدامات فقط در اختیار مالک است.
6. گیت‌های محتوایی/ایمنی، رضایت و حریم خصوصی، حفاظت از داده و جلوگیری از انتشار ناخواسته همچنان برقرارند؛ این‌ها با مانع گزارش‌دهی یا تست مخزن یکی نیستند. اگر یکی از این گیت‌ها مانع تست بی‌خطر شود، دقیقاً بگو چه چیزی، چرا، و با لغوش چه آسیبی ممکن است رخ دهد؛ بدون اجازه آن را حذف نکن.

## اصلاح مشاهده‌پذیری CI برای commitهای مستقیم main

- نقص قبلی: ابزار GitHub متصل فقط workflowهای Pull Request را از مسیر `fetch_commit_workflow_runs` برمی‌گرداند و اجرای مستقیم push روی `main` را نشان نمی‌داد؛ در نتیجه وضعیت تست‌ها برای دستیار نامشهود می‌ماند.
- اصلاح: در `.github/workflows/validate-content.yml` job جداگانه `report-commit-status` اضافه شد. پس از اتمام validation روی push، نتیجه با context ثابت `path28/validate-content` روی همان SHA از طریق `GITHUB_TOKEN` و مجوز محدود `statuses: write` ثبت می‌شود.
- این job فقط وضعیت CI را ثبت می‌کند؛ هیچ فایل اپ، Worker، تنظیم Cloudflare یا Action انتشار را اجرا/تغییر نمی‌دهد.
- Commit پیاده‌سازی: `028beeeea26c6cfce14413d077b41889de1d24c4`.
- اجرای اثباتی: run `41850639989`. ابزار status اکنون context را برمی‌گرداند و از target URL می‌توان run ID را استخراج و jobها را خواند؛ job گزارش وضعیت موفق بود.
- نتیجه validation همان run: **ناموفق**؛ ۴۰۶ از ۴۱۰ تست واحد موفق و ۴ تست ناموفق. سایر مراحل شامل npm audit، سه runtime integration محلی، Wrangler dry-run، topic/content validation و build موفق شدند. شکست‌ها از قبل در کد/تست assessmentEngine بودند، نه از job گزارش وضعیت.
- چهار شکست اولیه مربوط به فرض قدیمی «یک دور روشن‌سازی کافی است» و انتخاب صریح T27 در حضور واژه عمومی «ترس» بود. اصلاح آزمون‌های سازگار با دو دور روشن‌سازی در commit `577a7218b2f7a223d41040a06ef3e98937db36b9` و اصلاح انتخاب اولویت اختصاصی در commit `f347841512ff1a94ad89ec9848de20fae5b0dc25` ثبت شدند.
- CI مربوط به commit `f347841512ff1a94ad89ec9848de20fae5b0dc25` هنوز باید از status context بررسی شود؛ تا قبل از نتیجه نهایی هیچ‌یک از این اصلاحات تأیید اجرایی محسوب نمی‌شوند.
- روش بازیابی: ابتدا `get_commit_combined_status` برای SHA؛ اگر status حاوی target URL با `/actions/runs/<id>` بود، run ID را بردار و با `fetch_workflow_run_jobs` و در صورت شکست با `fetch_workflow_job_logs` جزئیات را بخوان.

## دسترسی Cloudflare — وضعیت واقعی ابزارها

- در ابزارهای متصل این نشست، Cloudflare Dashboard/API connector یا plugin قابل استفاده وجود ندارد؛ جست‌وجوی plugin با نام Cloudflare نیز نتیجه‌ای نداد.
- بنابراین دسترسی مستقیم به حساب، مشاهده وضعیت واقعی deployment/Pages/Workers، ایجاد Preview یا تغییر تنظیمات Dashboard در حال حاضر ممکن نیست.
- هیچ رمز عبور، API token یا secret نباید در چت ارسال شود. افزودن token به‌تنهایی هم این محدودیت را رفع نمی‌کند، چون ابزار فعلی محل امنی برای دریافت/استفاده از آن ندارد.
- در صورت فراهم‌شدن connector رسمی Cloudflare یا MCP مورد تأیید محیط ChatGPT، ابتدا دسترسی read-only برای مشاهده Workers/Pages/deployments/settings کافی است؛ مجوز write فقط برای Preview مشخص و با اجازه مالک، حداقل‌سطح و بدون Production لازم خواهد بود.
- تا آن زمان، دسترسی من به GitHub و اجرای Wrangler dry-run در CI محدود است؛ این dry-run اتصال به حساب Cloudflare یا وضعیت edge واقعی را اثبات نمی‌کند.
## وضعیت به‌روزشده — 2026-11-04 — اصلاح آزمون‌ها و تفکیک گیت انتشار

- آخرین تغییرات کد/تست روی `main`:
  - `577a7218b2f7a223d41040a06ef3e98937db36b9` — هم‌راستاسازی تست‌های قدیمی با دو دور روشن‌سازی.
  - `f347841512ff1a94ad89ec9848de20fae5b0dc25` — انتخاب موضوع خاص بر موضوع واژگانی عمومی مقدم می‌شود.
  - `f5ae0a95faf5cc23986267ad94f443cf323d1728` — آزمون انتخاب اولویت پس از تأیید خلاصه.
  - `6093b4f6f47dfd699853f0353a73095d3ee48c93` — پوشش عبارت طبیعی «نگرانی از آینده» برای T02.
  - `7a7ba121f7777b3509ab5c488c7f896c07e9fe0b` — آزمون مستقل عبارت جدید T02.
- CIهای میانی `41850639989` و `41851026285` شکست‌های واقعی را نشان دادند؛ اصلاح شد. اجرای `41851286502` نیز یک تست قدیمی دیگر را آشکار کرد؛ آن تست با الزام اولویت‌گذاری صریح هم‌راستا شد.
- Workflow اکنون در آغاز push مستقیم به `main` وضعیت `pending` را ثبت می‌کند و پس از پایان، `success/failure` را ثبت خواهد کرد. در run `41851722640` وضعیت pending روی SHA همان commit قابل خواندن شد؛ job اعلان موفق بود.
- در run `41851722640` تا زمان این یادداشت: `npm test` موفق، build موفق، registry/content validation، npm audit، Wrangler dry-run و سه runtime integration موفق؛ آزمون‌های Chromium در حال اجراست. نتیجه کل workflow هنوز نهایی نیست. پس از پایان باید status همان SHA دوباره بررسی شود.
- آخرین commit هنگام این یادداشت: `79255089802917058972feaa982dc2ed592f8826` — افزودن وضعیت pending پیش از شروع آزمون‌ها. این commit نیز روی `main` است.

### گیت‌های انتشار که عمداً حذف نشدند
- `.github/workflows/deploy.yml` یک workflow عمومی GitHub Pages است، نه محیط Preview خصوصی. سه شرط دارد: ورودی دستی `confirm_public_release=yes`، موفقیت validation برای همان SHA، و اجرای `npm run assert:production-content` برای تمام ۳۴×۲۸ روز.
- آخرین audit کیفیت محتوا در CI: ۵۶ روز دارای فراداده اما `pending_expert_review` و ۸۹۶ روز فاقد فراداده بازبینی. گیت تولید محتوای هر ۹۵۲ روز را از نظر `review_status=approved`، reviewer role، evidence/source، subtopic mapping، stop/contraindications و سایر metadata بررسی می‌کند.
- حذف گیت محتوایی می‌تواند ۹۵۲ روز را بدون تأیید تخصصی کامل در سایت عمومی منتشر کند؛ حذف گیت CI می‌تواند build با آزمون شکست‌خورده را منتشر کند؛ حذف ورودی دستی نیز احتمال انتشار ناخواسته را بالا می‌برد.
- این گیت‌ها مشاهده Commitها در `main` را مسدود نمی‌کنند؛ فقط انتشار عمومی را کنترل می‌کنند. هیچ‌کدام حذف نشده‌اند. حتی با حذفشان، در وضعیت فعلی UI/route دستیار به اپ متصل نیست؛ انتشار فعلی به‌تنهایی دستیار را قابل تست نمی‌کند.
- هر تصمیم برای حذف این گیت‌ها نیازمند تأیید صریح مالک پس از توضیح ریسک است. پیشنهاد فنی: نگه‌داشتن گیت عمومی و ایجاد Preview مجزا برای دستیار؛ اما دسترسی مستقیم Cloudflare فعلاً در ChatGPT متصل نیست.

### Cloudflare
- جست‌وجوی plugin با نام Cloudflare نتیجه‌ای نداد و در ابزارهای این نشست Cloudflare connector/API یا کنترل مرورگر واردشده وجود ندارد. هیچ رمز یا API token در چت درخواست/دریافت نشود. دسترسی واقعی نیازمند اتصال پشتیبانی‌شده Cloudflare/MCP در محیط ChatGPT است؛ تا آن زمان فقط فایل‌های Wrangler و dry-runهای CI قابل بررسی‌اند.