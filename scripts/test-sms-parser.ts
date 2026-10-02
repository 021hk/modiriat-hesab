// تست پارسر پیامک بانکی با نمونه‌های واقعی
import { parseBankSms } from "../src/lib/sms-parser";
import { isPersonalSender } from "../src/lib/sms-sync";

let pass = 0;
let fail = 0;

function expect(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${detail ? " — " + detail : ""}`);
  }
}

const samples: { text: string; sender: string }[] = [
  { sender: "MellatBank", text: "بانک ملت: برداشت مبلغ 500,000 ریال از حساب 1234**678 بابت خرید" },
  { sender: "BSI", text: "واریز به حساب شما مبلغ 2,500,000 ريال بانک صادرات. مانده: 10,000,000 ریال" },
  { sender: "MellatBank", text: "بانک ملت رمز یکبار مصرف 123456 برای مبلغ 500,000 ریال پویا" },
  { sender: "+989121234567", text: "سلام چطوری؟ امروز بیا خونه" },
  { sender: "9870", text: "مانده حساب شما 1,000,000 ریال می‌باشد" },
  { sender: "PARSIAN", text: "خرید مبلغ ۱۵۰٬۰۰۰ ریال از پایانه فروشگاهی، بانک پارسیان" },
  { sender: "TBANK", text: "بانک تجارت: انتقال وجه به مبلغ 1,000,000 ریال از حساب شما" },
  { sender: "ENBANK", text: "به نام شما مبلغ 750,000 ریال واریز شد. بانک اقتصاد نوین" },
  { sender: "1000606", text: "بیمه: لینک پرداخت قبض شما آماده است برنده جایزه" },
  { sender: "SB24", text: "سامان: پرداخت مبلغ 320,000 تومان انجام شد" },
];

console.log("--- پارسر ---");
// 1: برداشت ملت
let r = parseBankSms(samples[0].text);
expect("type=expense", r.type === "expense");
expect("amount=500000", r.amount === 500000, String(r.amount));
expect("bank=ملت", r.bankName === "ملت", String(r.bankName));
expect("unit=rial", r.unit === "rial");
expect("confidence>=0.85", r.confidence >= 0.85, String(r.confidence));

// 2: واریز صادرات
r = parseBankSms(samples[1].text);
expect("income", r.type === "income");
expect("amount=2500000", r.amount === 2500000, String(r.amount));
expect("bank=صادرات", r.bankName === "صادرات", String(r.bankName));

// 3: OTP
r = parseBankSms(samples[2].text);
console.log(`  (OTP parse: type=${r.type} amount=${r.amount} — junk filter هم می‌گیرد)`);

// 5: مانده بدون نوع
r = parseBankSms(samples[4].text);
expect("unknown (بدون نوع)", r.type === "unknown");

// 6: ارقام فارسی
r = parseBankSms(samples[5].text);
expect("fa-digits amount=150000", r.amount === 150000, String(r.amount));
expect("expense", r.type === "expense");

// 7: انتقال وجه
r = parseBankSms(samples[6].text);
expect("transfer=expense", r.type === "expense");
expect("amount=1000000", r.amount === 1000000, String(r.amount));

// 8: واریز اقتصاد نوین
r = parseBankSms(samples[7].text);
expect("income ENBANK", r.type === "income", r.type);
expect("amount=750000", r.amount === 750000, String(r.amount));

// 10: تومان
r = parseBankSms(samples[9].text);
expect("unit=toman", r.unit === "toman", String(r.unit));
expect("amount=320000", r.amount === 320000, String(r.amount));

console.log("--- فیلتر فرستنده ---");
expect("mobile personal", isPersonalSender("+989121234567") === true);
expect("mobile 09 personal", isPersonalSender("09121234567") === true);
expect("MellatBank NOT personal", isPersonalSender("MellatBank") === false);
expect("9870 NOT personal", isPersonalSender("9870") === false);
expect("PARSIAN NOT personal", isPersonalSender("PARSIAN") === false);
expect("landline personal", isPersonalSender("+982188776655") === true);

console.log("--- منطق تبدیل (مثل sync) ---");
// ملت برداشت 500000 ریال → 50000 تومان
const conv = r_rial_to_toman(samples[0].text);
expect("500000 rial → 50000 toman", conv === 50000, String(conv));
// سامان 320000 تومان → همان 320000
const conv2 = r_rial_to_toman(samples[9].text);
expect("320000 toman → 320000", conv2 === 320000, String(conv2));

function r_rial_to_toman(text: string): number {
  const p = parseBankSms(text);
  if (!p.amount) return 0;
  const unit = p.unit || "rial";
  return unit === "rial" ? Math.round(p.amount / 10) : p.amount;
}

console.log(`\nنتیجه: ${pass} موفق، ${fail} ناموفق`);
if (fail > 0) process.exit(1);
