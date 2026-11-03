#!/usr/bin/env bash
# به‌روزرسانی توضیحات فارسی Release v2.14.1 — دکمهٔ برگشت گوشی (ناوبری واقعی + خروج از داشبورد)
set -euo pipefail

TAG="v2.14.1"
REPO="021hk/modiriat-hesab"
TOKEN=$(git config remote.origin.url | grep -oP '(?<=://)[^@]+(?=@)' | cut -d: -f2)

BODY=$(cat <<'EOF'
## حساب‌یار نسخه ۲.۱۴.۱ — دکمهٔ برگشت گوشی مثل یک ناوبری واقعی

### ↩️ رفتار جدید دکمهٔ برگشت
- اول **اورلی‌های باز** بسته می‌شوند: دیالوگ تراکنش، منوها، انتخاب‌گرها و پنل دستیار هوشمند (گوی سبز)
- بعد **قدم‌به‌قدم به صفحه‌های قبلی برمی‌گردید** — همان مسیری که در برنامه رفته‌اید (مثلاً: تراکنش‌ها ← تنظیمات ← داشبورد)
- وقتی روی **داشبورد** هستید، فشردن دوبارهٔ برگشت از برنامه خارج می‌شود
- در نسخهٔ وب هم دکمهٔ برگشت مرورگر همین رفتار را دارد (خروج = برگشت عادی مرورگر)

### 🛠 موارد دیگر
- رفع مشکل hard-reload صفحه هنگام برگشت در نسخهٔ وب (سازگاری با مسیر داخلی Next.js)
- بدون تغییر دیتابیس و بدون تغییر پلاگین‌ها؛ مجموع تست‌های خودکار: ۴۰۸ مورد سبز

---
### 📲 نصب
فایل APK را دانلود و روی نسخهٔ قبل نصب کنید؛ داده‌ها حفظ می‌شود.
EOF
)

RELEASE_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "https://api.github.com/repos/$REPO/releases/tags/$TAG" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "release id: $RELEASE_ID"

python3 - "$RELEASE_ID" "$BODY" <<'PY'
import json, sys, urllib.request
rid, body = sys.argv[1], sys.argv[2]
token = __import__("subprocess").check_output(
    ["bash", "-lc", "git config remote.origin.url | grep -oP '(?<=://)[^@]+(?=@)' | cut -d: -f2"],
    text=True).strip()
req = urllib.request.Request(
    f"https://api.github.com/repos/021hk/modiriat-hesab/releases/{rid}",
    data=json.dumps({"body": body}).encode(),
    headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
             "Content-Type": "application/json"},
    method="PATCH")
with urllib.request.urlopen(req) as r:
    print("PATCH status:", r.status)
PY
echo "done"
