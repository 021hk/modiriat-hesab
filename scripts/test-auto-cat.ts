// تست‌های دسته‌بندی خودکار با مبلغ — bun scripts/test-auto-cat.ts
import {
  ruleMatchesAmount,
  matchAutoCatRule,
  validateAutoCatRuleInput,
  describeRule,
  type AutoCatRule,
} from "../src/lib/auto-cat";

let pass = 0;
let failCount = 0;
function eq(actual: unknown, expected: unknown, label: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
  } else {
    failCount++;
    console.error(`✗ ${label}\n  انتظار: ${e}\n  واقعی:  ${a}`);
  }
}

function rule(p: Partial<AutoCatRule> & { id: string }): AutoCatRule {
  return {
    label: null,
    flow: "expense",
    match: "exact",
    exact: null,
    min: null,
    max: null,
    categoryId: "c1",
    enabled: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...p,
  };
}

// ─── تطبیق عدد مشخص ───
const exactRule = rule({ id: "r1", match: "exact", exact: 5_000_000 }); // ۵۰۰ هزار تومان
eq(ruleMatchesAmount(exactRule, 5_000_000), true, "عدد مشخص — مبلغ برابر");
eq(ruleMatchesAmount(exactRule, 5_000_001), false, "عدد مشخص — یک ریال بیشتر");
eq(ruleMatchesAmount(exactRule, 4_999_999), false, "عدد مشخص — یک ریال کمتر");
eq(ruleMatchesAmount(exactRule, 0), false, "مبلغ صفر هرگز match نمی‌شود");
eq(ruleMatchesAmount(exactRule, -5_000_000), false, "مبلغ منفی match نمی‌شود");

// ─── تطبیق محدوده ───
const rangeRule = rule({ id: "r2", match: "range", min: 1_000_000, max: 9_999_999 }); // ۱۰۰ تا ۹۹۹ هزار تومان
eq(ruleMatchesAmount(rangeRule, 1_000_000), true, "محدوده — کران پایین شامل است");
eq(ruleMatchesAmount(rangeRule, 9_999_999), true, "محدوده — کران بالا شامل است");
eq(ruleMatchesAmount(rangeRule, 500_000), false, "محدوده — زیر کران پایین");
eq(ruleMatchesAmount(rangeRule, 10_000_000), false, "محدوده — بالای کران بالا");

const openMin = rule({ id: "r3", match: "range", min: 100_000_000, max: null });
eq(ruleMatchesAmount(openMin, 100_000_000), true, "محدوده باز — فقط از، شامل مرز");
eq(ruleMatchesAmount(openMin, 99_999_999), false, "محدوده باز — زیر مرز");
eq(ruleMatchesAmount(openMin, 10_000_000_000), true, "محدوده باز — بی‌نهایت بالا");

const openMax = rule({ id: "r4", match: "range", min: null, max: 50_000 });
eq(ruleMatchesAmount(openMax, 50_000), true, "محدوده باز — فقط تا، شامل مرز");
eq(ruleMatchesAmount(openMax, 50_001), false, "محدوده باز — بالای مرز");

eq(ruleMatchesAmount(rule({ id: "r5", match: "range", min: null, max: null }), 100), false, "محدوده بدون کران هرگز match نمی‌شود");

// ─── قانون غیرفعال و نامعتبر ───
eq(ruleMatchesAmount(rule({ id: "r6", enabled: false, match: "exact", exact: 100 }), 100), false, "قانون غیرفعال match نمی‌شود");
eq(ruleMatchesAmount(rule({ id: "r7", match: "exact", exact: 0 }), 0), false, "قانون با عدد صفر نامعتبر است");
eq(ruleMatchesAmount(rule({ id: "r8", flow: "weird" as never, match: "exact", exact: 100 }), 100), false, "جریان نامعتبر match نمی‌شود");

// ─── انتخاب اولین قانون برنده (اولویت ترتیب) ───
const rules = [
  rule({ id: "A", match: "exact", exact: 5_000_000, categoryId: "cat-A" }),
  rule({ id: "B", match: "range", min: 1_000_000, max: 9_999_999, categoryId: "cat-B" }),
  rule({ id: "C", flow: "income" as const, match: "range", min: 0 + 1, max: 999_999_999, categoryId: "cat-C" }),
];
eq(matchAutoCatRule(5_000_000, "expense", rules)?.id, "A", "اولویت — قانون اول برنده است");
eq(matchAutoCatRule(3_000_000, "expense", rules)?.id, "B", "قانون دوم برای مبلغ میان‌مایه");
eq(matchAutoCatRule(3_000_000, "income", rules)?.id, "C", "جریان درآمد قانون خودش را می‌گیرد");
eq(matchAutoCatRule(500, "expense", rules), null, "بدون تطبیق = null");
eq(matchAutoCatRule(3_000_000, "expense", null), null, "قوانین null = null");

// ─── دستهٔ حذف‌شده (validIds) ───
const valid = new Set(["cat-A", "cat-B"]);
eq(matchAutoCatRule(3_000_000, "expense", rules, valid)?.id, "B", "قانون با دستهٔ معتبر اعمال می‌شود");
const rulesDeleted = [
  rule({ id: "X", match: "range", min: 1, max: 100, categoryId: "cat-deleted" }),
  rule({ id: "Y", match: "range", min: 1, max: 100, categoryId: "cat-B" }),
];
eq(matchAutoCatRule(50, "expense", rulesDeleted, valid)?.id, "Y", "قانون با دستهٔ حذف‌شده نادیده گرفته می‌شود");

// ─── اعتبارسنجی ورودی ───
eq(typeof validateAutoCatRuleInput({ flow: "expense", match: "exact", exact: 100, categoryId: "c" }), "object", "ورودی معتبر exact");
eq(typeof validateAutoCatRuleInput({ flow: "income", match: "range", min: 10, max: 20, categoryId: "c" }), "object", "ورودی معتبر range");
eq(validateAutoCatRuleInput({ flow: "expense", match: "exact", exact: 0, categoryId: "c" }), "عدد مشخص باید بزرگ‌تر از صفر باشد", "exact صفر نامعتبر");
eq(validateAutoCatRuleInput({ flow: "expense", match: "exact", exact: 100 }), "انتخاب دسته الزامی است", "بدون دسته نامعتبر");
eq(validateAutoCatRuleInput({ flow: "expense", match: "range", min: 0, max: 0, categoryId: "c" }), "حداقل یکی از دو کران محدوده باید بزرگ‌تر از صفر باشد", "محدوده بدون کران نامعتبر");
eq(validateAutoCatRuleInput({ flow: "expense", match: "range", min: 30, max: 20, categoryId: "c" }), "کران پایین محدوده نباید از کران بالا بزرگ‌تر باشد", "ترتیب کران‌ها");
eq(validateAutoCatRuleInput({ flow: "x", match: "exact", exact: 10, categoryId: "c" }), "نوع قانون باید هزینه یا درآمد باشد", "جریان نامعتبر");
eq(validateAutoCatRuleInput({ flow: "expense", match: "regex", categoryId: "c" }), "حالت تطبیق باید «عدد مشخص» یا «محدوده» باشد", "حالت نامعتبر");

// ─── توصیف فارسی ───
const fmt = (rial: number) =>
  (rial / 10)
    .toLocaleString("en-US")
    .replace(/,/g, "٬")
    .replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
eq(describeRule(rule({ id: "d1", match: "exact", exact: 5_000_000 }), fmt, "تومان"), "هزینه دقیقاً ۵۰۰٬۰۰۰ تومان", "توصیف exact");
eq(
  describeRule(rule({ id: "d2", match: "range", min: 1_000_000, max: 9_990_000 }), fmt, "تومان"),
  "هزینه از ۱۰۰٬۰۰۰ تا ۹۹۹٬۰۰۰ تومان",
  "توصیف range دو کران"
);
eq(describeRule(rule({ id: "d3", match: "range", min: 100_000_000, max: null }), fmt, "تومان"), "هزینه از ۱۰٬۰۰۰٬۰۰۰ تومان به بالا", "توصیف فقط از");
eq(describeRule(rule({ id: "d4", flow: "income", match: "range", min: null, max: 50_000 }), fmt, "تومان"), "درآمد تا ۵٬۰۰۰ تومان", "توصیف فقط تا");

console.log(`\nنتیجه: ${pass} موفق، ${failCount} ناموفق`);
if (failCount > 0) process.exit(1);
