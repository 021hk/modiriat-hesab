// ---------- Parser پیامک‌های بانکی ----------
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
    .replace(/٬/g, ","); // جداکننده هزارگان فارسی
}

const BANK_NAMES: { key: string; patterns: string[] }[] = [
  { key: "ملت", patterns: ["ملت", "BANKMELLAT", "9870"] },
  { key: "صادرات", patterns: ["صادرات", "BSI", "5000"] },
  { key: "ملی", patterns: ["ملی", "ملي", "BMI", "9931"] },
  { key: "تجارت", patterns: ["تجارت", "TBANK", "585983"] },
  { key: ".refah", patterns: ["رفاه"] },
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
  { key: "میان، وات، یر", patterns: [] },
];

export interface SmsParseResult {
  type: "income" | "expense" | "unknown";
  amount: number | null;
  bankName: string | null;
  balance: number | null;
  unit: "rial" | "toman" | null; // واحد پول متن پیامک (پیامک‌های بانک‌های ایران معمولاً ریال است)
  confidence: number; // 0..1
}

const AMOUNT_RE = /(?:مبلغ|به\s*مبلغ|withdraw|deposit)[^\d]{0,15}([\d,]+(?:\.\d+)?)|([\d]{1,3}(?:[,،]\d{3})+)\s*(?:ریال|ريال|تومان|rial|IRR)/i;

function toNumber(raw: string): number {
  return Number(raw.replace(/[,،]/g, ""));
}

export function parseBankSms(rawText: string): SmsParseResult {
  const text = normalizeDigits(rawText);
  const lower = text.toLowerCase();

  // --- نوع تراکنش ---
  let type: "income" | "expense" | "unknown" = "unknown";
  const incomeHints = [
    "واریز",
    "واریز به حساب",
    "اِفزایش موجودی",
    "افزایش موجودی",
    "دریافت",
    "deposit",
    "credited",
  ];
  const expenseHints = [
    "برداشت",
    "برداشت از",
    "خرید",
    "کسر",
    "پرداخت",
    "انتقال وجه",
    "برداشت وجه",
    "کارمزد",
    "قبض",
    "withdraw",
    "debited",
  ];
  for (const h of incomeHints) {
    if (text.includes(h)) {
      type = "income";
      break;
    }
  }
  for (const h of expenseHints) {
    if (text.includes(h)) {
      type = "expense";
      break;
    }
  }

  // --- مبلغ ---
  let amount: number | null = null;
  const m = text.match(AMOUNT_RE);
  if (m) {
    amount = toNumber(m[1] || m[2]);
  } else {
    // fallback: عدد بزرگ کنار واژه ریال/تومان
    const m2 = text.match(/([\d,]{4,})\s*(?:ریال|ريال|تومان)/i);
    if (m2) amount = toNumber(m2[1]);
  }

  // --- موجودی ---
  let balance: number | null = null;
  const mb = text.match(/موجودی[^\d]{0,20}([\d,]+(?:\.\d+)?)/);
  if (mb) balance = toNumber(mb[1]);

  // --- بانک ---
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
    const m3 = text.match(/بانک\s*([\u0600-\u06FFa-zA-Z]+)/);
    if (m3) bankName = m3[1];
  }

  // --- واحد پول ---
  let unit: "rial" | "toman" | null = null;
  if (text.includes("ریال") || text.includes("ريال") || /\brial\b|IRR/i.test(text)) unit = "rial";
  else if (text.includes("تومان")) unit = "toman";

  // --- اطمینان ---
  let confidence = 0;
  if (type !== "unknown") confidence += 0.4;
  if (amount !== null && amount > 0) confidence += 0.45;
  if (bankName) confidence += 0.15;

  return { type, amount, bankName, balance, unit, confidence };
}
