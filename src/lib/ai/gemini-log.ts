// ─── لاگ تشخیصی Gemini (v2.15.1) ───
// هر گام اتصال (آزمون گوگل، لیست مدل‌ها، فراخوانی، پروکسی، گردش کلید) اینجا ثبت می‌شود تا
// از تنظیمات بتوان دید دقیقاً کجای مسیر و به چه دلیلی اتصال شکست خورده.
// نکته‌های امنیتی (اسکن گوگل‌پلی): لاگ فقط روی خود دستگاه ذخیره می‌شود (localStorage)،
// کلیدهای API هرگز کامل در آن نوشته نمی‌شوند (ماسک: ۴ حرف اول + ۴ حرف آخر) و
// متن خطای سرور تا ۲۰۰ نویسه بریده می‌شود.

export type GeminiLogLevel = "info" | "ok" | "warn" | "error";

export type GeminiLogPhase = "system" | "probe" | "proxy" | "list" | "call" | "key";

export interface GeminiLogEntry {
  /** شناسهٔ یکنواخت صعودی */
  id: number;
  /** زمان ثبت (epoch ms) */
  t: number;
  level: GeminiLogLevel;
  phase: GeminiLogPhase;
  /** توضیح فارسی خوانا */
  msg: string;
  /** جزئیات فنی (کد وضعیت، مدت، میزبان، قطعهٔ خطا) — اختیاری */
  detail?: string;
}

export const GEMINI_LOG_STORAGE_KEY = "hesab-yar:gemini-log";
/** بیشترین تعداد رکورد — قدیمی‌ها خودکار حذف می‌شوند */
export const GEMINI_LOG_LIMIT = 150;
/** رویداد window برای به‌روزرسانی زندهٔ نمایشگر لاگ */
export const GEMINI_LOG_EVENT = "hesab-gemini-log";

let seq = 0;
let memory: GeminiLogEntry[] = [];

// ─── نگهداری — همهٔ دسترسی‌ها محافظت‌شده تا در محیط بدون مرورگر (تست) هم امن باشد ───

function isEntry(x: unknown): x is GeminiLogEntry {
  const e = x as GeminiLogEntry;
  return (
    !!e &&
    typeof e === "object" &&
    typeof e.id === "number" &&
    typeof e.t === "number" &&
    typeof e.level === "string" &&
    typeof e.phase === "string" &&
    typeof e.msg === "string"
  );
}

function loadRaw(): GeminiLogEntry[] {
  try {
    if (typeof localStorage === "undefined") return memory;
    const s = localStorage.getItem(GEMINI_LOG_STORAGE_KEY);
    if (!s) return [];
    const arr: unknown = JSON.parse(s);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isEntry).slice(-GEMINI_LOG_LIMIT);
  } catch {
    return [];
  }
}

function saveRaw(entries: GeminiLogEntry[]): void {
  memory = entries;
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(GEMINI_LOG_STORAGE_KEY, JSON.stringify(entries.slice(-GEMINI_LOG_LIMIT)));
  } catch {
    // ذخیره نشد (مثلاً پر بودن حافظه) — نسخهٔ درون حافظه باقی می‌ماند
  }
}

function notify(): void {
  try {
    if (typeof window !== "undefined" && typeof CustomEvent === "function") {
      window.dispatchEvent(new CustomEvent(GEMINI_LOG_EVENT));
    }
  } catch {
    // ignore
  }
}

/** افزودن یک رکورد لاگ — همیشه امن (هرگز نمی‌اندازد استثنا) */
export function pushGeminiLog(entry: {
  level: GeminiLogLevel;
  phase: GeminiLogPhase;
  msg: string;
  detail?: string;
}): GeminiLogEntry | null {
  try {
    seq += 1;
    const full: GeminiLogEntry = { id: seq, t: Date.now(), ...entry };
    const cur = loadRaw();
    cur.push(full);
    saveRaw(cur.slice(-GEMINI_LOG_LIMIT));
    notify();
    return full;
  } catch {
    return null;
  }
}

/** رکوردها — تازه‌ترین اول (برای نمایش مستقیم در تنظیمات) */
export function readGeminiLog(): GeminiLogEntry[] {
  try {
    return loadRaw().slice(-GEMINI_LOG_LIMIT).reverse();
  } catch {
    return [];
  }
}

/** پاک کردن کل لاگ */
export function clearGeminiLog(): void {
  try {
    memory = [];
    try {
      if (typeof localStorage !== "undefined") localStorage.removeItem(GEMINI_LOG_STORAGE_KEY);
    } catch {
      // ignore
    }
    notify();
  } catch {
    // ignore
  }
}

// ─── ابزارهای نمایش ───

/** ماسک کردن کلید API برای لاگ — هرگز کلید کامل ذخیره/نمایش نمی‌شود */
export function maskKey(key: string): string {
  const k = String(key || "").trim();
  if (k.length <= 8) return "…" + k.slice(-4);
  return k.slice(0, 4) + "…" + k.slice(-4);
}

/** بریدن متن خطای سرور برای لاگ — بدون کلید/توکن */
export function clipBody(body: string, max = 200): string {
  return String(body || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** زمان خوانا برای متن کپی‌شدنی — HH:MM:SS محلی */
export function formatLogTime(t: number): string {
  try {
    const d = new Date(t);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  } catch {
    return "--:--:--";
  }
}

const LEVEL_TAG: Record<GeminiLogLevel, string> = { info: "INFO", ok: "OK  ", warn: "WARN", error: "ERR " };

/** کل لاگ به متن ساده — برای دکمهٔ «کپی لاگ» و ارسال برای بررسی */
export function geminiLogToText(entries?: GeminiLogEntry[]): string {
  const list = entries ?? readGeminiLog();
  const lines = list.map((e) => {
    const base = `[${formatLogTime(e.t)}] ${LEVEL_TAG[e.level] ?? "?"} ${e.phase.toUpperCase()} — ${e.msg}`;
    return e.detail ? `${base} | ${e.detail}` : base;
  });
  return ["لاگ تشخیصی Gemini — حساب‌یار", ...lines].join("\n");
}
