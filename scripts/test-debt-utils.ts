// تست ابزارهای بدهی/طلب مدل شخص‌محور (v2.12) — اجرا: bun scripts/test-debt-utils.ts
// اصل: هر تراکنش فقط یک kind دارد؛ معیار طلب/بدهی = شخص + علامت باقی‌مانده
import {
  TX_KINDS,
  kindLabel,
  kindDirection,
  isPersonKind,
  kindsOfDirection,
  personKindsOfDirection,
  autoKind,
  kindSentence,
  legacyKind,
  txKindOf,
  txDirection,
  personKey,
  summarizePersonFromTxns,
  legacyOpeningBalance,
  matchPersonInText,
  type TxKind,
} from "../src/lib/debt-utils";

let pass = 0;
let failCount = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++;
  else {
    failCount++;
    console.log(`✗ ${name}\n   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`);
  }
}

// ─── ۱) شش نوع یکتا و برچسب‌ها ───
check("۶ نوع یکتا", TX_KINDS, ["expense", "income", "debt_payment", "loan_given", "claim_received", "loan_received"]);
check("برچسب هزینه", kindLabel("expense"), "هزینه");
check("برچسب درآمد", kindLabel("income"), "درآمد");
check("برچسب پرداخت بدهی", kindLabel("debt_payment"), "پرداخت بدهی");
check("برچسب پرداخت قرض", kindLabel("loan_given"), "پرداخت قرض");
check("برچسب دریافت طلب", kindLabel("claim_received"), "دریافت طلب");
check("برچسب دریافت بدهی", kindLabel("loan_received"), "دریافت بدهی");

// ─── ۲) جهت هر نوع ───
check("هزینه = خروج", kindDirection("expense"), "out");
check("پرداخت بدهی = خروج", kindDirection("debt_payment"), "out");
check("پرداخت قرض = خروج", kindDirection("loan_given"), "out");
check("درآمد = ورود", kindDirection("income"), "in");
check("دریافت طلب = ورود", kindDirection("claim_received"), "in");
check("دریافت بدهی = ورود", kindDirection("loan_received"), "in");

// ─── ۳) شخص‌دار بودن ───
check("هزینه شخص‌دار نیست", isPersonKind("expense"), false);
check("درآمد شخص‌دار نیست", isPersonKind("income"), false);
check("پرداخت بدهی شخص‌دار است", isPersonKind("debt_payment"), true);
check("دریافت طلب شخص‌دار است", isPersonKind("claim_received"), true);

// ─── ۴) انواع مجاز هر جهت ───
check("انواع جهت خروج", kindsOfDirection("out"), ["expense", "debt_payment", "loan_given"]);
check("انواع جهت ورود", kindsOfDirection("in"), ["income", "claim_received", "loan_received"]);
check("شخصی‌های جهت خروج", personKindsOfDirection("out"), ["debt_payment", "loan_given"]);
check("شخصی‌های جهت ورود", personKindsOfDirection("in"), ["claim_received", "loan_received"]);

// ─── ۵) تشخیص خودکار از علامت باقی‌مانده شخص (معیار: شخص + باقی‌مانده) ───
check("برداشت + بدهی داریم (منفی) = پرداخت بدهی", autoKind("out", -600000), "debt_payment");
check("برداشت + تسویه (صفر) = پرداخت قرض", autoKind("out", 0), "loan_given");
check("برداشت + طلب داریم (مثبت) = پرداخت قرض", autoKind("out", 400000), "loan_given");
check("واریز + طلب داریم (مثبت) = دریافت طلب", autoKind("in", 300000), "claim_received");
check("واریز + تسویه (صفر) = دریافت بدهی", autoKind("in", 0), "loan_received");
check("واریز + بدهی داریم (منفی) = دریافت بدهی", autoKind("in", -100000), "loan_received");

// ─── ۶) جمله توضیح شامل عنوان ───
check("جمله loan_given شامل پرداخت قرض", kindSentence("loan_given", "علی", "۱٬۰۰۰", "تومان").includes("«پرداخت قرض»"), true);
check("جمله debt_payment شامل پرداخت بدهی", kindSentence("debt_payment", "علی", "۱٬۰۰۰", "تومان").includes("«پرداخت بدهی»"), true);
check("جمله claim_received شامل دریافت طلب", kindSentence("claim_received", "علی", "۱٬۰۰۰", "تومان").includes("«دریافت طلب»"), true);
check("جمله loan_received شامل دریافت بدهی", kindSentence("loan_received", "علی", "۱٬۰۰۰", "تومان").includes("«دریافت بدهی»"), true);
check("جمله expense شامل هزینه", kindSentence("expense", "", "۵۰۰", "تومان").includes("«هزینه»"), true);
check("جمله income شامل درآمد", kindSentence("income", "", "۵۰۰", "تومان").includes("«درآمد»"), true);

// ─── ۷) نگاشت داده قدیمی ───
check("قدیمی: برداشت + طلبکار = پرداخت بدهی", legacyKind("expense", "creditor"), "debt_payment");
check("قدیمی: برداشت + بدهکار = پرداخت قرض", legacyKind("expense", "debtor"), "loan_given");
check("قدیمی: واریز + بدهکار = دریافت طلب", legacyKind("income", "debtor"), "claim_received");
check("قدیمی: واریز + طلبکار = دریافت بدهی", legacyKind("income", "creditor"), "loan_received");
check("قدیمی: بدون رکورد + خروج = هزینه", legacyKind("expense", null), "expense");
check("قدیمی: بدون رکورد + ورود = درآمد", legacyKind("income", null), "income");

// ─── ۸) txKindOf و txDirection با fallback ───
check("kind معتبر اولویت دارد", txKindOf({ kind: "loan_given", type: "expense", debtId: "p1" }), "loan_given");
check("بدون kind + شخص: fallback از debtType", txKindOf({ type: "income", debtId: "p1", debtType: "debtor" }), "claim_received");
check("بدون kind و بدون شخص: هزینه", txKindOf({ type: "expense" }), "expense");
check("جهت از kind", txDirection({ kind: "claim_received", type: "income" }), "in");
check("جهت از type قدیمی", txDirection({ type: "expense" }), "out");

// ─── ۹) کلید یکسان‌سازی اشخاص ───
check("علي عربی = علی فارسی", personKey("علي"), personKey("علی"));
check("فاصله اضافی حذف شود", personKey("  علی   محمدی "), personKey("علی محمدی"));
check("نام خالی", personKey(""), "");

// ─── ۱۰) باقی‌مانده شخص از تراکنش‌ها (معیار: مانده اولیه + گردش بدهی − گردش طلب) ───
// سناریو: به علی ۲ میلیون قرض دادم (خروج)، ۱ میلیونش را پس گرفته‌ام (ورود)
const s1 = summarizePersonFromTxns(0, [
  { amount: 2000000, kind: "loan_given", type: "expense" },
  { amount: 1000000, kind: "claim_received", type: "income" },
]);
check("گردش بدهی = پرداخت‌های به او", s1.turnDebt, 2000000);
check("گردش طلب = دریافت‌ها از او", s1.turnClaim, 1000000);
check("باقی‌مانده مثبت = طلب", s1.net, 1000000);
check("وضعیت = طلب", s1.status, "claim");
check("تعداد پرداخت ۱", s1.paidCount, 1);
check("تعداد دریافت ۱", s1.receivedCount, 1);

// سناریوی بدهی: از رضا ۱ میلیون گرفتم (ورود)، ۴۰۰ هزار پس دادم (خروج)
const s2 = summarizePersonFromTxns(0, [
  { amount: 1000000, kind: "loan_received", type: "income" },
  { amount: 400000, kind: "debt_payment", type: "expense" },
]);
check("باقی‌منفه منفی = بدهی", s2.net, -600000);
check("وضعیت = بدهی", s2.status, "debt");

// مانده اولیه: او از قبل ۵۰۰ هزار بدهکار بود (+۵۰۰) و هنوز تراکنشی نیست
const s3 = summarizePersonFromTxns(500000, []);
check("فقط مانده اولیه مثبت = طلب", [s3.net, s3.status], [500000, "claim"]);
// مانده اولیه منفی = بدهی اولیه
const s4 = summarizePersonFromTxns(-1500000, []);
check("مانده اولیه منفی = بدهی", [s4.net, s4.status], [-1500000, "debt"]);
// تسویه: مانده اولیه + گردش‌ها صفر
const s5 = summarizePersonFromTxns(300000, [
  { amount: 500000, kind: "loan_given", type: "expense" },
  { amount: 800000, kind: "claim_received", type: "income" },
]);
check("تسویه: باقی‌مانده صفر", [s5.net, s5.status], [0, "settled"]);
// بدون تراکنش و بدون مانده = تسویه
check("بدون هیچ چیزی = تسویه", summarizePersonFromTxns(0, []).status, "settled");
// fallback داده قدیمی (بدون kind): جهت از type
const s6 = summarizePersonFromTxns(0, [
  { amount: 700000, type: "expense", debtId: "p" },
  { amount: 200000, type: "income", debtId: "p" },
]);
check("fallback بدون kind: باقی‌مانده درست", s6.net, 500000);

// ─── ۱۱) مانده اولیه از رکورد قدیمی (مهاجرت بدون دوبارشماری) ───
// رکورد دستی خالص: بدهکار ۵۰۰ با هیچ تراکنش متصل → +۵۰۰ طلب اولیه
check("دستی بدهکار = +مانده", legacyOpeningBalance({ type: "debtor", amount: 500000, paidAmount: 0 }, []), 500000);
// رکورد دستی خالص: طلبکار ۱٬۵۰۰ با هیچ تراکنش → −۱٬۵۰۰ بدهی اولیه
check("دستی طلبکار = −مانده", legacyOpeningBalance({ type: "creditor", amount: 1500000, paidAmount: 0 }, []), -1500000);
// رکوردِ ساخته‌شده از تراکنش: قرض دادم ۲ میلیون (رکورد بدهکار ۲M) → مانده اولیه صفر (خود تراکنش حساب می‌شود)
check("رکورد تراکنشی → صفر", legacyOpeningBalance({ type: "debtor", amount: 2000000, paidAmount: 0 }, [{ amount: 2000000, kind: "loan_given", type: "expense" }]), 0);
// رکورد ترکیبی: بدهکار ۵M/۱M با خروج ۲M و ورود ۱M → دستی = ۵−۱−۲+۱ = +۳
check("ترکیبی: بخش دستی جدا می‌شود", legacyOpeningBalance({ type: "debtor", amount: 5000000, paidAmount: 1000000 }, [
  { amount: 2000000, kind: "loan_given", type: "expense" },
  { amount: 1000000, kind: "claim_received", type: "income" },
]), 3000000);
// رکوردِ ساخته‌شده از تراکنش: طلبکار — از او ۲M گرفتم (ورود) و ۲M پس دادم (خروج) → مانده اولیه صفر
check("رکورد تراکنشی طلبکار → صفر", legacyOpeningBalance({ type: "creditor", amount: 2000000, paidAmount: 2000000 }, [
  { amount: 2000000, kind: "loan_received", type: "income" },
  { amount: 2000000, kind: "debt_payment", type: "expense" },
]), 0);
// رکورد ترکیبی: بدهکار ۵M/۱M با خروج ۲M و ورود ۱M → دستی = ۵−۱−۲+۱ = +۳
check("ترکیبی: بخش دستی جدا می‌شود", legacyOpeningBalance({ type: "debtor", amount: 5000000, paidAmount: 1000000 }, [
  { amount: 2000000, kind: "loan_given", type: "expense" },
  { amount: 1000000, kind: "claim_received", type: "income" },
]), 3000000);
// طلبکار دستی ۱M + پرداخت تراکنشی ۴۰۰ → مانده اولیه = −۱M (خودِ پرداخت در گردش حساب می‌شود)
check("طلبکار با پرداخت جزئی", legacyOpeningBalance({ type: "creditor", amount: 1000000, paidAmount: 400000 }, [
  { amount: 400000, kind: "debt_payment", type: "expense" },
]), -1000000);
// جمع کل بعد از مهاجرت باید با مانده قدیمی برابر باشد: opening + گردش = مانده رکورد
const rec = { type: "debtor" as const, amount: 5000000, paidAmount: 1000000 };
const linked = [
  { amount: 2000000, kind: "loan_given" as TxKind, type: "expense" },
  { amount: 1000000, kind: "claim_received" as TxKind, type: "income" },
];
const opening = legacyOpeningBalance(rec, linked);
const after = summarizePersonFromTxns(opening, linked);
check("تساوی مانده قدیم و جدید (بدهکار)", after.net, 4000000);
// معادل طلبکار: بدهی دستی ۱M + پرداخت ۴۰۰ → مانده جدید = بدهی ۶۰۰ مثل قبل
const recC = { type: "creditor" as const, amount: 1000000, paidAmount: 400000 };
const linkedC = [{ amount: 400000, kind: "debt_payment" as TxKind, type: "expense" }];
const afterC = summarizePersonFromTxns(legacyOpeningBalance(recC, linkedC), linkedC);
check("تساوی مانده قدیم و جدید (طلبکار)", afterC.net, -600000);

// ─── ۱۲) تشخیص خودکار شخص از متن پیامک ───
const persons = [
  { id: "p1", name: "علی محمدی" },
  { id: "p2", name: "رضا کریمی" },
  { id: "p3", name: "مریم" },
];
check("نام کامل در متن", matchPersonInText(persons, "انتقال وجه به علی محمدی - ۲٬۰۰۰٬۰۰۰"), persons[0]);
check("نرمال‌سازی ي عربی", matchPersonInText(persons, "به علي محمدی واریز شد"), persons[0]);
check("توکن ۴+ حرفی نام", matchPersonInText(persons, "واریز از کریمی"), persons[1]);
check("نام کوتاه فقط با تطبیق کامل", matchPersonInText(persons, "مریم ۵۰۰ هزار"), persons[2]);
check("نام کوتاه ناقص تطبیق نمی‌کند", matchPersonInText(persons, "مری"), null);
check("هیچ نامی نیست", matchPersonInText(persons, "برداشت از خودپرداز"), null);
check("متن خالی", matchPersonInText(persons, ""), null);
check("لیست خالی", matchPersonInText([], "علی"), null);
check("مبهم: دو شخص هم‌طول", matchPersonInText([{ id: "a", name: "علی اکبر" }, { id: "b", name: "علی اصغر" }], "علی اکبر"), { id: "a", name: "علی اکبر" });
check("بلندترین نام برنده است", matchPersonInText([...persons, { id: "p4", name: "علی" }], "به علی محمدی پول دادم"), persons[0]);

console.log(`\nنتیجه: ${pass} موفق، ${failCount} ناموفق`);
if (failCount > 0) process.exit(1);
