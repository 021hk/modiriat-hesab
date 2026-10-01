import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBankSms } from "@/lib/sms-parser";

// GET /api/sms - لیست پیامک‌ها
export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get("status");
    const where: Record<string, unknown> = {};
    if (status && ["pending", "imported", "ignored"].includes(status)) where.status = status;
    const logs = await db.smsLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json(logs);
  } catch {
    return NextResponse.json({ error: "خطا در دریافت پیامک‌ها" }, { status: 500 });
  }
}

// POST /api/sms - دریافت متن پیامک، پارس و ذخیره در صف
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, sender } = body;
    if (!text || typeof text !== "string" || text.trim().length < 3) {
      return NextResponse.json({ error: "متن پیامک نامعتبر است" }, { status: 400 });
    }
    const parsed = parseBankSms(text.trim());
    const log = await db.smsLog.create({
      data: {
        rawText: text.trim(),
        sender: sender || null,
        bankName: parsed.bankName,
        parsedType: parsed.type,
        parsedAmount: parsed.amount,
        status: parsed.confidence >= 0.55 ? "pending" : "pending",
      },
    });
    return NextResponse.json({ log, parsed }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "خطا در پردازش پیامک" }, { status: 500 });
  }
}
