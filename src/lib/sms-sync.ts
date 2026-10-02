// موتور همگام‌سازی خودکار پیامک‌های بانکی — فقط روی اندروید (APK)
// ۱) صندوق پیامک از آخرین همگام‌سازی خوانده می‌شود
// ۲) پیامک‌های شخصی/تبلیغاتی/کد یکبارمصرف حذف می‌شوند
// ۳) واریز/برداشت با مبلغ مشخص: ثبت خودکار (اگر مطمئن باشد) یا در صف بررسی
// ۴) هیچ داده‌ای از گوشی خارج نمی‌شود

import { isNativeAndroid, getSmsPermission, readInboxSince, type NativeSms } from "@/lib/native-sms";
import { parseBankSms } from "@/lib/sms-parser";
import { dbGetAll, dbPut, getMeta, setMeta, newId, STORES } from "@/lib/local-db";
import { api, type BankAccount, type SmsLog } from "@/lib/client-api";

const LAST_SYNC_KEY = "smsLastSync";
const FIRST_SYNC_DAYS = 30; // بار اول: ۳۰ روز اخیر
const AUTO_CONFIDENCE = 0.85; // نوع + مبلغ مشخص باشد → ثبت خودکار

export interface SmsSyncResult {
  ok: boolean;
  reason?: "not_native" | "permission" | "error";
  error?: string;
  total: number; // کل پیامک‌های خوانده‌شده
  bankCount: number; // پیامک‌های مرتبط با بانک
  imported: number; // خودکار ثبت شدند
  queued: number; // به صف بررسی رفتند
  skipped: number; // غیر مرتبط (شخصی/تبلیغ/کد)
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

function isJunk(text: string): boolean {
  const lower = text.toLowerCase();
  return JUNK_PATTERNS.some((p) => lower.includes(p));
}

// تطبیق نام بانک پارس‌شده با حساب‌های ثبت‌شده کاربر
function matchAccount(accounts: BankAccount[], bankName: string | null): string | null {
  if (!bankName) return null;
  const bn = bankName.replace(/\./g, "").trim();
  if (!bn) return null;
  const hit = accounts.find((a) => {
    const an = (a.bankName || "").trim();
    if (!an) return false;
    return an.includes(bn) || bn.includes(an);
  });
  return hit ? hit.id : null;
}

export interface SyncOptions {
  autoImport?: boolean; // ثبت خودکار تراکنش‌های مطمئن (پیش‌فرض: روشن)
  convertRial?: boolean; // تبدیل ریال به تومان (پیش‌فرض: روشن)
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
  const convertRial = options?.convertRial !== false;
  const empty = { total: 0, bankCount: 0, imported: 0, queued: 0, skipped: 0 };

  if (!isNativeAndroid()) return { ok: false, reason: "not_native", ...empty };
  const perm = await getSmsPermission();
  if (perm !== "granted") return { ok: false, reason: "permission", ...empty };

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

  let accounts: BankAccount[] = [];
  try {
    accounts = await api.get<BankAccount[]>("/api/bank-accounts");
  } catch {
    accounts = [];
  }

  let imported = 0;
  let queued = 0;
  let bankCount = 0;
  let skipped = 0;
  let maxDate = since;

  for (const msg of sorted) {
    if (msg.date > maxDate) maxDate = msg.date;

    if (!msg.body || isPersonalSender(msg.sender)) {
      skipped++;
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
    if (!parsed.amount || parsed.amount <= 0 || parsed.type === "unknown") {
      bankCount++; // متن بانکی ولی بدون مبلغ/نوع مشخص → صف نمی‌شود
      continue;
    }
    bankCount++;

    // واحد پول: پیامک بانک‌ها ریال است → در صورت فعال بودن، تقسیم بر ۱۰ (تومان)
    const unit = parsed.unit || "rial";
    let finalAmount = parsed.amount;
    if (convertRial && unit === "rial") finalAmount = Math.round(parsed.amount / 10);

    const dateIso = new Date(msg.date).toISOString();
    const baseLog = {
      id: newId(),
      rawText: text,
      sender: msg.sender || null,
      bankName: parsed.bankName,
      parsedType: parsed.type as "income" | "expense",
      parsedAmount: finalAmount,
      nativeId,
      createdAt: dateIso,
    };

    if (autoImport && parsed.confidence >= AUTO_CONFIDENCE && finalAmount > 0) {
      // ثبت خودکار تراکنش
      const tx = {
        id: newId(),
        type: parsed.type as "income" | "expense",
        amount: finalAmount,
        purpose: null,
        categoryId: null,
        bankAccountId: matchAccount(accounts, parsed.bankName),
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
      // در صف بررسی (نامطمئن یا ثبت خودکار خاموش)
      const log = { ...baseLog, status: "pending" as const };
      await dbPut(STORES.smsLogs, log);
      seenNative.add(nativeId);
      queued++;
    }
  }

  const newSyncPoint = Math.min(Math.max(maxDate, since), Date.now());
  if (newSyncPoint > since) await setMeta(LAST_SYNC_KEY, newSyncPoint);

  return { ok: true, total: messages.length, bankCount, imported, queued, skipped };
}

// آخرین همگام‌سازی (برای نمایش)
export async function getLastSmsSync(): Promise<number> {
  return (await getMeta<number>(LAST_SYNC_KEY)) || 0;
}
