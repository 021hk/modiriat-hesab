#!/bin/bash
# استارت سریع نسخه پروداکشن حساب‌یار — سریع و پایدار برای موبایل
# این اسکریپت توسط پلتفرم هنگام بوت (bun run dev) اجرا می‌شود.
cd /home/z/my-project || exit 1
export DATABASE_URL="${DATABASE_URL:-file:/home/z/my-project/db/custom.db}"
export NODE_ENV=production
export PORT=3000
export HOSTNAME=0.0.0.0

# اطمینان از ساختار دیتابیس
bunx prisma db push --accept-data-loss >/dev/null 2>&1 || true

# ۱) اگر نسخه پروداکشن کامیت‌شده موجود است، همان را اجرا کن (شروع چند ثانیه‌ای)
if [ -f prod-server/server.js ]; then
  cd prod-server || exit 1
  exec bun server.js
fi

# ۲) در غیر این صورت: بیلد کن، برای بوت‌های بعدی در prod-server ذخیره کن، و اجرا کن
if [ ! -d node_modules ]; then
  bun install
fi
bunx prisma generate
bun run build
rm -rf prod-server
cp -r .next/standalone prod-server
cd prod-server || exit 1
exec bun server.js
