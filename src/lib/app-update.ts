// ─── به‌روزرسانی از درون برنامه (In-app update) ───
// آخرین Release گیت‌هاب چک می‌شود؛ اگر نسخه جدیدتر بود، کاربر APK را دانلود و نصب می‌کند
// همه داده‌ها محلی است و با نصب نسخه جدید حفظ می‌شود (IndexedDB به APK وابسته نیست)

import { openExternalUrl } from "@/lib/native-sms";

export const REPO_API = "https://api.github.com/repos/021hk/modiriat-hesab/releases/latest";
export const REPO_RELEASES_PAGE = "https://github.com/021hk/modiriat-hesab/releases";

export interface ReleaseInfo {
  tagName: string;
  version: string; // بدون v — مثل 2.9.0
  apkUrl: string | null;
  htmlUrl: string;
  name: string;
  publishedAt: string | null;
}

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function toLatinDigits(s: string): string {
  return String(s)
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}

// "v2.9.0" / "۲.۹" / "2.9.1-beta" → [2,9,0]
export function parseVersion(v: string): number[] {
  return toLatinDigits(v)
    .replace(/[^0-9.]/g, "")
    .split(".")
    .filter((p) => p !== "")
    .map((p) => parseInt(p, 10) || 0);
}

// آیا نسخه ریموت جدیدتر از نسخه محلی است؟ (مقایسه عددی بخش‌به‌بخش)
export function isNewerVersion(remote: string, local: string): boolean {
  const r = parseVersion(remote);
  const l = parseVersion(local);
  const len = Math.max(r.length, l.length);
  for (let i = 0; i < len; i++) {
    const rv = r[i] || 0;
    const lv = l[i] || 0;
    if (rv !== lv) return rv > lv;
  }
  return false;
}

export async function fetchLatestRelease(): Promise<ReleaseInfo> {
  const res = await fetch(REPO_API, { cache: "no-store" });
  if (!res.ok) {
    // پیام‌های فارسی قابل‌فهم به‌جای کد خام
    if (res.status === 403 || res.status === 429) {
      throw new Error("محدودیت موقت درخواست‌ها — چند دقیقه دیگر دوباره امتحان کنید");
    }
    if (res.status === 404) {
      throw new Error("هنوز نسخه منتشرشده‌ای وجود ندارد");
    }
    throw new Error("خطا در دریافت اطلاعات نسخه (" + res.status + ")");
  }
  const d = (await res.json()) as {
    tag_name?: string;
    name?: string;
    html_url?: string;
    published_at?: string;
    assets?: { name?: string; browser_download_url?: string }[];
  };
  const tagName = d.tag_name || "";
  const asset = (d.assets || []).find(
    (a) => typeof a.name === "string" && a.name.toLowerCase().endsWith(".apk")
  );
  return {
    tagName,
    version: toLatinDigits(tagName).replace(/^v/i, ""),
    apkUrl: asset?.browser_download_url || null,
    htmlUrl: d.html_url || REPO_RELEASES_PAGE,
    name: d.name || tagName,
    publishedAt: d.published_at || null,
  };
}

/** دانلود APK نسخه جدید — در اندروید مرورگر سیستم باز می‌شود و دانلود شروع می‌شود */
export async function downloadReleaseApk(release: ReleaseInfo): Promise<boolean> {
  const url = release.apkUrl || release.htmlUrl;
  if (!url) return false;
  await openExternalUrl(url);
  return true;
}
