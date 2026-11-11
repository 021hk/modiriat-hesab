import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/debts - بدهکاران و طلبکاران
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const type = sp.get("type"); // debtor | creditor
    const status = sp.get("status"); // open | settled
    const where: Record<string, unknown> = {};
    if (type === "debtor" || type === "creditor") where.type = type;
    if (status === "open") where.isSettled = false;
    if (status === "settled") where.isSettled = true;

    const debts = await db.debt.findMany({
      where,
      orderBy: [{ isSettled: "asc" }, { updatedAt: "desc" }],
      include: { attachments: { orderBy: { createdAt: "asc" } } },
    });
    return NextResponse.json(debts);
  } catch {
    return NextResponse.json({ error: "خطا در دریافت بدهی‌ها" }, { status: 500 });
  }
}

// POST /api/debts
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, type, amount, phone, description, dueDate } = body;
    if (!name || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "نام و مبلغ الزامی است" }, { status: 400 });
    }
    if (type !== "debtor" && type !== "creditor") {
      return NextResponse.json({ error: "نوع بدهی نامعتبر است" }, { status: 400 });
    }
    const debt = await db.debt.create({
      data: {
        name: String(name).trim(),
        type,
        amount: Number(amount),
        phone: phone || null,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: { attachments: true },
    });
    return NextResponse.json(debt, { status: 201 });
  } catch {
    return NextResponse.json({ error: "خطا در ثبت بدهی" }, { status: 500 });
  }
}
