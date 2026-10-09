// تست ابزارهای جلالی و درخت دسته‌بندی — اجرا: bun scripts/test-jalali.ts
import {
  toJalali,
  toGregorian,
  jalaliMonthLength,
  isLeapJalaliYear,
  isoToJalali,
  jalaliPartsToIso,
  jalaliMonthBounds,
  JALALI_MONTH_NAMES,
} from "../src/lib/jalali";
import { buildCategoryTree, flattenCategoryTree, MAX_CATEGORY_DEPTH } from "../src/lib/category-tree";

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

// ─── ۱) لنگرهای شناخته‌شده ───
check("2025-03-21 → 1404/1/1", toJalali(2025, 3, 21), { jy: 1404, jm: 1, jd: 1 });
check("2026-03-21 → 1405/1/1", toJalali(2026, 3, 21), { jy: 1405, jm: 1, jd: 1 });
check("1404/1/1 → 2025-03-21", toGregorian(1404, 1, 1), { gy: 2025, gm: 3, gd: 21 });
check("1405/7/17 → 2026-10-09", toGregorian(1405, 7, 17), { gy: 2026, gm: 10, gd: 9 });
check("امروز 1405/7/17", (() => { const j = isoToJalali("2026-10-09T10:00:00.000Z"); return j.jy === 1405 && j.jm === 7 && j.jd === 17; })(), true);

// ─── ۲) رفت‌وبرگشت روی ~۴۰۰ سال ───
let rtOk = true;
for (let gy = 1900; gy <= 2300; gy += 3) {
  for (let gm = 1; gm <= 12; gm += 5) {
    const j = toJalali(gy, gm, 15);
    const g = toGregorian(j.jy, j.jm, j.jd);
    if (g.gy !== gy || g.gm !== gm || g.gd !== 15) {
      rtOk = false;
      console.log(`   roundtrip failed: ${gy}-${gm}-15 → ${j.jy}/${j.jm}/${j.jd} → ${g.gy}-${g.gm}-${g.gd}`);
    }
  }
}
check("رفت‌وبرگشت میلادی↔جلالی ۱۹۰۰..۲۳۰۰", rtOk, true);

// ─── ۳) طول ماه و سال کبیسه ───
check("ماه‌های ۱..۶ = ۳۱ روز", [1, 2, 3, 4, 5, 6].every((m) => jalaliMonthLength(1404, m) === 31), true);
check("ماه‌های ۷..۱۱ = ۳۰ روز", [7, 8, 9, 10, 11].every((m) => jalaliMonthLength(1404, m) === 30), true);
check("اسفند ۱۴۰۳ (کبیسه) = ۳۰", jalaliMonthLength(1403, 12), 30);
check("اسفند ۱۴۰۴ = ۲۹", jalaliMonthLength(1404, 12), 29);
check("۱۴۰۳ کبیسه است", isLeapJalaliYear(1403), true);
check("۱۴۰۴ کبیسه نیست", isLeapJalaliYear(1404), false);

// ─── ۴) گردش رفت‌وبرگشت روزهای اسفند (مرز کبیسه) ───
{
  const g = toGregorian(1403, 12, 30);
  const j = toJalali(g.gy, g.gm, g.gd);
  check("1403/12/30 رفت‌وبرگشت", j, { jy: 1403, jm: 12, jd: 30 });
}

// ─── ۵) jalaliPartsToIso رفت‌وبرگشت ───
{
  const iso = jalaliPartsToIso(1405, 7, 17, 14, 30);
  const d = new Date(iso);
  check("jalaliPartsToIso: ساعت/دقیقه", [d.getHours(), d.getMinutes()], [14, 30]);
  const j = isoToJalali(iso);
  check("jalaliPartsToIso: تاریخ", [j.jy, j.jm, j.jd], [1405, 7, 17]);
}

// ─── ۶) مرز ماه جلالی برای آمار ───
{
  // امروز میلادی 2026-10-09 → مهر ۱۴۰۴؛ آغاز مهر = 2026-09-23
  const b = jalaliMonthBounds(new Date(2026, 9, 9, 15, 0));
  const cur = [b.currentStart.getFullYear(), b.currentStart.getMonth() + 1, b.currentStart.getDate()];
  check("آغاز مهر ۱۴۰۴ = 2026-09-23", cur, [2026, 9, 23]);
  const prev = [b.prevStart.getFullYear(), b.prevStart.getMonth() + 1, b.prevStart.getDate()];
  check("آغاز شهریور ۱۴۰۴ = 2026-08-23", prev, [2026, 8, 23]);
  // فروردین: ماه قبل = اسفند سال قبل
  {
    const g5 = toGregorian(1404, 1, 5);
    const b2 = jalaliMonthBounds(new Date(g5.gy, g5.gm - 1, g5.gd, 12));
    check("آغاز فروردین = نوروز ۲۱ مارس", [b2.currentStart.getMonth() + 1, b2.currentStart.getDate()], [3, 21]);
    check("ماه قبل فروردین = اسفند ۱۴۰۳ (2025-02-19)", [b2.prevStart.getFullYear(), b2.prevStart.getMonth() + 1, b2.prevStart.getDate()], [2025, 2, 19]);
  }
}

check("نام ماه‌ها ۱۲ تا", JALALI_MONTH_NAMES.length, 12);

// ─── ۷) درخت دسته‌بندی ───
const cats = [
  { id: "a", name: "خواربار", parentId: null, allowSub: true },
  { id: "a1", name: "میوه", parentId: "a", allowSub: true },
  { id: "a1x", name: "تابستانه", parentId: "a1" },
  { id: "b", name: "اجاره", parentId: null, allowSub: false },
] as never[];
const tree = buildCategoryTree(cats);
check("ریشه‌ها: خواربار، اجاره", tree.map((n) => n.category.id), ["a", "b"]);
check("خواربار یک فرزند دارد", tree[0].children.length, 1);
check("میوه یک نوه دارد", tree[0].children[0].children.length, 1);
const flat = flattenCategoryTree(cats);
check("ترتیب DFS", flat.map((f) => f.category.id), ["a", "a1", "a1x", "b"]);
check("عمق‌ها", flat.map((f) => f.depth), [1, 2, 3, 1]);
check("حداکثر عمق مجاز = ۴", MAX_CATEGORY_DEPTH, 4);
check("برچسب تودرتو", flat.map((f) => f.label.trim()), ["خواربار", "— میوه", "— — تابستانه", "اجاره"]);

console.log(`\nنتیجه: ${pass} موفق، ${failCount} ناموفق`);
if (failCount > 0) process.exit(1);
