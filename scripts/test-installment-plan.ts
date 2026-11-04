// تست منطق قسط‌بندی وام (v2.14.2) — اجرا: bun scripts/test-installment-plan.ts
// فقط توابع خالص: computeInstallmentAmounts، jalaliMonthAdd، buildPlanRows، planSummary

import {
  computeInstallmentAmounts,
  jalaliMonthAdd,
  buildPlanRows,
  planSummary,
  toPersianDigits,
} from "../src/lib/installment-plan";
import { isoToJalali, toGregorian, jalaliMonthLength } from "../src/lib/jalali";

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

// ─── computeInstallmentAmounts ───

// بدون سود: همه برابر
const zero = computeInstallmentAmounts(12_000_000, 12, 0, "nozoli");
check("بدون سود — ۱۲ قسط ۱٬۰۰۰٬۰۰۰", zero, Array(12).fill(1_000_000));

// نزولی: اصل ۱۲M، ۱۲ قسط، ۱۲٪ سالانه → ماهانه ۱٪ روی مانده (۱٪ از ۱۲M = ۱۲۰٬۰۰۰)
const nozoli = computeInstallmentAmounts(12_000_000, 12, 12, "nozoli");
check("نزولی — قسط اول ۱٬۱۲۰٬۰۰۰", nozoli[0], 1_120_000);
check("نزولی — قسط دوم ۱٬۱۱۰٬۰۰۰", nozoli[1], 1_110_000);
check("نزولی — قسط آخر ۱٬۰۱۰٬۰۰۰", nozoli[11], 1_010_000);
check("نزولی — جمع سود ۷۸۰٬۰۰۰", nozoli.reduce((s, x) => s + x, 0), 12_780_000);
check("نزولی — نزولی است", nozoli.every((x, i) => i === 0 || x <= nozoli[i - 1]), true);

// ثابت: سود کل = ۱۲M × ۱٪ × ۱۲ = ۱٬۴۴۰٬۰۰۰ → هر قسط ۱٬۱۲۰٬۰۰۰
const sabet = computeInstallmentAmounts(12_000_000, 12, 12, "sabet");
check("ثابت — همه برابر ۱٬۱۲۰٬۰۰۰", sabet, Array(12).fill(1_120_000));
check("ثابت — جمع کل ۱۳٬۴۴۰٬۰۰۰", sabet.reduce((s, x) => s + x, 0), 13_440_000);

// سعودی: آینهٔ نزولی — همان جمع
const soudi = computeInstallmentAmounts(12_000_000, 12, 12, "soudi");
check("سعودی — قسط اول کوچک‌تر", soudi[0], 1_010_000);
check("سعودی — قسط آخر بزرگ‌تر", soudi[11], 1_120_000);
check("سعودی — جمع با نزولی برابر", soudi.reduce((s, x) => s + x, 0), 12_780_000);
check("سعودی — سعودی است", soudi.every((x, i) => i === 0 || x >= soudi[i - 1]), true);

// گرد کردن: اختلاف روی قسط آخر — ۱۰M در ۳ قسط
const round = computeInstallmentAmounts(10_000_000, 3, 0, "sabet");
check("گرد کردن — دو قسط ۳٬۳۳۳٬۳۳۳", [round[0], round[1]], [3_333_333, 3_333_333]);
check("گرد کردن — قسط آخر ۳٬۳۳۳٬۳۳۴", round[2], 3_333_334);
check("گرد کردن — جمع دقیق", round.reduce((s, x) => s + x, 0), 10_000_000);

// ورودی نامعتبر
check("ورودی صفر → خالی", computeInstallmentAmounts(0, 12, 10, "nozoli"), []);
check("تعداد صفر → خالی", computeInstallmentAmounts(1_000_000, 0, 10, "nozoli"), []);

// تک‌قسط با سود: یک ماه سود
check("تک‌قسط — اصل + یک ماه سود", computeInstallmentAmounts(1_000_000, 1, 12, "nozoli"), [1_010_000]);

// ─── jalaliMonthAdd ───

check("یک ماه بعد", jalaliMonthAdd(1404, 8, 15, 1), { jy: 1404, jm: 9, jd: 15 });
check("پرش سال", jalaliMonthAdd(1404, 12, 15, 2), { jy: 1405, jm: 2, jd: 15 });
check("کلamp روز ۳۱ به مهرِ ۳۰روزه", jalaliMonthAdd(1404, 6, 31, 1), { jy: 1404, jm: 7, jd: 30 });
// ۳۰ بهمن + ۱ ماه = ۳۰ اسفندِ ۱۴۰۴ (۲۹روزه) → به آخرین روز اسفند کم می‌شود
check("کلamp اسفند", jalaliMonthAdd(1404, 11, 30, 1), { jy: 1404, jm: 12, jd: Math.min(30, jalaliMonthLength(1404, 12)) });
// ۳۰ اسفند + ۱ ماه = ۳۰ فروردین (۳۱روزه) — بدون تغییر
check("۳۰ اسفند → ۳۰ فروردین", jalaliMonthAdd(1404, 12, 30, 1), { jy: 1405, jm: 1, jd: 30 });
check("۱۲ ماه بعد — همان روز سال بعد", jalaliMonthAdd(1404, 3, 20, 12), { jy: 1405, jm: 3, jd: 20 });

// ─── buildPlanRows ───

// سررسید اول: ۱۵ آبان ۱۴۰۴ (میلادی ≈ 2025-11-06) — از تقویم واقعی می‌سازیم
const g0 = toGregorian(1404, 8, 15);
const firstIso = new Date(g0.gy, g0.gm - 1, g0.gd, 12, 0, 0, 0).toISOString();
const rows = buildPlanRows({
  title: "وام مسکن",
  principal: 35_000_000,
  count: 35,
  annualRatePct: 23,
  rateType: "nozoli",
  firstDueDate: firstIso,
});

check("۳۵ قسط ساخته شد", rows.length, 35);
check("عنوان قسط اول", rows[0].title, "وام مسکن (قسط ۱ از ۳۵)");
check("عنوان قسط آخر", rows[34].title, "وام مسکن (قسط ۳۵ از ۳۵)");
check("سررسید اول ۱۵ آبان", isoToJalali(rows[0].dueDate), { jy: 1404, jm: 8, jd: 15 });
check("سررسید دوم ۱۵ آذر", isoToJalali(rows[1].dueDate), { jy: 1404, jm: 9, jd: 15 });
// ۳۴ ماه بعد از آبان ۱۴۰۴ → تیر ۱۴۰۷
check("سررسید آخر تیر ۱۴۰۷", isoToJalali(rows[34].dueDate), { jy: 1407, jm: 6, jd: 15 });
check("همهٔ سررسیدها روز ۱۵ ماه جلالی‌اند", rows.every((r) => isoToJalali(r.dueDate).jd === 15), true);
const dates = rows.map((r) => new Date(r.dueDate).getTime());
check("سررسیدها صعودی و یکتا", dates.every((d, i) => i === 0 || d > dates[i - 1]), true);
check("شماره‌ها ۱ تا ۳۵", rows[0].index === 1 && rows[34].index === 35, true);
const sum = rows.reduce((s, r) => s + r.amount, 0);
check("جمع اقساط > اصل (سود ۲۳٪)", sum > 35_000_000, true);
check("جمع اقساط منطقی (۲۳٪ سالانه، ~۳ سال)", sum < 35_000_000 * 1.5, true);

// طرح تک‌قسط — بدون پسوند عنوان
const single = buildPlanRows({
  title: "بدهی دوست",
  principal: 5_000_000,
  count: 1,
  annualRatePct: 0,
  rateType: "sabet",
  firstDueDate: firstIso,
});
check("تک‌قسط — عنوان ساده", single[0].title, "بدهی دوست");
check("تک‌قسط — مبلغ کامل", single[0].amount, 5_000_000);

// تاریخ نامعتبر → خالی
check("تاریخ خراب → خالی", buildPlanRows({ title: "x", principal: 1, count: 2, annualRatePct: 0, rateType: "sabet", firstDueDate: "nope" }), []);

// ─── planSummary ───

const s = planSummary(computeInstallmentAmounts(12_000_000, 12, 12, "nozoli"), 12_000_000);
check("خلاصه — تعداد", s.count, 12);
check("خلاصه — جمع پرداخت", s.totalPayable, 12_780_000);
check("خلاصه — جمع سود", s.totalInterest, 780_000);
check("خلاصه — اول و آخر", [s.first, s.last], [1_120_000, 1_010_000]);
check("خلاصه — کمترین/بیشترین", [s.min, s.max], [1_010_000, 1_120_000]);

// ─── toPersianDigits ───

check("ارقام فارسی", toPersianDigits(35), "۳۵");

console.log(`\nنتایج: ${pass} درست، ${failCount} غلط`);
if (failCount > 0) process.exit(1);
