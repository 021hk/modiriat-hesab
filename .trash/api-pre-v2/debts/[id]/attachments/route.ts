import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const MAX_SIZE = 4 * 1024 * 1024; // 4MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

// POST /api/debts/[id]/attachments - افزودن عکس رسید
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const debt = await db.debt.findUnique({ where: { id } });
    if (!debt) return NextResponse.json({ error: "بدهی یافت نشد" }, { status: 404 });

    const body = await req.json();
    const { fileName, mimeType, data } = body;
    if (!fileName || !mimeType || !data) {
      return NextResponse.json({ error: "فایل نامعتبر است" }, { status: 400 });
    }
    if (!ALLOWED.includes(mimeType)) {
      return NextResponse.json({ error: "فرمت فایل پشتیبانی نمی‌شود" }, { status: 400 });
    }
    const size = Math.floor((data.length * 3) / 4);
    if (size > MAX_SIZE) {
      return NextResponse.json({ error: "حجم فایل بیش از ۴ مگابایت است" }, { status: 400 });
    }
    const count = await db.attachment.count({ where: { debtId: id } });
    if (count >= 10) {
      return NextResponse.json({ error: "حداکثر ۱۰ پیوست برای هر بدهی" }, { status: 400 });
    }
    const attachment = await db.attachment.create({
      data: { debtId: id, fileName, mimeType, data },
      select: { id: true, debtId: true, fileName: true, mimeType: true, createdAt: true },
    });
    return NextResponse.json(attachment, { status: 201 });
  } catch {
    return NextResponse.json({ error: "خطا در افزودن پیوست" }, { status: 500 });
  }
}
