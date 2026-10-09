"use client";

// همگام‌سازی پس‌زمینه پیامک‌های بانکی — مستقل از تب فعال، در سطح کل برنامه
// قبلاً بررسی خودکار فقط وقتی تب «حساب‌ها» باز بود انجام می‌شد و پیامک زنده هم فقط همان‌جا
// گوش داده می‌شد؛ کاربر در بقیه تب‌ها فکر می‌کرد برنامه اصلاً پیامک‌ها را بررسی نمی‌کند.
// حالا: باز شدن برنامه (با اعلان) / بازگشت به برنامه از پس‌زمینه / رسیدن پیامک زنده
// → بررسی خودکار و تازه‌سازی داده‌ها اگر چیزی عوض شد.

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isNativeAndroid, getSmsPermission, HesabSms } from "@/lib/native-sms";
import { syncBankSms } from "@/lib/sms-sync";
import { useToast } from "@/hooks/use-toast";

export function SmsBackgroundSync() {
  const qc = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!isNativeAndroid()) return;
    let cancelled = false;

    const run = async (notify: boolean) => {
      try {
        const perm = await getSmsPermission();
        if (perm !== "granted") return;
        const res = await syncBankSms({ silent: true });
        if (cancelled || !res.ok) return;
        const changed = res.imported > 0 || res.queued > 0 || res.balanceUpdated > 0;
        if (!changed) return;
        qc.invalidateQueries();
        if (notify) {
          const fa = (n: number) => n.toLocaleString("fa-IR");
          const parts: string[] = [];
          if (res.imported > 0) parts.push(`${fa(res.imported)} تراکنش خودکار ثبت شد`);
          if (res.balanceUpdated > 0) parts.push(`موجودی ${fa(res.balanceUpdated)} حساب به‌روز شد`);
          if (res.queued > 0) parts.push(`${fa(res.queued)} پیامک در صف بررسی است`);
          toast({ title: "پیامک‌های بانکی بررسی شد", description: parts.join(" — ") });
        }
      } catch {
        // بی‌صدا — همگام‌سازی پس‌زمینه نباید مزاحم کاربر شود
      }
    };

    // باز شدن برنامه — با اعلان
    void run(true);

    // بازگشت به برنامه از پس‌زمینه (سوییچ بین اپ‌ها) — بی‌صدا
    const onVis = () => {
      if (document.visibilityState === "visible") void run(false);
    };
    document.addEventListener("visibilitychange", onVis);

    // پیامک تازه وقتی برنامه باز است — بی‌صدا با کمی تأخیر
    let timer: ReturnType<typeof setTimeout> | null = null;
    let handle: { remove: () => unknown } | null = null;
    try {
      HesabSms.addListener("smsReceived", () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void run(false), 3000);
      })
        .then((h) => {
          handle = h as unknown as { remove: () => unknown };
        })
        .catch(() => {});
    } catch {
      // پلاگین در دسترس نیست
    }

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      if (timer) clearTimeout(timer);
      try {
        void handle?.remove();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
