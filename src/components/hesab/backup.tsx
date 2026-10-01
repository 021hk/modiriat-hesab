"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, DatabaseBackup, ShieldCheck, RefreshCw, AlertTriangle } from "lucide-react";
import { api } from "@/lib/client-api";

export function Backup() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] = useState<unknown>(null);
  const [backupInfo, setBackupInfo] = useState<{ categories: number; bankAccounts: number; transactions: number; debts: number; attachments: number } | null>(null);

  const exportMutation = useMutation({
    mutationFn: async () => {
      window.location.href = "/api/backup";
    },
  });

  const importMutation = useMutation({
    mutationFn: (backup: unknown) => api.post<{ ok: boolean; counts: Record<string, number> }>("/api/backup", { backup }),
    onSuccess: (res) => {
      qc.invalidateQueries();
      toast({
        title: "بازیابی کامل شد",
        description: `${res.counts.transactions} تراکنش، ${res.counts.debts} بدهی، ${res.counts.categories} دسته و ${res.counts.bankAccounts} حساب وارد شد.`,
      });
      setPendingBackup(null);
      setBackupInfo(null);
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (json?.app !== "modiriat-hesab" || !json?.data) {
        toast({ title: "فایل نامعتبر", description: "این فایل پشتیبان حساب‌یار نیست", variant: "destructive" });
        return;
      }
      setPendingBackup(json);
      setBackupInfo({
        categories: (json.data.categories || []).length,
        bankAccounts: (json.data.bankAccounts || []).length,
        transactions: (json.data.transactions || []).length,
        debts: (json.data.debts || []).length,
        attachments: (json.data.attachments || []).length,
      });
    } catch {
      toast({ title: "خطا", description: "فایل قابل خواندن نیست", variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <DatabaseBackup className="h-5 w-5 text-emerald-700" />
            پشتیبان‌گیری
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm leading-6 text-muted-foreground">
            کل داده‌های شما (تراکنش‌ها، دسته‌بندی‌ها، حساب‌های بانکی، بدهکاران و طلبکاران و عکس رسیدها) در یک فایل JSON
            ذخیره می‌شود. این فایل را روی هر دستگاه دیگری با همین نرم‌افزار باز کنید و بازیابی کنید — پشتیبان بین همه
            دستگاه‌ها و نسخه‌ها قابل جابه‌جایی است.
          </p>
          <Button
            onClick={() => exportMutation.mutate()}
            className="w-full bg-emerald-700 hover:bg-emerald-800"
            size="lg"
          >
            <Download className="ml-2 h-4 w-4" /> دانلود فایل پشتیبان
          </Button>
          <div className="rounded-xl bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mb-1 h-4 w-4 text-emerald-600" />
            توصیه: هر هفته یک نسخه پشتیبان تهیه و در جای امن (مثلاً تلگرام سیو شده یا گوگل‌درایو) نگه دارید.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-5 w-5 text-emerald-700" />
            بازیابی از فایل پشتیبان
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm leading-6 text-muted-foreground">
            فایل پشتیبان را انتخاب کنید. محتوای فایل به داده‌های فعلی <b>اضافه</b> می‌شود (داده‌های فعلی حذف نمی‌شوند)،
            بنابراین می‌توانید پشتیبان گوشی را روی کامپیوتر و بالعکس بازیابی کنید.
          </p>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFileChange} />
          <Button variant="outline" size="lg" className="w-full" onClick={() => fileRef.current?.click()}>
            <RefreshCw className="ml-2 h-4 w-4" /> انتخاب فایل پشتیبان
          </Button>

          {backupInfo && (
            <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
              <div className="mb-2 text-sm font-bold text-emerald-900">فایل معتبر است — خلاصه محتوا:</div>
              <div className="grid grid-cols-2 gap-1.5 text-xs text-emerald-800 sm:grid-cols-3">
                <Badge variant="secondary">{backupInfo.transactions} تراکنش</Badge>
                <Badge variant="secondary">{backupInfo.categories} دسته</Badge>
                <Badge variant="secondary">{backupInfo.bankAccounts} حساب</Badge>
                <Badge variant="secondary">{backupInfo.debts} بدهی</Badge>
                <Badge variant="secondary">{backupInfo.attachments} عکس</Badge>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  className="flex-1 bg-emerald-700 hover:bg-emerald-800"
                  onClick={() => importMutation.mutate(pendingBackup)}
                  disabled={importMutation.isPending}
                >
                  {importMutation.isPending ? "در حال بازیابی..." : "تأیید و بازیابی"}
                </Button>
                <Button variant="outline" onClick={() => { setPendingBackup(null); setBackupInfo(null); }}>
                  انصراف
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            نکته درباره انتقال بین دستگاه‌ها
          </div>
          <Separator className="mb-3" />
          <ul className="list-inside list-disc space-y-1.5 text-xs leading-5 text-muted-foreground">
            <li>چون نرم‌افزار تحت وب است، با ورود از هر دستگاهی (گوشی، ویندوز، مک، لینوکس) داده‌های یکسانی را می‌بینید.</li>
            <li>فایل پشتیبان برای زمانی است که بخواهید داده‌ها را روی سرور دیگری منتقل کنید یا نسخه‌ای آفلاین نگه دارید.</li>
            <li>عکس رسیدها هم داخل فایل پشتیبان ذخیره می‌شوند و جای دیگری لازم نیست.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
