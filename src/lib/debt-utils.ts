// ابزارهای مشترک بدهی/طلب — خالص و قابل‌تست (بدون وابستگی به مرورگر)
// مدل: رکورد «بدهکار» = او به من بدهکار است (طلب من) | رکورد «طلبکار» = من به او بدهکارم (بدهی من)
// عنوان خودکار تراکنش‌ها:
//   برداشت → «پرداخت بدهی» (به طلبکار) یا «پرداخت قرض» (قرض دادن به بدهکار)
//   واریز  → «دریافت طلب» (از بدهکار) یا «دریافت بدهی» (قرض گرفتن از طلبکار)
import { normalizeSearch } from "@/lib/format";

export type DebtSide = "debtor" | "creditor";
export type DebtLinkMode = "lend" | "repay" | "collect" | "borrow";

/** کلید یکسان‌سازی اشخاص برای گروه‌بندی رکوردهای هم‌نام (علی/علي/«علی » یکی می‌شوند) */
export function personKey(name: string): string {
  return normalizeSearch(name || "").trim();
}

// ساختار حداقلی رکورد بدهی برای تست و استفاده عمومی (Debt اصلی سازگار ساختاری است)
export type DebtLike = {
  type: DebtSide;
  amount: number;
  paidAmount: number;
  isSettled?: boolean;
};

/** برچسب فارسی اتصال تراکنش به بدهی/طلب — فقط از نوع تراکنش و نوع رکورد شخص */
export function debtLinkLabel(txType: "income" | "expense", debtType?: DebtSide | null): string | null {
  if (debtType !== "debtor" && debtType !== "creditor") return null;
  if (txType === "expense") return debtType === "creditor" ? "پرداخت بدهی" : "پرداخت قرض";
  return debtType === "debtor" ? "دریافت طلب" : "دریافت بدهی";
}

/** مانده باز یک رکورد (هرگز منفی نیست) */
export function debtRemaining(d: Pick<DebtLike, "amount" | "paidAmount">): number {
  return Math.max(0, (d.amount || 0) - (d.paidAmount || 0));
}

/**
 * تشخیص خودکار حالت اتصال از وضعیت فعلی شخص:
 * برداشت → اگر به او بدهکاریم «پرداخت بدهی» (repay)، وگرنه «پرداخت قرض» (lend)
 * واریز  → اگر او به ما بدهکار است «دریافت طلب» (collect)، وگرنه «دریافت بدهی» (borrow)
 * رکوردهای تسویه‌شده یا مانده‌صفر نادیده گرفته می‌شوند.
 */
export function autoDetectDebtMode(txType: "income" | "expense", personRecords: DebtLike[]): DebtLinkMode {
  const open = (personRecords || []).filter((d) => !d.isSettled && debtRemaining(d) > 0);
  if (txType === "expense") return open.some((d) => d.type === "creditor") ? "repay" : "lend";
  return open.some((d) => d.type === "debtor") ? "collect" : "borrow";
}

/** نوع رکورد متناظر با هر حالت اتصال */
export function sideOfMode(mode: DebtLinkMode): DebtSide {
  return mode === "lend" || mode === "collect" ? "debtor" : "creditor";
}

/** جمله توضیح زندهٔ حالت اتصال — با عنوان خودکار که در لیست تراکنش‌ها دیده می‌شود */
export function debtModeSentence(mode: DebtLinkMode, personName: string, displayAmount: string, unit: string): string {
  const p = personName || "شخص";
  switch (mode) {
    case "lend":
      return `عنوان ثبت: «پرداخت قرض» — ${displayAmount} ${unit} به ${p} قرض می‌دهید و او به شما بدهکار می‌شود`;
    case "repay":
      return `عنوان ثبت: «پرداخت بدهی» — بدهی شما به ${p} به اندازه ${displayAmount} ${unit} کم می‌شود`;
    case "collect":
      return `عنوان ثبت: «دریافت طلب» — طلب شما از ${p} به اندازه ${displayAmount} ${unit} کم می‌شود`;
    case "borrow":
      return `عنوان ثبت: «دریافت بدهی» — ${displayAmount} ${unit} از ${p} قرض می‌گیرید و بدهی شما بیشتر می‌شود`;
  }
}

// ─── تجمیع گردش یک شخص از روی همه رکوردهایش ───

export type PersonStatus = "claim" | "debt" | "settled" | "none";

export type PersonSummary = {
  turnClaim: number; // گردش طلب = کل قرض‌هایی که به او داده‌اید (رکوردهای بدهکار)
  turnDebt: number; // گردش بدهی = کل قرض‌هایی که از او گرفته‌اید (رکوردهای طلبکار)
  claimReceived: number; // بازگشته از طلب (دریافت‌های او به شما)
  debtRepaid: number; // پرداخت‌شده از بدهی (پرداخت‌های شما به او)
  remainClaim: number; // مانده طلب
  remainDebt: number; // مانده بدهی
  status: PersonStatus;
};

/** وضعیت نهایی یک شخص: طلب دارید یا بدهی دارید یا تسویه */
export function summarizePerson(records: DebtLike[]): PersonSummary {
  const claimRecs = (records || []).filter((r) => r.type === "debtor");
  const debtRecs = (records || []).filter((r) => r.type === "creditor");
  const turnClaim = claimRecs.reduce((s, r) => s + (r.amount || 0), 0);
  const claimReceived = claimRecs.reduce((s, r) => s + (r.paidAmount || 0), 0);
  const turnDebt = debtRecs.reduce((s, r) => s + (r.amount || 0), 0);
  const debtRepaid = debtRecs.reduce((s, r) => s + (r.paidAmount || 0), 0);
  const remainClaim = Math.max(0, turnClaim - claimReceived);
  const remainDebt = Math.max(0, turnDebt - debtRepaid);

  let status: PersonStatus;
  if (!records || records.length === 0) status = "none";
  else if (remainClaim > remainDebt) status = "claim";
  else if (remainDebt > remainClaim) status = "debt";
  else status = "settled";

  return { turnClaim, turnDebt, claimReceived, debtRepaid, remainClaim, remainDebt, status };
}
