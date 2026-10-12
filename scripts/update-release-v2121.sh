#!/usr/bin/env bash
# به‌روزرسانی توضیحات فارسی Release v2.12.1 — حذف کارت خلاصه وضعیت از بالای بدهی‌ها
set -euo pipefail

TAG="v2.12.1"
REPO="021hk/modiriat-hesab"
TOKEN=$(git config remote.origin.url | grep -oP '(?<=://)[^@]+(?=@)' | cut -d: -f2)

BODY=$(cat <<'EOF'
## حساب‌یار نسخه ۲.۱۲.۱ — حذف کارت خلاصهٔ بالای بخش بدهی‌ها

### 🧹 چه چیزی حذف شد؟
- کارت «وضعیت فعلی شما» (دو جعبهٔ «طلب از دیگران» و «بدهی به دیگران» + خط تشخیص خودکار) از بالای تب بدهی‌ها برداشته شد
- تب بدهی‌ها حالا مستقیم با نوار ابزار شروع می‌شود: «شخص جدید» + فیلترها (همه / طلب‌دارها / بدهی‌دارها / تسویه‌شده) + جستجوی اشخاص

### ✅ چیزی که می‌دیدید قبلاً درست بود، سر جایش است
- کارت هر شخص مثل قبل: **نام → نشان وضعیت (طلب دارید / بدهی دارید — مانده) → گردش بدهی و گردش طلب → ریز جزئیات (چقد پرداخت، چقد برداشت)**
- معیار وضعیت همان است: علامت باقی‌ماندهٔ شخص — مثبت = طلب، منفی = بدهی، صفر = تسویه
- ثبت یکتای تراکنش‌ها (هزینه / درآمد / پرداخت بدهی / پرداخت قرض / دریافت طلب / دریافت بدهی) بدون هیچ تغییری

### 📲 نصب
فایل APK را دانلود و نصب کنید؛ روی نسخهٔ قبلی نصب می‌شود و داده‌های شما حفظ می‌شود.
EOF
)

RELEASE_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "https://api.github.com/repos/$REPO/releases/tags/$TAG" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "release id: $RELEASE_ID"

python3 - "$RELEASE_ID" "$BODY" <<'PY'
import json, sys, urllib.request
rid, body = sys.argv[1], sys.argv[2]
token = __import__("subprocess").check_output(
    ["git", "config", "remote.origin.url"], text=True
)
token = token.strip().split("//")[1].split("@")[0].split(":")[1]
req = urllib.request.Request(
    f"https://api.github.com/repos/021hk/modiriat-hesab/releases/{rid}",
    data=json.dumps({"body": body}).encode(),
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    method="PATCH",
)
print(urllib.request.urlopen(req).status)
PY
