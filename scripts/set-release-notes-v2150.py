#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""به‌روزرسانی توضیحات فارسی Release v2.15.0"""
import json
import subprocess
import sys

TAG = "v2.15.0"
REPO = "021hk/modiriat-hesab"

BODY = """## حساب‌یار نسخه ۲.۱۵.۰ — کهکشانی خودکار، قفل تم مشکی، پروکسی شخصی و چند کلید Gemini

### ⭐ کهکشانی: فقط یک تم، خودکار شب/روز
- تم‌های «کهکشانی شب» و «کهکشانی روز» ادغام شدند — حالا فقط **یک تم «کهکشانی»** دارید
- خودش تشخیص می‌دهد:
  - حالت **شب** (دستی یا سیستم) ← فضای تیره با ستاره‌های روشن
  - حالت **روشن** ← صفحهٔ **سفید** با **ستاره‌های رنگی** به رنگ تم
- بدون نیاز به دست‌زدن: همین حالا دکمهٔ روز/شب را عوض کنید، ستاره‌ها و پس‌زمینه همان لحظه عوض می‌شوند
- اگر نسخهٔ قبل «کهکشانی روز» را داشتید، خودکار به همین تم تبدیل می‌شود

### ⬛ تم مشکی کامل — شرطی و منطقی شد
- با انتخاب «مشکی کامل»، برنامه **خودکار روی حالت تاریک** می‌رود (چون سیاهِ کامل بدون حالت شب معنا ندارد)
- دکمه‌های «روشن» و «سیستمی» وقتی مشکی کامل فعال است غیرفعال می‌شوند با توضیح — برای برگشتن اول تم را روی «معمولی» بگذارید

### 🛡 پروکسی شخصی برای Gemini (جدید)
- اگر VPN هم جواب نمی‌دهد (خیلی از IPهای VPN را گوگل مسدود می‌کند)، حالا می‌توانید **آدرس یک پروکسی واسط** وارد کنید:
  1. یک Cloudflare Worker بسازید (رایگان) که درخواست‌ها را به `generativelanguage.googleapis.com` پاس می‌دهد
  2. آدرسش (مثل `https://my-gemini-proxy.workers.dev`) را در تنظیمات ← دستیار هوشمند ← «پروکسی شخصی» بگذارید
- از این به بعد همهٔ درخواست‌های Gemini از پروکسی شما می‌رود و گوگل IP ایران را نمی‌بیند
- کد آمادهٔ Worker در توضیحات این نسخه پایین‌تر آمده است 👇

### 🔑 چند کلید Gemini (جدید)
- حالا می‌توانید **چند کلید API** وارد کنید (هر کلید در یک خط)
- اگر کلیدی نامعتبر بود یا سقف مصرفش پر شد، **خودکار کلید بعدی** امتحان می‌شود
- «تست اتصال» همهٔ کلیدها را بررسی و تعداد سالم‌ها را گزارش می‌کند («۲ کلید سالم از ۳»)

### 🛠 موارد دیگر
- مجموع تست‌های خودکار: ۵۴۰+ مورد سبز (۱۳ مجموعه)

---
### 📄 کد آمادهٔ Cloudflare Worker برای پروکسی شخصی
در Cloudflare (رایگان) یک Worker بسازید و این کد را بگذارید:
```js
export default {
  async fetch(req) {
    const url = new URL(req.url);
    const target = "https://generativelanguage.googleapis.com" + url.pathname + url.search;
    const r = new Request(target, req);
    const res = await fetch(r);
    const out = new Response(res.body, res);
    out.headers.set("Access-Control-Allow-Origin", "*");
    out.headers.set("Access-Control-Allow-Headers", "*");
    return out;
  }
}
```
بعد فقط آدرس Worker را در تنظیمات برنامه وارد کنید.

### 📲 نصب
فایل APK را دانلود و روی نسخهٔ قبل نصب کنید؛ داده‌ها و تم انتخابی حفظ می‌شود.
"""

token = subprocess.run(
    ["bash", "-c", "git config remote.origin.url | grep -oP '(?<=://)[^@]+(?=@)' | cut -d: -f2"],
    capture_output=True, text=True, check=True,
).stdout.strip()

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
print("--- first 150 chars ---")
print(updated["body"][:150])
