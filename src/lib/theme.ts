// ─── تم‌های رنگی حساب‌یار (v2.14.3) ───
// رنگ اصلی برنامه (accent) + تم‌های ویژهٔ پس‌زمینه (مشکی کامل / کهکشانی)
// انتخاب کاربر در localStorage ذخیره می‌شود و اسکریپت بوت در <head> قبل از رندر
// روی <html> اعمال می‌شود تا صفحه رنگ درست را از اول نشان دهد (بدون پرش رنگ).

export const ACCENT_STORAGE_KEY = "hesab-yar:accent";
export const SPECIAL_STORAGE_KEY = "hesab-yar:special";

/** شناسهٔ رنگ‌های اصلی — سبز پیش‌فرض برند است */
export const ACCENT_IDS = ["sabz", "banafsh", "abi", "asemani", "zard"] as const;
export type AccentId = (typeof ACCENT_IDS)[number];

/** تم‌های ویژهٔ پس‌زمینه — none یعنی همان روشن/تاریک معمولی */
export const SPECIAL_IDS = ["none", "meshki", "kahkeshani"] as const;
export type SpecialId = (typeof SPECIAL_IDS)[number];

export interface AccentOption {
  id: AccentId;
  label: string;
  /** رنگ نمونه برای دکمهٔ انتخاب */
  swatch: string;
  hint: string;
}

export const ACCENTS: AccentOption[] = [
  { id: "sabz", label: "سبز", swatch: "#059669", hint: "رنگ پیش‌فرض حساب‌یار" },
  { id: "banafsh", label: "بنفش", swatch: "#7c3aed", hint: "بنفش ملایم و مدرن" },
  { id: "abi", label: "آبی", swatch: "#2563eb", hint: "آبی کلاسیک" },
  { id: "asemani", label: "آسمانی", swatch: "#0284c7", hint: "آبی روشن آسمانی" },
  { id: "zard", label: "زرد", swatch: "#d97706", hint: "طلایی/کهربایی گرم" },
];

export interface SpecialOption {
  id: SpecialId;
  label: string;
  hint: string;
}

export const SPECIALS: SpecialOption[] = [
  { id: "none", label: "معمولی", hint: "همان حالت روشن/تاریک عادی" },
  { id: "meshki", label: "مشکی کامل", hint: "پس‌زمینهٔ کاملاً سیاه — مناسب صفحه‌های OLED" },
  { id: "kahkeshani", label: "کهکشانی ⭐", hint: "فضای تیره با ستاره‌های چشمک‌زن به رنگ تم" },
];

/** اعتبارسنجی ورودی ذخیره‌شده — مقدار نامعتبر → null (خالص و قابل‌تست) */
export function parseAccent(value: unknown): AccentId | null {
  return typeof value === "string" && (ACCENT_IDS as readonly string[]).includes(value) ? (value as AccentId) : null;
}

export function parseSpecial(value: unknown): SpecialId | null {
  return typeof value === "string" && (SPECIAL_IDS as readonly string[]).includes(value) ? (value as SpecialId) : null;
}

export function readStoredAccent(): AccentId | null {
  try {
    return parseAccent(localStorage.getItem(ACCENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function readStoredSpecial(): SpecialId | null {
  try {
    return parseSpecial(localStorage.getItem(SPECIAL_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** اعمال رنگ اصلی روی <html> (data-accent) — سبز یعنی حذف ویژگی تا پیش‌فرض اعمال شود */
export function applyAccent(id: AccentId): void {
  try {
    if (id === "sabz") localStorage.removeItem(ACCENT_STORAGE_KEY);
    else localStorage.setItem(ACCENT_STORAGE_KEY, id);
  } catch {
    // ignore
  }
  const html = document.documentElement;
  if (id === "sabz") html.removeAttribute("data-accent");
  else html.setAttribute("data-accent", id);
  notifyThemeChange();
}

/** اعمال تم ویژه روی <html> (data-special) + حالت شب برای تم‌های تیره */
export function applySpecial(id: SpecialId, setDarkMode: (v: "dark" | "light") => void): void {
  try {
    if (id === "none") localStorage.removeItem(SPECIAL_STORAGE_KEY);
    else localStorage.setItem(SPECIAL_STORAGE_KEY, id);
  } catch {
    // ignore
  }
  const html = document.documentElement;
  if (id === "none") html.removeAttribute("data-special");
  else html.setAttribute("data-special", id);
  // تم‌های ویژه تیره‌اند — اگر برنامه در حالت روشن است، به شب می‌رویم تا متن خوانا بماند
  if (id !== "none") setDarkMode("dark");
  notifyThemeChange();
}

/** رویداد داخلی برای اطلاع به مؤلفه‌هایی مثل پس‌زمینهٔ ستاره‌باران */
export function notifyThemeChange(): void {
  try {
    window.dispatchEvent(new CustomEvent("hesab-theme-change"));
  } catch {
    // ignore
  }
}

/** اسکریپت بوت — در <head> اجرا می‌شود تا رنگ قبل از اولین رندر درست باشد */
export const THEME_BOOT_SCRIPT = `try{
var a=localStorage.getItem('${ACCENT_STORAGE_KEY}');
if(a&&a!=='sabz')document.documentElement.setAttribute('data-accent',a);
var s=localStorage.getItem('${SPECIAL_STORAGE_KEY}');
if(s&&s!=='none')document.documentElement.setAttribute('data-special',s);
}catch(e){}`;
