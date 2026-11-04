# سیاست اتصال و استقرار Worker دستیار مسیر۲۸

**تاریخ بررسی:** 2026-11-04  
**Worker موجود:** `still-firefly-9435maseer28-archive`  
**مخزن:** `H3269/Maseer28-V1`  
**شاخه مجاز:** فقط `main`

## نتیجه ممیزی فعلی

- نسخه‌ای که کاربر در Dashboard دیده، از نوع انتشار دستی Dashboard بوده است.
- در مخزن فعلی هیچ GitHub Actions workflow برای انتشار Cloudflare Worker وجود ندارد.
- workflowهای موجود فقط اعتبارسنجی، انتشار GitHub Pages با تأیید صریح ورودی، و انتشار Telegram با ورودی دستی را پوشش می‌دهند.
- فایل Wrangler موجود در `workers/assistant-api/wrangler.toml` نام Worker فعلی را هدف می‌گیرد.
- در این مرحله اتصال GitHub به Cloudflare انجام نشده و هیچ Deployment صورت نگرفته است.

## چرا اتصال مستقیم Workers Builds فعلاً ممنوع است؟

اتصال Git repository به Cloudflare Workers Builds به‌طور پیش‌فرض build و deploy را با push به شاخه انتخاب‌شده فعال می‌کند. چون سیاست پروژه استفاده انحصاری از `main` است و commitهای توسعه روی همین شاخه انجام می‌شوند، اتصال مستقیم می‌تواند هر commit عادی را به انتشار Worker در Production تبدیل کند.

تا وقتی یک سازوکار قابل اتکای توقف خودکار انتشار و تأیید دستیِ جداگانه طراحی و آزمون نشده، گزینه Connect در Cloudflare Dashboard نباید فعال شود.

## مسیر پیشنهادی امن

مسیر پیشنهادی، GitHub Actions با workflow دستی و قفل‌های صریح است؛ نه auto-deploy مستقیم Workers Builds.

شرایط لازم پیش از ساخت و استفاده از workflow انتشار:
1. فقط `workflow_dispatch` و فقط ref برابر `refs/heads/main`.
2. ورودی تأیید انتشار با مقدار پیش‌فرض `no` و اجرای job فقط در صورت انتخاب صریح `yes`.
3. الزام موفقیت CI برای همان SHA دقیق، نه صرفاً آخرین اجرای شاخه.
4. الزام اجرای smoke tests روی build/artifact همان SHA.
5. محدود کردن GitHub Environment با approval gate، در صورت پشتیبانی تنظیمات حساب.
6. استفاده از secrets با حداقل دسترسی لازم؛ هرگز ذخیره token در مخزن یا فایل‌های کد.
7. اجرای Wrangler با config صریح `workers/assistant-api/wrangler.toml` و تأیید تطابق نام Worker و حساب Cloudflare.
8. عدم انتشار خودکار Preview یا Production در اثر push.
9. امکان rollback به نسخه قبلی و ثبت شناسه deployment.

این workflow تا زمان دریافت مجوز صریح مالک برای انتشار نباید اجرا شود. ایجاد workflow نیز باید جدا از اجرای آن تلقی شود.

## اقدام لازم در Cloudflare Dashboard

در Worker موجود، مسیر `Settings > Builds` را فقط برای مشاهده وضعیت Git integration باز کنید. اگر دکمه `Connect` یا بخش Git Repository دیده می‌شود، فعلاً آن را انتخاب نکنید. فقط وجود/عدم وجود اتصال و متن وضعیت فعلی را ثبت کنید.

هیچ API token یا secret را در گفتگو ارسال نکنید. اگر بعداً نیاز به secret باشد، فقط نام secret و دستور تنظیم آن مطرح می‌شود، نه مقدار آن.

## منابع رسمی

- Cloudflare Workers Builds: اتصال مخزن و رفتار build/deploy روی push.
- Cloudflare Workers Git integration: مدیریت اتصال از مسیر Settings > Builds.
- Cloudflare Workers build configuration: فرمان deploy و تنظیمات build.

## وضعیت

**تصمیم:** اتصال مستقیم auto-deploy فعلاً رد شده است.  
**انتشار:** انجام نشده.  
**گام بعد:** بررسی read-only وضعیت `Settings > Builds` در Dashboard و سپس طراحی workflow دستیِ fail-closed. 
