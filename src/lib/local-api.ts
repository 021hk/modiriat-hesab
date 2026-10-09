// روتر محلی API — تمام درخواست‌های /api/* روی دیتابیس محلی (IndexedDB) اجرا می‌شوند
// دقیقاً همان قرارداد نسخه سرور (scripts/api-ref) بدون هیچ داده نمونه/الکی
import {
  STORES,
  dbGetAll,
  dbGet,
  dbPut,
  dbDelete,
  newId,
  type StoreName,
} from "@/lib/local-db";
import { parseBankSms, type SmsParseResult } from "@/lib/sms-parser";
import { categoryDepthById, MAX_CATEGORY_DEPTH } from "@/lib/category-tree";
import { jalaliMonthBounds } from "@/lib/jalali";
import type {
  Category,
  BankAccount,
  Transaction,
  Debt,
  Attachment,
  SmsLog,
  Stats,
} from "@/lib/client-api";

// ─── ابزارهای عمومی ───

function nowIso(): string {
  return new Date().toISOString();
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fail(message: string, status = 400): never {
  const e = new Error(message) as Error & { status?: number };
  e.status = status;
  throw e;
}

function notFound(message = "مورد یافت نشد"): never {
  fail(message, 404);
}

async function getOrThrow<T extends { id: string }>(store: StoreName, id: string): Promise<T> {
  const row = await dbGet<T>(store, id);
  if (!row) notFound();
  return row;
}

// ─── اتصال دسته/حساب به تراکنش ───

async function joinTx(tx: Transaction, categories?: Category[], accounts?: BankAccount[]): Promise<Transaction> {
  const cats = categories || (await dbGetAll<Category>(STORES.categories));
  const accs = accounts || (await dbGetAll<BankAccount>(STORES.bankAccounts));
  return {
    ...tx,
    category: tx.categoryId ? cats.find((c) => c.id === tx.categoryId) || null : null,
    bankAccount: tx.bankAccountId ? accs.find((a) => a.id === tx.bankAccountId) || null : null,
  };
}

// ─── دسته‌بندی‌ها ───

async function listCategories(): Promise<Category[]> {
  const [cats, txs] = await Promise.all([
    dbGetAll<Category>(STORES.categories),
    dbGetAll<Transaction>(STORES.transactions),
  ]);
  const sorted = cats.sort((a, b) =>
    a.type === b.type ? (a.createdAt > b.createdAt ? -1 : 1) : a.type < b.type ? -1 : 1
  );
  return sorted.map((c) => ({
    ...c,
    _count: { transactions: txs.filter((t) => t.categoryId === c.id).length },
  }));
}

async function createCategory(body: Record<string, unknown>): Promise<Category> {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) fail("نام دسته الزامی است");

  // ─── سلسله‌مراتب: حداکثر ۳ زیرشاخه زیر ریشه (عمق ۴) و فقط با کلید «زیرشاخه فعال» والد ───
  let parentId: string | null = null;
  let type = body.type === "income" ? "income" : "expense";
  if (body.parentId) {
    const parent = await dbGet<Category>(STORES.categories, String(body.parentId));
    if (!parent) fail("دسته والد پیدا نشد");
    if (parent.allowSub === false) fail("برای این دسته، زیرشاخه غیرفعال است");
    const cats = await dbGetAll<Category>(STORES.categories);
    const depth = categoryDepthById(cats, parent.id);
    if (depth >= MAX_CATEGORY_DEPTH) fail("حداکثر ۳ زیرشاخه مجاز است");
    parentId = parent.id;
    type = parent.type; // زیرشاخه همان نوع والد است
  }

  const cat: Category = {
    id: newId(),
    name,
    type: type as "income" | "expense",
    color: (body.color as string) || "#10b981",
    icon: (body.icon as string) || "Tag",
    parentId,
    allowSub: body.allowSub !== false, // پیش‌فرض: زیرشاخه فعال
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await dbPut(STORES.categories, cat);
  return cat;
}

async function updateCategory(id: string, body: Record<string, unknown>): Promise<Category> {
  const existing = await getOrThrow<Category>(STORES.categories, id);
  // خاموش‌کردن «زیرشاخه فعال» وقتی فرزند دارد مجاز نیست
  if (body.allowSub === false && existing.allowSub !== false) {
    const cats = await dbGetAll<Category>(STORES.categories);
    if (cats.some((c) => c.parentId === id)) {
      fail("اول زیرشاخه‌های این دسته را حذف کنید");
    }
  }
  const updated: Category = {
    ...existing,
    name: body.name !== undefined ? String(body.name).trim() || existing.name : existing.name,
    type: body.type === "income" || body.type === "expense" ? body.type : existing.type,
    color: body.color !== undefined ? String(body.color) : existing.color,
    icon: body.icon !== undefined ? String(body.icon) : existing.icon,
    allowSub: body.allowSub !== undefined ? body.allowSub !== false : existing.allowSub,
    updatedAt: nowIso(),
  };
  await dbPut(STORES.categories, updated);
  return updated;
}

async function deleteCategory(id: string): Promise<void> {
  await getOrThrow<Category>(STORES.categories, id);
  // کل زیردرخت حذف می‌شود (ریشه + همه زیرشاخه‌ها)
  const cats = await dbGetAll<Category>(STORES.categories);
  const doomed = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of cats) {
      if (c.parentId && doomed.has(c.parentId) && !doomed.has(c.id)) {
        doomed.add(c.id);
        grew = true;
      }
    }
  }
  const txs = await dbGetAll<Transaction>(STORES.transactions);
  for (const t of txs) {
    if (t.categoryId && doomed.has(t.categoryId)) {
      await dbPut(STORES.transactions, { ...t, categoryId: null, updatedAt: nowIso() });
    }
  }
  for (const cid of doomed) await dbDelete(STORES.categories, cid);
}

// ─── حساب‌های بانکی ───

async function listBankAccounts(): Promise<BankAccount[]> {
  const accs = await dbGetAll<BankAccount>(STORES.bankAccounts);
  return accs.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

async function createBankAccount(body: Record<string, unknown>): Promise<BankAccount> {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const bankName = typeof body.bankName === "string" ? body.bankName.trim() : "";
  if (!name || !bankName) fail("نام حساب و بانک الزامی است");
  const acc: BankAccount = {
    id: newId(),
    name,
    bankName,
    accountNumber: (body.accountNumber as string) || null,
    cardNumber: (body.cardNumber as string) || null,
    iban: (body.iban as string) || null,
    smsSender: (body.smsSender as string) || null,
    initialBalance: num(body.initialBalance),
    smsBalance: (body.smsBalance as number) || null,
    smsBalanceDate: (body.smsBalanceDate as string) || null,
    color: (body.color as string) || "#8b5cf6",
    isArchived: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await dbPut(STORES.bankAccounts, acc);
  return acc;
}

async function updateBankAccount(id: string, body: Record<string, unknown>): Promise<BankAccount> {
  const existing = await getOrThrow<BankAccount>(STORES.bankAccounts, id);
  const updated: BankAccount = {
    ...existing,
    name: body.name !== undefined ? String(body.name).trim() || existing.name : existing.name,
    bankName: body.bankName !== undefined ? String(body.bankName).trim() || existing.bankName : existing.bankName,
    accountNumber: body.accountNumber !== undefined ? (body.accountNumber as string) || null : existing.accountNumber,
    cardNumber: body.cardNumber !== undefined ? (body.cardNumber as string) || null : existing.cardNumber,
    iban: body.iban !== undefined ? (body.iban as string) || null : existing.iban,
    smsSender: body.smsSender !== undefined ? (body.smsSender as string) || null : existing.smsSender,
    initialBalance: body.initialBalance !== undefined ? num(body.initialBalance) : existing.initialBalance,
    // موجودی بانکی از پیامک — فقط همگام‌سازی پیامک اجازه تغییرش دارد (body.smsBalanceClear برای صفر کردن)
    smsBalance: body.smsBalance !== undefined ? ((body.smsBalance as number) || null) : existing.smsBalance ?? null,
    smsBalanceDate: body.smsBalanceDate !== undefined ? ((body.smsBalanceDate as string) || null) : existing.smsBalanceDate ?? null,
    color: body.color !== undefined ? String(body.color) : existing.color,
    updatedAt: nowIso(),
  };
  await dbPut(STORES.bankAccounts, updated);
  return updated;
}

async function deleteBankAccount(id: string): Promise<void> {
  await getOrThrow<BankAccount>(STORES.bankAccounts, id);
  const txs = await dbGetAll<Transaction>(STORES.transactions);
  for (const t of txs) {
    if (t.bankAccountId === id) await dbPut(STORES.transactions, { ...t, bankAccountId: null, updatedAt: nowIso() });
  }
  await dbDelete(STORES.bankAccounts, id);
}

// ─── تراکنش‌ها ───

async function listTransactions(query: URLSearchParams): Promise<Transaction[]> {
  const type = query.get("type");
  const categoryId = query.get("categoryId");
  const bankAccountId = query.get("bankAccountId");
  const q = query.get("q");
  const limit = Math.min(Number(query.get("limit") || 200) || 200, 500);

  let txs = await dbGetAll<Transaction>(STORES.transactions);
  if (type === "income" || type === "expense") txs = txs.filter((t) => t.type === type);
  if (categoryId) txs = txs.filter((t) => t.categoryId === categoryId);
  if (bankAccountId) txs = txs.filter((t) => t.bankAccountId === bankAccountId);
  if (q) {
    const needle = q.toLowerCase();
    txs = txs.filter(
      (t) =>
        (t.purpose || "").toLowerCase().includes(needle) ||
        (t.rawSms || "").toLowerCase().includes(needle)
    );
  }
  txs.sort((a, b) => (a.date > b.date ? -1 : 1));
  const sliced = txs.slice(0, limit);
  // نام دسته/حساب برای نمایش در لیست (قبلاً join نمی‌شد و نشان دسته هرگز نشان داده نمی‌شد)
  const [cats, accs] = await Promise.all([
    dbGetAll<Category>(STORES.categories),
    dbGetAll<BankAccount>(STORES.bankAccounts),
  ]);
  // ⚠️ joinTx هرمی است — بدون Promise.all آرایه‌ای از Promise برمی‌گشت و لیست تراکنش‌ها خالی نشان داده می‌شد (باگ نسخه ۲.۸.۰)
  return await Promise.all(sliced.map((t) => joinTx(t, cats, accs)));
}

function validateTxBody(body: Record<string, unknown>): void {
  const amount = num(body.amount);
  if (!amount || amount <= 0) fail("مبلغ باید بزرگ‌تر از صفر باشد");
  if (body.type !== "income" && body.type !== "expense") fail("نوع تراکنش نامعتبر است");
}

async function createTransaction(body: Record<string, unknown>): Promise<Transaction> {
  validateTxBody(body);
  const tx: Transaction = {
    id: newId(),
    type: body.type as "income" | "expense",
    amount: num(body.amount),
    purpose: (body.purpose as string) || null,
    categoryId: (body.categoryId as string) || null,
    bankAccountId: (body.bankAccountId as string) || null,
    date: body.date ? new Date(body.date as string).toISOString() : nowIso(),
    source: body.source === "sms" ? "sms" : "manual",
    rawSms: (body.rawSms as string) || null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await dbPut(STORES.transactions, tx);
  return joinTx(tx);
}

async function updateTransaction(id: string, body: Record<string, unknown>): Promise<Transaction> {
  const existing = await getOrThrow<Transaction>(STORES.transactions, id);
  if (body.amount !== undefined && num(body.amount) <= 0) fail("مبلغ باید بزرگ‌تر از صفر باشد");
  const updated: Transaction = {
    ...existing,
    type: body.type === "income" || body.type === "expense" ? body.type : existing.type,
    amount: body.amount !== undefined ? num(body.amount) : existing.amount,
    purpose: body.purpose !== undefined ? (body.purpose as string) || null : existing.purpose,
    categoryId: body.categoryId !== undefined ? (body.categoryId as string) || null : existing.categoryId,
    bankAccountId: body.bankAccountId !== undefined ? (body.bankAccountId as string) || null : existing.bankAccountId,
    date: body.date !== undefined ? new Date(body.date as string).toISOString() : existing.date,
    rawSms: body.rawSms !== undefined ? (body.rawSms as string) || null : existing.rawSms,
    updatedAt: nowIso(),
  };
  await dbPut(STORES.transactions, updated);
  return joinTx(updated);
}

async function deleteTransaction(id: string): Promise<void> {
  await getOrThrow<Transaction>(STORES.transactions, id);
  await dbDelete(STORES.transactions, id);
}

// ─── بدهی‌ها ───

async function listDebts(query: URLSearchParams): Promise<Debt[]> {
  const type = query.get("type");
  const status = query.get("status");
  let debts = await dbGetAll<Debt>(STORES.debts);
  if (type === "debtor" || type === "creditor") debts = debts.filter((d) => d.type === type);
  if (status === "open") debts = debts.filter((d) => !d.isSettled);
  if (status === "settled") debts = debts.filter((d) => d.isSettled);
  const atts = await dbGetAll<Attachment>(STORES.attachments);
  debts.sort((a, b) => (a.isSettled !== b.isSettled ? (a.isSettled ? 1 : -1) : a.updatedAt > b.updatedAt ? -1 : 1));
  return debts.map((d) => ({
    ...d,
    attachments: atts
      .filter((a) => a.debtId === d.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
  }));
}

async function createDebt(body: Record<string, unknown>): Promise<Debt> {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const amount = num(body.amount);
  if (!name || !amount || amount <= 0) fail("نام و مبلغ الزامی است");
  if (body.type !== "debtor" && body.type !== "creditor") fail("نوع بدهی نامعتبر است");
  const debt: Debt = {
    id: newId(),
    name,
    type: body.type as "debtor" | "creditor",
    amount,
    paidAmount: 0,
    phone: (body.phone as string) || null,
    description: (body.description as string) || null,
    dueDate: body.dueDate ? new Date(body.dueDate as string).toISOString() : null,
    isSettled: false,
    attachments: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await dbPut(STORES.debts, debt);
  return debt;
}

async function updateDebt(id: string, body: Record<string, unknown>): Promise<Debt> {
  const existing = await getOrThrow<Debt>(STORES.debts, id);
  let updated: Debt = { ...existing, updatedAt: nowIso() };

  if (body.name !== undefined) updated.name = String(body.name).trim() || existing.name;
  if (body.type === "debtor" || body.type === "creditor") updated.type = body.type;
  if (body.amount !== undefined) updated.amount = num(body.amount);
  if (body.phone !== undefined) updated.phone = (body.phone as string) || null;
  if (body.description !== undefined) updated.description = (body.description as string) || null;
  if (body.dueDate !== undefined) updated.dueDate = body.dueDate ? new Date(body.dueDate as string).toISOString() : null;

  // پرداخت جزئی
  if (body.addPayment !== undefined) {
    const newPaid = Math.max(0, Math.min(existing.amount, existing.paidAmount + num(body.addPayment)));
    updated.paidAmount = newPaid;
    updated.isSettled = newPaid >= existing.amount;
  }
  if (body.paidAmount !== undefined) {
    updated.paidAmount = num(body.paidAmount);
    updated.isSettled = num(body.paidAmount) >= updated.amount;
  }
  if (body.isSettled !== undefined) {
    updated.isSettled = Boolean(body.isSettled);
    if (updated.isSettled) updated.paidAmount = updated.amount;
    else if (body.paidAmount === undefined && existing.paidAmount >= existing.amount) updated.paidAmount = 0;
  }

  await dbPut(STORES.debts, updated);
  return updated;
}

async function deleteDebt(id: string): Promise<void> {
  await getOrThrow<Debt>(STORES.debts, id);
  const atts = await dbGetAll<Attachment>(STORES.attachments);
  for (const a of atts) {
    if (a.debtId === id) await dbDelete(STORES.attachments, a.id);
  }
  await dbDelete(STORES.debts, id);
}

// ─── پیوست‌ها (عکس رسید) ───

const ATT_MAX_SIZE = 4 * 1024 * 1024;
const ATT_ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

async function createAttachment(debtId: string, body: Record<string, unknown>): Promise<Attachment> {
  await getOrThrow<Debt>(STORES.debts, debtId);
  const { fileName, mimeType, data } = body as { fileName?: string; mimeType?: string; data?: string };
  if (!fileName || !mimeType || !data) fail("فایل نامعتبر است");
  if (!ATT_ALLOWED.includes(mimeType)) fail("فرمت فایل پشتیبانی نمی‌شود");
  const size = Math.floor((data.length * 3) / 4);
  if (size > ATT_MAX_SIZE) fail("حجم فایل بیش از ۴ مگابایت است");
  const atts = await dbGetAll<Attachment>(STORES.attachments);
  if (atts.filter((a) => a.debtId === debtId).length >= 10) fail("حداکثر ۱۰ پیوست برای هر بدهی");
  const att: Attachment = {
    id: newId(),
    debtId,
    fileName,
    mimeType,
    createdAt: nowIso(),
  };
  await dbPut(STORES.attachments, { ...att, data });
  return att;
}

async function getAttachment(id: string): Promise<{ id: string; debtId: string; fileName: string; mimeType: string; dataUrl: string }> {
  const row = await dbGet<Attachment & { data: string }>(STORES.attachments, id);
  if (!row) notFound("پیوست یافت نشد");
  return {
    id: row.id,
    debtId: row.debtId,
    fileName: row.fileName,
    mimeType: row.mimeType,
    dataUrl: `data:${row.mimeType};base64,${row.data}`,
  };
}

// ─── پیامک‌ها ───

async function listSmsLogs(query: URLSearchParams): Promise<SmsLog[]> {
  const status = query.get("status");
  let logs = await dbGetAll<SmsLog>(STORES.smsLogs);
  if (status && ["pending", "imported", "ignored"].includes(status)) logs = logs.filter((l) => l.status === status);
  logs.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  return logs.slice(0, 100);
}

async function createSmsLog(body: Record<string, unknown>): Promise<{ log: SmsLog; parsed: SmsParseResult }> {
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length < 3) fail("متن پیامک نامعتبر است");
  const parsed = parseBankSms(text);
  const log: SmsLog = {
    id: newId(),
    rawText: text,
    sender: (body.sender as string) || null,
    bankName: parsed.bankName,
    parsedType: parsed.type,
    parsedAmount: parsed.amount,
    status: "pending",
    createdAt: nowIso(),
  };
  await dbPut(STORES.smsLogs, log);
  return { log, parsed };
}

async function updateSmsLog(id: string, body: Record<string, unknown>): Promise<SmsLog> {
  const log = await getOrThrow<SmsLog>(STORES.smsLogs, id);

  if (body.action === "ignore") {
    const updated = { ...log, status: "ignored" as const };
    await dbPut(STORES.smsLogs, updated);
    return updated;
  }

  if (body.action === "import") {
    const amount = num(body.amount);
    const type = body.type;
    if (!amount || amount <= 0 || (type !== "income" && type !== "expense")) fail("مبلغ یا نوع نامعتبر است");
    const tx: Transaction = {
      id: newId(),
      type,
      amount,
      purpose: (body.purpose as string) || null,
      categoryId: null,
      bankAccountId: (body.bankAccountId as string) || null,
      date: body.date ? new Date(body.date as string).toISOString() : log.createdAt,
      source: "sms",
      rawSms: log.rawText,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await dbPut(STORES.transactions, tx);
    const updated: SmsLog = { ...log, status: "imported", transactionId: tx.id };
    await dbPut(STORES.smsLogs, updated);
    return updated;
  }

  fail("عملیات نامعتبر");
}

// ─── آمار داشبورد ───

async function getStats(): Promise<Stats> {
  const now = new Date();
  // مرز «این ماه» با تقویم جلالی — قبلاً ماه میلادی بود و آمار با تقویم کاربر نمی‌خواند
  const { currentStart: startOfMonth, prevStart: startOfPrevMonth } = jalaliMonthBounds(now);

  const [accounts, txs, debts] = await Promise.all([
    dbGetAll<BankAccount>(STORES.bankAccounts),
    dbGetAll<Transaction>(STORES.transactions),
    dbGetAll<Debt>(STORES.debts),
  ]);

  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const accountSummaries = activeAccounts.map((acc) => {
    const accTxs = txs.filter((t) => t.bankAccountId === acc.id);
    const inc = accTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const exp = accTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return {
      id: acc.id,
      name: acc.name,
      bankName: acc.bankName,
      color: acc.color,
      // موجودی بانکی از پیامک (مانده) اگر باشد مرجع است — همان عددی که کارت حساب نشان می‌دهد
      balance: acc.smsBalance != null ? acc.smsBalance : num(acc.initialBalance) + inc - exp,
    };
  });
  const totalBalance = accountSummaries.reduce((s, a) => s + a.balance, 0);

  const inMonth = (t: Transaction, start: Date, end?: Date) => {
    const d = new Date(t.date);
    return d >= start && (end ? d < end : true);
  };
  const monthTx = txs.filter((t) => inMonth(t, startOfMonth));
  const prevMonthTx = txs.filter((t) => inMonth(t, startOfPrevMonth, startOfMonth));

  const openDebts = debts.filter((d) => !d.isSettled);
  const debtors = openDebts.filter((d) => d.type === "debtor");
  const creditors = openDebts.filter((d) => d.type === "creditor");

  const byCategory: Record<string, { name: string; color: string; total: number }> = {};
  // قبلاً روی تراکنش‌های join‌نشده t.category?.name می‌خواند → همیشه «بدون دسته» بود!
  const cats = await dbGetAll<Category>(STORES.categories);
  const catMap = new Map(cats.map((c) => [c.id, c]));
  for (const t of monthTx.filter((t) => t.type === "expense")) {
    const cat = t.categoryId ? catMap.get(t.categoryId) : undefined;
    const key = cat ? cat.id : "بدون دسته";
    if (!byCategory[key]) {
      byCategory[key] = {
        name: cat?.name || "بدون دسته",
        color: cat?.color || "#94a3b8",
        total: 0,
      };
    }
    byCategory[key].total += t.amount;
  }

  const recentTx = await Promise.all(
    [...txs]
      .sort((a, b) => (a.date > b.date ? -1 : 1))
      .slice(0, 8)
      .map((t) => joinTx(t))
  );

  return {
    totalBalance,
    accountSummaries,
    monthIncome: monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    monthExpense: monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    prevIncome: prevMonthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    prevExpense: prevMonthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    totalDueToMe: debtors.reduce((s, d) => s + (d.amount - d.paidAmount), 0),
    totalIOwe: creditors.reduce((s, d) => s + (d.amount - d.paidAmount), 0),
    debtorCount: debtors.length,
    creditorCount: creditors.length,
    expenseByCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
    recentTx,
    totals: {
      income: txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
      expense: txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    },
  };
}

// ─── پشتیبان‌گیری ───

interface BackupData {
  categories?: Record<string, unknown>[];
  bankAccounts?: Record<string, unknown>[];
  transactions?: Record<string, unknown>[];
  debts?: Record<string, unknown>[];
  attachments?: Record<string, unknown>[];
  smsLogs?: Record<string, unknown>[];
}

async function exportBackup(): Promise<Record<string, unknown>> {
  const [categories, bankAccounts, transactions, debts, attachments, smsLogs] = await Promise.all([
    dbGetAll(STORES.categories),
    dbGetAll(STORES.bankAccounts),
    dbGetAll(STORES.transactions),
    dbGetAll(STORES.debts),
    dbGetAll(STORES.attachments),
    dbGetAll(STORES.smsLogs),
  ]);
  return {
    app: "modiriat-hesab",
    version: 1,
    exportedAt: nowIso(),
    data: { categories, bankAccounts, transactions, debts, attachments, smsLogs },
  };
}

async function importBackup(backupInput: Record<string, unknown>): Promise<{ ok: boolean; counts: Record<string, number> }> {
  const backup = (backupInput.backup as { app?: string; data?: BackupData } | undefined) || (backupInput as { app?: string; data?: BackupData });
  if (!backup || backup.app !== "modiriat-hesab" || !backup.data) fail("فایل پشتیبان معتبر نیست");
  const d = backup.data as BackupData;

  // بدهی‌ها + نگاشت شناسه‌ها
  const debtMap = new Map<string, string>();
  for (const debt of d.debts || []) {
    const oldId = String(debt.id || "");
    const { attachments: _attachments, ...debtRest } = debt as Record<string, unknown> & { attachments?: unknown };
    void _attachments;
    const newDebtId = oldId && !(await dbGet(STORES.debts, oldId)) ? oldId : newId();
    await dbPut(STORES.debts, {
      ...debtRest,
      id: newDebtId,
      paidAmount: num(debt.paidAmount),
      isSettled: Boolean(debt.isSettled),
      createdAt: debt.createdAt ? new Date(String(debt.createdAt)).toISOString() : nowIso(),
      updatedAt: debt.updatedAt ? new Date(String(debt.updatedAt)).toISOString() : nowIso(),
      dueDate: debt.dueDate ? new Date(String(debt.dueDate)).toISOString() : null,
    });
    if (oldId) debtMap.set(oldId, newDebtId);
  }
  for (const att of d.attachments || []) {
    const mappedDebtId = debtMap.get(String(att.debtId || ""));
    if (!mappedDebtId) continue;
    const attId = newId();
    await dbPut(STORES.attachments, {
      id: attId,
      debtId: mappedDebtId,
      fileName: att.fileName,
      mimeType: att.mimeType,
      data: att.data,
      createdAt: att.createdAt ? new Date(String(att.createdAt)).toISOString() : nowIso(),
    });
  }

  const catMap = new Map<string, string>();
  for (const cat of d.categories || []) {
    const oldId = String(cat.id || "");
    const newCatId = oldId && !(await dbGet(STORES.categories, oldId)) ? oldId : newId();
    await dbPut(STORES.categories, {
      ...cat,
      id: newCatId,
      type: cat.type === "income" ? "income" : "expense",
      createdAt: cat.createdAt ? new Date(String(cat.createdAt)).toISOString() : nowIso(),
      updatedAt: cat.updatedAt ? new Date(String(cat.updatedAt)).toISOString() : nowIso(),
    });
    if (oldId) catMap.set(oldId, newCatId);
  }

  const accMap = new Map<string, string>();
  for (const acc of d.bankAccounts || []) {
    const oldId = String(acc.id || "");
    const newAccId = oldId && !(await dbGet(STORES.bankAccounts, oldId)) ? oldId : newId();
    await dbPut(STORES.bankAccounts, {
      ...acc,
      id: newAccId,
      initialBalance: num(acc.initialBalance),
      isArchived: Boolean(acc.isArchived),
      createdAt: acc.createdAt ? new Date(String(acc.createdAt)).toISOString() : nowIso(),
      updatedAt: acc.updatedAt ? new Date(String(acc.updatedAt)).toISOString() : nowIso(),
    });
    if (oldId) accMap.set(oldId, newAccId);
  }

  const txMap = new Map<string, string>();
  for (const tx of d.transactions || []) {
    const oldId = String(tx.id || "");
    const newTxId = oldId && !(await dbGet(STORES.transactions, oldId)) ? oldId : newId();
    await dbPut(STORES.transactions, {
      ...tx,
      id: newTxId,
      amount: num(tx.amount),
      type: tx.type === "income" ? "income" : "expense",
      source: tx.source === "sms" ? "sms" : "manual",
      purpose: tx.purpose || null,
      rawSms: tx.rawSms || null,
      categoryId: catMap.get(String(tx.categoryId || "")) || null,
      bankAccountId: accMap.get(String(tx.bankAccountId || "")) || null,
      date: tx.date ? new Date(String(tx.date)).toISOString() : nowIso(),
      createdAt: tx.createdAt ? new Date(String(tx.createdAt)).toISOString() : nowIso(),
      updatedAt: tx.updatedAt ? new Date(String(tx.updatedAt)).toISOString() : nowIso(),
    });
    if (oldId) txMap.set(oldId, newTxId);
  }

  for (const log of d.smsLogs || []) {
    const oldTxId = log.transactionId ? String(log.transactionId) : "";
    await dbPut(STORES.smsLogs, {
      id: newId(),
      rawText: log.rawText,
      sender: log.sender || null,
      bankName: log.bankName || null,
      parsedType: log.parsedType || null,
      parsedAmount: log.parsedAmount == null ? null : num(log.parsedAmount),
      status: log.status || "pending",
      transactionId: oldTxId ? txMap.get(oldTxId) || null : null,
      createdAt: log.createdAt ? new Date(String(log.createdAt)).toISOString() : nowIso(),
    });
  }

  const counts = {
    categories: (d.categories || []).length,
    bankAccounts: (d.bankAccounts || []).length,
    transactions: (d.transactions || []).length,
    debts: (d.debts || []).length,
    attachments: (d.attachments || []).length,
    smsLogs: (d.smsLogs || []).length,
  };
  return { ok: true, counts };
}

// ─── روتر اصلی ───

type Handler = (query: URLSearchParams, body: Record<string, unknown>, id: string) => Promise<unknown>;

export async function localRequest<T>(method: string, url: string, body?: unknown): Promise<T> {
  const [path, queryString] = url.split("?");
  const query = new URLSearchParams(queryString || "");
  const segments = path.replace(/^\/+|\/+$/g, "").split("/"); // api/transactions/:id
  const payload = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const m = method.toUpperCase();

  let handler: Handler | null = null;
  let id = "";

  if (segments[0] === "api" && segments.length >= 2) {
    const resource = segments[1];
    id = segments[2] || "";
    const sub = segments[3] || "";

    const table: Record<string, Record<string, Handler>> = {
      categories: {
        GET: () => listCategories(),
        POST: (q, b) => createCategory(b),
      },
      "bank-accounts": {
        GET: () => listBankAccounts(),
        POST: (q, b) => createBankAccount(b),
      },
      transactions: {
        GET: (q) => listTransactions(q),
        POST: (q, b) => createTransaction(b),
      },
      debts: {
        GET: (q) => listDebts(q),
        POST: (q, b) => createDebt(b),
      },
      sms: {
        GET: (q) => listSmsLogs(q),
        POST: (q, b) => createSmsLog(b),
      },
      stats: {
        GET: () => getStats(),
      },
      backup: {
        GET: () => exportBackup(),
        POST: (q, b) => importBackup(b),
      },
    };

    if (resource === "backup" && m === "POST") handler = table.backup.POST;
    else if (id && sub === "attachments" && resource === "debts" && m === "POST") {
      handler = (q, b) => createAttachment(id, b);
    } else if (id && resource === "attachments") {
      if (m === "GET") handler = () => getAttachment(id);
      else if (m === "DELETE") handler = async () => {
        await getOrThrow<Attachment>(STORES.attachments, id);
        await dbDelete(STORES.attachments, id);
        return { ok: true };
      };
    } else if (id) {
      const crud: Record<string, Record<string, Handler>> = {
        categories: { PUT: (q, b) => updateCategory(id, b), DELETE: () => deleteCategory(id) },
        "bank-accounts": { PUT: (q, b) => updateBankAccount(id, b), DELETE: () => deleteBankAccount(id) },
        transactions: { PUT: (q, b) => updateTransaction(id, b), DELETE: () => deleteTransaction(id) },
        debts: { PUT: (q, b) => updateDebt(id, b), DELETE: () => deleteDebt(id) },
        sms: { PUT: (q, b) => updateSmsLog(id, b), DELETE: async () => { await dbDelete(STORES.smsLogs, id); return { ok: true }; } },
      };
      handler = crud[resource]?.[m] || null;
    } else {
      handler = table[resource]?.[m] || null;
    }
  }

  if (!handler) fail("مسیر پیدا نشد: " + url, 404);
  return (await handler(query, payload, id)) as T;
}
