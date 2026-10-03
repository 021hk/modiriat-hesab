"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, ArrowLeftRight, HandCoins, Landmark, Tags, Settings as SettingsIcon, Wallet } from "lucide-react";
import { Dashboard } from "@/components/hesab/dashboard";
import { Transactions } from "@/components/hesab/transactions";
import { Debts } from "@/components/hesab/debts";
import { Banks } from "@/components/hesab/banks";
import { Categories } from "@/components/hesab/categories";
import { Settings } from "@/components/hesab/settings";
import { TxDialog } from "@/components/hesab/transactions";
import { api, type Category, type BankAccount } from "@/lib/client-api";
import { isNativeAndroid, getSmsPermission } from "@/lib/native-sms";
import { syncBankSms } from "@/lib/sms-sync";
import { useToast } from "@/hooks/use-toast";

const TABS = [
  { value: "dashboard", label: "داشبورد", icon: LayoutDashboard },
  { value: "transactions", label: "تراکنش‌ها", icon: ArrowLeftRight },
  { value: "debts", label: "بدهی‌ها", icon: HandCoins },
  { value: "banks", label: "حساب و پیامک", icon: Landmark },
  { value: "categories", label: "دسته‌بندی", icon: Tags },
  { value: "settings", label: "تنظیمات", icon: SettingsIcon },
];

function AppContent() {
  const [tab, setTab] = useState("dashboard");
  const [txOpen, setTxOpen] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  // همگام‌سازی خودکار پیامک‌های بانکی در باز شدن برنامه (فقط اندروید)
  useEffect(() => {
    void (async () => {
      try {
        if (!isNativeAndroid()) return;
        const p = await getSmsPermission();
        if (p !== "granted") return;
        const res = await syncBankSms();
        if (res.ok && (res.imported > 0 || res.queued > 0)) {
          qc.invalidateQueries();
          const desc =
            res.imported > 0
              ? `${res.imported.toLocaleString("fa-IR")} تراکنش خودکار ثبت شد${res.queued > 0 ? ` و ${res.queued.toLocaleString("fa-IR")} مورد در صف بررسی است` : ""}`
              : `${res.queued.toLocaleString("fa-IR")} پیامک در صف بررسی است`;
          toast({ title: "پیامک‌های بانکی بررسی شد", description: desc });
        }
      } catch {
        // بی‌صدا — همگام‌سازی نباید باز شدن برنامه را مختل کند
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/api/categories"),
  });
  const { data: accounts } = useQuery<BankAccount[]>({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get("/api/bank-accounts"),
  });

  return (
    <div className="flex min-h-screen flex-col">
      {/* هدر */}
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-bl from-emerald-500 to-emerald-700 text-white shadow">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">حساب‌یار</h1>
              <p className="text-[11px] leading-tight text-muted-foreground">مدیریت حساب، هزینه و بدهی</p>
            </div>
          </div>
          <Button size="sm" onClick={() => setTxOpen(true)} className="bg-emerald-700 hover:bg-emerald-800">
            <span className="text-lg leading-none">+</span>
            <span className="mr-1 text-xs">تراکنش</span>
          </Button>
        </div>
      </header>

      {/* محتوا */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-4 lg:pb-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 hidden w-full justify-start gap-1 overflow-x-auto rounded-xl bg-muted p-1 lg:flex">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="gap-1.5 px-4 py-2 text-sm data-[state=active]:bg-card data-[state=active]:shadow"
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="dashboard">
            <Dashboard onGoToTab={setTab} />
          </TabsContent>
          <TabsContent value="transactions">
            <Transactions categories={categories || []} accounts={accounts || []} />
          </TabsContent>
          <TabsContent value="debts">
            <Debts />
          </TabsContent>
          <TabsContent value="banks">
            <Banks onOpenTxDialog={() => setTxOpen(true)} />
          </TabsContent>
          <TabsContent value="categories">
            <Categories />
          </TabsContent>
          <TabsContent value="settings">
            <Settings />
          </TabsContent>
        </Tabs>
      </main>

      {/* ناوبری پایین موبایل */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto grid max-w-lg grid-cols-6">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] transition ${
                tab === t.value ? "text-emerald-700" : "text-muted-foreground"
              }`}
            >
              <t.icon className="h-5 w-5" />
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* فوتر */}
      <footer className="mt-auto hidden border-t bg-card py-4 lg:block">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-muted-foreground">
          حساب‌یار — نسخه ۲.۵.۰ | اپلیکیشن آفلاین — ثبت خودکار پیامک بانکی
        </div>
      </footer>

      {/* دیالوگ تراکنش سریع */}
      {txOpen && (
        <TxDialog open={txOpen} onOpenChange={setTxOpen} categories={categories || []} accounts={accounts || []} />
      )}
    </div>
  );
}

export default function Home() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, retry: 1 },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
