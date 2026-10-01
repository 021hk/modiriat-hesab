import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/stats - آمار داشبورد
export async function GET() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [accounts, monthTx, prevMonthTx, openDebts, totalIncome, totalExpense, categoryStats] =
      await Promise.all([
        db.bankAccount.findMany({ where: { isArchived: false } }),
        db.transaction.findMany({ where: { date: { gte: startOfMonth } }, include: { category: true } }),
        db.transaction.findMany({ where: { date: { gte: startOfPrevMonth, lt: startOfMonth } } }),
        db.debt.findMany({ where: { isSettled: false } }),
        db.transaction.aggregate({ where: { type: "income" }, _sum: { amount: true } }),
        db.transaction.aggregate({ where: { type: "expense" }, _sum: { amount: true } }),
        db.transaction.findMany({
          where: { type: "expense", date: { gte: startOfMonth } },
          include: { category: true },
        }),
      ]);

    // مجموع کل تراکنش‌ها به تفکیک حساب
    const allTxs = await db.transaction.findMany({ select: { type: true, amount: true, bankAccountId: true } });
    const accountSummaries = accounts.map((acc) => {
      const accTxs = allTxs.filter((t) => t.bankAccountId === acc.id);
      const inc = accTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const exp = accTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      return {
        id: acc.id,
        name: acc.name,
        bankName: acc.bankName,
        color: acc.color,
        balance: Number(acc.initialBalance || 0) + inc - exp,
      };
    });

    const totalBalance = accountSummaries.reduce((sum, acc) => sum + acc.balance, 0);

    const monthIncome = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const monthExpense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const prevIncome = prevMonthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const prevExpense = prevMonthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

    const debtors = openDebts.filter((d) => d.type === "debtor");
    const creditors = openDebts.filter((d) => d.type === "creditor");
    const totalDueToMe = debtors.reduce((s, d) => s + (d.amount - d.paidAmount), 0);
    const totalIOwe = creditors.reduce((s, d) => s + (d.amount - d.paidAmount), 0);

    // هزینه ماه به تفکیک دسته
    const byCategory: Record<string, { name: string; color: string; total: number }> = {};
    for (const t of categoryStats) {
      const key = t.categoryId || "بدون دسته";
      if (!byCategory[key]) {
        byCategory[key] = {
          name: t.category?.name || "بدون دسته",
          color: t.category?.color || "#94a3b8",
          total: 0,
        };
      }
      byCategory[key].total += t.amount;
    }

    const recentTx = await db.transaction.findMany({
      orderBy: { date: "desc" },
      take: 8,
      include: { category: true, bankAccount: true },
    });

    return NextResponse.json({
      totalBalance,
      accountSummaries,
      monthIncome,
      monthExpense,
      prevIncome,
      prevExpense,
      totalDueToMe,
      totalIOwe,
      debtorCount: debtors.length,
      creditorCount: creditors.length,
      expenseByCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
      recentTx,
      txCount: { income: await db.transaction.count({ where: { type: "income" } }), expense: await db.transaction.count({ where: { type: "expense" } }) },
      totals: { income: totalIncome._sum.amount || 0, expense: totalExpense._sum.amount || 0 },
    });
  } catch {
    return NextResponse.json({ error: "خطا در دریافت آمار" }, { status: 500 });
  }
}
