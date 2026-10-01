"use client";

import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    // حذف اسپلش بوت بعد از بارگذاری برنامه
    document.getElementById("boot-splash")?.remove();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch(() => {
          // سرویس‌ورکر اختیاری است
        });
    }
  }, []);
  return null;
}
