#!/bin/bash
# Update release body for v2.8.1 (Persian notes)
set -e
cd /home/z/my-project
TOKEN=$(git config remote.origin.url | grep -oP '(?<=://)[^@]+(?=@)' | cut -d: -f2)
python3 - "$TOKEN" << 'PYEOF'
import json, sys, urllib.request
token = sys.argv[1]
body = """## نسخه ۲.۸.۱ — رفع باگ لیست تراکنش‌ها

در نسخه ۲.۸.۰ یک باگ داخلی باعث می‌شد **لیست تراکنش‌ها خالی/بدون اطلاعات** نشان داده شود و **ویرایش هم داده‌های قبلی را نشان ندهد**. این نسخه آن را کاملاً رفع می‌کند.

### چه چیزی درست شد؟
- ✅ **لیست تراکنش‌ها دوباره کامل است** — مبلغ، تاریخ جلالی، نشان دسته‌بندی (حتی زیرشاخه‌ها)، نام حساب بانکی و ترتیب نزولی همه برمی‌گردند
- ✅ **ویرایش تراکنش الان همه داده‌های قبلی را نشان می‌دهد** — مبلغ، بابت، دسته‌بندی (با زیرشاخه)، حساب بانکی و تاریخ/ساعت جلالی از قبل پر می‌شوند
- ✅ ثبت، ویرایش و حذف تراکنش همگی تست شد

### علت باگ
یک خطای برنامه‌نویسی در نسخه ۲.۸.۰ باعث می‌شد به‌جای داده‌های تراکنش، آبجکت خالی به لیست داده شود (مبلغ ۰، تاریخ -). ریشه‌یابی و رفع شد.

### نصب
1. APK زیر را دانلود کنید
2. اگر نسخه قبلی نصب است، مستقیم روی آن نصب می‌شود (امضای یکسان)
3. داده‌های شما سر جای خودشان هستند — هیچ چیز پاک نمی‌شود

---
**دانلود:** [hesab-yar-v2.8.1.apk](https://github.com/021hk/modiriat-hesab/releases/download/v2.8.1/hesab-yar-v2.8.1.apk)
"""
data = json.dumps({"body": body}).encode()
# پیدا کردن release id از طریق تگ (PATCH مستقیم با تگ گاهی 404 می‌دهد)
get_req = urllib.request.Request(
    "https://api.github.com/repos/021hk/modiriat-hesab/releases/tags/v2.8.1",
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
