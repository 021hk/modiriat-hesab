#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""به‌روزرسانی توضیحات فارسی Release v2.14.4"""
import json
import subprocess
import sys

TAG = "v2.14.4"
REPO = "021hk/modiriat-hesab"

BODY = """## حساب‌یار نسخه ۲.۱۴.۴ — اصلاح تم‌ها بر اساس بازخورد شما + تشخیص دقیق قطعی Gemini

### 🎨 اصلاح تم‌ها
- **«زرد» واقعاً زرد شد** 🟡 — رنگ قبلی کهربایی/نارنجی بود؛ حالا زرد خالص است (دکمه‌های زرد با متن تیره برای خوانایی)
- **پس‌زمینهٔ «رنگ + مشکی» برای همهٔ رنگ‌ها** — قبلاً فقط سبز در حالت شب پس‌زمینهٔ سبز-مشکی داشت؛ حالا بنفش، آبی، آسمانی و زرد هم هر کدام پس‌زمینهٔ تیرهٔ هم‌رنگ خودشان را دارند (در حالت روشن هم ته‌رنگ خیلی ملایم اضافه شد)
- **تم جدید «کهکشانی روز ☀️»** — برعکسِ کهکشانی شب: صفحهٔ **سفید** با **نقاط رنگی** به رنگ تم شما؛ حالت روشن خودکار فعال می‌شود
- رفع یک اشکال: پیش‌تر با تغییر رنگ اصلی، پس‌زمینهٔ تم کهکشانی/مشکی هم عوض می‌شد — حالا پس‌زمینهٔ تم‌های ویژه ثابت می‌ماند

### 🤖 تشخیص دقیق قطعی Gemini («چرا وصل نمی‌شود؟»)
- دکمهٔ «تست اتصال» حالا **علت قطعی را دقیق می‌گوید**:
  - اگر اینترنت وصل است ولی سرور Gemini جواب نمی‌دهد ← پیام می‌دهد که **گوگل دسترسی Gemini را از IP ایران محدود کرده و باید VPN (با سرور خارجی) روشن باشد**
  - اگر خود اینترنت قطع است ← پیام بررسی اینترنت دستگاه
- این نکته مهم است: سرورهای Gemini گوگل از IP ایران پاسخ نمی‌دهند — بدون VPN وصل نخواهد شد؛ با VPN پایدار (سرور خارجی) درست کار می‌کند
- سرعت: تایم‌اوت هر تلاش ۴۰→۳۰ ثانیه شد تا خطا سریع‌تر مشخص شود؛ تلاش مجدد خودکار ۳ باره سر جایش است

### 🛠 موارد دیگر
- مجموع تست‌های خودکار: ۵۳۰+ مورد سبز (۱۳ مجموعه)

---
### 📲 نصب
فایل APK را دانلود و روی نسخهٔ قبل نصب کنید؛ داده‌ها و تم انتخابی حفظ می‌شود.
"""

token = subprocess.run(
    ["bash", "-c", "git config remote.origin.url | grep -oP '(?<=://)[^@]+(?=@)' | cut -d: -f2"],
    capture_output=True, text=True, check=True,
).stdout.strip()

# پیدا کردن release id
import urllib.request
req = urllib.request.Request(
    f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}",
    headers={"Authorization": f"token {token}", "User-Agent": "hesab-yar"},
)
release = json.load(urllib.request.urlopen(req))
rid = release["id"]
print(f"release id: {rid}, current body len: {len(release.get('body') or '')}")

patch = json.dumps({"body": BODY}).encode()
req2 = urllib.request.Request(
    f"https://api.github.com/repos/{REPO}/releases/{rid}",
    data=patch, method="PATCH",
    headers={"Authorization": f"token {token}", "Content-Type": "application/json", "User-Agent": "hesab-yar"},
)
updated = json.load(urllib.request.urlopen(req2))
print(f"updated body len: {len(updated['body'])}")
print("--- first 200 chars ---")
print(updated["body"][:200])
