// تست پرس‌وجوی آماری دستیار هوشمند (v2.17) — اجرا: bun scripts/test-assistant-query.ts
// توابع خالص: validateAssistantQuery، runAssistantQuery، queryRange، formatAssistantResult
import {
  validateAssistantQuery,
  runAssistantQuery,
  queryRange,
  formatAssistantResult,
  describeAssistantQuery,
  buildQueryResultMessage,
  type AssistantTx,
} from "../src/lib/ai/assistant-query";
import { buildSystemPrompt } from "../src/lib/ai/gemini";
import { isoToJalali } from "../src/lib/jalali";

let pass = 0;
let failCount = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
  } else {
    failCount++;
    console.log(`✗ ${name}\n   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`);
  }
}

// ─── دادهٔ آزمایشی ───
// مرجع زمان ثابت: 1405-08-21 (آبان) — حدود 2026-11-12
const NOW = new Date("2026-11-12T10:00:00");

const TXS: AssistantTx[] = [
  { id: "t1", type: "expense", kind: "expense", amount: 1500000, date: "2026-10-20T12:00:00", purpose: "خرید شارژ", categoryId: "mob" },
  { id: "t2", type: "expense", kind: "expense", amount: 2500000, date: "2026-11-01T09:00:00", purpose: "تاکسی", categoryId: "nav" },
  { id: "t3", type: "expense", kind: "expense", amount: 500000, date: "2026-11-05T18:30:00", purpose: "نان", categoryId: "food" },
  { id: "t4", type: "expense", kind: "expense", amount: 900000, date: "2026-11-10T08:00:00", purpose: "نان و لبنیات", categoryId: "food" },
  { id: "t5", type: "income", kind: "income", amount: 10000000, date: "2026-11-08T11:00:00", purpose: "حقوق", categoryId: "salary" },
  // تراکنش بدهی/طلب — نباید در آمار هزینه/درآمد ساده بیاید
  { id: "d1", type: "expense", kind: "debt_payment", amount: 2000000, date: "2026-11-02T10:00:00", purpose: "پرداخت به علی" },
  { id: "d2", type: "income", kind: "claim_received", amount: 3000000, date: "2026-11-03T10:00:00", purpose: "دریافت از رضا" },
  // تاریخ خراب
  { id: "t6", type: "expense", kind: "expense", amount: 700000, date: "نه", purpose: "تاریخ خراب" },
];

// ─── validateAssistantQuery ───

const v1 = validateAssistantQuery({ type: "query_data", query: { op: "sum", flow: "expense", max: 2000000, period: "last_month" } });
check("query معتبر — مبلغ و دوره", typeof v1 === "object" && v1.max === 2000000 && v1.period === "last_month" && v1.op === "sum", true);

const v2 = validateAssistantQuery({ query: { flow: "expense" } });
check("بدون op → خطا", typeof v2, "string");

const v3 = validateAssistantQuery({ query: { op: "multiply" } });
check("op نامعتبر → خطا", typeof v3, "string");

const v4 = validateAssistantQuery({ query: { op: "sum", period: "last_year" } });
check("period نامعتبر → خطا", typeof v4, "string");

const v5 = validateAssistantQuery({ query: { op: "sum", min: 5000, max: 3000 } });
check("min>max → خطا", typeof v5, "string");

const v6 = validateAssistantQuery({ query: { op: "sum", flow: "هزینه" } });
check("flow فارسی → expense", typeof v6 === "object" && v6.flow === "expense", true);

const v7 = validateAssistantQuery({ query: { op: "list", limit: 999 } });
check("limit بزرگ → سقف ۵۰", typeof v7 === "object" && v7.limit === 50, true);

const v8 = validateAssistantQuery({ query: { op: "sum", unknownField: "x", junk: 1 } });
check("فیلد ناشناخته دور ریخته می‌شود", typeof v8 === "object" && !("unknownField" in v8), true);

const v9 = validateAssistantQuery({ op: "count", flow: "income" }); // query تودرتو ندارند — ریشه خودش query است
check("بدون query تودرتو هم قبول", typeof v9 === "object" && v9.op === "count", true);

const v10 = validateAssistantQuery({ query: { op: "sum", fromIso: "2026-11-10", toIso: "2026-11-01" } });
check("from بعد از to → خطا", typeof v10, "string");

// ─── queryRange ───

const rThis = queryRange({ period: "this_month" }, NOW);
const rLast = queryRange({ period: "last_month" }, NOW);
// آبان ۱۴۰۵ از ۲۳ اکتبر ۲۰۲۶ شروع می‌شود
check("this_month = ابتدای آبان ۱۴۰۵", (() => { const j = isoToJalali(new Date(rThis.fromMs).toISOString()); return [j.jy, j.jm, j.jd]; })(), [1405, 8, 1]);
check("last_month = ابتدای مهر ۱۴۰۵", (() => { const j = isoToJalali(new Date(rLast.fromMs).toISOString()); return [j.jy, j.jm, j.jd]; })(), [1405, 7, 1]);
check("last_month پایانش قبل از این ماه", rLast.toMs < rThis.fromMs, true);

const r7 = queryRange({ period: "last_7_days" }, NOW);
check(
  "last_7_days = از شروع ۶ روز قبل تا پایان امروز",
  r7.fromMs === new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - 6).getTime() &&
    r7.toMs === new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), 23, 59, 59, 999).getTime(),
  true
);

const rYear = queryRange({ period: "this_year" }, NOW);
check("this_year از نوروز (فروردین)", [0, 2].includes(new Date(rYear.fromMs).getMonth()), true);

const rMix = queryRange({ period: "last_month", fromIso: "2026-10-15", toIso: "2026-10-20" }, NOW);
check("period و from/to تلاقی می‌شوند", rMix.fromMs >= Date.parse("2026-10-15") && rMix.toMs <= Date.parse("2026-10-20T23:59:59.999"), true);

// ─── runAssistantQuery ───

// «مجموع هزینه‌های یه ماه اخیر زیر ۲ میلیون ریال»
const q1 = validateAssistantQuery({ query: { op: "sum", flow: "expense", max: 2000000, period: "last_month" } });
if (typeof q1 === "object") {
  const r1 = runAssistantQuery(TXS, q1, { now: NOW });
  // ماه جلالی قبل (مهر) → فقط t1 (1,500,000 ریال، ۲۰ اکتبر) — t2/t3/t4 آبان‌اند
  check("مجموع هزینه‌های ماه گذشته زیر ۲م — ۱ مورد", [r1.count, r1.total], [1, 1500000]);
  check("بدهی‌ها در هزینه ساده نمی‌آیند", r1.count, 1);
}

// «چند تا زیر ۳۰۰ هزار تومان داشتیم» (۳٬۰۰۰٬۰۰۰ ریال) — همهٔ دوره
const q2 = validateAssistantQuery({ query: { op: "count", flow: "expense", max: 3000000, period: "all" } });
if (typeof q2 === "object") {
  const r2 = runAssistantQuery(TXS, q2, { now: NOW });
  check("تعداد هزینه‌های زیر ۳م ریال", r2.count, 4); // t1..t4 — d1 حذف، t6 تاریخ خراب
}

// میانگین هزینه‌های این ماه
const q3 = validateAssistantQuery({ query: { op: "avg", flow: "expense", period: "this_month" } });
if (typeof q3 === "object") {
  const r3 = runAssistantQuery(TXS, q3, { now: NOW });
  // t2(2.5m) + t3(0.5m) + t4(0.9m) = 3.9m / 3
  check("میانگین هزینهٔ این ماه", [r3.count, r3.average], [3, 1300000]);
}

// بیشترین هزینه
const q4 = validateAssistantQuery({ query: { op: "max", flow: "expense", period: "all" } });
if (typeof q4 === "object") {
  const r4 = runAssistantQuery(TXS, q4, { now: NOW });
  check("بیشترین هزینه", r4.largest, 2500000);
}

// جستجوی متنی
const q5 = validateAssistantQuery({ query: { op: "sum", flow: "expense", text: "نان", period: "all" } });
if (typeof q5 === "object") {
  const r5 = runAssistantQuery(TXS, q5, { now: NOW });
  check("جستجوی «نان» — t3 و t4", [r5.count, r5.total], [2, 1400000]);
}

// دسته و حساب
const q6 = validateAssistantQuery({ query: { op: "sum", flow: "expense", categoryId: "food", period: "all" } });
if (typeof q6 === "object") {
  const r6 = runAssistantQuery(TXS, q6, { now: NOW, categoryName: (id) => (id === "food" ? "خوراک" : String(id)) });
  check("دستهٔ خوراک", [r6.count, r6.byCategory[0]?.name], [2, "خوراک"]);
}

// فهرست با سقف
const q7 = validateAssistantQuery({ query: { op: "list", flow: "expense", period: "all", limit: 2 } });
if (typeof q7 === "object") {
  const r7 = runAssistantQuery(TXS, q7, { now: NOW });
  check("list — ۲ مورد جدیدترین", [r7.items.length, r7.items[0]?.id ?? ""], [2, ""]);
  check("list مرتب از جدید", Date.parse(r7.items[0]!.date) >= Date.parse(r7.items[1]!.date), true);
}

// نتیجهٔ صفر
const q8 = validateAssistantQuery({ query: { op: "sum", flow: "income", max: 100, period: "all" } });
if (typeof q8 === "object") {
  const r8 = runAssistantQuery(TXS, q8, { now: NOW });
  check("نتیجهٔ صفر", [r8.count, r8.total, r8.smallest], [0, 0, 0]);
  check("متن نتیجهٔ صفر", formatAssistantResult(q8, r8).includes("هیچ موردی"), true);
}

// flow فارسی از مدل
const q9 = validateAssistantQuery({ query: { op: "count", flow: "درآمد", period: "this_month" } });
if (typeof q9 === "object") {
  const r9 = runAssistantQuery(TXS, q9, { now: NOW });
  check("درآمد این ماه — فقط t5 (طلب حذف)", r9.count, 1);
}

// ─── قالب فارسی ───

const f1 = validateAssistantQuery({ query: { op: "sum", flow: "expense", max: 2000000, period: "last_month" } });
if (typeof f1 === "object") {
  const fr = runAssistantQuery(TXS, f1, { now: NOW });
  const text = formatAssistantResult(f1, fr);
  check("قالب محلی — مجموع و تومان", text.includes("مجموع") && text.includes("تومان") && text.includes("ماه گذشته"), true);
}

check("توصیف پرس‌وجو", describeAssistantQuery({ op: "sum", flow: "expense", max: 2000000, period: "last_month" }).includes("ماه گذشته"), true);

const msg = buildQueryResultMessage({ op: "count", flow: "expense" }, {
  op: "count",
  period: "all",
  fromIso: "2026-01-01T00:00:00.000Z",
  toIso: "2026-11-12T23:59:59.999Z",
  count: 4,
  total: 5400000,
  average: 1350000,
  smallest: 500000,
  largest: 2500000,
  byCategory: [],
  items: [],
});
check("پیام نتیجه به مدل — JSON و تفسیر تومن", msg.includes('"count":4') && msg.includes("تومن"), true);

// ─── دستور سیستم شامل query_data ───

const sp = buildSystemPrompt("2026-11-12T00:00:00.000Z");
check("system prompt شامل query_data", sp.includes("query_data") && sp.includes("this_month|last_month"), true);
check("system prompt — قاعدهٔ تومن", sp.includes("تومن"), true);

// ─── جمع‌بندی ───

console.log(`\nپاس: ${pass} | شکست: ${failCount}`);
if (failCount > 0) process.exit(1);
console.log("همهٔ تست‌های پرس‌وجوی دستیار سبز ✓");
