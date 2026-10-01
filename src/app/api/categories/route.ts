import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/categories - لیست دسته‌بندی‌ها
export async function GET() {
  try {
    const categories = await db.category.findMany({
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
      include: { _count: { select: { transactions: true } } },
    });
    return NextResponse.json(categories);
  } catch {
    return NextResponse.json({ error: "خطا در دریافت دسته‌بندی‌ها" }, { status: 500 });
  }
}

// POST /api/categories - ساخت دسته‌بندی جدید
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, type, color, icon } = body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "نام دسته الزامی است" }, { status: 400 });
    }
    const category = await db.category.create({
      data: {
        name: name.trim(),
        type: type === "income" ? "income" : "expense",
        color: color || "#10b981",
        icon: icon || "Tag",
      },
    });
    return NextResponse.json(category, { status: 201 });
  } catch {
    return NextResponse.json({ error: "خطا در ساخت دسته‌بندی" }, { status: 500 });
  }
}
