// تست منطق اقساط و چک‌ها (v2.14) — اجرا: bun scripts/test-installments.ts
// فقط توابع خالص: computeNotifyAt، installmentNotifId، planInstallmentNotifications، daysUntilDue، buildNotifText
import {
  computeNotifyAt,
  installmentNotifId,
  planInstallmentNotifications,
  daysUntilDue,
  buildNotifText,
  numberToPersian,
  type InstallmentLike,
} from "../src/lib/notifications";

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

// زمان ثابت مرجع: 1404/08/13 میلادی ≈ 2024-11-03T06:00Z — برای سادگی از Date محلی استفاده می‌کنیم
const NOW = new Date(2026, 9, 12, 12, 0, 0).getTime(); // 12 اکتبر 2026 ساعت 12 محلی

// ─── computeNotifyAt ───

// سررسید ۲۰ مهر روز بعد (۸ روز دیگر)، daysBefore=2، ساعت 9
const dueIn8Days = new Date(NOW + 8 * 864e5).getTime();
const notify = computeNotifyAt(dueIn8Days, NOW, 2, 9);
check("اعلان ۲ روز قبل از سررسید", notify != null && notify < dueIn8Days, true);
const expectedHour = notify != null ? new Date(notify).getHours() : -1;
check("ساعت اعلان = ۹", expectedHour, 9);
const daysDiff = notify != null ? Math.round((new Date(dueIn8Days).setHours(0, 0, 0, 0) - new Date(notify).setHours(0, 0, 0, 0)) / 864e5) : -1;
check("فاصلهٔ اعلان تا سررسید = ۲ روز", daysDiff, 2);

// زمان اعلان گذشته ولی سررسید آینده → همان حالا + ۱ دقیقه
const dueTomorrow = new Date(NOW + 1 * 864e5).getTime();
const notify2 = computeNotifyAt(dueTomorrow, NOW, 2, 9);
check("اعلان برای سررسید فردا (زمان اعلان گذشته) → همین حالا", notify2 != null && notify2 > NOW && notify2 - NOW <= 120000, true);

// سررسید گذشته → بدون اعلان
check("سررسید گذشته → null", computeNotifyAt(NOW - 864e5, NOW, 2, 9), null);

// سررسید امروز → اعلان فوری (زمان اعلان امروز ساعت ۹ گذشته)
const dueToday = new Date(NOW + 2 * 3600e3).getTime(); // ۲ ساعت دیگر
const notify3 = computeNotifyAt(dueToday, NOW, 2, 9);
check("سررسید امروز → اعلان فوری", notify3 != null && notify3 > NOW && notify3 - NOW <= 120000, true);

// hour نامعتبر → clamp
const notify4 = computeNotifyAt(dueIn8Days, NOW, 2, 99);
check("ساعت نامعتبر → clamp به ۲۳", notify4 != null ? new Date(notify4).getHours() : -1, 23);

// daysBefore صفر → اعلان در روز سررسید ساعت ۹
const notify5 = computeNotifyAt(dueIn8Days, NOW, 0, 9);
const dd5 = notify5 != null ? Math.round((new Date(dueIn8Days).setHours(0, 0, 0, 0) - new Date(notify5).setHours(0, 0, 0, 0)) / 864e5) : -1;
check("daysBefore=۰ → روز سررسید", dd5, 0);

// ─── installmentNotifId ───

const id1 = installmentNotifId("abc-123");
const id2 = installmentNotifId("abc-123");
const id3 = installmentNotifId("other");
check("شناسه اعلان پایدار", id1, id2);
check("شناسه اعلان متفاوت برای قسط متفاوت", id1 !== id3, true);
check("شناسه اعلان ۳۱ بیتی مثبت", id1 > 0 && id1 <= 0x7fffffff, true);

// ─── daysUntilDue ───

check("امروز = ۰", daysUntilDue(new Date(NOW).getTime(), NOW), 0);
check("فردا = ۱", daysUntilDue(NOW + 864e5, NOW), 1);
check("دیروز = -۱", daysUntilDue(NOW - 864e5, NOW), -1);

// ─── planInstallmentNotifications ───

const fmt = (rial: number) => String(Math.round(rial)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const insts: InstallmentLike[] = [
  { id: "a", title: "قسط وام مسکن", kind: "installment", amount: 5000000, dueDate: new Date(NOW + 5 * 864e5).toISOString(), paid: false },
  { id: "b", title: "چک اجاره", kind: "check", amount: 12000000, dueDate: new Date(NOW + 2 * 864e5).toISOString(), paid: false },
  { id: "c", title: "پرداخت‌شده", kind: "installment", amount: 1000000, dueDate: new Date(NOW + 1 * 864e5).toISOString(), paid: true },
  { id: "d", title: "سررسید گذشته", kind: "installment", amount: 1000000, dueDate: new Date(NOW - 3 * 864e5).toISOString(), paid: false },
];

const plans = planInstallmentNotifications(insts, { enabled: true, daysBefore: 2, hour: 9 }, NOW, fmt);
check("فقط ۲ قسط آیندهٔ پرداخت‌نشده اعلان دارند", plans.length, 2);
check("ترتیب: نزدیک‌ترین اول", plans[0].body.includes("چک اجاره"), true);
check("شناسه اعلان عددی مثبت", plans.every((p) => p.id > 0), true);
check("متن اعلان شامل عنوان", plans.every((p) => p.body.includes("«")), true);

// خاموش → هیچ
check("یادآور خاموش → بدون اعلان", planInstallmentNotifications(insts, { enabled: false, daysBefore: 2, hour: 9 }, NOW, fmt).length, 0);

// daysBefore=7 → باز هم همان ۲ تا (هر دو در بازهٔ ۷ روزه)
check("daysBefore=۷ → باز ۲ اعلان", planInstallmentNotifications(insts, { enabled: true, daysBefore: 7, hour: 9 }, NOW, fmt).length, 2);

// ─── buildNotifText ───

const txt = buildNotifText({ id: "x", title: "قسط وام", kind: "installment", amount: 2500000 }, 2, fmt);
check("عنوان اعلان", txt.title, "⏰ یادآور قسط");
check("متن اعلان ۲ روز قبل", txt.body.includes("۲ روز قبل") && txt.body.includes("قسط وام"), true);
const txtChk = buildNotifText({ id: "x", title: "چک اجاره", kind: "check", amount: 1 }, 1, fmt);
check("عنوان اعلان چک", txtChk.title, "⏰ یادآور چک");

// ─── numberToPersian ───

check("تبدیل عدد به فارسی", numberToPersian(7), "۷");

console.log(`\nنتایج: ${pass} درست، ${failCount} غلط`);
if (failCount > 0) process.exit(1);
