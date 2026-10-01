import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PUT /api/categories/[id] - ویرایش دسته‌بندی
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, type, color, icon } = body;
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = String(name).trim();
    if (type !== undefined) data.type = type === "income" ? "income" : "expense";
    if (color !== undefined) data.color = color;
    if (icon !== undefined) data.icon = icon;
    const category = await db.category.update({ where: { id }, data });
    return NextResponse.json(category);
  } catch {
    return NextResponse.json({ error: "خطا در ویرایش دسته‌بندی" }, { status: 500 });
  }
}

// DELETE /api/categories/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.category.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "خطا در حذف دسته‌بندی" }, { status: 500 });
  }
}
