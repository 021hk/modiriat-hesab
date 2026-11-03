// ─── اجرای اقدام‌های دستیار هوشمند (v2.14) ───
// مدل Gemini فقط «درخواست اقدام» می‌دهد؛ اعتبارسنجی و اجرا اینجا روی دادهٔ محلی انجام می‌شود.
// validateAiAction خالص و قابل‌تست است؛ اجرا از api محلی استفاده می‌کند.

import type { AiChatMessage } from "@/lib/ai/gemini";

export type AiActionType = "categorize_by_range" | "create_rule" | "add_transaction" | "add_installment";

export interface AiAction {
  type: AiActionType;
  flow?: "expense" | "income";
  match?: "exact" | "range";
  exact?: number | null;
  min?: number | null;
  max?: number | null;
  categoryId?: string | null;
  overwrite?: boolean;
  type2?: "income" | "expense"; // برای add_transaction (type قبلی اشتباه‌خوان می‌شد)
  txType?: "income" | "expense"; // نام تمیز برای add_transaction
  amount?: number | null;
  purpose?: string | null;
  bankAccountId?: string | null;
  date?: string | null;
  title?: string | null;
  kind?: "installment" | "check";
  dueDate?: string | null;
  counterparty?: string | null;
  label?: string | null;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * اعتبارسنجی و نرمال‌سازی یک action خام از مدل — خالص و قابل‌تست.
 * خروجی: action تمیز یا رشتهٔ خطای فارسی.
 */
export function validateAiAction(raw: Record<string, unknown>): AiAction | string {
  const type = String(raw.type || "");
  const flow = raw.flow === "income" ? "income" : raw.flow === "expense" ? "expense" : null;

  if (type === "categorize_by_range" || type === "create_rule") {
    if (!flow) return "نوع تراکنش (هزینه/درآمد) مشخص نیست";
    const categoryId = typeof raw.categoryId === "string" && raw.categoryId ? raw.categoryId : null;
    if (!categoryId) return "دستهٔ مقصد انتخاب نشده است";
    const exact = raw.exact === undefined || raw.exact === null ? null : num(raw.exact);
    const min = raw.min === undefined || raw.min === null ? null : num(raw.min);
    const max = raw.max === undefined || raw.max === null ? null : num(raw.max);
    const hasExact = exact !== null && Number.isFinite(exact) && exact > 0;
    const hasMin = min !== null && Number.isFinite(min) && min > 0;
    const hasMax = max !== null && Number.isFinite(max) && max > 0;
    if (!hasExact && !hasMin && !hasMax) return "مبلغ یا محدوده مشخص نشده است";
    if (hasMin && hasMax && (min as number) > (max as number)) return "کران پایین محدوده از کران بالا بزرگ‌تر است";
    const action: AiAction = {
      type,
      flow,
      categoryId,
      exact: hasExact ? (exact as number) : null,
      min: hasMin ? (min as number) : null,
      max: hasMax ? (max as number) : null,
      overwrite: Boolean(raw.overwrite),
      match: type === "create_rule" ? (hasExact ? "exact" : "range") : undefined,
      label: typeof raw.label === "string" ? raw.label : null,
    };
    return action;
  }

  if (type === "add_transaction") {
    const txType = raw.txType === "income" || raw.txType === "expense" ? raw.txType : raw.type2 === "income" || raw.type2 === "expense" ? raw.type2 : flow;
    if (!txType) return "نوع تراکنش (هزینه/درآمد) مشخص نیست";
    const amount = num(raw.amount);
    if (!Number.isFinite(amount) || amount <= 0) return "مبلغ تراکنش نامعتبر است";
    const date = typeof raw.date === "string" && Number.isFinite(Date.parse(raw.date)) ? new Date(raw.date).toISOString() : null;
    return {
      type,
      txType,
      amount,
      purpose: typeof raw.purpose === "string" ? raw.purpose : null,
      categoryId: typeof raw.categoryId === "string" && raw.categoryId ? raw.categoryId : null,
      bankAccountId: typeof raw.bankAccountId === "string" && raw.bankAccountId ? raw.bankAccountId : null,
      date,
    };
  }

  if (type === "add_installment") {
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!title) return "عنوان قسط/چک مشخص نیست";
    const amount = num(raw.amount);
    if (!Number.isFinite(amount) || amount <= 0) return "مبلغ قسط/چک نامعتبر است";
    const dueMs = typeof raw.dueDate === "string" ? Date.parse(raw.dueDate) : NaN;
    if (!Number.isFinite(dueMs)) return "تاریخ سررسید نامعتبر است";
    return {
      type,
      title,
      kind: raw.kind === "check" ? "check" : "installment",
      amount,
      dueDate: new Date(dueMs).toISOString(),
      counterparty: typeof raw.counterparty === "string" ? raw.counterparty : null,
      bankAccountId: typeof raw.bankAccountId === "string" && raw.bankAccountId ? raw.bankAccountId : null,
    };
  }

  return "نوع اقدام ناشناخته است";
}

/** توصیف فارسی اقدام برای نمایش به کاربر */
export function describeAiAction(a: AiAction, fmt: (rial: number) => string): string {
  const scope =
    a.exact != null
      ? `دقیقاً ${fmt(a.exact)}`
      : a.min != null && a.max != null
        ? `بین ${fmt(a.min)} تا ${fmt(a.max)}`
        : a.min != null
          ? `از ${fmt(a.min)} به بالا`
          : a.max != null
            ? `تا ${fmt(a.max)}`
            : "";
  const flowLabel = (a.flow || a.txType) === "income" ? "درآمد" : "هزینه";
  switch (a.type) {
    case "categorize_by_range":
      return `انتقال ${flowLabel}‌های ${scope} به دستهٔ انتخابی${a.overwrite ? " (شامل دسته‌داشته‌ها)" : " (فقط بدون دسته)"}`;
    case "create_rule":
      return `ساختن قانون دائمی: ${flowLabel} ${scope}`;
    case "add_transaction":
      return `ثبت ${flowLabel} ${fmt(a.amount || 0)}${a.purpose ? ` — ${a.purpose}` : ""}`;
    case "add_installment":
      return `ثبت ${a.kind === "check" ? "چک" : "قسط"} «${a.title}» به مبلغ ${fmt(a.amount || 0)}`;
  }
}

export interface AiExecResult {
  ok: boolean;
  message: string; // جملهٔ فارسی نتیجه — به پاسخ مدل اضافه می‌شود
  refresh: string[]; // queryKey هایی که باید نو شوند
}

const fmtPlain = (rial: number): string => String(Math.round(rial)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/**
 * اجرای یک action معتبر روی دادهٔ محلی — از api محلی (IndexedDB) استفاده می‌کند.
 */
export async function executeAiAction(
  action: AiAction,
  apiLike: { get: <T>(url: string) => Promise<T>; post: <T>(url: string, body: unknown) => Promise<T>; put: <T>(url: string, body: unknown) => Promise<T> },
  options?: { categoryNames?: Map<string, string> }
): Promise<AiExecResult> {
  const catName = (id?: string | null) => (id ? options?.categoryNames?.get(id) || id : "");

  if (action.type === "categorize_by_range") {
    const txs = await apiLike.get<{ id: string; type: string; kind?: string | null; amount: number; categoryId?: string | null }[]>("/api/transactions");
    const want = action.flow === "income" ? "income" : "expense";
    let changed = 0;
    for (const t of txs) {
      if (t.type !== want) continue;
      if (t.kind && t.kind !== want) continue; // تراکنش بدهی/طلب دست نمی‌خورد
      if (!action.overwrite && t.categoryId) continue;
      if (action.overwrite && t.categoryId === action.categoryId) continue;
      if (action.exact != null ? t.amount !== action.exact : false) continue;
      if (action.min != null && t.amount < action.min) continue;
      if (action.max != null && t.amount > action.max) continue;
      await apiLike.put(`/api/transactions/${t.id}`, { categoryId: action.categoryId });
      changed++;
    }
    return {
      ok: changed > 0,
      message:
        changed > 0
          ? `✅ ${fmtPlain(changed)} تراکنش ${want === "income" ? "درآمدی" : "هزینه‌ای"} به دستهٔ «${catName(action.categoryId)}» منتقل شد.`
          : `هیچ تراکنش ${want === "income" ? "درآمدی" : "هزینه‌ای"}‌ای با این مبلغ پیدا نشد که بشود دسته‌بندی کرد.`,
      refresh: ["transactions", "stats", "categories"],
    };
  }

  if (action.type === "create_rule") {
    await apiLike.post("/api/auto-cat-rules", {
      flow: action.flow,
      match: action.match,
      exact: action.exact,
      min: action.min,
      max: action.max,
      categoryId: action.categoryId,
      label: action.label || "ساخته‌شده با دستیار هوشمند",
    });
    return {
      ok: true,
      message: `✅ قانون دائمی ساخته شد: ${flowLabelOf(action.flow)} ${scopeOf(action, fmtPlain)} ← «${catName(action.categoryId)}»`,
      refresh: ["auto-cat-rules"],
    };
  }

  if (action.type === "add_transaction") {
    const tx = await apiLike.post<{ id: string }>("/api/transactions", {
      type: action.txType,
      amount: action.amount,
      purpose: action.purpose || (action.txType === "income" ? "درآمد (ثبت با دستیار)" : "هزینه (ثبت با دستیار)"),
      categoryId: action.categoryId || null,
      bankAccountId: action.bankAccountId || null,
      date: action.date || new Date().toISOString(),
    });
    return {
      ok: true,
      message: `✅ تراکنش ثبت شد (${fmtPlain(action.amount || 0)} ریال) — شناسه ${tx.id.slice(0, 6)}`,
      refresh: ["transactions", "stats", "bank-accounts"],
    };
  }

  if (action.type === "add_installment") {
    const inst = await apiLike.post<{ id: string }>("/api/installments", {
      title: action.title,
      kind: action.kind,
      amount: action.amount,
      dueDate: action.dueDate,
      counterparty: action.counterparty || null,
      bankAccountId: action.bankAccountId || null,
    });
    return {
      ok: true,
      message: `✅ ${action.kind === "check" ? "چک" : "قسط"} «${action.title}» ثبت شد — سررسید ${new Date(action.dueDate || Date.now()).toLocaleDateString("fa-IR")}`,
      refresh: ["installments"],
    };
  }

  return { ok: false, message: "اقدام پشتیبانی نمی‌شود", refresh: [] };
}

function flowLabelOf(flow?: "expense" | "income"): string {
  return flow === "income" ? "درآمد" : "هزینه";
}

function scopeOf(a: AiAction, fmt: (rial: number) => string): string {
  if (a.exact != null) return `دقیقاً ${fmt(a.exact)}`;
  if (a.min != null && a.max != null) return `از ${fmt(a.min)} تا ${fmt(a.max)}`;
  if (a.min != null) return `از ${fmt(a.min)} به بالا`;
  if (a.max != null) return `تا ${fmt(a.max)}`;
  return "";
}

/** تبدیل فهرست action های خام مدل به فهرست تمیز + خطاها — خالص */
export function validateAiActions(raws: Record<string, unknown>[]): { actions: AiAction[]; errors: string[] } {
  const actions: AiAction[] = [];
  const errors: string[] = [];
  for (const raw of raws.slice(0, 5)) {
    const res = validateAiAction(raw);
    if (typeof res === "string") errors.push(res);
    else actions.push(res);
  }
  return { actions, errors };
}

export type { AiChatMessage };
