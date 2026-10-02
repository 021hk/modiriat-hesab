// تست پارسر پیامک بانکی — اجرا: bun scripts/test-sms-parser.ts
import { parseBankSms, normalizeDigits } from "../src/lib/sms-parser";

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

// ─── ۱) نمونه واقعی کاربر (فرمت ساختاری عددی) ───
const userSms = "777.888.13972872.1\n-473,000\n07/10_02:10\nمانده: 66,663,400";
const r1 = parseBankSms(userSms);
check("نمونه کاربر: نوع = برداشت", r1.type, "expense");
check("نمونه کاربر: مبلغ = 473000", r1.amount, 473000);
check("نمونه کاربر: موجودی = 66663400", r1.balance, 66663400);
check("نمونه کاربر: واحد = ریال (پیش‌فرض)", r1.unit, null);
check("نمونه کاربر: شناسه حساب", r1.accountRef, "777.888.13972872.1");
check("نمونه کاربر: ۴ رقم آخر = 2872", r1.cardTail, "2872");
check("نمونه کاربر: اطمینان ≥ 0.85 (ثبت خودکار)", r1.confidence >= 0.85, true);

// ─── ۲) نمونه کاربر با ارقام فارسی ───
const r2 = parseBankSms("۷۷۷.۸۸۸.۱۳۹۷۲۸۷۲.۱\n−۴۷۳,۰۰۰\n۰۷/۱۰_۰۲:۱۰\nمانده: ۶۶,۶۶۳,۴۰۰");
check("نمونه کاربر فارسی: نوع = برداشت", r2.type, "expense");
check("نمونه کاربر فارسی: مبلغ = 473000", r2.amount, 473000);

// ─── ۳) کلیدواژه‌دار کلاسیک ───
const r3 = parseBankSms("بانک ملت: برداشت مبلغ 500,000 ریال از حساب 1234 بابت خرید");
check("ملت برداشت: نوع", r3.type, "expense");
check("ملت برداشت: مبلغ", r3.amount, 500000);
check("ملت برداشت: بانک", r3.bankName, "ملت");
check("ملت برداشت: واحد", r3.unit, "rial");

// ─── ۴) واریز ───
const r4 = parseBankSms("بانک ملی: واریز به مبلغ 1,200,000 ریال شبا IR1205700282801 موجودی: 5,432,100");
check("ملی واریز: نوع", r4.type, "income");
check("ملی واریز: مبلغ", r4.amount, 1200000);
check("ملی واریز: موجودی", r4.balance, 5432100);

// ─── ۵) واریز + بابت خرید (اولین کلیدواژه برنده است) ───
const r5 = parseBankSms("واریز 300,000 ریال بابت خرید شما ثبت شد");
check("واریز بابت خرید: نوع = درآمد", r5.type, "income");

// ─── ۶) کارت به کارت با شماره کارت ───
const r6 = parseBankSms("بانک صادرات: کارت به کارت 2,500,000 ریال از کارت 6037-9971-1234-5678 مانده: 12,340,000");
check("صادرات کارت‌به‌کارت: نوع", r6.type, "expense");
check("صادرات کارت‌به‌کارت: مبلغ", r6.amount, 2500000);
check("صادرات کارت‌به‌کارت: ۴ رقم آخر", r6.cardTail, "5678");

// ─── ۷) ساختاری بدون علامت → نامطمئن (صف بررسی) ───
const r7 = parseBankSms("9876543.2\n473,000\n07/10_02:10\nمانده: 66,663,400");
check("بدون علامت: مبلغ پیدا شود", r7.amount, 473000);
check("بدون علامت: نوع نامشخص", r7.type, "unknown");
check("بدون علامت: اطمینان < 0.85", r7.confidence < 0.85, true);

// ─── ۸) فرمت تومان ───
const r8 = parseBankSms("بانک سامان: برداشت مبلغ 250,000 تومان");
check("سامان تومان: واحد", r8.unit, "toman");
check("سامان تومان: مبلغ", r8.amount, 250000);

// ─── ۹) فرمت فارسی منفی آخر خط ───
const r9 = parseBankSms("777.888.13972872.1\n473,000-\nمانده: 66,663,400");
check("منفی آخر خط: نوع = برداشت", r9.type, "expense");
check("منفی آخر خط: مبلغ", r9.amount, 473000);

// ─── ۱۰) فقط موجودی بدون مبلغ تراکنش ───
const r10 = parseBankSms("777.888.13972872.1\nمانده: 66,663,400");
check("فقط موجودی: بدون مبلغ", r10.amount, null);
check("فقط موجودی: موجودی درست", r10.balance, 66663400);

// ─── ۱۱) خط موجودی جدا (عدد در خط بعد از مانده) ───
const r11 = parseBankSms("مانده:\n66,663,400\n-100,000");
check("مانده جدا: مبلغ = برداشت 100000", r11.amount, 100000);
check("مانده جدا: موجودی درست", r11.balance, 66663400);

// ─── ۱۲) موجودی قابل استفاده ───
const r12 = parseBankSms("بانک سپه: مانده قابل استفاده: 3,500,000 ریال - برداشت 400,000 ریال");
check("سپه: نوع", r12.type, "expense");
check("سپه: مبلغ", r12.amount, 400000);
check("سپه: موجودی", r12.balance, 3500000);

// ─── ۱۳) کارمزد ───
const r13 = parseBankSms("بانک تجارت: کسر کارمزد 50,000 ریال");
check("تجارت کارمزد: نوع", r13.type, "expense");
check("تجارت کارمزد: مبلغ", r13.amount, 50000);

// ─── ۱۴) فرمت با نقطه هزارگان ───
const r14 = parseBankSms("777.888.13972872.1\n-473.000\nمانده: 66.663.400");
check("نقطه هزارگان: مبلغ = 473000", r14.amount, 473000);

// ─── ۱۵) شبا واریز ───
const r15 = parseBankSms("انتقال وجه به شبا IR واریز 45,000,000 ریال به حساب شما");
check("شبا واریز: نوع", r15.type, "income");
check("شبا واریز: مبلغ", r15.amount, 45000000);

// ─── ۱۶) نرمال‌سازی ارقام ───
check("نرمال‌سازی: ۱۲۳٬۴۵۶", normalizeDigits("۱۲۳٬۴۵۶"), "123,456");

// ─── ۱۷) پیامک غیربانکی ───
const r17 = parseBankSms("سلام خوبی؟ فردا میای؟");
check("غیربانکی: بدون مبلغ", r17.amount, null);
check("غیربانکی: نوع نامشخص", r17.type, "unknown");

// ─── ۱۸) دریافت + موجودی ───
const r18 = parseBankSms("دريافت 800,000 ريال — موجودي 9,000,000 ريال");
check("دریافت عربی: نوع", r18.type, "income");
check("دریافت عربی: مبلغ", r18.amount, 800000);

console.log(`\nنتیجه: ${pass} موفق، ${failCount} ناموفق`);
if (failCount > 0) process.exit(1);
