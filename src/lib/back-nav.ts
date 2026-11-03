// ناوبری دکمهٔ برگشت گوشی
// رفتار: ۱) اول اورلی‌های باز بسته می‌شوند (پنل گوی، دیالوگ‌ها، منوها)
//        ۲) بعد برگشت به تب/صفحهٔ قبلی (تاریخچهٔ ناوبری)
//        ۳) روی داشبورد (ریشه) → خروج از برنامه
// در نسخهٔ وب هم دکمهٔ برگشت مرورگر همین رفتار را دارد (به‌جز خروج = برگشت عادی مرورگر).

import { App } from "@capacitor/app";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";

type BackHandler = () => boolean; // true = همین هندلر برگشت را مدیریت کرد

const handlers: BackHandler[] = [];

/** ثبت هندلر برگشت (مثلاً وقتی پنل گوی باز است) — تابع برگشتی آن را برداشتن */
export function pushBackHandler(h: BackHandler): () => void {
  handlers.push(h);
  return () => {
    const i = handlers.lastIndexOf(h);
    if (i >= 0) handlers.splice(i, 1);
  };
}

// اورلی‌های Radix (دیالوگ، هشدار، منو، سلکت) وقتی باز هستند data-state="open" دارند
const OPEN_LAYER_SELECTOR = [
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[role="listbox"][data-state="open"]',
  '[role="menu"][data-state="open"]',
].join(", ");

/** بستن بالاترین اورلی باز؛ اگر چیزی بسته شد true */
export function closeTopOverlay(): boolean {
  // ۱) هندلرهای ثبت‌شده (مثل پنل گوی)
  while (handlers.length > 0) {
    const h = handlers[handlers.length - 1];
    let handled = false;
    try {
      handled = h();
    } catch {
      handled = false;
    }
    if (handled) return true;
    handlers.pop(); // هندلر بی‌اثر → کنار گذاشتن و ادامه
  }
  // ۲) دیالوگ/منوهای Radix با Escape بسته می‌شوند — رویداد را شبیه‌سازی می‌کنیم
  const openLayer = document.querySelector(OPEN_LAYER_SELECTOR);
  if (openLayer) {
    openLayer.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
    );
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
    );
    return true;
  }
  return false;
}

/**
 * نصب رفتار دکمهٔ برگشت:
 *  ۱) اورلی باز → بستن
 *  ۲) navigateBack() → برگشت به صفحهٔ قبلی (اگر true برگرداند)
 *  ۳) وگرنه onExit → خروج از برنامه
 * خروجی: تابع پاک‌سازی
 */
export function installBackButton(
  navigateBack: () => boolean,
  onExit: () => void
): () => void {
  const handle = () => {
    if (closeTopOverlay()) return;
    if (navigateBack()) return;
    onExit();
  };

  if (Capacitor.isNativePlatform()) {
    // اندروید — دکمهٔ سخت‌افزاری/نرم‌افزاری برگشت
    let cancelled = false;
    let sub: PluginListenerHandle | null = null;
    void App.addListener("backButton", handle).then((s) => {
      if (cancelled) void s.remove();
      else sub = s;
    });
    return () => {
      cancelled = true;
      void sub?.remove();
    };
  }

  // وب — یک ورودی نگهبان در history نگه می‌داریم تا دکمهٔ برگشت مرورگر از برنامه نپرد
  // نکتهٔ مهم: Next.js App Router روی popstate وضعیت خودش (__NA) را چک می‌کند؛
  // اگر ورودی state «بیگانه» داشته باشد کل صفحه را hard-reload می‌کند. پس همیشه
  // state فعلی را حفظ می‌کنیم و فقط نشان خودمان را اضافه می‌کنیم.
  const armedState = (): Record<string, unknown> => ({
    ...(history.state ?? {}),
    hesabBackGuard: true,
  });
  try {
    history.replaceState(armedState(), "");
    history.pushState(armedState(), "");
  } catch {
    // ignore
  }
  const onPop = () => {
    if (closeTopOverlay() || navigateBack()) {
      // نگهبان را دوباره مسلح کن — با تأخیر، بعد از settled شدن خود پیمایش history
      setTimeout(() => {
        try {
          history.replaceState(armedState(), "");
          history.pushState(armedState(), "");
        } catch {
          // ignore
        }
      }, 0);
      return;
    }
    onExit(); // در وب: کاری نمی‌کنیم → مرورگر به‌طور عادی برگشت می‌کند (خروج از برنامه)
  };
  window.addEventListener("popstate", onPop);
  return () => window.removeEventListener("popstate", onPop);
}
