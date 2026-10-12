// تست ابزارهای بدهی/طلب (عنوان خودکار، تشخیص خودکار، گردش اشخاص) — اجرا: bun scripts/test-debt-utils.ts
import {
  debtLinkLabel,
  debtRemaining,
  autoDetectDebtMode,
  sideOfMode,
  debtModeSentence,
  personKey,
  summarizePerson,
  type DebtLike,
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

function rec(type: "debtor" | "creditor", amount: number, paidAmount = 0, isSettled = false): DebtLike {
  return { type, amount, paidAmount, isSettled };
}

// ─── ۱) برچسب خودکار از نوع تراکنش + نوع رکورد ───
check("برداشت + رکورد طلبکار = پرداخت بدهی", debtLinkLabel("expense", "creditor"), "پرداخت بدهی");
check("برداشت + رکورد بدهکار = پرداخت قرض", debtLinkLabel("expense", "debtor"), "پرداخت قرض");
check("واریز + رکورد بدهکار = دریافت طلب", debtLinkLabel("income", "debtor"), "دریافت طلب");
check("واریز + رکورد طلبکار = دریافت بدهی", debtLinkLabel("income", "creditor"), "دریافت بدهی");
check("بدون اتصال = بدون عنوان", debtLinkLabel("expense", null), null);
check("بدون نوع = بدون عنوان", debtLinkLabel("income", undefined), null);

// ─── ۲) مانده رکورد ───
check("مانده معمولی", debtRemaining({ amount: 5000, paidAmount: 2000 }), 3000);
check("مانده هرگز منفی نشود", debtRemaining({ amount: 1000, paidAmount: 3000 }), 0);
check("مانده صفر", debtRemaining({ amount: 0, paidAmount: 0 }), 0);

// ─── ۳) تشخیص خودکار حالت اتصال ───
check("برداشت + به او بدهکارم = پرداخت بدهی (repay)", autoDetectDebtMode("expense", [rec("creditor", 1000000, 0)]), "repay");
check("برداشت + بدون رکورد = پرداخت قرض (lend)", autoDetectDebtMode("expense", []), "lend");
check("برداشت + او به من بدهکار است = پرداخت قرض (lend)", autoDetectDebtMode("expense", [rec("debtor", 500000)]), "lend");
check("واریز + او به من بدهکار است = دریافت طلب (collect)", autoDetectDebtMode("income", [rec("debtor", 2000000, 500000)]), "collect");
check("واریز + بدون رکورد = دریافت بدهی (borrow)", autoDetectDebtMode("income", []), "borrow");
check("واریز + فقط طلبکار = دریافت بدهی (borrow)", autoDetectDebtMode("income", [rec("creditor", 800000)]), "borrow");
check("رکورد تسویه‌شده نادیده گرفته می‌شود", autoDetectDebtMode("expense", [rec("creditor", 100, 100, true)]), "lend");
check("رکورد مانده‌صفر نادیده گرفته می‌شود", autoDetectDebtMode("income", [rec("debtor", 100, 100)]), "borrow");
check("هر دو رکورد باز: برداشت اولویت پرداخت بدهی", autoDetectDebtMode("expense", [rec("debtor", 100), rec("creditor", 50)]), "repay");
check("هر دو رکورد باز: واریز اولویت دریافت طلب", autoDetectDebtMode("income", [rec("debtor", 100), rec("creditor", 50)]), "collect");

// ─── ۴) تناظر حالت ↔ نوع رکورد ───
check("lend → بدهکار", sideOfMode("lend"), "debtor");
check("collect → بدهکار", sideOfMode("collect"), "debtor");
check("repay → طلبکار", sideOfMode("repay"), "creditor");
check("borrow → طلبکار", sideOfMode("borrow"), "creditor");

// ─── ۵) جمله توضیح شامل عنوان خودکار ───
check("جمله repay شامل پرداخت بدهی", debtModeSentence("repay", "علی", "۱٬۰۰۰٬۰۰۰", "تومان").includes("«پرداخت بدهی»"), true);
check("جمله lend شامل پرداخت قرض", debtModeSentence("lend", "علی", "۱٬۰۰۰٬۰۰۰", "تومان").includes("«پرداخت قرض»"), true);
check("جمله collect شامل دریافت طلب", debtModeSentence("collect", "علی", "۱٬۰۰۰٬۰۰۰", "تومان").includes("«دریافت طلب»"), true);
check("جمله borrow شامل دریافت بدهی", debtModeSentence("borrow", "علی", "۱٬۰۰۰٬۰۰۰", "تومان").includes("«دریافت بدهی»"), true);
check("جمله نام شخص را دارد", debtModeSentence("collect", "علی محمدی", "۱", "تومان").includes("علی محمدی"), true);

// ─── ۶) کلید یکسان‌سازی اشخاص ───
check("علي عربی = علی فارسی", personKey("علي"), personKey("علی"));
check("فاصله اضافی حذف شود", personKey("  علی   محمدی "), personKey("علی محمدی"));
check("نام خالی", personKey(""), "");

// ─── ۷) تجمیع گردش یک شخص ───
// سناریوی کاربر: به علی ۲ میلیون قرض دادم، ۱ میلیونش را پس گرفته‌ام
const s1 = summarizePerson([rec("debtor", 2000000, 1000000)]);
check("گردش طلب = کل قرض داده‌شده", s1.turnClaim, 2000000);
check("گردش بدهی = صفر", s1.turnDebt, 0);
check("مانده طلب", s1.remainClaim, 1000000);
check("وضعیت = طلب", s1.status, "claim");

// سناریوی دوطرفه: هم قرض داده‌ام هم گرفته‌ام
const s2 = summarizePerson([rec("debtor", 2000000, 2000000), rec("creditor", 5000000, 1000000)]);
check("دو طرفه: گردش طلب", s2.turnClaim, 2000000);
check("دو طرفه: گردش بدهی", s2.turnDebt, 5000000);
check("دو طرفه: مانده طلب صفر", s2.remainClaim, 0);
check("دو طرفه: مانده بدهی", s2.remainDebt, 4000000);
check("دو طرفه: وضعیت = بدهی", s2.status, "debt");

// تسویه کامل
const s3 = summarizePerson([rec("debtor", 300, 300)]);
check("تسویه کامل: مانده‌ها صفر", [s3.remainClaim, s3.remainDebt], [0, 0]);
check("تسویه کامل: وضعیت تسویه", s3.status, "settled");

// بدون رکورد
check("بدون رکورد: وضعیت none", summarizePerson([]).status, "none");

// برابری مانده‌ها = متعادل/تسویه
const s4 = summarizePerson([rec("debtor", 100, 40), rec("creditor", 100, 40)]);
check("مانده برابر = تسویه", s4.status, "settled");

console.log(`\nنتیجه: ${pass} موفق، ${failCount} ناموفق`);
if (failCount > 0) process.exit(1);
