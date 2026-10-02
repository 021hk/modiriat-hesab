"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

export function SwRegister() {
  useEffect(() => {
    // حذف اسپلش بوت بعد از بارگذاری موفق برنامه
    document.getElementById("boot-splash")?.remove();
    try {
      sessionStorage.removeItem("boot-retried");
    } catch {
      // ignore
    }

    // در APK اندروید همه دارایی‌ها داخل خود برنامه است — سرویس‌ورکر لازم نیست
    if (Capacitor.isNativePlatform()) return;

    // پاک‌سازی کش‌های قدیمی سرویس‌ورکر (هر چیزی جز نسخه فعلی)
    if ("caches" in window) {
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((k) => !k.startsWith("hesab-yar-v5"))
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
