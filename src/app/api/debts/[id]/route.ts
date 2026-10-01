import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PUT /api/debts/[id] - ویرایش/تسویه/پرداخت جزئی
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const existing = await db.debt.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "بدهی یافت نشد" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.type !== undefined) data.type = body.type;
    if (body.amount !== undefined) data.amount = Number(body.amount);
    if (body.phone !== undefined) data.phone = body.phone || null;
    if (body.description !== undefined) data.description = body.description || null;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;

    // پرداخت جزئی
    if (body.addPayment !== undefined) {
      const newPaid = Math.max(0, Math.min(existing.amount, existing.paidAmount + Number(body.addPayment)));
      data.paidAmount = newPaid;
      data.isSettled = newPaid >= existing.amount;
    }
    if (body.paidAmount !== undefined) {
      data.paidAmount = Number(body.paidAmount);
      data.isSettled = Number(body.paidAmount) >= (data.amount !== undefined ? Number(data.amount) : existing.amount);
    }
    if (body.isSettled !== undefined) {
      data.isSettled = Boolean(body.isSettled);
      if (data.isSettled === true) data.paidAmount = data.amount !== undefined ? Number(data.amount) : existing.amount;
      if (data.isSettled === false && data.paidAmount === undefined) data.paidAmount = existing.paidAmount === existing.amount ? 0 : existing.paidAmount;
    }

    const debt = await db.debt.update({ where: { id }, data, include: { attachments: true } });
    return NextResponse.json(debt);
  } catch {
    return NextResponse.json({ error: "خطا در ویرایش بدهی" }, { status: 500 });
  }
}

// DELETE /api/debts/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.debt.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "خطا در حذف بدهی" }, { status: 500 });
  }
}
