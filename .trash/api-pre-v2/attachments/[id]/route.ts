import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/attachments/[id] - نمایش عکس/فایل
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const att = await db.attachment.findUnique({ where: { id } });
    if (!att) return NextResponse.json({ error: "پیوست یافت نشد" }, { status: 404 });
    const buffer = Buffer.from(att.data, "base64");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": att.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "خطا در دریافت پیوست" }, { status: 500 });
  }
}

// DELETE /api/attachments/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.attachment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "خطا در حذف پیوست" }, { status: 500 });
  }
}
