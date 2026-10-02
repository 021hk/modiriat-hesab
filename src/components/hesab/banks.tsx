"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Landmark,
  Wallet,
  MessageSquareText,
  Inbox,
  Download,
  CheckCheck,
  XCircle,
  Sparkles,
  BellRing,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import { api, type BankAccount, type SmsLog, type Transaction } from "@/lib/client-api";
import {
  formatMoney,
  formatMoneyU,
  parseMoneyInput,
  formatMoneyPlain,
  currencyLabel,
  toDisplayAmount,
  toStoredAmount,
} from "@/lib/format";
import {
  HesabSms,
  isNativeAndroid,
  getSmsPermission,
  requestSmsPermission,
  type SmsPermState,
} from "@/lib/native-sms";
import { syncBankSms, getLastSmsSync } from "@/lib/sms-sync";
import { getMeta, setMeta } from "@/lib/local-db";
import type { PluginListenerHandle } from "@capacitor/core";

const BANKS = [
  "ملت", "صادرات", "ملی", "تجارت", "پارسیان", "پاسارگاد", "سامان", "کشاورزی",
  "مسکن", "سپه", "صنعت و معدن", "اقتصاد نوین", "کارآفرین", "سینا", "دی", "پست بانک",
  "شهر", "آینده", "انصار", "قوامین", "رسالت", "رفاه", "توسعه صادرات", "سایر",
];

const COLORS = ["#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16", "#f97316"];

function AccountDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: BankAccount | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(editing?.name || "");
  const [bankName, setBankName] = useState(editing?.bankName || "");
  const [cardNumber, setCardNumber] = useState(editing?.cardNumber || "");
  const [accountNumber, setAccountNumber] = useState(editing?.accountNumber || "");
  const [iban, setIban] = useState(editing?.iban || "");
  const [smsSender, setSmsSender] = useState(editing?.smsSender || "");
  const [initialBalance, setInitialBalance] = useState(
    editing ? formatMoneyPlain(toDisplayAmount(editing.initialBalance)) : ""
  );
  const [color, setColor] = useState(editing?.color || COLORS[0]);

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        name,
        bankName,
        cardNumber: cardNumber || null,
        accountNumber: accountNumber || null,
        iban: iban || null,
        smsSender: smsSender.trim() || null,
        initialBalance: toStoredAmount(parseMoneyInput(initialBalance)),
        color,
      };
      if (editing) return api.put(`/api/bank-accounts/${editing.id}`, body);
      return api.post("/api/bank-accounts", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast({ title: editing ? "حساب ویرایش شد" : "حساب بانکی اضافه شد" });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? "ویرایش حساب" : "افزودن حساب بانکی"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>نام بانک</Label>
              <Select value={bankName} onValueChange={setBankName}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب بانک" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {BANKS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>نام نمایشی حساب</Label>
              <Input placeholder="مثلاً: ملت - جاری" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>شماره کارت (اختیاری)</Label>
              <Input dir="ltr" className="text-left" placeholder="6104-..." value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>شماره حساب (اختیاری)</Label>
              <Input dir="ltr" className="text-left" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>شماره شبا (اختیاری)</Label>
            <Input dir="ltr" className="text-left" placeholder="IR..." value={iban} onChange={(e) => setIban(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>شماره فرستنده پیامک بانک (برای خواندن خودکار)</Label>
            <Input dir="ltr" className="text-left" placeholder="9999, 5000142" value={smsSender} onChange={(e) => setSmsSender(e.target.value)} />
            <p className="text-xs text-muted-foreground leading-5">
              فقط پیامک‌های همین شماره(ها) خوانده می‌شود — چند شماره را با کاما جدا کنید. اگر چند حساب در یک بانک دارید،
              شماره حساب/کارت هر حساب را دقیق وارد کنید تا پیامک‌ها تفکیک شوند.
            </p>
          </div>
          <div className="grid gap-2">
            <Label>موجودی اولیه ({currencyLabel()})</Label>
            <Input
              inputMode="numeric"
              dir="ltr"
              className="text-left font-bold tabular-nums-persian"
              value={initialBalance ? formatMoneyPlain(parseMoneyInput(initialBalance)) : ""}
              onChange={(e) => setInitialBalance(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>رنگ</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full transition ${color === c ? "ring-2 ring-offset-2 ring-foreground" : ""}`}
                  style={{ backgroundColor: c }}
                  aria-label={`رنگ ${c}`}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !name.trim() || !bankName}
            className="bg-emerald-700 hover:bg-emerald-800"
          >
            {mutation.isPending ? "..." : editing ? "ذخیره" : "افزودن حساب"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const toFa = (n: number) => {
  try {
    return n.toLocaleString("fa-IR");
  } catch {
    return String(n);
  }
};

// ─── خواندن خودکار پیامک‌های بانکی (فقط اندروید) ───
function SmsAutoSync() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [perm, setPerm] = useState<SmsPermState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(0);
  const [autoImport, setAutoImport] = useState(true);

  const syncingRef = useRef(false);
  const optsRef = useRef({ autoImport: true });
  useEffect(() => {
    optsRef.current = { autoImport };
  }, [autoImport]);

  const runSync = useCallback(
    async (silent: boolean) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      setSyncing(true);
      try {
        const res = await syncBankSms({ ...optsRef.current });
        setLastSync(await getLastSmsSync());
        qc.invalidateQueries({ queryKey: ["sms-logs"] });
        qc.invalidateQueries({ queryKey: ["transactions"] });
        qc.invalidateQueries({ queryKey: ["stats"] });
        if (res.ok) {
          const parts: string[] = [];
          if (res.imported > 0) parts.push(`${toFa(res.imported)} تراکنش خودکار ثبت شد`);
          if (res.queued > 0) parts.push(`${toFa(res.queued)} پیامک در صف بررسی است`);
          if (res.skippedForeign > 0) parts.push(`${toFa(res.skippedForeign)} پیامک متعلق به حساب دیگری بود و نادیده گرفته شد`);
          const desc = parts.length > 0 ? parts.join(" — ") : "پیامک بانکی جدیدی نبود";
          if (!silent || res.imported > 0 || res.queued > 0) {
            toast({ title: "پیامک‌ها بررسی شد", description: desc });
          }
        } else if (!silent && res.reason === "no_senders") {
          toast({
            title: "شماره فرستنده پیامک تنظیم نشده است",
            description: "در ویرایش هر حساب بانکی، شماره فرستنده پیامک آن بانک را وارد کنید تا فقط پیامک‌های همان شماره خوانده شود",
            variant: "destructive",
          });
        } else if (!silent && res.reason === "permission") {
          toast({ title: "دسترسی پیامک داده نشده است", variant: "destructive" });
        } else if (!silent && res.reason === "error") {
          toast({ title: "خطا در خواندن پیامک‌ها", variant: "destructive" });
        }
      } catch {
        if (!silent) toast({ title: "خطا در همگام‌سازی", variant: "destructive" });
      } finally {
        syncingRef.current = false;
        setSyncing(false);
      }
    },
    [qc, toast]
  );

  // بارگذاری اولیه + sync خودکار در باز شدن تب
  useEffect(() => {
    if (!isNativeAndroid()) return;
    setMounted(true);
    void (async () => {
      const [p, ls, ai] = await Promise.all([
        getSmsPermission(),
        getLastSmsSync(),
        getMeta<boolean>("smsAutoImport"),
      ]);
      setPerm(p);
      setLastSync(ls || 0);
      if (ai === false) setAutoImport(false);
      if (p === "granted") void runSync(true);
    })();
  }, [runSync]);

  // گوش دادن به پیامک زنده (وقتی برنامه باز است)
  useEffect(() => {
    if (!isNativeAndroid()) return;
    let handle: PluginListenerHandle | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    HesabSms.addListener("smsReceived", () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void runSync(true), 3000);
    })
      .then((h) => {
        handle = h;
      })
      .catch(() => {});
    return () => {
      if (timer) clearTimeout(timer);
      void handle?.remove();
    };
  }, [runSync]);

  const askPermission = async () => {
    const p = await requestSmsPermission();
    setPerm(p);
    if (p === "granted") {
      toast({ title: "دسترسی پیامک فعال شد" });
      void runSync(false);
    } else if (p === "denied") {
      toast({
        title: "دسترسی رد شد",
        description: "از تنظیمات گوشی ← برنامه‌ها ← حساب‌یار ← مجوزها، دسترسی پیامک را فعال کنید",
        variant: "destructive",
      });
    }
  };

  if (!mounted || perm === null) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="h-4 w-4 text-emerald-700" />
          خواندن خودکار پیامک بانکی
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {perm !== "granted" ? (
          <div className="flex items-start gap-3 rounded-xl border bg-amber-50 p-3 dark:bg-amber-950/30">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-2">
              <p className="text-xs leading-5">
                برای ثبت خودکار واریز و برداشت، برنامه باید پیامک‌های بانکی را بخواند.
                هیچ داده‌ای از گوشی شما خارج نمی‌شود و همه‌چیز روی خود دستگاه ذخیره می‌شود.
              </p>
              <Button size="sm" onClick={askPermission} className="bg-emerald-700 hover:bg-emerald-800">
                <ShieldCheck className="ml-1 h-4 w-4" /> اجازه دسترسی به پیامک‌ها
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>دسترسی فعال — {lastSync > 0 ? `آخرین بررسی: ${new Date(lastSync).toLocaleString("fa-IR")}` : "هنوز بررسی نشده"}</span>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={syncing} onClick={() => void runSync(false)}>
                <RefreshCw className={`ml-1 h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "در حال بررسی..." : "بررسی الان"}
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div className="pl-3">
                <div className="text-sm font-medium">ثبت خودکار تراکنش‌ها</div>
                <p className="text-[11px] leading-4 text-muted-foreground">
                  پیامک‌های واریز/برداشت با مبلغ واضح، بدون دست وارد شوند؛ موارد نامطمئن در صف بررسی می‌مانند
                </p>
              </div>
              <Switch
                checked={autoImport}
                onCheckedChange={(v) => {
                  setAutoImport(v);
                  void setMeta("smsAutoImport", v);
                }}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SmsSection({ accounts }: { accounts: BankAccount[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<{ type: string; amount: number | null; bankName: string | null; confidence: number } | null>(null);
  const [importLog, setImportLog] = useState<SmsLog | null>(null);
  const [importType, setImportType] = useState<"income" | "expense">("expense");
  const [importAmount, setImportAmount] = useState("");
  const [importPurpose, setImportPurpose] = useState("");
  const [importAccount, setImportAccount] = useState("");

  const { data: logs, isLoading } = useQuery<SmsLog[]>({
    queryKey: ["sms-logs"],
    queryFn: () => api.get("/api/sms"),
  });

  const parseMutation = useMutation({
    mutationFn: (t: string) => api.post<{ type: string; amount: number | null; bankName: string | null; confidence: number }>("/api/sms/parse", { text: t }),
    onSuccess: (p) => {
      setPreview(p);
      if (p.confidence < 0.55) {
        toast({ title: "تشخیص نامطمئن", description: "پیامک ذخیره شد ولی نوع یا مبلغ مشخص نشد. می‌توانید دستی وارد کنید.", variant: "destructive" });
      }
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ log: SmsLog }>("/api/sms", { text });
      return res.log;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sms-logs"] });
      toast({ title: "پیامک به صف وارد شد" });
      setText("");
      setPreview(null);
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.put(`/api/sms/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sms-logs"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast({ title: "انجام شد" });
      setImportLog(null);
      setImportPurpose("");
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/sms/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sms-logs"] }),
  });

  const pending = (logs || []).filter((l) => l.status === "pending");
  const processed = (logs || []).filter((l) => l.status !== "pending");

  return (
    <div className="space-y-4">
      {/* خواندن خودکار پیامک (فقط در اپ اندروید نمایش داده می‌شود) */}
      <SmsAutoSync />

      {/* ورود پیامک */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareText className="h-4 w-4 text-emerald-700" />
            ورود پیامک بانکی
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs leading-5 text-muted-foreground">
            پیامک واریز یا برداشت بانک را کپی و اینجا بچسبانید. نرم‌افزار به‌طور خودکار نوع (واریز/برداشت)، مبلغ و نام بانک را تشخیص می‌دهد.
            در نسخه اندروید، پیامک‌ها به‌صورت خودکار خوانده و وارد می‌شوند.
          </p>
          <textarea
            dir="rtl"
            rows={3}
            className="w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-[rgba(5,150,105,0.4)]"
            placeholder="مثال: بانک ملت: برداشت مبلغ 500,000 ریال از حساب 1234 بابت خرید"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {preview && (
            <div className="rounded-xl border bg-muted/50 p-3 text-sm">
              <div className="mb-1 flex items-center gap-1.5 font-medium text-emerald-800">
                <Sparkles className="h-4 w-4" /> نتیجه تشخیص خودکار
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs text-muted-foreground">نوع</div>
                  <div className="font-bold">{preview.type === "income" ? "واریز ↑" : preview.type === "expense" ? "برداشت ↓" : "نامشخص"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">مبلغ</div>
                  <div className="font-bold tabular-nums-persian">{preview.amount ? formatMoneyU(preview.amount) : "نامشخص"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">بانک</div>
                  <div className="font-bold">{preview.bankName || "نامشخص"}</div>
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => parseMutation.mutate(text)}
              disabled={!text.trim() || parseMutation.isPending}
              className="flex-1"
            >
              پیش‌نمایش تشخیص
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!text.trim() || saveMutation.isPending} className="flex-1 bg-emerald-700 hover:bg-emerald-800">
              <Inbox className="ml-1 h-4 w-4" /> افزودن به صف
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* صف پیامک‌ها */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            صف پیامک‌ها {pending.length > 0 && <Badge className="mr-1 bg-emerald-700">{pending.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <Skeleton className="h-20 rounded-xl" />
          ) : pending.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">پیامک جدیدی در صف نیست</p>
          ) : (
            pending.map((log) => (
              <div key={log.id} className="rounded-xl border p-3">
                <p className="text-xs leading-5 text-muted-foreground" dir="rtl">
                  {log.rawText}
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant={log.parsedType === "income" ? "default" : "destructive"} className={log.parsedType === "income" ? "bg-emerald-700" : ""}>
                      {log.parsedType === "income" ? "واریز" : log.parsedType === "expense" ? "برداشت" : "نامشخص"}
                    </Badge>
                    <span className="font-bold tabular-nums-persian">{log.parsedAmount ? formatMoneyU(log.parsedAmount) : "؟"}</span>
                    {log.bankName && <span className="text-muted-foreground">• بانک {log.bankName}</span>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" className="h-7 bg-emerald-700 text-xs hover:bg-emerald-800" onClick={() => { setImportType(log.parsedType === "income" ? "income" : "expense"); setImportAmount(log.parsedAmount ? formatMoneyPlain(toDisplayAmount(log.parsedAmount)) : ""); setImportLog(log); }}>
                      <Download className="ml-1 h-3 w-3" /> ثبت تراکنش
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => actionMutation.mutate({ id: log.id, body: { action: "ignore" } })}
                    >
                      <XCircle className="ml-1 h-3 w-3" /> نادیده
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteMutation.mutate(log.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* تاریخچه پردازش‌شده */}
      {processed.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">پردازش‌شده‌ها</CardTitle>
          </CardHeader>
          <CardContent className="max-h-48 space-y-1.5 overflow-y-auto">
            {processed.map((log) => (
              <div key={log.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
                <span className="line-clamp-1 max-w-[60%] text-muted-foreground">{log.rawText}</span>
                <div className="flex items-center gap-2">
                  {log.status === "imported" ? (
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-300">
                      <CheckCheck className="ml-1 h-3 w-3" /> ثبت شد
                    </Badge>
                  ) : (
                    <Badge variant="secondary">نادیده</Badge>
                  )}
                  <button onClick={() => deleteMutation.mutate(log.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* دیالوگ ثبت تراکنش از پیامک */}
      <Dialog open={!!importLog} onOpenChange={(v) => !v && setImportLog(null)}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>ثبت تراکنش از پیامک</DialogTitle>
          </DialogHeader>
          {importLog && (
            <div className="grid gap-4 py-1">
              <p className="rounded-lg bg-muted p-2 text-xs leading-5 text-muted-foreground">{importLog.rawText}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>نوع تراکنش</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setImportType("income")}
                      className={`rounded-xl border-2 p-2 text-sm font-medium transition ${
                        importType === "income"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      واریز ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportType("expense")}
                      className={`rounded-xl border-2 p-2 text-sm font-medium transition ${
                        importType === "expense"
                          ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      برداشت ↓
                    </button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>مبلغ {currencyLabel()} (قابل اصلاح)</Label>
                  <SmsAmountInput
                    initial={importLog.parsedAmount ?? null}
                    value={importAmount}
                    onChange={setImportAmount}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>بابت (اختیاری)</Label>
                <Input placeholder="مثلاً: خرید از فروشگاه" value={importPurpose} onChange={(e) => setImportPurpose(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>حساب بانکی</Label>
                <Select value={importAccount} onValueChange={setImportAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب حساب" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون حساب</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} {importLog.bankName && a.bankName.includes(importLog.bankName) ? "✓" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportLog(null)}>
              انصراف
            </Button>
            <Button
              className="bg-emerald-700 hover:bg-emerald-800"
              disabled={actionMutation.isPending || parseMoneyInput(importAmount) <= 0}
              onClick={() =>
                importLog &&
                actionMutation.mutate({
                  id: importLog.id,
                  body: {
                    action: "import",
                    type: importType,
                    amount: toStoredAmount(parseMoneyInput(importAmount)),
                    purpose: importPurpose || null,
                    bankAccountId: importAccount || null,
                  },
                })
              }
            >
              {actionMutation.isPending ? "..." : "ثبت"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SmsAmountInput({ initial, value, onChange }: { initial: number | null; value: string; onChange: (v: string) => void }) {
  return (
    <Input
      inputMode="numeric"
      dir="ltr"
      className="text-left font-bold tabular-nums-persian"
      value={value ? formatMoneyPlain(parseMoneyInput(value)) : ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Banks({ onOpenTxDialog }: { onOpenTxDialog?: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);

  const { data: accounts, isLoading } = useQuery<BankAccount[]>({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get("/api/bank-accounts"),
  });

  const { data: transactions } = useQuery<Transaction[]>({
    queryKey: ["transactions", "all"],
    queryFn: () => api.get("/api/transactions?limit=500"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/bank-accounts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast({ title: "حساب حذف شد" });
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button onClick={() => { setEditing(null); setAddOpen(true); }} className="bg-emerald-700 hover:bg-emerald-800">
          <Plus className="ml-1 h-4 w-4" /> حساب جدید
        </Button>
        {onOpenTxDialog && (
          <Button variant="outline" onClick={onOpenTxDialog}>
            <Wallet className="ml-1 h-4 w-4" /> ثبت تراکنش دستی
          </Button>
        )}
      </div>

      {/* کارت حساب‌ها */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : !accounts || accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Landmark className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium">حساب بانکی ثبت نشده</p>
            <p className="text-sm text-muted-foreground">می‌توانید چند حساب بانکی اضافه کنید و پیامک‌های هر کدام را مدیریت کنید</p>
            <Button onClick={() => setAddOpen(true)} className="mt-2 bg-emerald-700 hover:bg-emerald-800">
              <Plus className="ml-1 h-4 w-4" /> افزودن اولین حساب
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {accounts.some((a) => !a.smsSender) && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
              برای خواندن خودکار پیامک، شماره فرستنده پیامک بانک را در ویرایش حساب وارد کنید (مثل 9999).
              بدون آن هیچ پیامکی خوانده نمی‌شود. اگر چند حساب در یک بانک دارید، شماره حساب/کارت هرکدام را هم وارد کنید تا پیامک‌ها تفکیک شوند.
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => {
            const accTxs = (transactions || []).filter((t) => t.bankAccountId === acc.id);
            const inc = accTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
            const exp = accTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
            const balance = acc.initialBalance + inc - exp;
            const maskedCard = acc.cardNumber ? `•••• ${acc.cardNumber.slice(-4)}` : null;
            return (
              <Card key={acc.id} className="relative overflow-hidden py-0">
                <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: acc.color }} />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold">{acc.name}</div>
                      <div className="text-xs text-muted-foreground">بانک {acc.bankName}</div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditing(acc); setAddOpen(true); }}>
                          <Pencil className="ml-2 h-4 w-4" /> ویرایش
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => {
                            if (confirm(`حذف حساب ${acc.name}؟ تراکنش‌هایش حذف نمی‌شوند.`)) deleteMutation.mutate(acc.id);
                          }}
                        >
                          <Trash2 className="ml-2 h-4 w-4" /> حذف
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {maskedCard && <div dir="ltr" className="mt-2 text-sm tracking-widest text-muted-foreground">{maskedCard}</div>}
                  {acc.smsSender && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                      <MessageSquareText className="h-3.5 w-3.5" />
                      <span dir="ltr">{acc.smsSender}</span>
                      <span className="text-muted-foreground">— پیامک این شماره خوانده می‌شود</span>
                    </div>
                  )}
                  <div className="mt-3 text-2xl font-bold tabular-nums-persian">
                    {formatMoneyU(balance)}
                    <span className="mr-1 text-xs font-normal text-muted-foreground">{currencyLabel()}</span>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>موجودی اولیه</span>
                      <span className="tabular-nums-persian">{formatMoneyU(acc.initialBalance)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                      <span>جمع واریز</span>
                      <span className="tabular-nums-persian">+{formatMoneyU(inc)}</span>
                    </div>
                    <div className="flex justify-between text-red-600 dark:text-red-400">
                      <span>جمع برداشت</span>
                      <span className="tabular-nums-persian">−{formatMoneyU(exp)}</span>
                    </div>
                    <Progress value={Math.min(100, (exp / Math.max(1, inc)) * 100)} className="mt-1 h-1" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
          </div>
        </>
      )}

      <SmsSection accounts={accounts || []} />

      {addOpen && <AccountDialog open={addOpen} onOpenChange={setAddOpen} editing={editing} />}
    </div>
  );
}
