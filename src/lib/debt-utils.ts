// ابزارهای مشترک بدهی/طلب — مدل شخص‌محور (نسخه ۲.۱۲)
// اصل ۱: هر تراکنش فقط و فقط «یک» هویت (kind) دارد — هزینه یا درآمد یا پرداخت بدهی یا پرداخت قرض یا دریافت طلب یا دریافت بدهی
// اصل ۲: معیار طلب/بدهی = «شخص» و «باقی‌مانده» او — نه انتخاب دستی کاربر:
//         باقی‌مانده = مانده اولیه + گردش بدهی (پرداخت‌های شما به او) − گردش طلب (دریافت‌های شما از او)
//         مثبت → طلب | منفی → بدهی | صفر → تسویه
// عنوان خودکار تراکنش‌ها از علامت باقی‌مانده شخص تشخیص داده می‌شود:
//   برداشت (خروج پول) → «پرداخت بدهی» (اگر به او بدهکارید) یا «پرداخت قرض» (قرض دادن به او)
//   واریز  (ورود پول) → «دریافت طلب» (اگر او به شما بدهکار است) یا «دریافت بدهی» (قرض گرفتن از او)
import { normalizeSearch } from "@/lib/format";

// ─── انواع یکتای تراکنش ───

export type TxKind =
  | "expense" // هزینه — خروج پول، بدون شخص
  | "income" // درآمد — ورود پول، بدون شخص
  | "debt_payment" // پرداخت بدهی — خروج پول به شخصی که به او بدهکارید
  | "loan_given" // پرداخت قرض — خروج پول به شخص (قرض دادن → او بدهکار شما می‌شود)
  | "claim_received" // دریافت طلب — ورود پول از شخصی که به شما بدهکار است
  | "loan_received"; // دریافت بدهی — ورود پول از شخص (قرض گرفتن → شما بدهکار او می‌شوید)

export const TX_KINDS: TxKind[] = [
  "expense",
  "income",
  "debt_payment",
  "loan_given",
  "claim_received",
  "loan_received",
];

const KIND_LABELS: Record<TxKind, string> = {
  expense: "هزینه",
  income: "درآمد",
  debt_payment: "پرداخت بدهی",
  loan_given: "پرداخت قرض",
  claim_received: "دریافت طلب",
  loan_received: "دریافت بدهی",
};

export function kindLabel(kind: TxKind | null | undefined): string {
  return kind ? KIND_LABELS[kind] || "تراکنش" : "تراکنش";
}

/** جهت تراکنش از روی kind — خروج (out) یا ورود (in) */
export function kindDirection(kind: TxKind): "out" | "in" {
  return kind === "expense" || kind === "debt_payment" || kind === "loan_given" ? "out" : "in";
}

/** آیا این kind تراکنشِ بابت شخص (بدهی/طلب) است؟ */
export function isPersonKind(kind: TxKind | null | undefined): boolean {
  return kind === "debt_payment" || kind === "loan_given" || kind === "claim_received" || kind === "loan_received";
}

/** انواع مجاز برای هر جهت */
export function kindsOfDirection(direction: "out" | "in"): TxKind[] {
  return direction === "out" ? ["expense", "debt_payment", "loan_given"] : ["income", "claim_received", "loan_received"];
}

/** انواع شخص‌دار (بدهی/طلب) هر جهت — برای انتخاب دستی در فرم */
export function personKindsOfDirection(direction: "out" | "in"): TxKind[] {
  return direction === "out" ? ["debt_payment", "loan_given"] : ["claim_received", "loan_received"];
}

/** تشخیص خودکار kind از جهت + علامت باقی‌مانده فعلی شخص */
export function autoKind(direction: "out" | "in", personNet: number): TxKind {
  if (direction === "out") return personNet < 0 ? "debt_payment" : "loan_given";
  return personNet > 0 ? "claim_received" : "loan_received";
}

/** جمله توضیح زنده برای فرم تراکنش — شامل عنوان نهایی ثبت */
export function kindSentence(kind: TxKind, personName: string, displayAmount: string, unit: string): string {
  const a = `${displayAmount} ${unit}`;
  switch (kind) {
    case "loan_given":
      return `عنوان ثبت: «پرداخت قرض» — ${a} به ${personName || "شخص"} قرض می‌دهید و او به شما بدهکار می‌شود`;
    case "debt_payment":
      return `عنوان ثبت: «پرداخت بدهی» — بدهی شما به ${personName || "شخص"} به اندازه ${a} کم می‌شود`;
    case "claim_received":
      return `عنوان ثبت: «دریافت طلب» — طلب شما از ${personName || "شخص"} به اندازه ${a} کم می‌شود`;
    case "loan_received":
      return `عنوان ثبت: «دریافت بدهی» — ${a} از ${personName || "شخص"} قرض می‌گیرید و بدهی شما بیشتر می‌شود`;
    case "expense":
      return `عنوان ثبت: «هزینه» — ${a} هزینه ثبت می‌شود و در آمار هزینه‌ها حساب می‌شود`;
    case "income":
      return `عنوان ثبت: «درآمد» — ${a} درآمد ثبت می‌شود و در آمار درآمدها حساب می‌شود`;
  }
}

// ─── خواندن kind/جهت از رکورد تراکنش (با پشتیبانی از داده قدیمی بدون kind) ───

export type TxLike = {
  kind?: TxKind | null;
  type?: "income" | "expense" | string;
  debtId?: string | null;
  debtType?: "debtor" | "creditor" | null;
  amount?: number;
};

/** نگاشت داده قدیمی (type + نوع رکورد بدهی) → kind */
export function legacyKind(txType: "income" | "expense" | string, debtType?: "debtor" | "creditor" | null): TxKind {
  if (debtType === "creditor") return txType === "income" ? "loan_received" : "debt_payment";
  if (debtType === "debtor") return txType === "income" ? "claim_received" : "loan_given";
  return txType === "income" ? "income" : "expense";
}

/** kind قطعی یک تراکنش — kind ذخیره‌شده، وگرنه نگاشت قدیمی */
export function txKindOf(tx: TxLike): TxKind {
  if (tx.kind && TX_KINDS.includes(tx.kind)) return tx.kind;
  if (tx.debtId) return legacyKind(tx.type || "expense", tx.debtType ?? null);
  return tx.type === "income" ? "income" : "expense";
}

/** جهت تراکنش — خروج یا ورود پول */
export function txDirection(tx: TxLike): "out" | "in" {
  return kindDirection(txKindOf(tx));
}

// ─── کلید یکسان‌سازی اشخاص (علی/علي/«علی » یکی می‌شوند) ───

export function personKey(name: string): string {
  return normalizeSearch(name || "").trim();
}

// ─── تجمیع باقی‌مانده یک شخص از روی تراکنش‌ها ───

export type PersonStatus = "claim" | "debt" | "settled";

export type PersonSummary = {
  turnDebt: number; // گردش بدهی = جمع پرداخت‌های شما به این شخص (خروج)
  turnClaim: number; // گردش طلب = جمع دریافت‌های شما از این شخص (ورود)
  paidCount: number; // تعداد پرداخت‌ها
  receivedCount: number; // تعداد دریافت‌ها
  openingBalance: number; // مانده اولیه (+ = طلب اولیه، − = بدهی اولیه)
  net: number; // باقی‌مانده = مانده اولیه + گردش بدهی − گردش طلب
  status: PersonStatus; // مثبت → طلب | منفی → بدهی | صفر → تسویه
};

/**
 * باقی‌مانده شخص از روی مانده اولیه و تراکنش‌های او — معیارِ وضعیت طلب/بدهی
 * جهت هر تراکنش با txDirection (kind-محور با fallback به type قدیمی) تعیین می‌شود
 */
export function summarizePersonFromTxns(
  openingBalance: number,
  personTxs: TxLike[] | null | undefined
): PersonSummary {
  let turnDebt = 0;
  let turnClaim = 0;
  let paidCount = 0;
  let receivedCount = 0;
  for (const t of personTxs || []) {
    if (txDirection(t) === "out") {
      turnDebt += t.amount || 0;
      paidCount++;
    } else {
      turnClaim += t.amount || 0;
      receivedCount++;
    }
  }
  const opening = openingBalance || 0;
  const net = opening + turnDebt - turnClaim;
  const status: PersonStatus = net > 0 ? "claim" : net < 0 ? "debt" : "settled";
  return { turnDebt, turnClaim, paidCount, receivedCount, openingBalance: opening, net, status };
}

// ─── مهاجرت داده قدیمی → مدل شخص‌محور ───

/**
 * مانده اولیه یک رکورد قدیمی بدهکار/طلبکار — فقط بخش «دستیِ» که تراکنش‌ها پوشش نداده‌اند:
 *   بدهکار (او به من بدهکار است): مانده اولیه = مانده رکورد − پرداخت‌های متصل + دریافت‌های متصل (علامت +)
 *   طلبکار (من به او بدهکارم):    مانده اولیه = −(مانده رکورد − دریافت‌های متصل + پرداخت‌های متصل) (علامت −)
 * رکوردهایی که کاملاً از تراکنش ساخته شده‌اند → مانده اولیه صفر (تراکنش خودش حساب می‌شود — بدون دوبارشماری)
 */
export function legacyOpeningBalance(
  rec: { type?: "debtor" | "creditor" | string; amount?: number; paidAmount?: number },
  linkedTxs: TxLike[] | null | undefined
): number {
  const outSum = (linkedTxs || []).filter((t) => txDirection(t) === "out").reduce((s, t) => s + (t.amount || 0), 0);
  const inSum = (linkedTxs || []).filter((t) => txDirection(t) === "in").reduce((s, t) => s + (t.amount || 0), 0);
  const remaining = Math.max(0, (rec.amount || 0) - (rec.paidAmount || 0));
  if (rec.type === "debtor") return remaining - outSum + inSum;
  return -(remaining - inSum + outSum);
}

// ─── تشخیص خودکار شخص از متن پیامک بانک ───

/**
 * اگر نام یکی از اشخاص در متن پیامک باشد همان را برمی‌گرداند — وگرنه null.
 * محافظه‌کارانه: نام باید حداقل ۳ حرف باشد؛ توکن‌های ۴+ حرفی نام هم جستجو می‌شوند؛
 * بلندترین نام تطبیق‌یافته برنده است و اگر دو شخصِ هم‌طول تطبیق کنند، مبهم است و هیچ‌کدام.
 */
export function matchPersonInText(
  persons: { id: string; name: string }[] | null | undefined,
  text: string
): { id: string; name: string } | null {
  const t = normalizeSearch(text || "");
  if (!t) return null;
  const candidates = (persons || []).filter((p) => {
    const key = personKey(p.name);
    if (key.length < 3) return false;
    if (t.includes(key)) return true;
    return key
      .split(" ")
      .filter((w) => w.length >= 4)
      .some((w) => t.includes(w));
  });
  if (candidates.length === 0) return null;
  let best = 0;
  for (const c of candidates) best = Math.max(best, personKey(c.name).length);
  const winners = candidates.filter((c) => personKey(c.name).length === best);
  return winners.length === 1 ? { id: winners[0].id, name: winners[0].name } : null;
}
