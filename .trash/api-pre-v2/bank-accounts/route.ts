import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/bank-accounts
export async function GET() {
  try {
    const accounts = await db.bankAccount.findMany({
      orderBy: { createdAt: "asc" },
      include: { transactions: { orderBy: { date: "desc" }, take: 1 } },
    });
    return NextResponse.json(accounts);
  } catch {
    return NextResponse.json({ error: "خطا در دریافت حساب‌ها" }, { status: 500 });
  }
}

// POST /api/bank-accounts
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, bankName, accountNumber, cardNumber, iban, initialBalance, color } = body;
    if (!name || !bankName) {
      return NextResponse.json({ error: "نام حساب و بانک الزامی است" }, { status: 400 });
    }
    const account = await db.bankAccount.create({
      data: {
        name: String(name).trim(),
        bankName: String(bankName).trim(),
        accountNumber: accountNumber || null,
        cardNumber: cardNumber || null,
        iban: iban || null,
        initialBalance: Number(initialBalance || 0),
        color: color || "#8b5cf6",
      },
    });
    return NextResponse.json(account, { status: 201 });
  } catch {
    return NextResponse.json({ error: "خطا در ساخت حساب" }, { status: 500 });
  }
}
