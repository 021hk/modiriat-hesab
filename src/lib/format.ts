"use client";
// ابزارهای فرمت‌بندی فارسی + سیستم واحد پول (ریال/تومان)
// اصل مهم: مبلغ همیشه به «ریال» در دیتابیس ذخیره می‌شود (پیامک بانک‌ها ریال است)
// و فقط هنگام نمایش بر اساس تنظیم کاربر تبدیل می‌شود (تومان = ریال ÷ ۱۰)

import { useSyncExternalStore } from "react";

export function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "۰";
  return new Intl.NumberFormat("fa-IR").format(Math.round(n));
}

export function formatMoneyPlain(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "0";
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export function parseMoneyInput(raw: string): number {
  if (!raw) return 0;
  const normalized = raw
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٬,،\s]/g, "");
  return Number(normalized) || 0;
}

// ─── واحد پول ───

export type CurrencyUnit = "rial" | "toman";

const CURRENCY_KEY = "hesab-yar:currency-unit";
let cachedUnit: CurrencyUnit | null = null;
const unitListeners = new Set<() => void>();

function readUnit(): CurrencyUnit {
  if (cachedUnit) return cachedUnit;
  try {
    const v = localStorage.getItem(CURRENCY_KEY);
    if (v === "rial" || v === "toman") {
      cachedUnit = v;
      return v;
    }
  } catch {
    // ignore
  }
  cachedUnit = "toman"; // پیش‌فرض: تومان
  return cachedUnit;
}

export function getCurrencyUnit(): CurrencyUnit {
  return readUnit();
}

export function setCurrencyUnit(u: CurrencyUnit): void {
  cachedUnit = u;
  try {
    localStorage.setItem(CURRENCY_KEY, u);
  } catch {
    // ignore
  }
  unitListeners.forEach((l) => l());
}

function subscribeUnit(cb: () => void): () => void {
  unitListeners.add(cb);
  return () => {
    unitListeners.delete(cb);
  };
}

/** هوک ری‌اکتیو واحد پول — با تغییر تنظیم، همه UI به‌روز می‌شود */
export function useCurrencyUnit(): CurrencyUnit {
  return useSyncExternalStore(subscribeUnit, readUnit, () => "toman" as CurrencyUnit);
}

export function currencyLabel(u?: CurrencyUnit): string {
  return (u || readUnit()) === "toman" ? "تومان" : "ریال";
}

/** ریال → عدد نمایشی (اگر واحد تومان باشد تقسیم بر ۱۰) */
export function toDisplayAmount(rial: number, u?: CurrencyUnit): number {
  return (u || readUnit()) === "toman" ? rial / 10 : rial;
}

/** عدد واردشده توسط کاربر (در واحد انتخابی) → ریال برای ذخیره */
export function toStoredAmount(input: number, u?: CurrencyUnit): number {
  return (u || readUnit()) === "toman" ? Math.round(input * 10) : Math.round(input);
}

/** فرمت مبلغ ذخیره‌شده (ریال) برای نمایش در واحد انتخابی */
export function formatMoneyU(rial: number | null | undefined, u?: CurrencyUnit): string {
  if (rial === null || rial === undefined || Number.isNaN(rial)) return formatMoney(0);
  return formatMoney(toDisplayAmount(rial, u));
}

// ─── تاریخ ───

export function formatDateFa(d: string | Date | null | undefined): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatDateShortFa(d: string | Date | null | undefined): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fa-IR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export const INCOME_EMOJI = "📈";
export const EXPENSE_EMOJI = "📉";
