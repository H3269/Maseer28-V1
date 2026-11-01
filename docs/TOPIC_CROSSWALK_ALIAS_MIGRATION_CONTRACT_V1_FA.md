# قرارداد Crosswalk، Alias و Migration Manifest طبقه‌بندی مسیر۲۸

- نسخه قرارداد: 1.0.0-draft
- وضعیت: طراحی و fixture؛ غیرقابل اجرا در runtime
- دامنه: نگاشت نام‌های قدیمی دسته‌های محتوایی و شناسه‌های taxonomy به شناسه‌های پایدار

## تصمیم‌های ایمنی مهاجرت

1. تطبیق دقیق نام فقط یک **نامزد** است؛ تأیید مفهومی یا محتوایی نیست.
2. هر نگاشت باید منشأ، مقصد(ها)، نوع نگاشت، وضعیت تصمیم، rationale و الزام بازبینی انسانی داشته باشد.
3. قرارداد نگاشت ۱:۱، چندبه‌یک و یک‌به‌چند را پشتیبانی می‌کند. نگاشت یک‌به‌چند هرگز مجوز تکثیر خودکار محتوا نیست.
4. مورد بدون مقصد یا نامشخص باید در قرنطینه/بازبینی دستی بماند؛ حذف خاموش ممنوع است.
5. شناسه و محتوای مبدأ، ارجاع کتاب/منبع و provenance حفظ می‌شود.
6. safety routing از مسیر محتوای آموزشی مقدم است.
7. این نسخه هیچ داده عملیاتی، پروفایل کاربر یا مسیر ذخیره‌شده‌ای را تغییر نمی‌دهد.

## فایل‌ها

- `public/assistant/migrations/topic-crosswalk.v1.json`: نگاشت‌های کاندیدا؛ شامل ۳۴ تطبیق نام legacy و سه تصمیم زیرموضوعی نیازمند بازبینی.
- `public/assistant/migrations/topic-aliases.v1.json`: ۳۴ alias فارسی برای دسته‌های قدیمی؛ فقط exact-match و candidate.
- `public/assistant/migrations/topic-migration-manifest.v1.json`: پیش‌شرط‌ها، invariants، dry-run steps، rollback و rollout gates بسته.
- `public/assistant/migrations/topic-migration-manifest.v1.schema.json`: schema نسخه manifest.
- `public/assistant/migrations/topic-migration-fixtures.v1.json`: نمونه‌های مصنوعی برای حالت‌های ۱:۱، چندبه‌یک، یک‌به‌چند، بدون مقصد و قرنطینه.
- `scripts/validate-topic-migration-contract.mjs`: اعتبارسنج مستقل بدون وابستگی جدید.
- `tests/topicMigrationContract.test.js`: آزمون‌های ساختاری و آزمون رد تغییرات ناایمن.

## وضعیت نگاشت‌های اولیه

- ۳۴ دسته قدیمی با نام موضوع رجیستری تطبیق اسمی دارند؛ همه با وضعیت `candidate_exact_name_match` و بازبینی انسانی اجباری ثبت شده‌اند.
- T04-S02 به T18 و T15-S03 به T23 فقط پیشنهادهای نیازمند بازبینی محتوایی‌اند.
- T18-S03 عمداً بدون مقصد باقی مانده تا طراحی مستقل safety registry انجام شود؛ شناسه مقصد ساختگی ایجاد نشده است.
- fixtureهای ادغام و تفکیک فقط توانایی قرارداد را آزمایش می‌کنند و نگاشت واقعی/تصمیم مصوب نیستند.

## اجرای اعتبارسنجی

```bash
node scripts/validate-topic-migration-contract.mjs
node --test tests/topicMigrationContract.test.js
```

اعتبارسنجی ساختاری، تأیید علمی، بازبینی متخصص، اجرای dry-run روی snapshot داده واقعی یا مجوز مهاجرت را اثبات نمی‌کند.

## معیار خروج از این مرحله

قرارداد، schema، fixture، validator و آزمون‌ها باید در شاخه ثبت شوند؛ اما تمام rollout gates باید بسته بمانند. مرحله بعدی فقط پس از تأیید مالک و با تصمیم‌های محتوایی/تخصصی مستقل می‌تواند به dry-run داده‌های کپی‌شده نزدیک شود.
