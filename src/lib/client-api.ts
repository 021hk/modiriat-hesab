// انواع داده مشترک
export interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
  color: string;
  icon: string;
  parentId?: string | null; // دسته والد — null/undefined = ریشه
  allowSub?: boolean; // «زیرشاخه فعال» — فقط اگر true باشد می‌توان زیر آن زیرشاخه ساخت (undefined = فعال)
  createdAt: string;
  updatedAt: string;
  _count?: { transactions: number };
}

export interface BankAccount {
  id: string;
  name: string;
  bankName: string;
  accountNumber?: string | null;
  cardNumber?: string | null;
  iban?: string | null;
  smsSender?: string | null; // شماره(های) فرستنده پیامک بانک — فقط پیامک همین شماره‌ها خوانده می‌شود (جداکننده: کاما)
  initialBalance: number;
  smsBalance?: number | null; // موجودی گزارش‌شده از آخرین پیامک بانک (ریال) — مرجع نمایش «موجودی بانک»
  smsBalanceDate?: string | null; // تاریخ (ISO) پیامکی که موجودی از آن خوانده شد
  color: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  purpose?: string | null;
  categoryId?: string | null;
  category?: Category | null;
  bankAccountId?: string | null;
  bankAccount?: BankAccount | null;
  date: string;
  source: "manual" | "sms";
  rawSms?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  debtId: string;
  fileName: string;
  mimeType: string;
  createdAt: string;
}

export interface Debt {
  id: string;
  name: string;
  type: "debtor" | "creditor";
  amount: number;
  paidAmount: number;
  phone?: string | null;
  description?: string | null;
  dueDate?: string | null;
  isSettled: boolean;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export interface SmsLog {
  id: string;
  rawText: string;
  sender?: string | null;
  bankName?: string | null;
  parsedType?: "income" | "expense" | "unknown" | null;
  parsedAmount?: number | null;
  status: "pending" | "imported" | "ignored";
  transactionId?: string | null;
  nativeId?: string | null;
  createdAt: string;
}

export interface Stats {
  totalBalance: number;
  accountSummaries: {
    id: string;
    name: string;
    bankName: string;
    color: string;
    balance: number;
  }[];
  monthIncome: number;
  monthExpense: number;
  prevIncome: number;
  prevExpense: number;
  totalDueToMe: number;
  totalIOwe: number;
  debtorCount: number;
  creditorCount: number;
  expenseByCategory: { name: string; color: string; total: number }[];
  recentTx: Transaction[];
  totals: { income: number; expense: number };
}

// کلاینت — حالا کاملاً محلی (IndexedDB روی خود دستگاه)؛ همین رابط در نسخه سرور هم بود
import { localRequest } from "@/lib/local-api";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const method = (options?.method || "GET").toUpperCase();
  let body: unknown;
  if (options?.body) {
    try {
      body = JSON.parse(String(options.body));
    } catch {
      body = options.body;
    }
  }
  try {
    return await localRequest<T>(method, url, body);
  } catch (e) {
    throw e instanceof Error ? e : new Error("خطای غیرمنتظره");
  }
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body: unknown) => request<T>(url, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(url: string, body: unknown) => request<T>(url, { method: "PUT", body: JSON.stringify(body) }),
  del: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};

// فشرده‌سازی تصویر سمت کلاینت قبل از آپلود
export async function compressImage(file: File, maxSize = 900, quality = 0.75): Promise<{ fileName: string; mimeType: string; data: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve({ fileName: file.name, mimeType: file.type, data: dataUrl.split(",")[1] });
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL("image/jpeg", quality);
      resolve({ fileName: file.name, mimeType: "image/jpeg", data: compressed.split(",")[1] });
    };
    img.onerror = () => {
      resolve({ fileName: file.name, mimeType: file.type, data: dataUrl.split(",")[1] });
    };
    img.src = dataUrl;
  });
}
