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

// ─── ۱۹) ارقام شناسه بدون نقطه (پارسر v3) ───
check("نمونه کاربر: ارقام کامل شناسه", r1.accountRefDigits, "777888139728721");
const r19 = parseBankSms("حساب 1234567890\nبرداشت 250,000 ریال\nمانده: 1,000,000 ریال");
check("الگوی «حساب ...»: شناسه", r19.accountRef, "1234567890");
check("الگوی «حساب ...»: ارقام", r19.accountRefDigits, "1234567890");
check("الگوی «حساب ...»: نوع", r19.type, "expense");

// ─── ۲۰) خرید (کلیدواژه) ───
const r20 = parseBankSms("خرید 850,000 ریال توسط کارت 6037-9971-1234-5678 در فروشگاه");
check("خرید: نوع = برداشت", r20.type, "expense");
check("خرید: مبلغ", r20.amount, 850000);

// ═══════════════ تطبیق حساب / تفکیک چند حساب در یک شماره (sms-match) ═══════════════
import { digitsOnly, normalizeSender, parseConfiguredSenders, senderMatches, matchAccountByRef } from "../src/lib/sms-match";

// شبیه‌سازی: بانک X شماره فرستنده 9999 — کاربر دو حساب دارد + حساب دیگر اعضای خانواده هم پیامک می‌دهد
const myAccounts = [
  { id: "acc-1", bankName: "ملت", cardNumber: "6104-3379-1234-2872", accountNumber: "77788813972872" },
  { id: "acc-2", bankName: "ملت", cardNumber: "6104-3379-9876-7754", accountNumber: "333444555666" },
];

check("digitsOnly: فارسی", digitsOnly("۷۷۷.۸۸۸"), "777888");
check("digitsOnly: خط تیره", digitsOnly("6037-9971-1234-5678"), "6037997112345678");
check("normalizeSender: +98 و فاصله", normalizeSender("+98 5000-5412"), "9850005412");
check("parseConfiguredSenders: چند شماره", parseConfiguredSenders("9999، 5000142, +98700077"), ["9999", "5000142", "+98700077"]);

check("فرستنده: دقیق", senderMatches("9999", ["9999"]), true);
check("فرستنده: با کد کشور معادل است", senderMatches("+989999", ["9999"]), true);
check("فرستنده: موبایل شخصی رد", senderMatches("09123456789", ["9999"]), false);
check("فرستنده: ۸ رقمی با کد کشور", senderMatches("+9850005412", ["50005412"]), true);
check("فرستنده: نام لاتین", senderMatches("BPMELLAT", ["bpmellat"]), true);
check("فرستنده: ناشناس رد", senderMatches("7777", ["9999"]), false);

// v2.5.0 — باگ ارقام فارسی: کاربر با کیبورد فارسی «۵۰۰۰۱۴۲» تایپ می‌کند ولی اندروید «+985000142» می‌دهد
check("normalizeSender: ارقام فارسی", normalizeSender("۵۰۰۰۱۴۲"), "5000142");
check("normalizeSender: ارقام عربی", normalizeSender("٠٩١٢٣"), "09123");
check("فرستنده: تنظیم با ارقام فارسی = پیامک لاتین", senderMatches("+985000142", ["۵۰۰۰۱۴۲"]), true);
check("فرستنده: تنظیم با ارقام فارسی + کد کشور", senderMatches("985000142", ["۵۰۰۰۱۴۲"]), true);
check("فرستنده: ارقام فارسی در لیست چند شماره", senderMatches("5000142", ["۹۹۹۹", "۵۰۰۰۱۴۲"]), true);

// پیامک خودمان (شماره حساب داخلش با حساب ۱ می‌خواند) → پذیرفته شود
const myRef = parseBankSms("777.888.13972872.1\n-473,000\n07/10_02:10\nمانده: 66,663,400");
check("تفکیک: پیامک حساب خودم → حساب ۱", matchAccountByRef(myAccounts, myRef.accountRefDigits, myRef.cardTail), "acc-1");

// پیامک حساب دیگری در همان شماره 9999 (شناسه‌اش با هیچ حساب ما نمی‌خواند) → null
const foreignRef = parseBankSms("555.666.11112233.9\n-900,000\n07/10_03:15\nمانده: 12,000,000");
check("تفکیک: پیامک حساب دیگر → رد", matchAccountByRef(myAccounts, foreignRef.accountRefDigits, foreignRef.cardTail), null);

// پیامک با شناسه ناقص (فقط ۴ رقم آخر) → تطبیق دُم
check("تفکیک: فقط ۴ رقم آخر", matchAccountByRef(myAccounts, null, "7754"), "acc-2");

// بدون شناسه اصلاً → null (نباید حدس بزند)
check("تفکیک: بدون شناسه → رد/صف", matchAccountByRef(myAccounts, null, null), null);

// شبا هم تطبیق داده می‌شود
const ibanAccounts = [{ id: "acc-3", cardNumber: null, accountNumber: null, iban: "IR120570028280101723123123" }];
check("تفکیک: تطبیق با شبا", matchAccountByRef(ibanAccounts, "0570028280101723123123", null), "acc-3");

// ─── v2.5.0 — judgeSms: حکم نهایی همگام‌سازی (برای ابزار عیب‌یابی) ───
import { judgeSms } from "../src/lib/sms-sync";
const judgeAccounts = [
  { id: "acc-1", bankName: "ملت", cardNumber: "6104-3379-1234-2872", accountNumber: "77788813972872", iban: null, smsSender: "9999" },
  { id: "acc-2", bankName: "سامان", cardNumber: null, accountNumber: "333444555666", iban: null, smsSender: "۵۰۰۰۱۴۲" },
] as never[];

check("حکم: شماره ناهمسان", judgeSms({ sender: "7777", text: "برداشت 100,000 ریال", accounts: judgeAccounts, autoImport: true }).verdict, "rejected_sender");
check("حکم: حساب غریبه", judgeSms({ sender: "+989999", text: "555.666.11112233.9\n-900,000\nمانده: 12,000,000", accounts: judgeAccounts, autoImport: true }).verdict, "rejected_foreign");
check("حکم: خودکار ثبت (شماره حساب می‌خواند)", judgeSms({ sender: "9999", text: "777.888.13972872.1\n-473,000\nمانده: 66,663,400", accounts: judgeAccounts, autoImport: true }).verdict, "auto_import");
check("حکم: مبلغ تشخیص نشد → صف", judgeSms({ sender: "9999", text: "پیامک آزمایشی بانک ملت بدون مبلغ", accounts: judgeAccounts, autoImport: true }).verdict, "queued_no_amount");
check("حکم: ارقام فارسی فرستنده می‌خواند", judgeSms({ sender: "+985000142", text: "واریز 1,500,000 ریال به حساب 333444555666", accounts: judgeAccounts, autoImport: true }).verdict, "auto_import");
check("حکم: رمز یکبارمصرف → junk", judgeSms({ sender: "9999", text: "رمز یکبار مصرف شما: 12345", accounts: judgeAccounts, autoImport: true }).verdict, "rejected_junk");

console.log(`\nنتیجه: ${pass} موفق، ${failCount} ناموفق`);
if (failCount > 0) process.exit(1);
