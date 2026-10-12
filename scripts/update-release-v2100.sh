#!/bin/bash
# Update release body for v2.10.0 (Persian notes)
set -e
cd /home/z/my-project
TOKEN=$(git config remote.origin.url | grep -oP '(?<=://)[^@]+(?=@)' | cut -d: -f2)
python3 - "$TOKEN" << 'PYEOF'
import json, sys, urllib.request
token = sys.argv[1]
body = """## نسخه ۲.۱۰.۰ — تشخیص خودکار وضعیت بدهی/طلب + جستجوی اشخاص

### چه چیزهایی اضافه شد؟

**۱) تشخیص خودکار: الان طلب داریم یا بدهی داریم؟** ✅
- بالای تب «بدهی‌ها» کارت جدید «وضعیت فعلی شما» اضافه شد
- دو عدد بزرگ: **طلب از دیگران** (چقدر به شما بدهکارند) و **بدهی به دیگران** (به چند نفر بدهکارید) + تعداد افراد
- خط وضعیت خودکار: **«الان طلب دارید»** (سبز) / **«الان بدهی دارید»** (نارنجی) / **«متعادل»** — با مبلغ خالص
- این کارت همیشه از کل رکوردها محاسبه می‌شود و با فیلترها یا جستجو تغییر نمی‌کند
- هر پرداخت/تسویه، وضعیت را بلافاصله به‌روز می‌کند — حتی پرداخت‌هایی که از بخش تراکنش‌ها ثبت می‌شوند

**۲) جستجوی اشخاص در بدهی‌ها** ✅
- کادر جستجوی جدید: با **نام**، **شماره تماس** یا **توضیحات** جستجو کنید
- هوشمند برای فارسی: ي/ك عربی و ی/ک فارسی فرقی ندارد؛ ارقام فارسی/عربی هم به عدد تبدیل می‌شود (مثلاً «۰۹۱۲» شماره را پیدا می‌کند)
- چند کلمه؟ ترتیب مهم نیست — «محمدی علی» هم «علی محمدی» را پیدا می‌کند
- تعداد نتایج نشان داده می‌شود و دکمه پاک‌کردن جستجو دارد

### نصب
- APK زیر را دانلود و مستقیم روی نسخه قبلی نصب کنید — **همه داده‌ها حفظ می‌شود**
- یا از داخل خود برنامه: **تنظیمات → به‌روزرسانی برنامه → دانلود نسخه جدید**

---

**تغییرات نسخه‌های قبلی:** [Release v2.9.0](https://github.com/021hk/modiriat-hesab/releases/tag/v2.9.0)
"""
req = urllib.request.Request(
    "https://api.github.com/repos/021hk/modiriat-hesab/releases/tags/v2.10.0",
    headers={"Authorization": f"token {token}", "Accept": "application/vnd.github+json", "User-Agent": "release-script"},
)
with urllib.request.urlopen(req) as r:
    rel = json.load(r)
req2 = urllib.request.Request(
    f"https://api.github.com/repos/021hk/modiriat-hesab/releases/{rel['id']}",
    data=json.dumps({"body": body}).encode(),
    headers={"Authorization": f"token {token}", "Accept": "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "release-script"},
    method="PATCH",
)
with urllib.request.urlopen(req2) as r:
    out = json.load(r)
print("PATCH ok:", out["tag_name"], "| body chars:", len(out["body"]))
PYEOF
