import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/backup - خروجی کامل داده‌ها به صورت JSON (قابل انتقال بین همه دستگاه‌ها)
export async function GET() {
  try {
    const [categories, bankAccounts, transactions, debts, attachments, smsLogs] = await Promise.all([
      db.category.findMany(),
      db.bankAccount.findMany(),
      db.transaction.findMany(),
      db.debt.findMany(),
      db.attachment.findMany(),
      db.smsLog.findMany(),
    ]);

    const backup = {
      app: "modiriat-hesab",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        categories,
        bankAccounts,
        transactions,
        debts,
        attachments,
        smsLogs,
      },
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="hesab-backup-${dateStr}.json"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "خطا در ساخت پشتیبان" }, { status: 500 });
  }
}

// POST /api/backup - بازیابی از فایل پشتیبان
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const backup = body.backup || body;
    if (!backup || backup.app !== "modiriat-hesab" || !backup.data) {
      return NextResponse.json({ error: "فایل پشتیبان معتبر نیست" }, { status: 400 });
    }
    const d = backup.data;

    const createdDebts = new Map<string, string>();
    for (const debt of d.debts || []) {
      const { id, attachments, ...rest } = debt;
      void attachments;
      void id;
      const c = await db.debt.create({
        data: { ...rest, createdAt: new Date(debt.createdAt), updatedAt: new Date(debt.updatedAt) },
      });
      createdDebts.set(debt.id, c.id);
    }
    for (const att of d.attachments || []) {
      const newDebtId = createdDebts.get(att.debtId);
      if (newDebtId) {
        await db.attachment.create({
          data: {
            debtId: newDebtId,
            fileName: att.fileName,
            mimeType: att.mimeType,
            data: att.data,
            createdAt: new Date(att.createdAt),
          },
        });
      }
    }

    const createdCategories = new Map<string, string>();
    for (const cat of d.categories || []) {
      const { id, ...rest } = cat;
      void id;
      const c = await db.category.create({
        data: { ...rest, createdAt: new Date(cat.createdAt), updatedAt: new Date(cat.updatedAt) },
      });
      createdCategories.set(cat.id, c.id);
    }

    const createdAccounts = new Map<string, string>();
    for (const acc of d.bankAccounts || []) {
      const { id, ...rest } = acc;
      void id;
      const c = await db.bankAccount.create({
        data: { ...rest, createdAt: new Date(acc.createdAt), updatedAt: new Date(acc.updatedAt) },
      });
      createdAccounts.set(acc.id, c.id);
    }

    for (const tx of d.transactions || []) {
      const { id, ...txRest } = tx;
      void id;
      await db.transaction.create({
        data: {
          ...txRest,
          purpose: tx.purpose || null,
          categoryId: createdCategories.get(tx.categoryId || "") || null,
          bankAccountId: createdAccounts.get(tx.bankAccountId || "") || null,
          date: new Date(tx.date),
          rawSms: tx.rawSms || null,
          createdAt: new Date(tx.createdAt),
          updatedAt: new Date(tx.updatedAt),
        },
      });
    }

    for (const log of d.smsLogs || []) {
      await db.smsLog.create({
        data: {
          rawText: log.rawText,
          sender: log.sender || null,
          bankName: log.bankName || null,
          parsedType: log.parsedType || null,
          parsedAmount: log.parsedAmount ?? null,
          status: log.status || "pending",
          transactionId: log.transactionId || null,
          createdAt: new Date(log.createdAt),
        },
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
    return NextResponse.json({ ok: true, counts });
  } catch {
    return NextResponse.json({ error: "خطا در بازیابی پشتیبان" }, { status: 500 });
  }
}
