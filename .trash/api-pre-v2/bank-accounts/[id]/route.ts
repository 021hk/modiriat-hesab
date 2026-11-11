import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PUT /api/bank-accounts/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.bankName !== undefined) data.bankName = String(body.bankName).trim();
    if (body.accountNumber !== undefined) data.accountNumber = body.accountNumber || null;
    if (body.cardNumber !== undefined) data.cardNumber = body.cardNumber || null;
    if (body.iban !== undefined) data.iban = body.iban || null;
    if (body.initialBalance !== undefined) data.initialBalance = Number(body.initialBalance);
    if (body.color !== undefined) data.color = body.color;
    if (body.isArchived !== undefined) data.isArchived = Boolean(body.isArchived);
    const account = await db.bankAccount.update({ where: { id }, data });
    return NextResponse.json(account);
  } catch {
    return NextResponse.json({ error: "خطا در ویرایش حساب" }, { status: 500 });
  }
}

// DELETE /api/bank-accounts/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.bankAccount.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "خطا در حذف حساب" }, { status: 500 });
  }
}
