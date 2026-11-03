// ---------- تطبیق پیامک با حساب بانکی (نسخه ۳) ----------
// مشکل: از یک شماره فرستنده (مثل 9999) پیامک چند حساب مختلف می‌آید —
// فقط پیامکی که شماره حساب/کارت آن با حساب‌های ثبت‌شده کاربر بخواند باید پذیرفته شود.
// نمونه واقعی: خط شناسه «777.888.13972872.1» معمولاً نقطه دارد.

// فقط ارقام (فارسی/عربی هم پشتیبانی می‌شود)
export function digitsOnly(s: string | null | undefined): string {
  if (!s) return "";
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  return String(s)
    .replace(/[۰-۹٠-٩]/g, (d) => {
      const fi = fa.indexOf(d);
      return String(fi > -1 ? fi : ar.indexOf(d));
    })
    .replace(/\D/g, "");
}

// نرمال‌سازی شماره فرستنده: حروف کوچک، تبدیل ارقام فارسی/عربی به لاتین، بدون +/فاصله/خط تیره
// ⚠️ تبدیل ارقام حیاتی است: کیبورد فارسی «۵۰۰۰۱۴۲» تایپ می‌کند ولی اندروید «5000142» می‌دهد
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function normalizeSender(s: string | null | undefined): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[۰-۹٠-٩]/g, (d) => {
      const fi = FA_DIGITS.indexOf(d);
      if (fi > -1) return String(fi);
      return String(AR_DIGITS.indexOf(d));
    })
    .replace(/[+\s\-()]/g, "");
}

// لیست شماره‌های فرستنده تنظیم‌شده روی یک حساب (جداکننده: کاما/ویرگول/فاصله/سطر)
export function parseConfiguredSenders(smsSender: string | null | undefined): string[] {
  if (!smsSender) return [];
  return String(smsSender)
    .split(/[,،;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// اشکال معادل یک شماره فرستنده: خودش + بدون کد کشور 98 + بدون صفر ابتدا
function senderVariants(s: string): string[] {
  const base = normalizeSender(s);
  const out = new Set<string>();
  if (base) {
    out.add(base);
    if (base.startsWith("98") && base.length > 5) out.add(base.slice(2));
    if (base.startsWith("0") && base.length > 5) out.add(base.slice(1));
  }
  return [...out];
}

// آیا فرستنده پیامک در لیست شماره‌های تنظیم‌شده کاربر هست؟
// تطبیق انعطاف‌پذیر: «+9850005412» با «50005412» و «989999» با «9999» یکی شمرده می‌شوند (کد کشور)
export function senderMatches(msgSender: string, configured: string[]): boolean {
  const m = senderVariants(msgSender);
  if (m.length === 0) return false;
  return configured.some((c) => {
    const ns = senderVariants(c);
    return ns.some((n) =>
      m.some((x) => x === n || (n.length >= 4 && x.endsWith(n)) || (x.length >= 4 && n.endsWith(x)))
    );
  });
}

export interface AccountLike {
  id: string;
  cardNumber?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
}

const MIN_OVERLAP = 4; // حداقل ارقام مشترک برای اطمینان از تطبیق

/**
 * امتیاز تطبیق یک شناسهٔ پیامک با یک فیلد حساب — بزرگ‌تر = مطمئن‌تر
 * تطبیق کامل = بیشترین امتیاز؛ وگرنه هرچه ارقام مشترک بیشتر، امتیاز بیشتر.
 * v2.14: وقتی از یک شمارهٔ بانک چند حساب داریم، حسابی که «بیشترین» ارقام مشترک دارد برنده است
 * (قبلاً اولین تطبیق برنده می‌شد و گاهی حساب اشتباه انتخاب می‌شد).
 */
export function scoreAccountRefMatch(accountFieldDigits: string, refDigits: string): number {
  const d = accountFieldDigits;
  const ref = refDigits;
  if (!d || d.length < MIN_OVERLAP || !ref) return 0;
  if (d === ref) return 1000 + d.length; // تطبیق کامل
  if (ref.endsWith(d)) return d.length * 10 + 5; // شمارهٔ حسابِ پیامک با پسوند حساب کاربر می‌خواند
  if (d.endsWith(ref)) return ref.length * 10; // شناسهٔ پیامک پسوند شمارهٔ حساب کاربر است
  return 0;
}

// تطبیق سخت‌گیرانه پیامک با حساب کاربر بر اساس شماره حساب/کارت داخل پیامک
// null یعنی «این پیامک مال هیچ‌کدام از حساب‌های من نیست» → باید رد شود
// v2.14: امتیازدهی — حسابی که بیشترین ارقام مشترک با پیامک دارد انتخاب می‌شود
export function matchAccountByRef(
  accounts: AccountLike[],
  refDigits: string | null | undefined,
  cardTail?: string | null
): string | null {
  const ref = digitsOnly(refDigits);

  // ۱) تطبیق مستقیم ارقام با امتیازدهی (بهترین حساب برنده است)
  if (ref) {
    let bestId: string | null = null;
    let bestScore = 0;
    for (const a of accounts) {
      for (const field of [a.cardNumber, a.accountNumber, a.iban]) {
        const d = digitsOnly(field);
        const score = scoreAccountRefMatch(d, ref);
        if (score > bestScore) {
          bestScore = score;
          bestId = a.id;
        }
      }
    }
    if (bestId) return bestId;
  }

  // ۲) تطبیق ۴ رقم آخر (برای خطوط شناسه گروه‌بندی‌شده مثل 777.888.13972872.1 → انتهای معنادار 2872)
  const tail = digitsOnly(cardTail);
  if (tail.length >= 3) {
    let bestId: string | null = null;
    let bestLen = 0;
    for (const a of accounts) {
      for (const field of [a.cardNumber, a.accountNumber]) {
        const d = digitsOnly(field);
        if (d.length >= 4 && d.endsWith(tail) && d.length > bestLen) {
          bestLen = d.length;
          bestId = a.id;
        }
      }
    }
    if (bestId) return bestId;
  }

  return null;
}
