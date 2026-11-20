# سیاست اتصال GitHub به Cloudflare برای Worker دستیار مسیر۲۸

**تاریخ بازبینی:** 2026-11-04  
**Worker موجود:** `still-firefly-9435maseer28-archive`  
**مخزن:** `H3269/Maseer28-V1`  
**شاخه مجاز:** فقط `main`  
**مسیر Worker در مخزن:** `workers/assistant-api`

## تصمیم نهایی اتصال

اتصال GitHub به Worker موجود مجاز است، اما فقط با تنظیمی که در هر push یک **نسخه غیرفعال** بارگذاری کند و آن را به ترافیک Production ارتقا ندهد.

اتصال پیش‌فرض Cloudflare Workers Builds امن نیست: فرمان پیش‌فرض `wrangler deploy` پس از push نسخه را فعال می‌کند. طبق مستندات رسمی Cloudflare، فرمان `wrangler versions upload` نسخه را بارگذاری می‌کند ولی آن را فوراً deploy نمی‌کند. بنابراین فرمان دوم برای این پروژه انتخاب شده است.

**ممنوع:** استفاده از `wrangler deploy`، `wrangler versions deploy`، انتشار تدریجی یا هر گزینه‌ای که نسخه را به Active Deployment تبدیل کند. ارتقای نسخه به Production باید تصمیم جداگانه و با اجازه صریح مالک باشد.

## تنظیمات دقیق Cloudflare Dashboard

در Worker موجود برو به `Settings > Builds` و GitHub repository را به همین Worker وصل کن. در صفحه تنظیمات Build، مقادیر زیر را دقیقاً وارد کن:

| فیلد | مقدار |
|---|---|
| Git account | حساب GitHub مالک مخزن |
| Git repository | `H3269/Maseer28-V1` |
| Production branch | `main` |
| Root directory | `workers/assistant-api` |
| Build command | خالی |
| Deploy command | `npx --yes wrangler@4.157.0 versions upload --config wrangler.toml` |
| Preview builds | خاموش |
| Build watch paths — Include | `workers/assistant-api/*` |
| Build watch paths — Exclude | خالی |

نکات مهم:

1. نام Worker در Dashboard باید دقیقاً با `name` داخل `workers/assistant-api/wrangler.toml` برابر باشد: `still-firefly-9435maseer28-archive`.
2. Root directory نسبت به ریشه مخزن است؛ چون فایل `wrangler.toml` داخل آن قرار دارد، فرمان بالا باید همان فایل را بخواند.
3. الگوی include فقط تغییرات پوشه Worker را build می‌کند؛ تغییرات UI، محتوا، مستندات و تست‌های بیرون آن نباید build Worker ایجاد کند.
4. فقط شاخه `main` انتخاب شود. هیچ شاخه دیگری نساز یا متصل نکن.
5. Preview builds خاموش بماند؛ پروژه فعلاً به preview branch نیاز ندارد.
6. اگر Cloudflare فرمان Deploy را به `wrangler deploy` برگرداند، تنظیم را ذخیره نکن و ادامه نده.
7. اگر Dashboard پیش از امکان تعیین Deploy command، گزینه‌ای مانند `Save and Deploy` یا انتشار فعال را اجبار کرد، متوقف شو و از صفحه خارج شو؛ انتشار ناخواسته مجاز نیست.
8. Cloudflare ممکن است برای Workers Builds یک API token داخلی بسازد. مقدار token را در گفتگو یا مخزن قرار نده. هیچ متغیر runtime، secret یا provider key در این مرحله اضافه نکن.

## رفتار مورد انتظار پس از اتصال

- push به `main` که فایل‌های زیر `workers/assistant-api/` را تغییر دهد، یک Build ایجاد می‌کند.
- خروجی باید یک Worker Version جدید باشد، نه Active Deployment.
- ترافیک Production باید روی نسخه فعال قبلی باقی بماند.
- هیچ نسخه‌ای را در Version History ارتقا نده و هیچ گزینه Deploy/Promote را انتخاب نکن، مگر پس از درخواست و تأیید صریح مالک.
- اگر نتیجه Build نشان داد نسخه به Active Deployment ارتقا یافته، اتصال/Build را متوقف کن و فوراً از Dashboard وضعیت را بررسی کن؛ این نتیجه خلاف سیاست است.

## اعتبارسنجی داخل مخزن

CI باید هر دو فرمان زیر را فقط در حالت dry-run اجرا کند؛ هیچ‌کدام به Cloudflare متصل نمی‌شوند و چیزی upload/deploy نمی‌کنند:

- `wrangler deploy --dry-run`
- `wrangler versions upload --dry-run`

تست دوم، سازگاری فرمان غیرانتشاری پیشنهادی با فایل Wrangler همین Worker را کنترل می‌کند.

## محدوده‌ای که هنوز فعال نشده است

- این اتصال، خودِ مدل زبانی نیست.
- endpoint مکالمه همچنان 503 و fail-closed است.
- هیچ API provider، secret، consent، session، Durable Object binding یا متن مکالمه‌ای به سرویس بیرونی متصل نشده است.
- Replay Marker فقط در تست محلی Workers runtime اجرا شده؛ هنوز به Worker تولیدی متصل یا deploy نشده است.
- اتصال GitHub و ساخت Version به معنی انتشار یا آماده‌بودن دستیار برای کاربران نیست.

## منابع رسمی

- Workers Builds و رفتار نسخه/انتشار: https://developers.cloudflare.com/workers/ci-cd/builds/
- تنظیم Deploy command و Root directory: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- Build watch paths: https://developers.cloudflare.com/workers/ci-cd/builds/build-watch-paths/
- فرمان‌های `versions upload` و `versions deploy`: https://developers.cloudflare.com/workers/wrangler/commands/workers/
- مجوزهای API Token: https://developers.cloudflare.com/fundamentals/api/reference/permissions/

## وضعیت

**تصمیم:** اتصال مخزن مجاز است، مشروط به تنظیم غیرانتشاری فوق.  
**اتصال واقعی در Dashboard:** هنوز انجام نشده است.  
**نسخه فعال Production:** تغییر داده نشده است.  
**انتشار:** انجام نشده و بدون مجوز صریح ممنوع است.
