"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Wallet, HandCoins, ScrollText, Landmark, ArrowLeft } from "lucide-react";
import { api, type Stats } from "@/lib/client-api";
import { formatMoney, formatDateShortFa } from "@/lib/format";

function Diff({ value, prev }: { value: number; prev: number }) {
  if (prev === 0) return null;
  const diff = ((value - prev) / prev) * 100;
  const up = diff >= 0;
  return (
    <span className={`text-xs ${up ? "text-emerald-600" : "text-red-500"}`}>
      {up ? "▲" : "▼"} {formatMoney(Math.abs(diff))}٪ نسبت به ماه قبل
    </span>
  );
}

export function Dashboard({ onGoToTab }: { onGoToTab?: (tab: string) => void }) {
  const { data, isLoading } = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: () => api.get("/api/stats"),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const maxCat = Math.max(1, ...data.expenseByCategory.map((c) => c.total));

  return (
    <div className="space-y-4">
      {/* موجودی کل */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-bl from-emerald-600 via-emerald-700 to-teal-900 p-6 text-white shadow-lg">
        <div className="absolute -left-8 -top-8 h-40 w-40 rounded-full bg-[rgba(255,255,255,0.1)]" />
        <div className="absolute -bottom-10 -right-4 h-32 w-32 rounded-full bg-[rgba(255,255,255,0.1)]" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-emerald-100">
            <Wallet className="h-4 w-4" />
            <span className="text-sm">موجودی کل حساب‌ها</span>
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">
            {formatMoney(data.totalBalance)}
            <span className="mr-2 text-base font-normal text-emerald-200">تومان</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.accountSummaries.length === 0 ? (
              <button
                onClick={() => onGoToTab?.("banks")}
                className="rounded-full bg-[rgba(255,255,255,0.15)] px-4 py-1.5 text-sm backdrop-blur transition hover:bg-[rgba(255,255,255,0.25)]"
              >
                + حساب بانکی خود را اضافه کنید
              </button>
            ) : (
              data.accountSummaries.map((acc) => (
                <div key={acc.id} className="flex items-center gap-1.5 rounded-full bg-[rgba(255,255,255,0.15)] px-3 py-1.5 text-xs backdrop-blur">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: acc.color }} />
                  <span>{acc.name}</span>
                  <span className="font-bold tabular-nums-persian">{formatMoney(acc.balance)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* کارت‌های آماری */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="border-emerald-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">درآمد این ماه</span>
              <div className="rounded-full bg-emerald-100 p-1.5 text-emerald-700">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-lg font-bold text-emerald-700 tabular-nums-persian">{formatMoney(data.monthIncome)}</div>
            <Diff value={data.monthIncome} prev={data.prevIncome} />
          </CardContent>
        </Card>
        <Card className="border-red-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">هزینه این ماه</span>
              <div className="rounded-full bg-red-100 p-1.5 text-red-600">
                <TrendingDown className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-lg font-bold text-red-600 tabular-nums-persian">{formatMoney(data.monthExpense)}</div>
            <Diff value={data.monthExpense} prev={data.prevExpense} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">از بدهکاران طلب دارم</span>
              <div className="rounded-full bg-amber-100 p-1.5 text-amber-700">
                <HandCoins className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-lg font-bold text-amber-700 tabular-nums-persian">{formatMoney(data.totalDueToMe)}</div>
            <span className="text-xs text-muted-foreground">{data.debtorCount} بدهکار فعال</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">به طلبکاران بدهکارم</span>
              <div className="rounded-full bg-orange-100 p-1.5 text-orange-700">
                <ScrollText className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-lg font-bold text-orange-700 tabular-nums-persian">{formatMoney(data.totalIOwe)}</div>
            <span className="text-xs text-muted-foreground">{data.creditorCount} طلبکار فعال</span>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* هزینه به تفکیک دسته */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">هزینه‌های این ماه به تفکیک دسته</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.expenseByCategory.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">هنوز هزینه‌ای ثبت نشده است</p>
            ) : (
              data.expenseByCategory.slice(0, 6).map((c) => (
                <div key={c.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </span>
                    <span className="font-medium tabular-nums-persian">{formatMoney(c.total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(c.total / maxCat) * 100}%`, backgroundColor: c.color }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* آخرین تراکنش‌ها */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">آخرین تراکنش‌ها</CardTitle>
            <button
              onClick={() => onGoToTab?.("transactions")}
              className="flex items-center gap-1 text-xs text-emerald-700 hover:underline"
            >
              مشاهده همه <ArrowLeft className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentTx.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">تراکنشی ثبت نشده است</p>
            ) : (
              data.recentTx.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between rounded-lg border p-2.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs ${
                        tx.type === "income" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                      }`}
                    >
                      {tx.type === "income" ? "+" : "-"}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{tx.purpose || tx.category?.name || (tx.type === "income" ? "درآمد" : "هزینه")}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {formatDateShortFa(tx.date)}
                        {tx.source === "sms" && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">
                            پیامکی
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-sm font-bold tabular-nums-persian ${
                      tx.type === "income" ? "text-emerald-700" : "text-red-600"
                    }`}
                  >
                    {tx.type === "income" ? "+" : "−"} {formatMoney(tx.amount)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* حساب‌ها */}
      {data.accountSummaries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark className="h-4 w-4 text-emerald-700" /> حساب‌های بانکی
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.accountSummaries.map((acc) => (
              <div key={acc.id} className="rounded-xl border p-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: acc.color }} />
                  <span className="text-sm font-medium">{acc.name}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">بانک {acc.bankName}</div>
                <div className="mt-2 text-lg font-bold tabular-nums-persian">{formatMoney(acc.balance)} <span className="text-xs font-normal text-muted-foreground">تومان</span></div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
