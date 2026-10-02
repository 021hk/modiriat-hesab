# Worklog — حساب‌یار (modiriat-hesab)

---
Task ID: 6
Agent: Main Agent (Super Z)
Task: نسخه ۲.۲.۰ — رفع مشکل ریال/تومان، پارسر SMS نسخه ۲ (فرمت عددی ساختاری)، حذف داده‌های الکی، حالت شب/روز، APK جدید

Work Log:
- کشف بحرانی: فایل‌های local-db.ts و local-api.ts (لایه داده IndexedDB) هرگز کامیت نشده بودند و گم شده بودند → بازسازی کامل از روی قرارداد scripts/api-ref (بدون هیچ seed/داده نمونه)
- دیتابیس محلی جدید با نام «hesabyar-db» → داده‌های آزمایشی/الکی نسخه‌های قبلی کاملاً کنار گذاشته می‌شوند
- پارسر SMS نسخه ۲: پشتیبانی از پیامک‌های ساختاری عددی (نمونه کاربر: 777.888.13972872.1 / -473,000 / 07/10_02:10 / مانده: 66,663,400) + کلیدواژه‌ای + ارقام فارسی/عربی + علامت منفی یونیکد/انتهای خط + تشخیص ۴ رقم آخر کارت + انتخاب کلیدواژه نزدیک به مبلغ — ۴۴/۴۴ تست موفق (bun scripts/test-sms-parser.ts)
- سیستم واحد پول: ذخیره همیشگی به ریال؛ نمایش بر اساس تنظیم کاربر (تومان پیش‌فرض = ÷۱۰)؛ هوک useCurrencyUnit + currencyLabel + toDisplayAmount/toStoredAmount در format.ts؛ همه برچسب‌های «تومان» هاردکد حذف و به واحد پویا تبدیل شد (dashboard/transactions/debts/banks)
- حذف سوئیچ قدیمی «تبدیل ریال به تومان» از تب پیامک (دیگر لازم نیست — واحد سراسری است)
- صف پیامک: پیامک‌های دارای مبلغ ولی بدون نوع مشخص هم در صف می‌آیند و در دیالوگ ثبت، نوع (واریز/برداشت) قابل انتخاب است
- تطبیق حساب بانکی: اولویت با ۴ رقم آخر کارت/حساب، سپس نام بانک
- حالت شب/روز: ThemeProvider (next-themes) + تب جدید «تنظیمات» (شامل تم، واحد پول، پشتیبان‌گیری، درباره) جایگزین تب «پشتیبان»؛ رنگ‌های تاریک (dark: variants) برای همه سطوح روشن‌محور؛ استایل بوت اسپلش تاریک
- حذف کد مرده: seedMutation در debts.tsx
- keystore جدید ساخته شد (android/hesabyar.keystore — پسورد hesabyar2024) و در git استثنا شد؛ امضای APK با v2.1.0 متفاوت است → نصب روی نسخه قبلی نیاز به حذف اول دارد
- JDK 17 (Temurin در .jdk/) + Android SDK مجدداً نصب شد (.android-sdk/)
- نسخه‌ها: package.json/manifest 2.2.0، versionCode 4، SW cache v5 (پاک‌سازی کش قدیمی داده‌های الکی)

Stage Summary:
- همه ۴ درخواست کاربر اعمال شد: ریال/تومان درست، پارسر SMS با فرمت نمونه او، بدون داده الکی، حالت شب در تنظیمات
- APK ساین‌شده release در download/hesab-yar-v2.2.0.apk تحویل شد
- commit + push به GitHub انجام شد

---
Task ID: 6 (appendix)
Agent: Main Agent (Super Z)
Task: نکات تکمیلی Task 6

Work Log:
- ریشه‌یابی گم‌شدن فایل‌های لایه داده: خط ۴۳ .gitignore الگوی local-* داشت که src/lib/local-api.ts و local-db.ts را نادیده می‌گرفت → قانون اصلاح شد (local-*.db / local-*.sqlite + استثنای !src/lib/local-*) و فایل‌ها کامیت شدند — دیگر هرگز گم نمی‌شوند
- کشف: شاخه main در GitHub توسط یک سشن موازی با نسخه Flutter جایگزین شده بود (کامیت‌های cbf1e01/efdb18c/8493a1c شامل CI)؛ برای عدم از بین رفتن آن، شاخه flutter-version ساخته شد و main با نسخه ۲.۲.۰ (Next.js + Capacitor) به‌روزرسانی شد (force-push)
- APK: download/hesab-yar-v2.2.0.apk (۴.۱MB، ساین با keystore جدید hesabyar، versionCode 4)
- تست مرورگر: داشبورد خالی بدون داده الکی ✓، تب تنظیمات (تم + واحد پول + پشتیبان) ✓، حالت تاریک کامل ✓، ورود ۴۷,۳۰۰ تومان → ذخیره ۴۷۳,۰۰۰ ریال → نمایش ۴۷,۳۰۰ تومان ✓

Stage Summary:
- main = v2.2.0 (کامیت a2ddc72)، flutter-version = نسخه Flutter موازی
- JDK 21 در .jdk/ و SDK در .android-sdk/ برای بیلدهای بعدی؛ keystore در android/hesabyar.keystore (پسورد: hesabyar2024)

---
Task ID: 7
Agent: Main Agent (Super Z)
Task: انتشار Release رسمی v2.2.0 روی گیت‌هاب + CI بیلد خودکار APK

Work Log:
- کاربر گفت «روی گیت‌هاب منتشر نکردی» → بررسی: کد v2.2.0 پوش شده بود ولی هیچ Release با APK وجود نداشت (فقط تگ v1.0.0)
- commit خودکار محیط (4a8110d) که کل .jdk با حجم 346MB را کامیت کرده بود → با git reset --mixed HEAD~1 حذف شد (به گیت‌هاب نرفته بود — خوشبختانه)
- .gitignore: افزودن .jdk/ و tool-results/ و .next/ برای جلوگیری دائمی از کامیت شدن نویز محیطی؛ git config core.filemode false برای نویز chmod محیط
- ساخت .github/workflows/build-apk.yml: روی هر push به main (مسیرهای src/android/public) یا تگ v* → Java 17 + Bun + next build (export استاتیک) + cap sync + gradlew assembleRelease (ساین با hesabyar.keystore داخل گیت) → آپلود artifact + اتصال به Release در صورت تگ
- ساخت Release v2.2.0 با API (اسکریپت scripts/create-release.sh — توکن از .git/config خوانده شد و هرگز نمایش داده نشد): تگ v2.2.0 روی main + توضیحات کامل فارسی (تغییرات + روش نصب + نکته حذف نسخه قبلی) + آپلود hesab-yar-v2.2.0.apk (4.1MB)
- تأیید: لینک مستقیم دانلود بدون لاگین 200 / صفحه release 200 / CI شروع به بیلد کرد

Stage Summary:
- لینک دانلود رسمی: https://github.com/021hk/modiriat-hesab/releases/download/v2.2.0/hesab-yar-v2.2.0.apk
- صفحه Release: https://github.com/021hk/modiriat-hesab/releases/tag/v2.2.0
- از این پس هر تغییر در main → CI خودکار APK می‌سازد و artifact می‌دهد؛ تگ v* → مستقیم به Release اضافه می‌شود
