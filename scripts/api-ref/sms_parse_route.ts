import { NextRequest, NextResponse } from "next/server";
import { parseBankSms } from "@/lib/sms-parser";

// POST /api/sms/parse - فقط پارس بدون ذخیره (پیش‌نمایش)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.text) return NextResponse.json({ error: "متن الزامی است" }, { status: 400 });
    const parsed = parseBankSms(String(body.text));
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "خطا در پردازش" }, { status: 500 });
  }
}
