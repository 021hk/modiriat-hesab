"use client";

import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    // حذف اسپلش بوت بعد از بارگذاری موفق برنامه
    document.getElementById("boot-splash")?.remove();
    try {
      sessionStorage.removeItem("boot-retried");
    } catch {
      // ignore
    }

    // پاک‌سازی کش‌های قدیمی سرویس‌ورکر (نسخه‌های قبل از v3)
    if ("caches" in window) {
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((k) => !k.startsWith("hesab-yar-v3"))
              .map((k) => caches.delete(k))
          )
        )
        .catch(() => {
          // ignore
        });
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // بررسی به‌روزرسانی سرویس‌ورکر در هر بازدید
          reg.update().catch(() => {});
        })
        .catch(() => {
          // سرویس‌ورکر اختیاری است
        });
    }
  }, []);
  return null;
}
