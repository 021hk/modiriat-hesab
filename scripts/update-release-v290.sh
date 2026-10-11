#!/bin/bash
# Update release body for v2.9.0 (Persian notes)
set -e
cd /home/z/my-project
TOKEN=$(git config remote.origin.url | grep -oP '(?<=://)[^@]+(?=@)' | cut -d: -f2)
python3 - "$TOKEN" << 'PYEOF'
import json, sys, urllib.request
token = sys.argv[1]
body = """## نسخه ۲.۹.۰ — داشبورد درست، ثبت بدهی/طلب از تراکنش‌ها، به‌روزرسانی از درون برنامه

### چه چیزهایی اضافه/درست شد؟

**۱) رفع اشتباه تومان/ریال در داشبورد** ✅
- «موجودی کل حساب‌ها» یک صفر اضافه داشت — عدد ریال را با برچسب تومان نشان می‌داد
- حالا مثل بقیه برنامه، بر اساس واحد انتخابی شما (تومان/ریال) درست نمایش داده می‌شود

**۲) ثبت بدهی و طلب از همان قسمت تراکنش‌ها** ✅
- موقع ثبت تراکنش، کلید «بابت بدهی یا طلب ثبت شود؟» را روشن کنید
- نام شخص را بنویسید (نام‌های قبلی پیشنهاد می‌شوند) و حالت را انتخاب کنید:
  - برداشت: **«قرض دادم»** (او به شما بدهکار می‌شود) یا **«پرداخت بدهی‌ام»** (بدهی شما به او کم می‌شود)
  - واریز: **«دریافت طلبم»** (طلب شما از او کم می‌شود) یا **«قرض گرفتم»** (به او بدهکار می‌شوید)
- رکورد بدهکار/طلبکار خودکار ساخته یا به‌روز می‌شود و نشان نام شخص روی همان تراکنش دیده می‌شود
- برای این‌که مبلغ دو بار شمرده نشود، تراکنشِ متصل به بدهی فقط از بخش «بدهی‌ها» اصلاح می‌شود

**۳) به‌روزرسانی از درون برنامه (تنظیمات)** ✅
- تب تنظیمات → «به‌روزرسانی برنامه»: خودش آخرین نسخه منتشرشده را چک می‌کند
- اگر نسخه جدید باشد، دکمه «دانلود نسخه جدید» فایل نصب را در مرورگر گوشی باز می‌کند
- بعد از دانلود، فایل را از نوار اعلان‌ها باز کنید و اجازه نصب بدهید — همه داده‌ها حفظ می‌شود

### نصب
1. APK زیر را دانلود و روی نسخه قبلی نصب کنید (داده‌ها سر جایشان می‌مانند)
2. بعد از این نسخه، برای نسخه‌های بعدی لازم نیست به گیت‌هاب بیایید — از خود برنامه، تنظیمات → به‌روزرسانی برنامه

---
**دانلود:** [hesab-yar-v2.9.0.apk](https://github.com/021hk/modiriat-hesab/releases/download/v2.9.0/hesab-yar-v2.9.0.apk)
"""
data = json.dumps({"body": body}).encode()
get_req = urllib.request.Request(
    "https://api.github.com/repos/021hk/modiriat-hesab/releases/tags/v2.9.0",
    headers={"Authorization": f"token {token}", "Accept": "application/vnd.github+json"},
)
release_id = json.load(urllib.request.urlopen(get_req))["id"]
req = urllib.request.Request(
    f"https://api.github.com/repos/021hk/modiriat-hesab/releases/{release_id}",
    data=data, method="PATCH",
    headers={"Authorization": f"token {token}", "Accept": "application/vnd.github+json", "Content-Type": "application/json"},
)
r = json.load(urllib.request.urlopen(req))
print("PATCHed:", r["tag_name"], "| assets:", [a["name"] for a in r["assets"]])
PYEOF
