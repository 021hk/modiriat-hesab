// تست تم‌های رنگی (v2.14.3) — اجرا: bun scripts/test-theme.ts
// اعتبارسنجی رجیستری تم‌ها و توابع خالص خواندن/اعتبارسنجی

import {
  ACCENTS,
  ACCENT_IDS,
  SPECIALS,
  SPECIAL_IDS,
  THEME_BOOT_SCRIPT,
  isGalaxySpecial,
  parseAccent,
  parseSpecial,
  type AccentId,
} from "../src/lib/theme";

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

// رجیستری: ۵ رنگ + ۳ تم ویژه (کهکشانی واحد خودکار — v2.15)، شناسه‌ها یکتا
check("تعداد رنگ‌ها", ACCENTS.length, 5);
check("تعداد تم‌های ویژه", SPECIALS.length, 3);
check("شناسه‌های یکتا", new Set(ACCENT_IDS).size, ACCENT_IDS.length);
check("شناسه‌های ویژه یکتا", new Set(SPECIAL_IDS).size, SPECIAL_IDS.length);
check("swatch hex معتبر", ACCENTS.every((a) => /^#[0-9a-f]{6}$/i.test(a.swatch)), true);
check("برچسب فارسی غیرخالی", ACCENTS.every((a) => a.label.length > 0) && SPECIALS.every((s) => s.label.length > 0), true);

// اعتبارسنجی ورودی
check("parseAccent درست", parseAccent("banafsh"), "banafsh");
check("parseAccent نامعتبر", parseAccent("hacker"), null);
check("parseAccent غیررشته", parseAccent(42), null);
check("parseSpecial درست", parseSpecial("kahkeshani"), "kahkeshani");
// مهاجرت v2.15: تم کهکشانی روز نسخهٔ قبل → کهکشانی واحد (خودکار شب/روز)
check("مهاجرت کهکشانی روز", parseSpecial("kahkeshani-rooz"), "kahkeshani");
check("parseSpecial نامعتبر", parseSpecial("dark"), null);

// کهکشانی واحد (v2.15)
check("کهکشانی جزو خانوادهٔ کهکشان", isGalaxySpecial("kahkeshani"), true);
check("مشکی جزو کهکشان نیست", isGalaxySpecial("meshki"), false);
check("معمولی جزو کهکشان نیست", isGalaxySpecial("none"), false);
check("بدون تم", isGalaxySpecial(null), false);

// اسکریپت بوت باید attribute های درست را بگذارد و در برابر کوتیشن امن باشد
check("بوت: کلید accent", THEME_BOOT_SCRIPT.includes("hesab-yar:accent"), true);
check("بوت: کلید special", THEME_BOOT_SCRIPT.includes("hesab-yar:special"), true);
check("بوت: data-accent", THEME_BOOT_SCRIPT.includes("data-accent"), true);
check("بوت: data-special", THEME_BOOT_SCRIPT.includes("data-special"), true);
check("بوت: بدون کوتیشن مضاعف خطرناک", !THEME_BOOT_SCRIPT.includes('"'), true);
// بوت باید مقدار قدیمی کهکشانی روز را به کهکشانی عادی تبدیل کند
check("بوت: مهاجرت کهکشانی روز", THEME_BOOT_SCRIPT.includes("kahkeshani-rooz"), true);

// نوع‌ها درست سر جای خودشان باشند (compile-time check در زمان اجرا)
const ids: readonly AccentId[] = ACCENT_IDS;
check("AccentId سازگار", ids.length, 5);

console.log(`\nنتیجه: ${pass} درست، ${failCount} غلط`);
process.exit(failCount > 0 ? 1 : 0);
