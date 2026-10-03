// موتور همگام‌سازی خودکار پیامک‌های بانکی — فقط روی اندروید (APK)
// ۱) صندوق پیامک از آخرین همگام‌سازی خوانده می‌شود
// ۲) پیامک‌های شخصی/تبلیغاتی/کد یکبارمصرف حذف می‌شوند
// ۳) واریز/برداشت با مبلغ مشخص: ثبت خودکار (اگر مطمئن باشد) یا در صف بررسی
// ۴) هیچ داده‌ای از گوشی خارج نمی‌شود

import { isNativeAndroid, getSmsPermission, readInboxSince, type NativeSms } from "@/lib/native-sms";
import { parseBankSms } from "@/lib/sms-parser";
import { parseConfiguredSenders, senderMatches, matchAccountByRef } from "@/lib/sms-match";
import { dbGetAll, dbPut, getMeta, setMeta, newId, STORES } from "@/lib/local-db";
import { api, type BankAccount, type SmsLog } from "@/lib/client-api";

const LAST_SYNC_KEY = "smsLastSync";
const FIRST_SYNC_DAYS = 30; // بار اول: ۳۰ روز اخیر
const AUTO_CONFIDENCE = 0.85; // نوع + مبلغ مشخص باشد → ثبت خودکار

export interface SmsSyncResult {
  ok: boolean;
  reason?: "not_native" | "permission" | "error" | "no_senders";
  error?: string;
  total: number; // کل پیامک‌های خوانده‌شده
  bankCount: number; // پیامک‌های شماره‌های تنظیم‌شده
  imported: number; // خودکار ثبت شدند
  queued: number; // به صف بررسی رفتند
  skipped: number; // غیر مرتبط (شخصی/تبلیغ/کد)
  skippedSender: number; // از شماره‌هایی که کاربر تنظیم نکرده — اصلاً خوانده نمی‌شوند
  skippedForeign: number; // پیامک حساب دیگری در همان شماره (شماره حساب داخلش با حساب‌های ما نمی‌خواند)
}

// فرستنده شخصی (شماره موبایل/خط ثابت) ≠ فرستنده بانک (کد کوتاه یا نام لاتین)
export function isPersonalSender(sender: string): boolean {
  const s = String(sender || "").trim();
  if (!s) return false;
  if (/^(\+?98|0)?9\d{9}$/.test(s)) return true; // موبایل ایران
  if (/^\+?\d{11,}$/.test(s.replace(/\s/g, ""))) return true; // عدد بلند (تلفن)
  return false;
}

const JUNK_PATTERNS = [
  "رمز",
  "کد تایید",
  "کد تأیید",
  "یکبار مصرف",
  "یک‌بار مصرف",
  "پویا",
  "otp",
  "password",
  "برنده",
  "جایزه",
  "قرعه",
  "نظرسنجی",
  "bit.ly",
  "t.me",
];

export function isJunk(text: string): boolean {
  const lower = text.toLowerCase();
  return JUNK_PATTERNS.some((p) => lower.includes(p));
}

// متن پیامک به کدام دسته همگام‌سازی می‌رود — برای ابزار عیب‌یابی
export type SmsSyncVerdict =
  | "rejected_sender" // شماره فرستنده ناهمسان/تنظیم‌نشده
  | "rejected_junk" // تبلیغاتی/رمز یکبارمصرف
  | "rejected_foreign" // حساب غریبه
  | "queued_no_amount" // مبلغ تشخیص نشد → صف
  | "queued_unsure" // نوع نامطمئن یا ثبت خودکار خاموش → صف
  | "auto_import"; // خودکار ثبت می‌شود

export function judgeSms(params: {
  sender: string;
  text: string;
  accounts: BankAccount[];
  autoImport: boolean;
}): { verdict: SmsSyncVerdict; accountId: string | null; explanation: string } {
  const { sender, text, accounts, autoImport } = params;
  const configuredSenders = accounts.flatMap((a) => parseConfiguredSenders(a.smsSender));
  if (configuredSenders.length === 0) {
    return { verdict: "rejected_sender", accountId: null, explanation: "هیچ شماره فرستنده‌ای روی حساب‌ها تنظیم نشده است" };
  }
  if (!senderMatches(sender, configuredSenders)) {
    return { verdict: "rejected_sender", accountId: null, explanation: "شماره فرستنده پیامک با شماره‌های تنظیم‌شده نمی‌خواند" };
  }
  const t = text.trim();
  if (!t || isJunk(t)) {
    return { verdict: "rejected_junk", accountId: null, explanation: "پیامک تبلیغاتی/کد یکبارمصرف تشخیص داده شد" };
  }
  const parsed = parseBankSms(t);
  let accountId: string | null = null;
  if (parsed.accountRefDigits || parsed.cardTail) {
    accountId = matchAccountByRef(accounts, parsed.accountRefDigits, parsed.cardTail);
    if (!accountId) {
      return { verdict: "rejected_foreign", accountId: null, explanation: "شناسه حساب/کارت داخل پیامک با هیچ‌کدام از حساب‌های شما نمی‌خواند" };
    }
  } else {
    accountId = matchAccountWithoutRef(accounts, parsed.bankName);
  }
  if (!parsed.amount || parsed.amount <= 0) {
    return { verdict: "queued_no_amount", accountId, explanation: "مبلغ تشخیص داده نشد — در صف بررسی می‌آید (ثبت دستی مبلغ)" };
  }
  if (autoImport && parsed.confidence >= AUTO_CONFIDENCE && (parsed.type === "income" || parsed.type === "expense")) {
    return { verdict: "auto_import", accountId, explanation: "خودکار ثبت می‌شود" };
  }
  return { verdict: "queued_unsure", accountId, explanation: autoImport ? "نوع تراکنش نامطمئن است — در صف بررسی می‌آید" : "ثبت خودکار خاموش است — در صف بررسی می‌آید" };
}

// تطبیق نام بانک/کارت پارس‌شده با حساب‌های ثبت‌شده کاربر — فقط وقتی پیامک اصلاً شناسه حساب/کارت ندارد
// (اگر شناسه داشته باشد ولی با حساب‌های کاربر نخواند، باید رد شود — نه تطبیق با نام بانک)
function matchAccountWithoutRef(
  accounts: BankAccount[],
  bankName: string | null
): string | null {
  if (!bankName) return null;
  const bn = bankName.replace(/\./g, "").trim();
  if (!bn) return null;
  const hits = accounts.filter((a) => {
    const an = (a.bankName || "").trim();
    if (!an) return false;
    return an.includes(bn) || bn.includes(an);
  });
  // فقط وقتی دقیقاً یک حساب آن بانک داریم قطعی است؛ با چند حساب حدس زدن ممنوع
  return hits.length === 1 ? hits[0].id : null;
}

export interface SyncOptions {
  autoImport?: boolean; // ثبت خودکار تراکنش‌های مطمئن (پیش‌فرض: روشن)
  silent?: boolean;
}

// قفل تک‌اجرایی — اگر دو جای برنامه همزمان sync بخواهند، فقط یکی اجرا می‌شود
let runningSync: Promise<SmsSyncResult> | null = null;

export function syncBankSms(options?: SyncOptions): Promise<SmsSyncResult> {
  if (runningSync) return runningSync;
  runningSync = doSyncBankSms(options).finally(() => {
    runningSync = null;
  });
  return runningSync;
}

async function doSyncBankSms(options?: SyncOptions): Promise<SmsSyncResult> {
  const autoImport = options?.autoImport !== false;
  const empty = { total: 0, bankCount: 0, imported: 0, queued: 0, skipped: 0, skippedSender: 0, skippedForeign: 0 };

  if (!isNativeAndroid()) return { ok: false, reason: "not_native", ...empty };
  const perm = await getSmsPermission();
  if (perm !== "granted") return { ok: false, reason: "permission", ...empty };

  let accounts: BankAccount[] = [];
  try {
    accounts = await api.get<BankAccount[]>("/api/bank-accounts");
  } catch {
    accounts = [];
  }

  // ─── فیلتر شماره فرستنده: فقط شماره‌هایی که کاربر روی حساب‌هایش تنظیم کرده ───
  const configuredSenders = accounts.flatMap((a) => parseConfiguredSenders(a.smsSender));
  if (accounts.length === 0 || configuredSenders.length === 0) {
    return { ok: false, reason: "no_senders", ...empty };
  }

  const now = Date.now();
  const last = (await getMeta<number>(LAST_SYNC_KEY)) || 0;
  const since = last > 0 ? last : now - FIRST_SYNC_DAYS * 24 * 60 * 60 * 1000;

  let messages: NativeSms[] = [];
  try {
    messages = await readInboxSince(since, 500);
  } catch (e) {
    return { ok: false, reason: "error", error: String(e), ...empty };
  }

  // قدیمی → جدید برای ترتیب درست تاریخ تراکنش‌ها
  const sorted = [...messages].sort((a, b) => a.date - b.date);

  // dedupe بر اساس شناسه بومی پیامک (فقط nativeId — پیامک‌های تکراری واقعی نباید حذف شوند)
  const existing = await dbGetAll<SmsLog & { nativeId?: string }>(STORES.smsLogs);
  const seenNative = new Set<string>();
  for (const l of existing) if (l.nativeId) seenNative.add(l.nativeId);

  let imported = 0;
  let queued = 0;
  let bankCount = 0;
  let skipped = 0;
  let skippedSender = 0;
  let skippedForeign = 0;
  let maxDate = since;

  for (const msg of sorted) {
    if (msg.date > maxDate) maxDate = msg.date;

    // ─── فقط شماره‌های تنظیم‌شده — بقیه پیامک‌ها اصلاً بررسی نمی‌شوند ───
    if (!msg.body || !senderMatches(msg.sender, configuredSenders)) {
      skippedSender++;
      continue;
    }
    const text = msg.body.trim();
    if (!text || isJunk(text)) {
      skipped++;
      continue;
    }

    const nativeId = `sms:${msg.id}`;
    if (seenNative.has(nativeId)) {
      bankCount++; // قبلاً پردازش شده
      continue;
    }

    const parsed = parseBankSms(text);

    // ─── تفکیک حساب‌ها داخل یک شماره ───
    // اگر پیامک شماره حساب/کارت دارد، باید با یکی از حساب‌های خودمان بخواند؛ وگرنه مال حساب دیگری است → رد
    let accountId: string | null = null;
    if (parsed.accountRefDigits || parsed.cardTail) {
      accountId = matchAccountByRef(accounts, parsed.accountRefDigits, parsed.cardTail);
      if (!accountId) {
        skippedForeign++; // پیامک حساب دیگری (مثلاً حساب دیگر اعضای خانواده در همان شماره بانک)
        continue;
      }
    } else {
      // بدون شناسه: فقط اگر دقیقاً یک حساب این شماره/بانک باشد قطعی است
      accountId = matchAccountWithoutRef(accounts, parsed.bankName);
    }

    bankCount++;

    // واحد پول: مبالغ همیشه به «ریال» ذخیره می‌شوند (نمایش بر اساس تنظیم کاربر تبدیل می‌شود)
    const finalAmount = parsed.amount && parsed.amount > 0 ? parsed.amount : null;

    const dateIso = new Date(msg.date).toISOString();
    const baseLog = {
      id: newId(),
      rawText: text,
      sender: msg.sender || null,
      bankName: parsed.bankName,
      parsedType: parsed.type,
      parsedAmount: finalAmount,
      nativeId,
      createdAt: dateIso,
    };

    // ─── پیامک ناشناخته (مبلغ یا نوع تشخیص نشد) → هرگز گم نمی‌شود؛ در صف بررسی می‌آید ───
    // کاربر می‌تواند مبلغ و نوع را دستی وارد کند یا یک ضرب نادیده بگیرد
    if (!finalAmount) {
      const log = { ...baseLog, status: "pending" as const };
      await dbPut(STORES.smsLogs, log);
      seenNative.add(nativeId);
      queued++;
      continue;
    }

    if (
      autoImport &&
      parsed.confidence >= AUTO_CONFIDENCE &&
      (parsed.type === "income" || parsed.type === "expense") &&
      finalAmount &&
      finalAmount > 0
    ) {
      // ثبت خودکار تراکنش
      const tx = {
        id: newId(),
        type: parsed.type as "income" | "expense",
        amount: finalAmount,
        purpose: parsed.bankName ? `پیامک بانک ${parsed.bankName}` : "ثبت خودکار پیامک",
        categoryId: null,
        bankAccountId: accountId,
        date: dateIso,
        source: "sms" as const,
        rawSms: text,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await dbPut(STORES.transactions, tx);
      const log = { ...baseLog, status: "imported" as const, transactionId: tx.id };
      await dbPut(STORES.smsLogs, log);
      seenNative.add(nativeId);
      imported++;
    } else {
      // در صف بررسی (نامطمئن، بدون نوع مشخص، یا ثبت خودکار خاموش)
      const log = { ...baseLog, status: "pending" as const };
      await dbPut(STORES.smsLogs, log);
      seenNative.add(nativeId);
      queued++;
    }
  }

  const newSyncPoint = Math.min(Math.max(maxDate, since), Date.now());
  if (newSyncPoint > since) await setMeta(LAST_SYNC_KEY, newSyncPoint);

  return { ok: true, total: messages.length, bankCount, imported, queued, skipped, skippedSender, skippedForeign };
}

// آخرین همگام‌سازی (برای نمایش)
export async function getLastSmsSync(): Promise<number> {
  return (await getMeta<number>(LAST_SYNC_KEY)) || 0;
}
