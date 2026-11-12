// ─── پرس‌وجوی آماری دستیار هوشمند روی دادهٔ محلی (v2.17) ───
// مدل به‌جای حدس زدن، «query_data» می‌دهد؛ اجرا کاملاً روی خود دستگاه انجام می‌شود
// و فقط نتیجهٔ تجمیعی (بدون جزئیات حساس اضافه) به مدل برمی‌گردد.
// مثال کاربر: «مجموع هزینه‌های یه ماه اخیر زیر مبلغ ۲۰۰ تومن چقدره؟»
//   → op=sum, flow=expense, max=2000000, period=last_month (ماه جلالی قبل)
// خالص و قابل‌تست — هیچ وابستگی به IndexedDB ندارد.

import { jalaliMonthBounds, toJalali, toGregorian } from "@/lib/jalali";
import { txKindOf } from "@/lib/debt-utils";

export type AssistantQueryOp = "sum" | "count" | "avg" | "max" | "min" | "list";

/** دوره‌های آماده — تقویم جلالی اینجا محاسبه می‌شود تا مدل تاریخ جلالی را حدس نزند */
export type AssistantPeriod =
  | "this_month" // ماه جلالی جاری
  | "last_month" // ماه جلالی قبل
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "this_year" // سال جلالی جاری (از نوروز)
  | "all";

export const ASSISTANT_OPS: AssistantQueryOp[] = ["sum", "count", "avg", "max", "min", "list"];
export const ASSISTANT_PERIODS: AssistantPeriod[] = [
  "this_month",
  "last_month",
  "last_7_days",
  "last_30_days",
  "last_90_days",
  "this_year",
  "all",
];

export interface AssistantQuery {
  op: AssistantQueryOp;
  flow?: "expense" | "income" | null;
  min?: number | null;
  max?: number | null;
  exact?: number | null;
  period?: AssistantPeriod | null;
  fromIso?: string | null;
  toIso?: string | null;
  categoryId?: string | null;
  accountId?: string | null;
  text?: string | null;
  limit?: number | null;
}

export interface AssistantTx {
  id?: string;
  type?: string; // "income" | "expense" — kind معیار دقیق‌تر است
  kind?: string | null;
  debtId?: string | null;
  debtType?: string | null;
  amount: number;
  date: string; // ISO
  purpose?: string | null;
  categoryId?: string | null;
  bankAccountId?: string | null;
}

export interface AssistantQueryResult {
  op: AssistantQueryOp;
  period?: AssistantPeriod | null;
  fromIso: string | null; // پنجرهٔ زمانی واقعی اجراشده — برای شفافیت پاسخ مدل
  toIso: string | null;
  count: number;
  total: number | null; // فقط برای sum/avg/list بی‌معنا نیست — همیشه داده می‌شود
  average: number | null;
  smallest: number | null;
  largest: number | null;
  byCategory: { categoryId: string; name: string; count: number; total: number }[];
  items: { date: string; amount: number; purpose: string | null }[]; // فقط op=list
}

const num = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[٫,]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * اعتبارسنجی و نرمال‌سازی یک query_data خام از مدل — خالص و قابل‌تست.
 * خروجی: query تمیز یا رشتهٔ خطای فارسی. فیلدهای ناشناخته دور ریخته می‌شوند.
 */
export function validateAssistantQuery(raw: Record<string, unknown>): AssistantQuery | string {
  const q = (raw.query && typeof raw.query === "object" ? raw.query : raw) as Record<string, unknown>;

  const op = String(q.op || "").trim() as AssistantQueryOp;
  if (!ASSISTANT_OPS.includes(op)) return "نوع محاسبهٔ پرس‌وجو (op) نامعتبر است — sum یا count یا …";

  const flow = q.flow === "income" || q.flow === "درآمد" ? "income" : q.flow === "expense" || q.flow === "هزینه" ? "expense" : null;

  const min = num(q.min);
  const max = num(q.max);
  const exact = num(q.exact);
  if (min !== null && max !== null && min > max) return "کران پایین مبلغ از کران بالا بزرگ‌تر است";

  let period: AssistantPeriod | null = null;
  const p = String(q.period || "").trim();
  if (p) {
    if (!ASSISTANT_PERIODS.includes(p as AssistantPeriod)) return "دورهٔ زمانی (period) نامعتبر است";
    period = p as AssistantPeriod;
  }

  const parseIso = (v: unknown): string | null => {
    if (typeof v !== "string" || !v.trim()) return null;
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  };
  const fromIso = parseIso(q.fromIso);
  const toIso = parseIso(q.toIso);
  if (fromIso && toIso && Date.parse(fromIso) > Date.parse(toIso)) return "تاریخ شروع بعد از تاریخ پایان است";

  let limit: number | null = null;
  if (q.limit !== undefined && q.limit !== null && q.limit !== "") {
    const n = Math.round(Number(q.limit));
    limit = Number.isFinite(n) && n > 0 ? Math.min(n, 50) : null;
  }

  const text = typeof q.text === "string" ? q.text.trim().slice(0, 80) || null : null;

  return {
    op,
    flow,
    min,
    max,
    exact,
    period,
    fromIso,
    toIso,
    categoryId: typeof q.categoryId === "string" && q.categoryId.trim() ? q.categoryId.trim() : null,
    accountId: typeof q.accountId === "string" && q.accountId.trim() ? q.accountId.trim() : null,
    text,
    limit,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const startOfDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const endOfDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

/** پنجرهٔ زمانی پرس‌وجو — period جلالی مقدم است؛ from/to صریح با آن تلاقی (intersect) می‌شود */
export function queryRange(
  q: Pick<AssistantQuery, "period" | "fromIso" | "toIso">,
  now: Date
): { fromMs: number; toMs: number } {
  let fromMs = 0;
  let toMs = endOfDay(now);
  switch (q.period) {
    case "this_month": {
      fromMs = jalaliMonthBounds(now).currentStart.getTime();
      break;
    }
    case "last_month": {
      const b = jalaliMonthBounds(now);
      fromMs = b.prevStart.getTime();
      toMs = b.currentStart.getTime() - 1;
      break;
    }
    case "last_7_days":
      fromMs = startOfDay(new Date(now.getTime() - 6 * DAY_MS));
      break;
    case "last_30_days":
      fromMs = startOfDay(new Date(now.getTime() - 29 * DAY_MS));
      break;
    case "last_90_days":
      fromMs = startOfDay(new Date(now.getTime() - 89 * DAY_MS));
      break;
    case "this_year": {
      const j = toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
      const g = toGregorian(j.jy, 1, 1);
      fromMs = new Date(g.gy, g.gm - 1, g.gd, 0, 0, 0, 0).getTime();
      break;
    }
    default:
      break; // all یا بدون period
  }
  if (q.fromIso) fromMs = Math.max(fromMs, Date.parse(q.fromIso));
  if (q.toIso) toMs = Math.min(toMs, endOfDay(new Date(Date.parse(q.toIso))));
  return { fromMs, toMs };
}

/**
 * اجرای پرس‌وجو روی تراکنش‌های محلی — خالص و قابل‌تست.
 * فقط تراکنش‌های سادهٔ هزینه/درآمد (بدون بدهی/طلب) — همان قاعدهٔ اقدام‌های دسته‌بندی.
 */
export function runAssistantQuery(
  txs: AssistantTx[],
  q: AssistantQuery,
  opts?: { now?: Date; categoryName?: (id: string | null | undefined) => string }
): AssistantQueryResult {
  const now = opts?.now || new Date();
  const catName = (id: string | null | undefined) => opts?.categoryName ? opts.categoryName(id) : id || "";
  const { fromMs, toMs } = queryRange(q, now);

  const matched = txs.filter((t) => {
    if (q.flow) {
      if (txKindOf(t) !== q.flow) return false; // بدهی/طلب و درآمد/هزینهٔ مخلوط نمی‌شوند
    }
    const a = Number(t.amount);
    if (!Number.isFinite(a) || a <= 0) return false;
    if (q.exact !== null && q.exact !== undefined && a !== q.exact) return false;
    if (q.min !== null && q.min !== undefined && a < q.min) return false;
    if (q.max !== null && q.max !== undefined && a > q.max) return false;
    if (q.categoryId && t.categoryId !== q.categoryId) return false;
    if (q.accountId && t.bankAccountId !== q.accountId) return false;
    if (q.text) {
      const hay = String(t.purpose || "").toLowerCase();
      if (!hay.includes(q.text.toLowerCase())) return false;
    }
    const ms = t.date ? Date.parse(t.date) : NaN;
    if (!Number.isFinite(ms)) return false;
    return ms >= fromMs && ms <= toMs;
  });

  const amounts = matched.map((t) => Number(t.amount));
  const total = amounts.reduce((s, a) => s + a, 0);
  const byCatMap = new Map<string, { count: number; total: number }>();
  for (let i = 0; i < matched.length; i++) {
    const key = matched[i].categoryId || "";
    const e = byCatMap.get(key) || { count: 0, total: 0 };
    e.count++;
    e.total += amounts[i];
    byCatMap.set(key, e);
  }

  const items =
    q.op === "list"
      ? matched
          .slice()
          .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
          .slice(0, q.limit || 10)
          .map((t) => ({
            date: t.date,
            amount: Number(t.amount),
            purpose: String(t.purpose || "").slice(0, 60) || null,
          }))
      : [];

  return {
    op: q.op,
    period: q.period || null,
    fromIso: new Date(fromMs).toISOString(),
    toIso: new Date(toMs).toISOString(),
    count: matched.length,
    total: matched.length > 0 ? total : 0,
    average: matched.length > 0 ? Math.round(total / matched.length) : 0,
    smallest: matched.length > 0 ? Math.min(...amounts) : 0,
    largest: matched.length > 0 ? Math.max(...amounts) : 0,
    byCategory: Array.from(byCatMap.entries())
      .map(([categoryId, e]) => ({ categoryId, name: catName(categoryId), ...e }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8),
    items,
  };
}

// ─── قالب‌بندی فارسی نتیجه — وقتی دور دوم مدل در دسترس نیست (قطعی/سهمیه) جواب محلی می‌دهیم ───

const faNum = (n: number): string => Math.round(n).toLocaleString("fa-IR", { maximumFractionDigits: 0 });

/** توصیف فارسی پرس‌وجو — «مجموع هزینه‌های تا ۲٬۰۰۰٬۰۰۰ ریال در ماه گذشته» */
export function describeAssistantQuery(q: AssistantQuery): string {
  const flowWord = q.flow === "income" ? "درآمد" : q.flow === "expense" ? "هزینه" : "تراکنش";
  const amount =
    q.exact != null
      ? `دقیقاً ${faNum(q.exact)} ریال`
      : q.min != null && q.max != null
        ? `بین ${faNum(q.min)} تا ${faNum(q.max)} ریال`
        : q.min != null
          ? `از ${faNum(q.min)} ریال به بالا`
          : q.max != null
            ? `تا ${faNum(q.max)} ریال`
            : "";
  const periodWord =
    q.period === "this_month"
      ? "این ماه"
      : q.period === "last_month"
        ? "ماه گذشته"
        : q.period === "last_7_days"
          ? "۷ روز اخیر"
          : q.period === "last_30_days"
            ? "۳۰ روز اخیر"
            : q.period === "last_90_days"
              ? "۹۰ روز اخیر"
              : q.period === "this_year"
                ? "امسال"
                : "";
  const opWord =
    q.op === "sum" ? "مجموع" : q.op === "count" ? "تعداد" : q.op === "avg" ? "میانگین" : q.op === "max" ? "بیشترین" : q.op === "min" ? "کمترین" : "فهرست";
  return [opWord, flowWord, amount && `${flowWord === "تراکنش" ? "با مبلغ" : ""} ${amount}`.trim(), periodWord && `در ${periodWord}`.trim()]
    .filter(Boolean)
    .join(" ");
}

/** خلاصهٔ فارسی نتیجه — پاسخ محلی قطعی وقتی مدل در دسترس نیست */
export function formatAssistantResult(q: AssistantQuery, r: AssistantQueryResult): string {
  const desc = describeAssistantQuery(q);
  const toman = (rial: number): string => `${faNum(rial / 10)} تومان`;
  if (r.count === 0) return `🔍 ${desc}: هیچ موردی پیدا نشد.`;
  const parts: string[] = [];
  if (q.op === "count") parts.push(`تعداد ${faNum(r.count)} مورد`);
  else parts.push(`مجموع ${faNum(r.total || 0)} ریال (${toman(r.total || 0)}) از ${faNum(r.count)} مورد`);
  if (q.op === "avg" && r.average) parts.push(`میانگین ${faNum(r.average)} ریال`);
  if (q.op === "max" && r.largest) parts.push(`بیشترین ${faNum(r.largest)} ریال`);
  if (q.op === "min" && r.smallest) parts.push(`کمترین ${faNum(r.smallest)} ریال`);
  return `🔍 ${desc}: ${parts.join(" — ")}.`;
}

/** پیام کاربر برای دور دوم گفتگو — نتیجهٔ پرس‌وجو به مدل برمی‌گردد تا پاسخ نهایی بدهد */
export function buildQueryResultMessage(q: AssistantQuery, r: AssistantQueryResult): string {
  return [
    "نتیجهٔ پرس‌وجوی query_data روی دادهٔ واقعی کاربر (JSON):",
    JSON.stringify(r),
    "بر اساس این نتیجه فقط JSON نهایی با reply کامل بده؛ تعداد و مجموع را با اعداد خوانا و تومان/ریال ذکر کن.",
    "اگر نتیجه صفر بود، شفاف بگو و اگر «تومن» در گفتار کاربر احتمالاً یعنی هزار تومان، یک بار با آن تفسیر هم پیشنهاد بده.",
  ].join("\n");
}
