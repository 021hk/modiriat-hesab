import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PUT /api/sms/[id] - وارد کردن پیامک به تراکنش یا نادیده گرفتن
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const log = await db.smsLog.findUnique({ where: { id } });
    if (!log) return NextResponse.json({ error: "پیامک یافت نشد" }, { status: 404 });

    if (body.action === "ignore") {
      const updated = await db.smsLog.update({ where: { id }, data: { status: "ignored" } });
      return NextResponse.json(updated);
    }

    if (body.action === "import") {
      const { type, amount, purpose, bankAccountId, date } = body;
      if (!amount || Number(amount) <= 0 || (type !== "income" && type !== "expense")) {
        return NextResponse.json({ error: "مبلغ یا نوع نامعتبر است" }, { status: 400 });
      }
      const tx = await db.transaction.create({
        data: {
          type,
          amount: Number(amount),
          purpose: purpose || null,
          bankAccountId: bankAccountId || null,
          date: date ? new Date(date) : log.createdAt,
          source: "sms",
          rawSms: log.rawText,
        },
      });
      const updated = await db.smsLog.update({
        where: { id },
        data: { status: "imported", transactionId: tx.id },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "عملیات نامعتبر" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "خطا در پردازش پیامک" }, { status: 500 });
  }
}

// DELETE /api/sms/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.smsLog.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "خطا در حذف پیامک" }, { status: 500 });
  }
}
