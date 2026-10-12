// تست جستجوی فارسی (نرمال‌سازی متن برای جستجوی اشخاص) — اجرا: bun scripts/test-search.ts
import { normalizeSearch, searchTokens, matchesAllTokens } from "../src/lib/format";

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

// ─── ۱) نرمال‌سازی حروف ───
check("ي عربی → ی فارسی", normalizeSearch("علي"), "علی");
check("ى maksura → ی", normalizeSearch("على"), "علی");
check("ك عربی → ک فارسی", normalizeSearch("كرم"), "کرم");
check("أ/إ/آ → ا", normalizeSearch("أحمد آبان إيمان"), "احمد ابان ایمان");
check("ة → ه", normalizeSearch("فاطمة"), "فاطمه");

// ─── ۲) نرمال‌سازی ارقام ───
check("ارقام فارسی → لاتین", normalizeSearch("۰۹۱۲"), "0912");
check("ارقام عربی → لاتین", normalizeSearch("٠٩١٢"), "0912");
check("ترکیب حروف و ارقام", normalizeSearch("Ali۰۹"), "ali09");

// ─── ۳) فاصله‌ها و نیم‌فاصله ───
check("فاصله‌های اضافی", normalizeSearch("  علی   محمدی  "), "علی محمدی");
check("نیم‌فاصله → فاصله", normalizeSearch("لپ‌تاپ"), "لپ تاپ");
check("کاراکترهای جهت‌دهی حذف شوند", normalizeSearch("علی\u200fمحمدی"), "علی محمدی");
check("حروف لاتین کوچک شود", normalizeSearch("ReZA"), "reza");
check("ورودی خالی/ناموجود", normalizeSearch(undefined as never), "");

// ─── ۴) توکن‌های جستجو ───
check("توکن‌ها با فاصله اضافی", searchTokens("  علی   رضا "), ["علی", "رضا"]);
check("ورودی فقط فاصله → هیچ توکنی", searchTokens("   "), []);
check("توکن با ارقام فارسی", searchTokens("۰۹۱۲"), ["0912"]);

// ─── ۵) تطبیق چند‌توکنی (ترتیب کلمات مهم نیست) ───
const hay = "علی محمدی 09121234567 قرض خرید لپ تاپ";
check("همه توکن‌ها موجود", matchesAllTokens(hay, searchTokens("علی م")), true);
check("ترتیب برعکس هم پیدا شود", matchesAllTokens(hay, searchTokens("محمدی علی")), true);
check("جستجو با ي عربی روی متن فارسی", matchesAllTokens(hay, searchTokens("علي")), true);
check("جستجو با ارقام فارسی روی شماره لاتین", matchesAllTokens("09121234567", searchTokens("۰۹۱۲")), true);
check("شخص دیگر پیدا نشود", matchesAllTokens(hay, searchTokens("علی رضا")), false);
check("کلمه از توضیحات", matchesAllTokens(hay, searchTokens("لپ")), true);
check("توکن خالی = تطبیق همه", matchesAllTokens(hay, []), true);
check("جستجوی بدون نتیجه", matchesAllTokens(hay, searchTokens("رضا کریمی 0912")), false);

console.log(`\nنتیجه: ${pass} موفق، ${failCount} ناموفق`);
if (failCount > 0) process.exit(1);
