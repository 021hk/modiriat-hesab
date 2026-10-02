#!/bin/bash
# راه‌اندازی نسخه وب (خروجی استاتیک آفلاین) — بدون دیتابیس سروری
cd /home/z/my-project
export NODE_ENV=production
export PORT=3000
export HOSTNAME=0.0.0.0

# اگر خروجی استاتیک وجود ندارد، بساز
if [ ! -f out/index.html ]; then
  bun install
  bun run build
  node scripts/gen-sw.js
fi

exec bun scripts/static-server.ts
