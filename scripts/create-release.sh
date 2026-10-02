#!/bin/bash
# Create GitHub Release v2.2.0 with APK — token extracted from git remote URL, never printed
set -e
cd /home/z/my-project

TOKEN=$(git config --get remote.origin.url | sed -n 's|https://[^:]*:\([^@]*\)@github.com.*|\1|p')
REPO="021hk/modiriat-hesab"
APK="download/hesab-yar-v2.2.0.apk"
TAG="v2.2.0"

auth="Authorization: Bearer $TOKEN"
api="https://api.github.com/repos/$REPO"

echo "== checking existing releases =="
EXISTING=$(curl -s -H "$auth" "$api/releases/tags/$TAG" | grep -o '"id":' | head -1)
if [ -n "$EXISTING" ]; then
  echo "release $TAG already exists — uploading/refreshing asset only"
  REL_ID=$(curl -s -H "$auth" "$api/releases/tags/$TAG" | grep -oP '"id": \K[0-9]+' | head -1)
else
  echo "== creating release $TAG =="
  cat > /tmp/release-body.json <<'EOF'
{
  "tag_name": "v2.2.0",
  "target_commitish": "main",
  "name": "حساب‌یار نسخه ۲.۲.۰ — اندروید",
  "body": "## دانلود برنامه اندروید (APK)\n\nفایل **hesab-yar-v2.2.0.apk** را از بخش Assets پایین همین صفحه دانلود و نصب کنید.\n\n## تغییرات این نسخه\n\n- **ریال / تومان:** مبالغ همیشه به ریال ذخیره می‌شوند و نمایش بر اساس انتخاب شماست (تومان پیش‌فرض = یک صفر کمتر)\n- **خواندن خودکار پیامک بانکی:** پشتیبانی از فرمت ساختاری عددی (نمونه: `777.888.13972872.1` / `-473,000` / `07/10_02:10` / `مانده: 66,663,400`) + فرمت‌های کلیدواژه‌ای + ارقام فارسی/عربی\n- **بدون داده الکی:** برنامه با لیست کاملاً خالی شروع می‌شود؛ هیچ داده نمونه‌ای وجود ندارد\n- **حالت شب / روز:** تب جدید «تنظیمات» با انتخاب تم (روشن / تاریک / سیستم)\n- **تنظیمات:** واحد پول، پشتیبان‌گیری و بازیابی، درباره\n- خواندن خودکار پیامک‌های جدید در لحظه رسیدن + تطبیق خودکار با حساب بانکی (۴ رقم آخر کارت)\n\n## روش نصب\n\n1. فایل APK را دانلود کنید\n2. روی فایل بزنید؛ اگر پرسید، اجازه «نصب از منابع ناشناس» را بدهید\n3. اولین بار که برنامه باز شود، دسترسی **پیامک (SMS)** را تأیید کنید تا خواندن خودکار فعال شود\n\n> توجه: اگر نسخه قبلی (v2.1.0) را نصب دارید، امضای این نسخه جدید است — اول نسخه قبلی را حذف کنید.",
  "draft": false,
  "prerelease": false
}
EOF
  REL_ID=$(curl -s -X POST -H "$auth" -H "Content-Type: application/json" \
    -d @/tmp/release-body.json "$api/releases" | grep -oP '"id": \K[0-9]+' | head -1)
  echo "release id: $REL_ID"
fi

if [ -z "$REL_ID" ]; then echo "FAILED to get release id"; exit 1; fi

echo "== uploading APK =="
UPLOAD_URL="https://uploads.github.com/repos/$REPO/releases/$REL_ID/assets?name=hesab-yar-v2.2.0.apk"
# check if asset already exists
ASSET_ID=$(curl -s -H "$auth" "$api/releases/$REL_ID/assets" | grep -B4 '"name": "hesab-yar-v2.2.0.apk"' | grep -oP '"id": \K[0-9]+' | head -1)
if [ -n "$ASSET_ID" ]; then
  echo "asset exists (id $ASSET_ID) — deleting first"
  curl -s -X DELETE -H "$auth" "$api/releases/assets/$ASSET_ID"
fi
curl -s -X POST -H "$auth" -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK" "$UPLOAD_URL" | grep -o '"browser_download_url": "[^"]*"' | head -1

echo "== verify =="
curl -s -H "$auth" "$api/releases/$REL_ID/assets" | grep -oP '"name": "\K[^"]+|"size": \K[0-9]+|"download_count": \K[0-9]+'
echo "DONE"
