# دفتر تداوم جلسات دستیار مسیر۲۸

هدف: ساخت دستیار مکالمه‌ای هوشمند، زمینه‌محور و ایمن داخل اپ مسیر۲۸. مخزن مرجع `H3269/Maseer28-V1` و شاخه مجاز فقط `main` است. بخش موجود اپ، journey، پروفایل، ۳۴ موضوع و ۹۵۲ تمرین خارج از دامنه تغییرند.

## وضعیت زنده مخزن
- آخرین commit ثبت نتایج کد/تست semantic orchestration: `751b9196da863958738743b690c136683603193e`.
- CI run `41825332984` روی همین SHA: `success`.
- آخرین commit مستندات وضعیت: `8932467fe71d3545ec43739c03e2d190a8323a83`.
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

ارکستراتور provider-neutral است: تاریخچه کوتاه و محدود را می‌پذیرد، متن را به‌عنوان داده غیرقابل‌اعتماد بسته‌بندی می‌کند، موضوع‌ها را فقط از registry واقعی T01–T34 می‌پذیرد، برای ابهام سؤال می‌پرسد و هیچ موضوعی را بدون تأیید کاربر انتخاب نمی‌کند. گیت ایمنی مستقل پیش از مدل اجرا می‌شود؛ خروجی مدل فقط می‌تواند هشدار را تشدید کند. اطلاعات عمومی بدون محتوای تأییدشده پاسخ factual نمی‌گیرد.

آداپتور Workers AI فقط مدل‌های دارای JSON Mode مستندشده را می‌پذیرد. در تست‌ها از AI.run ساختگی استفاده شده؛ هیچ inference واقعی یا هزینه AI ایجاد نشده است. consent gate به نتیجه server-side با دو هدف cloud AI و sensitive data و policy version نیاز دارد. redaction الگوهای رایج شناسه مستقیم را حذف می‌کند اما ناشناس‌سازی کامل نیست.

CI run `41825332984` روی SHA `751b9196da863958738743b690c136683603193e` موفق شد: audit صفر آسیب‌پذیری، Worker/Wrangler dry-runها، سه integration محلی Worker، ۳۶۶ تست واحد بدون شکست، اعتبارسنجی topic/content، ممیزی کیفیت، build و آزمون‌های Chromium شامل ۱۰ سناریوی privacy migration، archive export و safety browser scenarios.

جزئیات، محدودیت‌ها و تصمیم‌های باز در بخش ۱۹ سند `docs/PROJECT_EXECUTION_STATE_FA.md` و بررسی provider در `docs/AI_PROVIDER_SELECTION_AND_DATA_BOUNDARY_FA.md` ثبت شده‌اند.

## محدودیت‌های قطعی فعلی
- endpoint `/v1/assistant/turn` همچنان 503 و fail-closed است.
- `workers/assistant-api/wrangler.toml` فاقد AI binding است؛ آداپتور هنوز به Worker اصلی وصل نیست.
- هیچ model ID واقعی انتخاب نشده و هیچ inference واقعی اجرا نشده است.
- محل دقیق inference، شرایط منطقه‌ای، هزینه/سهمیه حساب و مجوز ارسال داده حساس تعیین نشده‌اند.
- consent verifier، session/auth برای مرورگر و mini-app، rate limit و کنترل هزینه عملیاتی هنوز وجود ندارند.
- UI موجود هنوز به orchestrator وصل نشده است؛ نسخه قابل تعامل مرورگری آماده نیست.
- Telegram bootstrap آزموده شده؛ Bale هنوز با مستندات رسمی/آزمون مرجع مستقل راستی‌آزمایی نشده و نباید پشتیبانی امن آن ادعا شود.
- محتوای دانش تأییدشده هنوز برای پاسخ factual آماده نیست.
- هیچ deploy، upload واقعی Version، promote یا تغییر ترافیک Production انجام نشده است.
- فایل‌های journey/profile/content و داده‌های ۳۴ موضوع و ۹۵۲ تمرین تغییر نکرده‌اند.

## گام بعدی
پیش از هر اتصال مدل واقعی، consent verifier سمت سرور و هویت/نشست مناسب برای مرورگر و mini-app، rate limit، سقف هزینه و کنترل withdrawal طراحی و آزموده شوند. سپس مدل فارسی با مجموعه مصنوعی و معیارهای ثابت ارزیابی شود؛ اجرای inference واقعی به دلیل هزینه و ارسال داده به Cloudflare نیازمند مجوز صریح است. بعد از آن route و UI در Preview محدود و قابل مشاهده در مرورگر به هم متصل شوند.

## قاعده گزارش‌دهی به مالک
مالک برنامه‌نویس نیست و صریحاً خواسته تا وقتی یک بخش خروجی واقعی و قابل مشاهده در مرورگر ندارد، از او تست فنی، بازبینی فایل، کد یا تنظیمات نخواهیم. فقط وقتی نسخه مشخصی واقعاً در مرورگر قابل مشاهده و تعامل شد، با دستورالعمل ساده و یک گام روشن اطلاع بده. موفقیت CI یا local runtime به‌تنهایی «آماده مرورگر» نیست. هیچ Production deploy/activate بدون اجازه صریح مالک انجام نشود.
