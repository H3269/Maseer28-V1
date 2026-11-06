# بررسی اولیه گزینه‌های اجرای محلی مدل و صوت — A1 (پژوهش رومیزی)

**تاریخ بررسی:** 2026-11-06  
**وضعیت:** پژوهش مقدماتی؛ A1 تکمیل نشده و هیچ فناوری انتخاب نهایی نشده است.  
**مبنای کد:** شاخه main، HEAD پیش از این گزارش A1: d69c2cb8a0afd871a87706eedad855d55f5ab924

## 1. نتیجه مهم معماری

محصول فعلی React/Vite و مینی‌اپ وبی است. استفاده از کتابخانه Kotlin/Android برای اجرای مدل، مستقیماً در کد وب موجود ممکن نیست؛ این گزینه فقط در صورت وجود اپ Native یا bridge بومیِ در اختیار مالک میزبان قابل بررسی است. نباید فرض کنیم می‌توان داخل WebView تلگرام یا بله کد Native نصب کرد.

بنابراین مسیر اصلی قابل بررسی برای مینی‌اپ، اجرای مدل در خود مرورگر با WebGPU یا WASM است. این مسیر به پشتیبانی واقعی مرورگر میزبان، GPU، حافظه، Workerها، ذخیره مدل و محدودیت‌های WebView وابسته است. مستندات Chromium تأکید می‌کنند WebView با Chrome یکسان نیست و بعضی APIها/مجوزها و معماری پردازش در آن محدودیت‌های مخصوص دارند.

## 2. گزینه‌های مدل زبانی محلی

### گزینه W1 — WebLLM / MLC
- موتور استنتاج LLM داخل مرورگر با WebGPU، پشتیبانی از streaming و اجرای محاسبات در Web Worker دارد.
- مدل‌ها و کتابخانه‌های مدل باید در قالب سازگار MLC آماده باشند؛ بارگیری اولیه مدل می‌تواند سنگین باشد.
- پیش‌نیاز WebGPU است؛ در مرورگری که WebGPU ندارد، این مسیر به‌صورت محلی قابل اجرا نیست.
- مزیت: ادغام مستقیم‌تر با React/Vite و معماری وب.
- ریسک: سازگاری Android WebView و WebView میزبان‌های Telegram/Bale هنوز روی دستگاه واقعی اثبات نشده؛ مدل فارسی مناسب، حجم، سرعت و RAM نیز باید آزمایش شوند.

### گزینه W2 — Transformers.js / ONNX Runtime Web
- مدل‌های NLP و صوت را مستقیماً در مرورگر و بدون سرور اجرا می‌کند؛ CPU/WASM مسیر پایه و WebGPU مسیر شتاب‌دهی است.
- پشتیبانی WebGPU وابسته به مرورگر و نسخه است؛ وجود API در Chrome desktop به معنی کارکرد در WebView میزبان نیست.
- مزیت: انعطاف برای آزمودن embedding، طبقه‌بندی، ASR و TTS و fallback CPU برای مدل‌های سبک.
- ریسک: اجرای یک LLM مکالمه‌ای با کیفیت فارسی روی CPU موبایل ممکن است کند یا پرمصرف باشد؛ باید جداگانه اندازه‌گیری شود.

### گزینه W3 — LiteRT-LM JavaScript
- مستندات Google AI Edge در زمان بررسی API وب را در وضعیت Early Preview معرفی می‌کنند؛ پشتیبانی اعلام‌شده فعلی محدود به چند مدل وب‌سازگار و اجرای WebGPU است.
- مزیت: مسیر رسمی Google برای اجرای محلی LLM در وب.
- ریسک: وضعیت preview و فهرست مدل محدود است؛ پیش از اتکا به آن باید ثبات API، سازگاری WebView و پوشش زبان فارسی آزمایش شود.

### گزینه N1 — LiteRT-LM Android/Kotlin
- مستندات فعلی، API Kotlin اندروید را برای اجرای محلی با CPU/GPU/NPU ارائه می‌کنند.
- این مسیر برای اپ Native مناسب‌تر است، نه مینی‌اپ وبی که داخل برنامه میزبان باز می‌شود؛ فقط با مجوز و امکان فنی ساخت wrapper/bridge بومی قابل بررسی است.
- این پروژه فعلاً نباید بر وجود چنین wrapperی فرض بگذارد.

## 3. گزینه‌های صوت محلی

### ASR — گفتار به متن فارسی
- sherpa-onnx از اجرای آفلاین روی Android و WebAssembly پشتیبانی می‌کند و گزینه فنی قابل بررسی برای مسیر وب/بومی است.
- یک مدل کوچک فارسی منتشرشده برای sherpa-onnx، حدود 6.9M پارامتر، در صفحه منتشرکننده WER حدود 24.5% گزارش کرده است؛ این عدد برای مکالمه حساس و روان کافی فرض نمی‌شود.
- یک مدل فارسی دیگر در شاخه RNNT حدود 114M پارامتر و benchmark منتشرشده WER حدود 9.5% دارد؛ همان صفحه برای شاخه CTC مرتبط WER حدود 8.12% گزارش می‌کند. این اعداد self-reported و وابسته به مجموعه آزمون همان ناشرند؛ ارزیابی مستقل با گفتار محاوره‌ای، لهجه‌ها و نویز واقعی لازم است.
- Whisper.cpp نیز Android را پشتیبانی می‌کند، اما حجم/سرعت مدل فارسی و مصرف RAM باید روی دستگاه هدف سنجیده شود.

### TTS — متن به گفتار فارسی
- sherpa-onnx موتورهای آفلاین TTS و هدف‌های Android/WebAssembly دارد؛ اما وجود موتور عمومی به‌تنهایی وجود صدای فارسی طبیعی و مجاز را ثابت نمی‌کند.
- یک پروژه فارسی ONNX آفلاین نیز پیدا شد؛ این فقط نامزد آزمایش است و هنوز کیفیت، مجوز، اندازه، زمان تولید و امکان ادغام WebAssembly آن بررسی نشده است.
- صدای طبیعی، تلفظ فارسی، مکث، عددها، نام‌ها و پایداری در متن‌های طولانی باید با ارزیابی انسانی سنجیده شود.

## 4. جمع‌بندی مقدماتی

1. برای مینی‌اپ وب، WebLLM و Transformers.js مسیرهای prototype منطقی‌اند؛ هیچ‌کدام هنوز برای محیط واقعی Telegram/Bale تأیید نشده‌اند.
2. LiteRT-LM JS ارزش آزمایش دارد، اما وضعیت Early Preview و محدودیت مدل‌ها ریسک محصولی دارد.
3. LiteRT-LM Kotlin از نظر اجرا روی دستگاه جذاب است، اما به مسیر Native نیاز دارد و نمی‌توان آن را مستقیماً در کد React/Vite تزریق کرد.
4. برای صوت، sherpa-onnx نامزد جدی‌تر برای آزمایش آفلاین است؛ کیفیت ASR فارسی باید روی مجموعه مستقل و TTS فارسی باید از نظر کیفیت/مجوز بررسی شود.
5. هیچ‌یک از گزینه‌ها بدون آزمون روی WebView واقعی، حافظه و سرعت دستگاه و capture شبکه، انتخاب نهایی نمی‌شوند.

## 5. آزمون‌های لازم برای تکمیل A1

- فهرست دستگاه‌های هدف و حداقل مشخصات: Android version، RAM واقعی آزاد، مدل SoC/GPU، نسخه Android System WebView و نسخه اپ میزبان.
- آزمون قابلیت WebGPU و Worker در مرورگر مستقل و WebView میزبان به‌صورت جداگانه.
- آزمون بارگیری اولیه مدل، resume دانلود، ذخیره پایدار، پاک‌سازی و بازیابی مدل.
- آزمون آفلاین واقعی پس از دانلود؛ capture شبکه برای اطمینان از عدم ارسال prompt، transcript، audio و context.
- آزمون مدل فارسی با مجموعه سناریوهای واقعی اپ: پرسش عمومی، راهنمای صفحه، توضیح تمرین روز، اصلاح برداشت، پرسش چندمرحله‌ای و عدم قطعیت.
- ثبت حجم مدل، زمان بارگیری، زمان اولین توکن، tokens/sec، RAM اوج، دمای دستگاه و مصرف باتری.
- آزمون توقف و بازگشت از پس‌زمینه، کمبود حافظه، قطع renderer و بارگیری مجدد.
- ارزیابی ASR با WER/CER و ارزیابی انسانی برای لهجه، گفتار محاوره‌ای و نویز.
- ارزیابی TTS با فهم‌پذیری، طبیعی‌بودن، تلفظ، تأخیر و اندازه بسته.
- آزمون مجوز میکروفون و رفتار رد/لغو مجوز در هر میزبان.

## 6. منابع اولیه

- Google AI Edge — LiteRT-LM Overview: https://developers.google.com/edge/litert-lm/overview
- Google AI Edge — LiteRT-LM JavaScript Web API: https://developers.google.com/edge/litert-lm/js
- Google AI Edge — LiteRT-LM Android/Kotlin: https://developers.google.com/edge/litert-lm/android
- Hugging Face — Transformers.js: https://huggingface.co/docs/transformers.js
- Hugging Face — Transformers.js WebGPU: https://huggingface.co/docs/transformers.js/guides/webgpu
- MLC — WebLLM getting started: https://webllm.mlc.ai/docs/user/get_started.html
- Chromium — Android WebView platform compatibility: https://chromium.googlesource.com/chromium/src/+/HEAD/android_webview/docs/web-platform-compatibility.md
- sherpa-onnx — Android: https://k2-fsa.github.io/sherpa/onnx/android/index.html
- sherpa-onnx — project overview: https://k2-fsa.github.io/sherpa/onnx/index.html
- Persian ASR candidate (publisher benchmark): https://huggingface.co/Reza2kn/Shenava-Koochik-v1.5-RNNT-sherpa-onnx
- Persian TTS candidate (initial lead only): https://github.com/nimaone/persian_tts

**هشدار:** این سند پژوهش مقدماتی فنی است؛ نه ارزیابی نهایی، نه تأیید کیفیت مدل و نه مجوز افزودن dependency یا تغییر محصول.


## دستگاه مرجع و پروتکل آزمون میزبانی A1 — 2026-11-06

**دستگاه مرجع تأییدشده:** Samsung SM-A307FN / Android 11.

**میزبان‌ها:**
1. Telegram Android — میزبان محصول نهایی.
2. Bale Android — میزبان محصول نهایی.
3. Chrome Android — محیط تست و ارزیابی مالک.

**قاعده تفسیر:** هر سه میزبان روی همان دستگاه باید جداگانه آزموده شوند. Chrome معیار تشخیصی است و جایگزین آزمون WebView تلگرام یا بله نیست. نتیجه موفق یک میزبان، موفقیت میزبان دیگر را اثبات نمی‌کند.

**اطلاعات محیطی که پیش از آزمون باید ثبت شود:** نسخه دقیق Telegram، Bale، Chrome و Android System WebView؛ فضای ذخیره‌سازی آزاد؛ وضعیت دسترسی‌های لازم؛ و مشخصات حافظه قابل مشاهده دستگاه. نسخه WebView ممکن است با نسخه Chrome یکسان نباشد.

**ماتریس آزمون برای هر سه میزبان:**
- تشخیص میزبان و بارگذاری اپ بدون تغییر یا افزودن UI.
- دسترسی/عدم دسترسی WebGPU و گزارش دقیق قابلیت‌های واقعی؛ آزمون fallback CPU/WASM در صورت نبود WebGPU.
- اجرای Worker و بررسی محدودیت‌های lifecycle/background.
- cache و ذخیره مدل: فضای لازم، ماندگاری پس از بستن میزبان و بازیابی پس از راه‌اندازی مجدد.
- اجرای مدل پس از دانلود اولیه در حالت airplane/offline؛ capture شبکه باید نشان دهد متن و صوت مکالمه به endpoint بیرونی ارسال نمی‌شود.
- اندازه‌گیری زمان بارگذاری اولیه، زمان پاسخ، RAM، گرما/مصرف باتری و پایداری در مکالمه پیوسته.
- آزمون مستقل STT و TTS آفلاین فارسی، کیفیت قابل‌قبول و مدیریت مجوز میکروفون/صدا.
- آزمون بازگشت از background، قطع/وصل شبکه، کمبود حافظه و خطاهای میزبان.

**وضعیت:** فقط هدف آزمون و پروتکل ثبت شده‌اند. هیچ نتیجه‌ای درباره پشتیبانی WebGPU، سرعت مدل، کیفیت فارسی یا عملکرد آفلاین روی SM-A307FN تا اجرای آزمون واقعی قابل ادعا نیست.


**نسخه‌های ثبت‌شده دستگاه مرجع:** Chrome `156.0.8078.75`؛ Android System WebView `156.0.8078.47` (گزارش کاربر، 2026-11-06). نسخه Telegram و Bale و نتایج آزمون فیزیکی هنوز نامشخص‌اند.


**نسخه‌های میزبان آزمون (گزارش کاربر، 2026-11-06):** Telegram Android `13.1.1`؛ Bale Android `10.05.08` (شناسه/بیلد `180792`). همراه با Chrome Android `156.0.8078.75` و Android System WebView `156.0.8078.47` روی Samsung SM-A307FN / Android 11. نسخه‌ها ثبت شده‌اند، اما آزمون فیزیکی هنوز اجرا نشده است.

## ارزیابی سازگاری اولیه با دستگاه مرجع — تکمیل بررسی رومیزی، 2026-11-06

### یافته تعیین‌کننده WebGPU

مستند رسمی Chrome اعلام می‌کند WebGPU در Chrome 121 روی Android برای دستگاه‌های دارای Android 12 یا بالاتر و GPUهای Qualcomm/ARM فعال شده است. راهنمای رسمی عیب‌یابی نیز Android را از Chrome 121 به بعد ذکر می‌کند؛ اما وجود نسخه جدید Chrome به‌تنهایی کافی نیست و سیستم‌عامل/سخت‌افزار باید واجد شرایط باشد.

دستگاه مرجع پروژه Samsung SM-A307FN با Android 11 است. مشخصات منتشرشده برای خانواده Galaxy A30s، GPU از خانواده Mali-G71 MP2 و پیکربندی‌های 4GB RAM را نشان می‌دهد؛ مشخصات دقیق SKU باید از خود دستگاه/اطلاعات سیستم تأیید شود.

**نتیجه مهندسی:** WebGPU در این دستگاه، بر اساس پیش‌نیاز رسمی Android 12+، گزینه قابل اتکای پایه نیست. Chrome 156 و WebView 156 این مانع سیستم‌عامل را برطرف نمی‌کنند. بنابراین:
- WebLLM/هر LLM وابسته به WebGPU نباید مبنای محصول یا مسیر اجباری باشد.
- مسیر WASM/CPU باید به‌عنوان مسیر اصلی قابل‌آزمایش روی دستگاه فعلی بررسی شود؛ این به معنی اثبات سرعت یا کیفیت قابل قبول نیست.
- ارتقای Android یا تغییر دستگاه را فرض نمی‌کنیم و تا تصمیم مالک، شرط سخت‌افزار را تغییر نمی‌دهیم.
- WebGPU همچنان می‌تواند روی دستگاه‌های جدیدتر/سازگار در ماتریس توسعه‌ای بررسی شود، اما قبولی Chrome روی دستگاه دیگر، قبولی Telegram/Bale را اثبات نمی‌کند.

### نتیجه تصمیم‌گیری نامزدها

| گزینه | تصمیم فعلی برای دستگاه مرجع |
|---|---|
| WebLLM / MLC با WebGPU | از مسیر پایه خارج؛ پیش‌نیاز رسمی Android 12+ با Android 11 فعلی منطبق نیست |
| Transformers.js / ONNX Runtime Web با WASM/CPU | نامزد اصلی مرحله prototype؛ عملکرد و حافظه هنوز اندازه‌گیری نشده |
| Transformers.js / ONNX Runtime Web با WebGPU | فقط مسیر مشروط و غیرقابل اتکا تا آزمون واقعی |
| LiteRT-LM JS | به علت وابستگی به WebGPU و وضعیت preview، نامزد ثانویه |
| LiteRT-LM Kotlin | خارج از معماری فعلی مینی‌اپ؛ نیازمند bridge بومی و مجوز مستقل مالک |
| sherpa-onnx WASM/Android برای ASR/TTS | نامزد مستقل؛ باید اندازه بسته، کیفیت فارسی و مصرف منابع جداگانه سنجیده شود |

### شکاف آزمون باقی‌مانده

بدون اجرای کد در origin واقعی اپ و داخل WebView هر میزبان، نمی‌توان دسترسی عملی به WebGPU، Worker، IndexedDB، Cache Storage، میکروفون یا پایداری پس‌زمینه را تأیید کرد. نسخه‌های Chrome و Android System WebView به‌تنهایی جایگزین آزمون درون Telegram و Bale نیستند. در وضعیت فعلی دسترسی مستقیم به DevTools دستگاه نیز فراهم نیست؛ بنابراین این موارد «تأییدنشده» می‌مانند و نباید با آزمون CI مرورگر دسکتاپ اشتباه گرفته شوند.

**قاعده ادامه A1:** هیچ dependency، مدل یا کد محصولی تا پیش از اثبات مسیر WASM/CPU، اندازه‌گیری منابع و آزمون حریم خصوصی اضافه نمی‌شود. هیچ UI آزمایشی/جدیدی در اپ ساخته نمی‌شود.

### منابع رسمی و مشخصات مرجع

- Chrome for Developers, What's New in WebGPU (Chrome 121), بخش Android: https://developer.chrome.com/blog/new-in-webgpu-121
- Chrome for Developers, WebGPU troubleshooting: https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips
- Chrome for Developers, WebGPU overview: https://developer.chrome.com/docs/web-platform/webgpu/overview
- Samsung Galaxy A30s / SM-A307FN specifications (third-party device reference): https://www.phonemore.com/specs/samsung/galaxy-a30s/sm-a307fn/
- Google AI Edge, LiteRT-LM JavaScript: https://developers.google.com/edge/litert-lm/js
- Transformers.js documentation: https://huggingface.co/docs/transformers.js
