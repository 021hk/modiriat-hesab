// ---------- Parser پیامک/نوتیفیکیشن بانکی (نسخه ۲) ----------
// v2.16: پشتیبانی کامل نوتیفیکیشن بلوبانک (واریز/برداشت/سود) + عبارت‌های قطعی
// «از حساب شما کم شد» / «به حسابتان واریز شد» + «بابت X» + تاریخ شمسی داخل پیام
// نمونه واقعی بلو (برداشت):
//        شارژ شدی
//        علی عزیز، 220,000 ریال بابت خرید شارژ از حساب شما کم شد
//        موجودی: 50,025,971 ریال
//        1405.08.21 02:42
// نمونه واقعی بلو (واریز):
//        علی عزیز، 200,000 ریال به حسابتان واریز شد
//        موجودی: 50,225,971 ریال
// دو ساختار را پشتیبانی می‌کند:
// ۱) پیامک‌های کلیدواژه‌دار: «بانک ملت: برداشت مبلغ 500,000 ریال از حساب 1234 بابت خرید»
// ۲) پیامک‌های ساختاری عددی (بدون کلیدواژه) — نمونه واقعی:
//        777.888.13972872.1
//        -473,000
//        07/10_02:10
//        مانده: 66,663,400
// واحد پول: مبالغ پیامک بانک‌های ایران معمولاً «ریال» است.

import { toGregorian } from "./jalali";

// تبدیل ارقام فارسی/عربی به انگلیسی
export function normalizeDigits(input: string): string {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  return input
    .replace(/[۰-۹٠-٩]/g, (d) => {
      const fi = fa.indexOf(d);
      if (fi > -1) return String(fi);
      return String(ar.indexOf(d));
    })
    .replace(/٬/g, ",") // جداکننده هزارگان فارسی
    .replace(/−|–|—/g, "-") // علامت منفی یونیکد → هايفن معمولی
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک"); // حروف عربی → فارسی
}

const BANK_NAMES: { key: string; patterns: string[] }[] = [
  { key: "بلوبانک", patterns: ["بلوبانک", "بلو بانک", "blubank", "blu bank", "blu", "بلو"] },
  { key: "ملت", patterns: ["ملت", "BANKMELLAT", "bpm"] },
  { key: "صادرات", patterns: ["صادرات", "BSI"] },
  { key: "ملی", patterns: ["ملی", "ملي", "BMI"] },
  { key: "تجارت", patterns: ["تجارت", "TBANK"] },
  { key: "رفاه", patterns: ["رفاه"] },
  { key: "پاسارگاد", patterns: ["پاسارگاد"] },
  { key: "سامان", patterns: ["سامان"] },
  { key: "کشاورزی", patterns: ["کشاورزی", "كشاورزي"] },
  { key: "مسکن", patterns: ["مسکن", "مسكن"] },
  { key: "سپه", patterns: ["سپه"] },
  { key: "توسعه صادرات", patterns: ["توسعه صادرات"] },
  { key: "صنعت و معدن", patterns: ["صنعت", "معدن"] },
  { key: "اقتصاد نوین", patterns: ["اقتصاد نوین", "ENBANK"] },
  { key: "پارسیان", patterns: ["پارسیان", "PARSIAN"] },
  { key: "کارآفرین", patterns: ["کارآفرین", "كارافرين"] },
  { key: "سینا", patterns: ["سینا"] },
  { key: "دی", patterns: ["بانک دی", "BANKDAY"] },
  { key: "پست بانک", patterns: ["پست بانک"] },
  { key: "شهر", patterns: ["بانک شهر", "CITYBANK"] },
  { key: "آینده", patterns: ["آینده", "آينده"] },
  { key: "انصار", patterns: ["انصار"] },
  { key: "قوامین", patterns: ["قوامین"] },
  { key: "رسالت", patterns: ["رسالت"] },
  { key: "حکمت ایرانیان", patterns: ["حکمت"] },
  { key: "ایران زمین", patterns: ["ایران زمین"] },
  { key: "مهر ایران", patterns: ["مهر ایران", "مهر ايران"] },
  { key: "خاورمیانه", patterns: ["خاورمیانه"] },
];

export interface SmsParseResult {
  type: "income" | "expense" | "unknown";
  amount: number | null;
  bankName: string | null;
  balance: number | null;
  unit: "rial" | "toman" | null; // واحد پول متن پیامک (پیامک‌های بانک‌های ایران معمولاً ریال است)
  accountRef: string | null; // شماره کارت/حساب داخل پیامک (برای تطبیق با حساب کاربر)
  accountRefDigits: string | null; // فقط ارقام شناسه (بدون نقطه/خط تیره) — مثل 777888139728721
  cardTail: string | null; // ۴ رقم آخر کارت/حساب
  purpose: string | null; // دلیل تراکنش از «بابت X» (مثلاً «خرید شارژ»)
  dateIso: string | null; // تاریخ/ساعت شمسی داخل پیام → ISO (اگر در متن بود)
  confidence: number; // 0..1
}

function toNumber(raw: string): number {
  return Number(
    raw
      .replace(/[,،]/g, "")
      // نقطه فقط وقتی جداکننده هزارگان است که دقیقاً ۳ رقم بعدش باشد (1.500.000 → 1500000)
      .replace(/\.(?=\d{3}(?:\b|\.))/g, "")
      .replace(/\.$/, "")
  );
}

const INCOME_HINTS = ["واریز", "افزایش موجودی", "دریافت", "وصول", "شارژ", "بستانکار", "واریز به حساب", "deposit", "credited"];
const EXPENSE_HINTS = ["برداشت", "خرید", "کسر", "پرداخت", "انتقال وجه", "کارت به کارت", "کارمزد", "قبض", "بدهکار", "برداشت از حساب", "کم شد", "کسر شد", "withdraw", "debited"];

// عبارت‌های قطعی (نوتیفیکیشن بلوبانک و چند بانک دیگر) — از منطق «نزدیک‌ترین کلیدواژه» قوی‌ترند:
// «... ریال بابت خرید شارژ از حساب شما کم شد» و «... ریال به حسابتان واریز شد»
// نکته: «شارژ» هم می‌تواند درآمد باشد («حسابت شارژ شد») هم هزینه («خرید شارژ») — عبارت قطعی این ابهام را حل می‌کند
const STRONG_EXPENSE = [
  "از حساب شما کم شد",
  "از حسابتان کم شد",
  "از حساب‌تان کم شد",
  "از حسابت کم شد",
  "از حساب شما برداشت شد",
  "از حسابتان برداشت شد",
];
const STRONG_INCOME = [
  "به حسابتان واریز شد",
  "به حساب شما واریز شد",
  "به حساب‌تان واریز شد",
  "به حسابت واریز شد",
];

/** عبارت «بابت X» — دلیل تراکنش (مثلاً «بابت خرید شارژ») — خالص و قابل‌تست */
export function extractPurpose(text: string): string | null {
  const m = normalizeDigits(text).match(/بابت\s+([^\n]{2,80}?)(?=\s*(?:از\s+حسا|کم\s+شده?|کسر\s+شده?|ثبت\s+شده?|موجودی|مانده|تاریخ|$))/);
  const p = m ? m[1].trim().replace(/[،,.\s]+$/, "") : "";
  return p.length >= 2 ? p.slice(0, 60) : null;
}

/** تاریخ و ساعت شمسی داخل پیام — «1405.08.21» یا «۱۴۰۵۰۸۲۱» + «02:42» → ISO (خالص و قابل‌تست) */
export function extractJalaliDateIso(text: string): string | null {
  // ارقام فارسی/عربی هم خودش نرمال می‌کند — تابع جداگانه است و ممکن است متن خام بگیرد
  const t0 = normalizeDigits(text);
  let m = /(?:^|[^\d])(1[2-5]\d{2})[.\/\-](\d{1,2})[.\/\-](\d{1,2})(?:[^\d]|$)/.exec(t0);
  if (!m) {
    const c = /(?:^|[^\d])(1[2-5]\d{2})(\d{2})(\d{2})(?:[^\d]|$)/.exec(t0);
    if (!c) return null;
    m = c;
  }
  const jy = parseInt(m[1], 10);
  const jm = parseInt(m[2], 10);
  const jd = parseInt(m[3], 10);
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  const t = /(?:^|[^\d])([01]?\d|2[0-3]):([0-5]\d)(?:[^\d]|$)/.exec(t0);
  const hour = t ? parseInt(t[1], 10) : 12;
  const minute = t ? parseInt(t[2], 10) : 0;
  try {
    const g = toGregorian(jy, jm, jd);
    if (g.gy < 2020 || g.gy > 2040) return null;
    return new Date(g.gy, g.gm - 1, g.gd, hour, minute).toISOString();
  } catch {
    return null;
  }
}

// خط تاریخ مثل: 07/10_02:10 یا 1404/07/10 02:10 یا 2026/10/02
const DATE_LINE_RE = /^\d{1,4}[\/\-.]\d{1,2}(?:[\/\-.]\d{0,2})?[_\sT]\d{1,2}:\d{2}(?::\d{2})?$/;

// خط شناسه مثل: 777.888.13972872.1 یا 6037-9971-1234-5678
const ID_LINE_RE = /^\d{1,6}(?:[.\-]\d{1,12})+[a-zA-Z]?$/;

// خط مبلغ عددی مثل: -473,000 یا +473,000 یا 473000 یا 473.000
const AMOUNT_LINE_RE = /^([+\-])?\s*(\d{1,3}(?:,\d{3})+|\d{1,3}(?:\.\d{3})+|\d{4,})(?:\.0+)?$/;

const BALANCE_RE = /(?:مانده|موجودی|balance)\s*[:：]?\s*([\d,]+(?:\.\d+)?)/i;
const BALANCE_RE2 = /(?:مانده|موجودی|balance)[^\d\n]{0,25}([\d,]+(?:\.\d+)?)/i;

function detectTypeByHints(text: string): "income" | "expense" | "unknown" {
  // نزدیک‌ترین کلیدواژه به ابتدای متن برنده است
  // (مثلاً «واریز ... بابت خرید» → واریز جلوتر است → درآمد)
  let bestIdx = Infinity;
  let bestType: "income" | "expense" | "unknown" = "unknown";
  for (const h of INCOME_HINTS) {
    const i = text.indexOf(h);
    if (i > -1 && i < bestIdx) {
      bestIdx = i;
      bestType = "income";
    }
  }
  for (const h of EXPENSE_HINTS) {
    const i = text.indexOf(h);
    if (i > -1 && i < bestIdx) {
      bestIdx = i;
      bestType = "expense";
    }
  }
  return bestType;
}

export function parseBankSms(rawText: string): SmsParseResult {
  const text = normalizeDigits(rawText);
  const lower = text.toLowerCase();
  const lines = text
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  // ─── نوع تراکنش از کلیدواژه‌ها ───
  let type: "income" | "expense" | "unknown" = "unknown";
  let typeFromSign = false;

  // ─── موجودی ───
  let balance: number | null = null;
  const mb = text.match(BALANCE_RE) || text.match(BALANCE_RE2);
  if (mb) balance = toNumber(mb[1]);

  // ─── مبلغ ───
  let amount: number | null = null;
  let sign: "+" | "-" | null = null;

  let amountIdx: number | null = null; // موقعیت مبلغ در متن (برای انتخاب کلیدواژه نزدیک)

  // روش ۱: کلیدواژه «مبلغ» + عدد (جداکننده هزارگان هم کاما هم نقطه — «1.500.000» رایج است!)
  const kw = text.match(/(?:مبلغ|به\s*مبلغ|withdraw|deposit)[^\d\-]{0,15}([\d][\d,\.]*)/i);
  if (kw && kw.index !== undefined) {
    amount = toNumber(kw[1]);
    amountIdx = kw.index;
  } else {
    // روش ۲: همه اعداد کنار واژه ریال/تومان → عددی که موجودی نیست
    const unitRe = /([\d]{1,3}(?:[,\.]\d{3})+|[\d]{4,})\s*(?:ریال|ريال|تومان|rial|IRR)/gi;
    const cands: { amount: number; index: number }[] = [];
    let um: RegExpExecArray | null;
    while ((um = unitRe.exec(text)) !== null) {
      cands.push({ amount: toNumber(um[1]), index: um.index });
    }
    if (cands.length > 0) {
      // اگر همه اعداد کنار ریال همان «مانده» هستند، پیامک اصلاً مبلغ تراکنش ندارد
      // (قبلاً fallback به cands[0] مانده را مبلغ می‌گرفت — باگ ثبت اشتباه!)
      const nonBalance = balance != null ? cands.filter((c) => c.amount !== balance) : cands;
      if (nonBalance.length > 0) {
        amount = nonBalance[0].amount;
        amountIdx = nonBalance[0].index;
      }
    }
  }

  // روش ۳: خطوط عددی مستقل (ساختاری) — وقتی مبلغ هنوز پیدا نشده
  if (amount === null) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (DATE_LINE_RE.test(line)) continue;
      if (/^\d{10,}$/.test(line)) continue; // شماره کارت/حساب بدون جداکننده — مبلغ نیست
      // فرمت فارسی: علامت منفی آخر خط (473,000-)
      const trailNeg = line.match(/^(\d{1,3}(?:,\d{3})+|\d{4,})-$/);
      if (trailNeg) {
        const prevLine2 = i > 0 ? lines[i - 1] : "";
        if (!/مانده|موجودی|balance/i.test(prevLine2)) {
          amount = toNumber(trailNeg[1]);
          sign = "-";
          break;
        }
        continue;
      }
      const m = line.match(AMOUNT_LINE_RE);
      if (!m) continue;
      const prevLine = i > 0 ? lines[i - 1] : "";
      // اگر خط قبل «مانده/موجودی» است، این عدد موجودی است نه مبلغ تراکنش
      if (/مانده|موجودی|balance/i.test(prevLine)) continue;
      if (/مانده|موجودی|balance/i.test(line)) continue;
      amount = toNumber(m[2]);
      if (m[1] === "-") sign = "-";
      else if (m[1] === "+") sign = "+";
      break;
    }
  }

  // ─── عبارت‌های قطعی (نوتیفیکیشن بلوبانک و مشابه) — قبل از منطق کلیدواژهٔ موقعیتی ───
  let strongType: "income" | "expense" | null = null;
  for (const p of STRONG_EXPENSE) {
    if (text.includes(p) || text.replace(/\u200c/g, "").includes(p.replace(/\u200c/g, ""))) {
      strongType = "expense";
      break;
    }
  }
  if (!strongType) {
    for (const p of STRONG_INCOME) {
      if (text.includes(p) || text.replace(/\u200c/g, "").includes(p.replace(/\u200c/g, ""))) {
        strongType = "income";
        break;
      }
    }
  }
  if (strongType) {
    type = strongType;
    typeFromSign = false;
  }

  // ─── نوع از علامت (+/−) ───
  if (sign === "-" && (type === "unknown" || type === "income")) {
    type = "expense";
    typeFromSign = true;
  } else if (sign === "+" && type === "unknown") {
    type = "income";
    typeFromSign = true;
  }
  if (type === "unknown" && amount !== null && balance !== null && amount > balance) {
    // عدد بزرگ‌تر از موجودی → احتمالاً مبلغ تراکنش واریزی است؛ مطمئن نیستیم
    type = "unknown";
  }

  // انتخاب نوع: اگر هر دو نوع (درآمد/هزینه) در متن بود، کلیدواژه‌ای که به مبلغ نزدیک‌تر است برنده است
  if (type !== "unknown" || amountIdx !== null) {
    const hintMatches: { i: number; t: "income" | "expense" }[] = [];
    for (const h of INCOME_HINTS) {
      const i = text.indexOf(h);
      if (i > -1) hintMatches.push({ i, t: "income" });
    }
    for (const h of EXPENSE_HINTS) {
      const i = text.indexOf(h);
      if (i > -1) hintMatches.push({ i, t: "expense" });
    }
    if (hintMatches.length > 0) {
      const hasIncome = hintMatches.some((h) => h.t === "income");
      const hasExpense = hintMatches.some((h) => h.t === "expense");
      if (hasIncome && hasExpense && amountIdx !== null) {
        hintMatches.sort((a, b) => Math.abs(a.i - amountIdx) - Math.abs(b.i - amountIdx));
        type = hintMatches[0].t;
      } else {
        hintMatches.sort((a, b) => a.i - b.i);
        type = hintMatches[0].t;
      }
    }
  }
  let bankName: string | null = null;
  for (const bank of BANK_NAMES) {
    for (const p of bank.patterns) {
      if (text.includes(p) || lower.includes(p.toLowerCase())) {
        bankName = bank.key;
        break;
      }
    }
    if (bankName) break;
  }
  if (!bankName) {
    // فاصله/نیم‌فاصله بعد از «بانک» لازم است — وگرنه «سود بانکی» → نام بانک «ی» می‌شد!
    const m3 = text.match(/بانک[\s\u200c]+([\u0600-\u06FFa-zA-Z]{2,})/);
    if (m3) bankName = m3[1];
  }

  // ─── شناسه کارت/حساب (برای تطبیق حساب) ───
  let accountRef: string | null = null;
  let accountRefDigits: string | null = null;
  let cardTail: string | null = null;
  for (const line of lines) {
    if (DATE_LINE_RE.test(line)) continue;
    if (line.match(AMOUNT_LINE_RE)) continue;
    if (ID_LINE_RE.test(line)) {
      accountRef = line;
      accountRefDigits = line.replace(/\D/g, "") || null;
      const groups = line.split(/[.\-]/);
      const digitsGroups = groups.filter((g) => g.length >= 4);
      if (digitsGroups.length > 0) {
        cardTail = digitsGroups[digitsGroups.length - 1].slice(-4);
      }
      break;
    }
  }
  if (!accountRef) {
    // «کارت 6037-9971-1234-5678» یا «حساب 1234567890» → کامل + ۴ رقم آخر
    // مراقبت: اگر عدد پشت آن واژه واحد پول دارد (مثل «کارت به کارت 2,000,000 ریال») مبلغ است نه شناسه
    const mc = text.match(/(?:کارت|حساب)\s*(?:شماره)?\s*[:：]?\s*([\d\-\.]{4,})\s*(?:ریال|ريال|تومان|rial|IRR)?/i);
    if (mc) {
      const digits = mc[1].replace(/\D/g, "");
      const groups = mc[1].split(/[.\-]/).filter(Boolean);
      const followedByUnit = Boolean(mc[2]);
      const looksLikeId = !followedByUnit && (digits.length >= 8 || groups.some((g) => g.length >= 4));
      if (looksLikeId) {
        accountRef = mc[1].replace(/[.\-]+$/, "");
        if (digits.length >= 4) {
          accountRefDigits = digits;
          cardTail = digits.slice(-4);
        }
      }
    }
  }

  // فرمت «ملت**7266» یا «ملت ** 7266» → ۴ رقم آخر کارت/حساب (خیلی رایج در پیامک‌های بانکی)
  if (!accountRefDigits) {
    const starTail = text.match(/\*+\s*(\d{3,4})\b/);
    if (starTail) {
      cardTail = starTail[1];
    }
  }

  // ─── واحد پول ───
  let unit: "rial" | "toman" | null = null;
  if (text.includes("ریال") || text.includes("ريال") || /\brial\b|IRR/i.test(text)) unit = "rial";
  else if (text.includes("تومان")) unit = "toman";

  // ─── اطمینان ───
  let confidence = 0;
  if (type !== "unknown") confidence += 0.4;
  if (amount !== null && amount > 0) confidence += 0.45;
  if (bankName) confidence += 0.15;
  if (type !== "unknown" && typeFromSign && !bankName) confidence = Math.max(confidence, 0.85);

  return {
    type,
    amount,
    bankName,
    balance,
    unit,
    accountRef,
    accountRefDigits,
    cardTail,
    purpose: extractPurpose(text),
    dateIso: extractJalaliDateIso(text),
    confidence,
  };
}
