import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/transactions - لیست تراکنش‌ها با فیلتر
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const type = sp.get("type"); // income | expense
    const categoryId = sp.get("categoryId");
    const bankAccountId = sp.get("bankAccountId");
    const q = sp.get("q");
    const limit = Number(sp.get("limit") || 200);

    const where: Record<string, unknown> = {};
    if (type === "income" || type === "expense") where.type = type;
    if (categoryId) where.categoryId = categoryId;
    if (bankAccountId) where.bankAccountId = bankAccountId;
    if (q) where.OR = [{ purpose: { contains: q } }, { rawSms: { contains: q } }];

    const transactions = await db.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      take: Math.min(limit, 500),
      include: { category: true, bankAccount: true },
    });
    return NextResponse.json(transactions);
  } catch {
    return NextResponse.json({ error: "خطا در دریافت تراکنش‌ها" }, { status: 500 });
  }
}

// POST /api/transactions - ثبت تراکنش جدید
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, amount, purpose, categoryId, bankAccountId, date, source, rawSms } = body;
    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "مبلغ باید بزرگ‌تر از صفر باشد" }, { status: 400 });
    }
    if (type !== "income" && type !== "expense") {
      return NextResponse.json({ error: "نوع تراکنش نامعتبر است" }, { status: 400 });
    }
    const transaction = await db.transaction.create({
      data: {
        type,
        amount: Number(amount),
        purpose: purpose || null,
        categoryId: categoryId || null,
        bankAccountId: bankAccountId || null,
        date: date ? new Date(date) : new Date(),
        source: source === "sms" ? "sms" : "manual",
        rawSms: rawSms || null,
      },
      include: { category: true, bankAccount: true },
    });
    return NextResponse.json(transaction, { status: 201 });
  } catch {
    return NextResponse.json({ error: "خطا در ثبت تراکنش" }, { status: 500 });
  }
}
