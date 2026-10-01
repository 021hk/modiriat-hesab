import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PUT /api/transactions/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.type !== undefined) data.type = body.type;
    if (body.amount !== undefined) data.amount = Number(body.amount);
    if (body.purpose !== undefined) data.purpose = body.purpose || null;
    if (body.categoryId !== undefined) data.categoryId = body.categoryId || null;
    if (body.bankAccountId !== undefined) data.bankAccountId = body.bankAccountId || null;
    if (body.date !== undefined) data.date = new Date(body.date);
    const transaction = await db.transaction.update({
      where: { id },
      data,
      include: { category: true, bankAccount: true },
    });
    return NextResponse.json(transaction);
  } catch {
    return NextResponse.json({ error: "خطا در ویرایش تراکنش" }, { status: 500 });
  }
}

// DELETE /api/transactions/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.transaction.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "خطا در حذف تراکنش" }, { status: 500 });
  }
}
