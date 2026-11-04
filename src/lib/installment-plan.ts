// ─── قسط‌بندی وام (v2.14.2) — خالص و بدون وابستگی به UI ───
// کاربر اصل وام، تعداد اقساط (مثلاً ۳۵)، نوع نرخ (نزولی/ثابت/سعودی) و نرخ سود سالانه می‌دهد؛
// مبلغ هر قسط محاسبه و سررسیدها خودکار «همان روزِ ماه جلالی» ساخته می‌شود
// (مثلاً سررسید اول ۱۵ مهر → بعدی ۱۵ آبان، ۱۵ آذر و …). اعلان یادآور هم از همان
// سررسیدها زمان‌بندی می‌شود (notifications.ts).

import { toJalali, toGregorian, jalaliMonthLength, type JalaliDate } from "@/lib/jalali";

export type PlanRateType = "nozoli" | "sabet" | "soudi";

export const PLAN_RATE_TYPES: PlanRateType[] = ["nozoli", "sabet", "soudi"];

export const PLAN_RATE_LABEL: Record<PlanRateType, string> = {
  nozoli: "نزولی — وام بانکی",
  sabet: "ثابت — اقساط برابر",
  soudi: "سعودی — افزایشی",
};

export const PLAN_RATE_HINT: Record<PlanRateType, string> = {
  nozoli: "قسط اول بزرگ‌تر و کم‌کم کم می‌شود (سود روی ماندهٔ بدهی)",
  sabet: "همهٔ اقساط یکسان (سود ثابت روی اصل وام)",
  soudi: "قسط اول کوچک‌تر و کم‌کم زیاد می‌شود",
};

export function toPersianDigits(n: number): string {
  return String(Math.round(n)).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

/**
 * مبلغ هر قسط به ریال (گردشده) — مجموع دقیقاً برابر اصل + سود
 * (اختلاف گرد کردن روی قسط آخر جبران می‌شود).
 * نرخ ماهانه = نرخ سالانه ÷ ۱۲.
 */
export function computeInstallmentAmounts(
  principal: number,
  count: number,
  annualRatePct: number,
  type: PlanRateType
): number[] {
  const P = Math.round(principal);
  const N = Math.floor(count);
  if (!(P > 0) || !(N > 0)) return [];
  const r = Math.max(0, Number.isFinite(annualRatePct) ? annualRatePct : 0) / 100 / 12;
  let raw: number[];
  if (r === 0) {
    raw = Array<number>(N).fill(P / N);
  } else if (type === "sabet") {
    // نرخ ثابت (flat): سود کل = اصل × نرخ ماهانه × تعداد ماه → همهٔ اقساط برابر
    const each = P / N + P * r;
    raw = Array<number>(N).fill(each);
  } else {
    // نزولی: هر ماه اصل/N + سودِ ماندهٔ باقی‌مانده — قسط اول بزرگ‌تر
    const nozoli: number[] = [];
    for (let k = 1; k <= N; k++) {
      const remaining = P - ((k - 1) * P) / N;
      nozoli.push(P / N + remaining * r);
    }
    // سعودی: دقیقاً آینهٔ نزولی — قسط اول کوچک‌تر، مجموع کل همان
    raw = type === "soudi" ? nozoli.slice().reverse() : nozoli;
  }
  const rounded = raw.map((x) => Math.round(x));
  const diff = Math.round(raw.reduce((s, x) => s + x, 0)) - rounded.reduce((s, x) => s + x, 0);
  rounded[rounded.length - 1] += diff;
  return rounded;
}

/** k ماه بعد در تقویم جلالی، همان روزِ ماه — روز بزرگ‌تر از طول ماه → آخر آن ماه */
export function jalaliMonthAdd(jy: number, jm: number, jd: number, k: number): JalaliDate {
  const total = jy * 12 + (jm - 1) + k;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12 + 1;
  const len = jalaliMonthLength(ny, nm);
  return { jy: ny, jm: nm, jd: Math.min(jd, len) };
}

export interface PlanRow {
  index: number; // ۱ تا N
  amount: number; // ریال
  dueDate: string; // ISO — همان روز ماه جلالی
  title: string; // «عنوان طرح (قسط ۳ از ۳۵)»
}

export interface BuildPlanInput {
  title: string;
  principal: number; // ریال
  count: number; // تعداد اقساط
  annualRatePct: number; // نرخ سود سالانه (٪) — ۰ یعنی بدون سود
  rateType: PlanRateType;
  firstDueDate: string; // ISO — روز این تاریخ در ماه‌های بعد هم سررسید می‌شود
}

/** ساخت همهٔ ردیف‌های طرح: مبلغ + سررسید + عنوان — خالص و قابل‌تست */
export function buildPlanRows(input: BuildPlanInput): PlanRow[] {
  const amounts = computeInstallmentAmounts(input.principal, input.count, input.annualRatePct, input.rateType);
  if (amounts.length === 0) return [];
  const d = new Date(input.firstDueDate);
  if (Number.isNaN(d.getTime())) return [];
  const j = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const hour = d.getHours();
  const minute = d.getMinutes();
  const N = amounts.length;
  return amounts.map((amount, i) => {
    const nxt = jalaliMonthAdd(j.jy, j.jm, j.jd, i);
    const g = toGregorian(nxt.jy, nxt.jm, nxt.jd);
    const dueDate = new Date(g.gy, g.gm - 1, g.gd, hour, minute, 0, 0).toISOString();
    const idx = i + 1;
    const label = N > 1 ? ` (قسط ${toPersianDigits(idx)} از ${toPersianDigits(N)})` : "";
    return { index: idx, amount, dueDate, title: `${input.title}${label}` };
  });
}

export interface PlanSummary {
  count: number;
  totalPayable: number; // جمع اقساط (اصل + سود) — ریال
  totalInterest: number; // جمع سود — ریال
  first: number;
  last: number;
  min: number;
  max: number;
}

/** خلاصهٔ طرح برای پیش‌نمایش دیالوگ — سود = جمع اقساط − اصل */
export function planSummary(amounts: number[], principal: number): PlanSummary {
  const total = amounts.reduce((s, x) => s + x, 0);
  return {
    count: amounts.length,
    totalPayable: total,
    totalInterest: Math.max(0, Math.round(total - Math.round(principal))),
    first: amounts[0] || 0,
    last: amounts[amounts.length - 1] || 0,
    min: amounts.length ? Math.min(...amounts) : 0,
    max: amounts.length ? Math.max(...amounts) : 0,
  };
}
