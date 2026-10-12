"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Camera,
  Phone,
  HandCoins,
  CheckCircle2,
  ImagePlus,
  X,
  Search,
  TrendingUp,
  TrendingDown,
  Scale,
  ChevronDown,
} from "lucide-react";
import { api, compressImage, type Debt, type Attachment, type Transaction } from "@/lib/client-api";
import {
  formatMoney,
  formatMoneyU,
  parseMoneyInput,
  formatMoneyPlain,
  formatDateFa,
  currencyLabel,
  toDisplayAmount,
  toStoredAmount,
  normalizeSearch,
  searchTokens,
  matchesAllTokens,
} from "@/lib/format";
import { personKey, summarizePerson, debtLinkLabel, debtRemaining } from "@/lib/debt-utils";

type DebtFormState = {
  name: string;
  type: "debtor" | "creditor";
  amount: string;
  phone: string;
  description: string;
  dueDate: string;
};

const emptyForm: DebtFormState = {
  name: "",
  type: "debtor",
  amount: "",
  phone: "",
  description: "",
  dueDate: "",
};

function DebtDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Debt | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<DebtFormState>({
    name: editing?.name || "",
    type: editing?.type || "debtor",
    amount: editing ? formatMoneyPlain(toDisplayAmount(editing.amount)) : "",
    phone: editing?.phone || "",
    description: editing?.description || "",
    dueDate: editing?.dueDate ? editing.dueDate.slice(0, 10) : "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        type: form.type,
        amount: toStoredAmount(parseMoneyInput(form.amount)),
        phone: form.phone || null,
        description: form.description || null,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      };
      if (editing) return api.put(`/api/debts/${editing.id}`, body);
      return api.post("/api/debts", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debts"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast({ title: editing ? "بدهی ویرایش شد" : "بدهی ثبت شد" });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? "ویرایش بدهی" : "ثبت بدهی جدید"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, type: "debtor" })}
              className={`rounded-xl border-2 p-3 text-sm font-medium transition ${
                form.type === "debtor"
                  ? "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  : "border-border text-muted-foreground"
              }`}
            >
              بدهکار <span className="block text-[10px] opacity-70">به من بدهکار است (طلب من)</span>
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: "creditor" })}
              className={`rounded-xl border-2 p-3 text-sm font-medium transition ${
                form.type === "creditor"
                  ? "border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300"
                  : "border-border text-muted-foreground"
              }`}
            >
              طلبکار <span className="block text-[10px] opacity-70">من بدهکار او هستم (بدهی من)</span>
            </button>
          </div>
          <div className="grid gap-2">
            <Label>نام شخص</Label>
            <Input
              placeholder="مثلاً: علی محمدی"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>مبلغ کل ({currencyLabel()})</Label>
            <Input
              inputMode="numeric"
              dir="ltr"
              className="text-left font-bold tabular-nums-persian"
              value={form.amount ? formatMoneyPlain(parseMoneyInput(form.amount)) : ""}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>شماره تماس (اختیاری)</Label>
              <Input
                dir="ltr"
                className="text-left"
                placeholder="0912..."
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>موعد تسویه (اختیاری)</Label>
              <Input
                type="date"
                className="tabular-nums-persian"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>توضیحات (اختیاری)</Label>
            <Textarea
              placeholder="مثلاً: قرض خرید لپ‌تاپ"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.name.trim() || parseMoneyInput(form.amount) <= 0}
            className="bg-emerald-700 hover:bg-emerald-800"
          >
            {mutation.isPending ? "..." : editing ? "ذخیره تغییرات" : "ثبت"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ debt, open, onOpenChange }: { debt: Debt; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const remaining = debt.amount - debt.paidAmount;

  const mutation = useMutation({
    mutationFn: () => api.put(`/api/debts/${debt.id}`, { addPayment: toStoredAmount(parseMoneyInput(amount)) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debts"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast({ title: "پرداخت ثبت شد" });
      setAmount("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>ثبت پرداخت از {debt.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          مانده بدهی: <span className="font-bold text-foreground tabular-nums-persian">{formatMoneyU(remaining)}</span> {currencyLabel()}
        </p>
        <Input
          inputMode="numeric"
          dir="ltr"
          className="text-left font-bold tabular-nums-persian"
          placeholder={formatMoneyPlain(toDisplayAmount(remaining))}
          value={amount ? formatMoneyPlain(parseMoneyInput(amount)) : ""}
          onChange={(e) => setAmount(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || parseMoneyInput(amount) <= 0}
            className="bg-emerald-700 hover:bg-emerald-800"
          >
            ثبت پرداخت
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// نمایش عکس پیوست از دیتابیس محلی (بدون سرور)
function AttImg({ attId, fileName, className }: { attId: string; fileName: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .get<{ id: string; dataUrl: string }>(`/api/attachments/${attId}`)
      .then((r) => {
        if (alive) setSrc(r.dataUrl);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [attId]);
  if (!src) return <div className={`${className} animate-pulse bg-muted`} />;
  return <img src={src} alt={fileName} className={className} />;
}

// ─── کارت شخص — گروه رکوردهای هم‌نام ───
// ترتیب نمایش مثل دفتر باستان: ۱) نام شخص  ۲) گردش بدهی و گردش طلب  ۳) وضعیت نهایی (طلب دارید یا بدهی دارید)
// و «ریز جزئیات» بازشدنی: چقد پرداخت و چقد برداشت/دریافت شده با عنوان خودکار هر تراکنش
type PersonGroup = { key: string; name: string; records: Debt[] };

function PersonCard({ group, linkedTxs }: { group: PersonGroup; linkedTxs: Transaction[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [payFor, setPayFor] = useState<Debt | null>(null);
  const [editFor, setEditFor] = useState<Debt | null>(null);
  const [viewImg, setViewImg] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const records = group.records;
  const primary = records[0];
  const multi = records.length > 1;
  const summary = useMemo(() => summarizePerson(records), [records]);
  const totalAmount = summary.turnClaim + summary.turnDebt;
  const totalPaid = summary.claimReceived + summary.debtRepaid;
  const totalRemain = summary.remainClaim + summary.remainDebt;
  const pct = totalAmount > 0 ? Math.min(100, (totalPaid / totalAmount) * 100) : 0;

  // تراکنش‌های متصل به رکوردهای این شخص — عنوان هرکدام خودکار از نوع تراکنش + نوع رکورد می‌آید
  const linked = useMemo(() => {
    const ids = new Set(records.map((r) => r.id));
    return linkedTxs
      .filter((t) => t.debtId && ids.has(t.debtId))
      .sort((a, b) => (a.date > b.date ? -1 : 1));
  }, [records, linkedTxs]);
  const recTypeById = useMemo(() => new Map(records.map((r) => [r.id, r.type] as const)), [records]);
  const paidOut = linked.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const paidOutCount = linked.filter((t) => t.type === "expense").length;
  const receivedIn = linked.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const receivedInCount = linked.filter((t) => t.type === "income").length;

  const attachments = useMemo(() => records.flatMap((r) => r.attachments), [records]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["debts"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const compressed = await compressImage(file);
      return api.post(`/api/debts/${primary.id}/attachments`, compressed);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "عکس رسید اضافه شد" });
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
    onSettled: () => setUploading(false),
  });

  const deleteAttMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/attachments/${id}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "عکس حذف شد" });
    },
  });

  const settleMutation = useMutation({
    mutationFn: ({ record, settled }: { record: Debt; settled: boolean }) =>
      api.put(`/api/debts/${record.id}`, { isSettled: settled }),
    onSuccess: () => {
      invalidate();
      toast({ title: "وضعیت به‌روزرسانی شد" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/debts/${id}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "بدهی حذف شد" });
    },
  });

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      uploadMutation.mutate(file);
    }
    e.target.value = "";
  };

  const statusBadge =
    summary.status === "claim"
      ? {
          cls: "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300",
          label: `طلب دارید — ${formatMoneyU(summary.remainClaim)} ${currencyLabel()}`,
        }
      : summary.status === "debt"
        ? {
            cls: "bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-900/40 dark:text-orange-300",
            label: `بدهی دارید — ${formatMoneyU(summary.remainDebt)} ${currencyLabel()}`,
          }
        : {
            cls: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-300",
            label: "تسویه شده",
          };

  const avatarCls =
    summary.status === "claim"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
      : summary.status === "debt"
        ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300"
        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300";

  const openRecord = records.find((r) => !r.isSettled && debtRemaining(r) > 0);

  return (
    <Card className="py-0 overflow-hidden">
      <div
        className={`h-1.5 w-full ${
          summary.status === "claim" ? "bg-amber-400" : summary.status === "debt" ? "bg-orange-400" : "bg-emerald-400"
        }`}
      />
      <CardContent className="p-4">
        {/* ۱) نام شخص + وضعیت نهایی */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold text-lg ${avatarCls}`}>
              {group.name.trim().charAt(0) || "؟"}
            </div>
            <div>
              <span className="text-base font-bold">{group.name}</span>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <Badge className={statusBadge.cls}>{statusBadge.label}</Badge>
                {multi && (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    {formatMoney(records.length)} رکورد
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {records.map((r, i) => {
                const q = multi ? (r.type === "debtor" ? " (طلب)" : " (بدهی)") : "";
                return (
                  <div key={r.id}>
                    <DropdownMenuItem onClick={() => setEditFor(r)}>
                      <Pencil className="ml-2 h-4 w-4" /> ویرایش{q}
                    </DropdownMenuItem>
                    {!r.isSettled && debtRemaining(r) > 0 && (
                      <DropdownMenuItem onClick={() => setPayFor(r)}>
                        <HandCoins className="ml-2 h-4 w-4" /> ثبت پرداخت{q}
                      </DropdownMenuItem>
                    )}
                    {!r.isSettled ? (
                      <DropdownMenuItem onClick={() => settleMutation.mutate({ record: r, settled: true })}>
                        <CheckCircle2 className="ml-2 h-4 w-4" /> تسویه کامل{q}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => settleMutation.mutate({ record: r, settled: false })}>
                        <X className="ml-2 h-4 w-4" /> لغو تسویه{q}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => {
                        if (confirm(`حذف ${r.type === "debtor" ? "رکورد طلب" : "رکورد بدهی"} ${r.name}؟`))
                          deleteMutation.mutate(r.id);
                      }}
                    >
                      <Trash2 className="ml-2 h-4 w-4" /> حذف{q}
                    </DropdownMenuItem>
                    {i < records.length - 1 && <DropdownMenuSeparator />}
                  </div>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ۲) گردش بدهی و گردش طلب */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-orange-50 px-3 py-2 dark:bg-orange-950/30">
            <div className="text-[11px] text-muted-foreground">گردش بدهی — قرض گرفته‌شده از او</div>
            <div className="mt-0.5 text-sm font-bold text-orange-700 tabular-nums-persian dark:text-orange-300">
              {formatMoneyU(summary.turnDebt)} <span className="text-[10px] font-normal">{currencyLabel()}</span>
            </div>
          </div>
          <div className="rounded-xl bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
            <div className="text-[11px] text-muted-foreground">گردش طلب — قرض داده‌شده به او</div>
            <div className="mt-0.5 text-sm font-bold text-amber-700 tabular-nums-persian dark:text-amber-300">
              {formatMoneyU(summary.turnClaim)} <span className="text-[10px] font-normal">{currencyLabel()}</span>
            </div>
          </div>
        </div>

        {/* مانده و پیشرفت — فقط وقتی چیزی مانده */}
        {totalRemain > 0 && (
          <div className="mt-3 space-y-1.5">
            <Progress value={pct} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                مانده:{" "}
                <span
                  className={`font-bold tabular-nums-persian ${
                    summary.status === "debt" ? "text-orange-700 dark:text-orange-300" : "text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {formatMoneyU(totalRemain)}
                </span>{" "}
                {currencyLabel()} {summary.status === "debt" ? "بدهی" : "طلب"}
              </span>
              <span>{Math.round(pct)}٪ انجام شده</span>
            </div>
          </div>
        )}

        {primary.description && <p className="mt-2 text-sm text-muted-foreground">{primary.description}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {primary.phone && (
            <a href={`tel:${primary.phone}`} className="flex items-center gap-1 hover:text-emerald-700">
              <Phone className="h-3 w-3" /> <span dir="ltr">{primary.phone}</span>
            </a>
          )}
          {primary.dueDate && <span>موعد: {formatDateFa(primary.dueDate)}</span>}
        </div>

        {/* عکس‌های رسید */}
        {attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.map((att) => (
              <button
                key={att.id}
                onClick={() => setViewImg(att)}
                className="group relative h-16 w-16 overflow-hidden rounded-lg border transition hover:ring-2 hover:ring-emerald-500"
              >
                <AttImg attId={att.id} fileName={att.fileName} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* اکشن‌ها */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="h-8 text-xs">
            <ImagePlus className="ml-1 h-3.5 w-3.5" />
            {uploading ? "در حال آپلود..." : "افزودن عکس رسید"}
          </Button>
          {openRecord && (
            <Button variant="outline" size="sm" onClick={() => setPayFor(openRecord)} className="h-8 text-xs">
              <HandCoins className="ml-1 h-3.5 w-3.5" /> ثبت پرداخت
            </Button>
          )}
          <Button
            variant={detailsOpen ? "secondary" : "outline"}
            size="sm"
            onClick={() => setDetailsOpen((v) => !v)}
            className="h-8 text-xs"
          >
            <ChevronDown className={`ml-1 h-3.5 w-3.5 transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
            ریز جزئیات{linked.length > 0 ? ` (${formatMoney(linked.length)})` : ""}
          </Button>
          {attachments.length > 0 && (
            <span className="mr-auto flex items-center gap-1 text-xs text-muted-foreground">
              <Camera className="h-3 w-3" /> {formatMoney(attachments.length)} عکس
            </span>
          )}
        </div>

        {/* ۴) ریز جزئیات — چقد پرداخت و چقد برداشت/دریافت شده */}
        {detailsOpen && (
          <div className="mt-3 space-y-3 rounded-xl border bg-muted/30 p-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-red-50 px-3 py-2 dark:bg-red-950/30">
                <div className="text-[11px] text-muted-foreground">برداشت‌ها (پرداخت به او)</div>
                <div className="text-sm font-bold text-red-600 tabular-nums-persian dark:text-red-300">
                  {formatMoneyU(paidOut)} <span className="text-[10px] font-normal">{currencyLabel()}</span>
                  <span className="mr-1 text-[10px] font-normal text-muted-foreground">— {formatMoney(paidOutCount)} مورد</span>
                </div>
              </div>
              <div className="rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30">
                <div className="text-[11px] text-muted-foreground">واریزها (دریافت از او)</div>
                <div className="text-sm font-bold text-emerald-700 tabular-nums-persian dark:text-emerald-300">
                  {formatMoneyU(receivedIn)} <span className="text-[10px] font-normal">{currencyLabel()}</span>
                  <span className="mr-1 text-[10px] font-normal text-muted-foreground">— {formatMoney(receivedInCount)} مورد</span>
                </div>
              </div>
            </div>

            {linked.length > 0 ? (
              <div className="divide-y rounded-lg bg-background px-3">
                {linked.map((t) => {
                  const label = debtLinkLabel(t.type, t.debtId ? recTypeById.get(t.debtId) || null : null);
                  return (
                    <div key={t.id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-2">
                      <Badge
                        variant="outline"
                        className="border-amber-300 text-[10px] text-amber-700 dark:border-amber-800 dark:text-amber-300"
                      >
                        <HandCoins className="ml-1 h-2.5 w-2.5" />
                        {label || "بدهی/طلب"}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground tabular-nums-persian">{formatDateFa(t.date)}</span>
                      <span
                        className={`text-sm font-bold tabular-nums-persian ${
                          t.type === "expense" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        {t.type === "expense" ? "−" : "+"} {formatMoneyU(t.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs leading-5 text-muted-foreground">
                هنوز تراکنش بانکی متصلی ثبت نشده — گردش بالا از ثبت مستقیم بدهی/طلب آمده است. در تب «تراکنش‌ها» با گزینه
                «بابت بدهی یا طلب» واریز و برداشت این شخص را با عنوان خودکار (پرداخت بدهی، پرداخت قرض، دریافت طلب یا دریافت
                بدهی) ثبت کنید.
              </p>
            )}

            {/* مدیریت رکوردها وقتی شخص بیش از یک رکورد دارد */}
            {multi && (
              <div className="space-y-1.5 border-t pt-2">
                {records.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">
                      {r.type === "debtor" ? "رکورد طلب — او بدهکار است" : "رکورد بدهی — من بدهکارم"}: کل{" "}
                      {formatMoneyU(r.amount)} | مانده {formatMoneyU(debtRemaining(r))} {currencyLabel()}
                    </span>
                    <span className="flex gap-1">
                      {!r.isSettled && debtRemaining(r) > 0 && (
                        <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setPayFor(r)}>
                          پرداخت
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setEditFor(r)}>
                        ویرایش
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* مشاهده عکس */}
      <Dialog open={!!viewImg} onOpenChange={(v) => !v && setViewImg(null)}>
        <DialogContent className="sm:max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm">رسید - {group.name}</DialogTitle>
          </DialogHeader>
          {viewImg && (
            <div className="relative">
              <AttImg attId={viewImg.id} fileName={viewImg.fileName} className="max-h-[65vh] w-full rounded-lg object-contain" />
              <Button
                variant="destructive"
                size="sm"
                className="mt-3"
                onClick={() => {
                  if (confirm("این عکس حذف شود؟")) {
                    deleteAttMutation.mutate(viewImg.id);
                    setViewImg(null);
                  }
                }}
              >
                <Trash2 className="ml-1 h-3.5 w-3.5" /> حذف عکس
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {payFor && <PaymentDialog debt={payFor} open={!!payFor} onOpenChange={(v) => !v && setPayFor(null)} />}
      {editFor && <DebtDialogWrapper debt={editFor} open={!!editFor} onOpenChange={(v) => !v && setEditFor(null)} />}
    </Card>
  );
}

// wrapper برای جلوگیری از مشکل state در dialog ویرایش
function DebtDialogWrapper({ debt, open, onOpenChange }: { debt: Debt; open: boolean; onOpenChange: (v: boolean) => void }) {
  if (!open) return null;
  return <DebtDialog open={open} onOpenChange={onOpenChange} editing={debt} />;
}

// ─── کارت «تشخیص خودکار وضعیت» ───
// همیشه از کل رکوردها محاسبه می‌شود — مستقل از فیلترها و جستجو
// طلب = مانده رکوردهای بدهکار (به شما بدهکارند) | بدهی = مانده رکوردهای طلبکار (شما بدهکارید)
function DebtsSummary({ debts }: { debts: Debt[] }) {
  const open = debts.filter((d) => !d.isSettled);
  const rem = (d: Debt) => Math.max(0, d.amount - d.paidAmount);
  const receivables = open.filter((d) => d.type === "debtor" && rem(d) > 0);
  const payables = open.filter((d) => d.type === "creditor" && rem(d) > 0);
  const totalReceivable = receivables.reduce((s, d) => s + rem(d), 0);
  const totalPayable = payables.reduce((s, d) => s + rem(d), 0);
  const net = totalReceivable - totalPayable;
  const debtorPeople = new Set(receivables.map((d) => normalizeSearch(d.name))).size;
  const creditorPeople = new Set(payables.map((d) => normalizeSearch(d.name))).size;

  const hasAny = totalReceivable > 0 || totalPayable > 0;
  const status = !hasAny ? "none" : net > 0 ? "receivable" : net < 0 ? "payable" : "balanced";

  const statusView =
    status === "receivable"
      ? {
          icon: <TrendingUp className="h-4 w-4 shrink-0" />,
          cls: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
          text: (
            <>
              <b>الان طلب دارید</b> — خالص طلب شما {formatMoneyU(net)} {currencyLabel()} است
            </>
          ),
        }
      : status === "payable"
        ? {
            icon: <TrendingDown className="h-4 w-4 shrink-0" />,
            cls: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
            text: (
              <>
                <b>الان بدهی دارید</b> — خالص بدهی شما {formatMoneyU(-net)} {currencyLabel()} است
              </>
            ),
          }
        : status === "balanced"
          ? {
              icon: <Scale className="h-4 w-4 shrink-0" />,
              cls: "border-border bg-muted text-foreground",
              text: (
                <>
                  <b>الان متعادل هستید</b> — مجموع طلب و بدهی برابر است
                </>
              ),
            }
          : {
              icon: <CheckCircle2 className="h-4 w-4 shrink-0" />,
              cls: "border-border bg-muted text-muted-foreground",
              text: <>فعلاً طلب یا بدهی فعالی ندارید — همه چیز تسویه شده است</>,
            };

  return (
    <Card className="py-0 overflow-hidden">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">وضعیت فعلی شما</span>
          <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
            تشخیص خودکار
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30">
            <div className="text-xs text-muted-foreground">طلب از دیگران</div>
            <div className="mt-0.5 text-lg font-bold text-amber-700 tabular-nums-persian dark:text-amber-300">
              {formatMoneyU(totalReceivable)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {debtorPeople > 0
                ? `${formatMoney(debtorPeople)} نفر به شما بدهکارند`
                : "هیچ‌کس به شما بدهکار نیست"}
            </div>
          </div>
          <div className="rounded-xl bg-orange-50 p-3 dark:bg-orange-950/30">
            <div className="text-xs text-muted-foreground">بدهی به دیگران</div>
            <div className="mt-0.5 text-lg font-bold text-orange-700 tabular-nums-persian dark:text-orange-300">
              {formatMoneyU(totalPayable)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {creditorPeople > 0
                ? `به ${formatMoney(creditorPeople)} نفر بدهکارید`
                : "شما به هیچ‌کس بدهکار نیستید"}
            </div>
          </div>
        </div>
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${statusView.cls}`}>
          {statusView.icon}
          <span className="tabular-nums-persian">{statusView.text}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function Debts() {
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  // همه رکوردها یک‌بار خوانده می‌شود؛ گروه‌بندی اشخاص + فیلتر + جستجو سمت کلاینت (داده محلی کم‌حجم است)
  const { data: allDebts, isLoading } = useQuery<Debt[]>({
    queryKey: ["debts", "all"],
    queryFn: () => api.get("/api/debts"),
  });
  // همه تراکنش‌ها برای «ریز جزئیات» هر شخص — join با نوع رکورد بدهی در local-api انجام می‌شود
  const { data: allTxs } = useQuery<Transaction[]>({
    queryKey: ["transactions", "all"],
    queryFn: () => api.get("/api/transactions?limit=500"),
  });

  const tokens = useMemo(() => searchTokens(q), [q]);

  // گروه‌بندی رکوردهای هم‌نام → یک کارت برای هر شخص (با هر تعداد رکورد طلب/بدهی)
  const groups = useMemo<PersonGroup[]>(() => {
    const map = new Map<string, PersonGroup>();
    for (const d of allDebts || []) {
      const k = personKey(d.name) || `__id:${d.id}`;
      let g = map.get(k);
      if (!g) {
        g = { key: k, name: d.name, records: [] };
        map.set(k, g);
      } else if (d.name && d.name.length > g.name.length) {
        g.name = d.name; // کامل‌ترین شکل نام نشان داده شود
      }
      g.records.push(d);
    }
    const list = [...map.values()];
    for (const g of list) g.records.sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1));
    // فعال‌ها اول، بعد جدیدترین
    list.sort((a, b) => {
      const aOpen = a.records.some((r) => !r.isSettled && debtRemaining(r) > 0) ? 0 : 1;
      const bOpen = b.records.some((r) => !r.isSettled && debtRemaining(r) > 0) ? 0 : 1;
      if (aOpen !== bOpen) return aOpen - bOpen;
      const aD = a.records[0]?.updatedAt || "";
      const bD = b.records[0]?.updatedAt || "";
      return aD < bD ? 1 : -1;
    });
    return list;
  }, [allDebts]);

  // فیلترها حالا روی «شخص» اعمال می‌شوند نه رکورد — بدهکاران = اشخاصی که به شما بدهکارند
  const data = useMemo(() => {
    let list = groups;
    if (tokens.length > 0) {
      list = list.filter((g) =>
        g.records.some((r) => matchesAllTokens([r.name, r.phone, r.description].filter(Boolean).join(" "), tokens))
      );
    } else if (filter === "open") {
      list = list.filter((g) => g.records.some((r) => !r.isSettled && debtRemaining(r) > 0));
    } else if (filter === "debtor") {
      list = list.filter((g) => summarizePerson(g.records).remainClaim > 0);
    } else if (filter === "creditor") {
      list = list.filter((g) => summarizePerson(g.records).remainDebt > 0);
    } else if (filter === "settled") {
      list = list.filter((g) => {
        const s = summarizePerson(g.records);
        return s.remainClaim === 0 && s.remainDebt === 0;
      });
    }
    return list;
  }, [groups, filter, tokens]);

  const filters = [
    { v: "all", label: "همه" },
    { v: "open", label: "فعال" },
    { v: "debtor", label: "بدهکاران" },
    { v: "creditor", label: "طلبکاران" },
    { v: "settled", label: "تسویه‌شده" },
  ];

  return (
    <div className="space-y-4">
      {/* تشخیص خودکار: الان طلب داریم یا بدهی داریم */}
      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : (
        <DebtsSummary debts={allDebts || []} />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setAddOpen(true)} className="bg-emerald-700 hover:bg-emerald-800">
          <Plus className="ml-1 h-4 w-4" /> بدهی جدید
        </Button>
        <div className="flex flex-wrap rounded-lg border p-1">
          {filters.map((o) => (
            <button
              key={o.v}
              onClick={() => setFilter(o.v)}
              className={`rounded-md px-3 py-1 text-xs transition ${
                filter === o.v ? "bg-emerald-700 text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {/* جستجوی اشخاص — نام، شماره تماس و توضیحات */}
        <div className="relative w-full sm:w-auto sm:min-w-48 sm:flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="جستجوی اشخاص — نام، شماره یا توضیحات..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pr-9 pl-9"
          />
          {q && (
            <button
              type="button"
              aria-label="پاک کردن جستجو"
              onClick={() => setQ("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {tokens.length > 0 && data.length > 0 && (
        <p className="-mt-2 text-xs text-muted-foreground">
          {formatMoney(data.length)} نتیجه برای «{q.trim()}»
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : data.length === 0 ? (
        tokens.length > 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <Search className="h-10 w-10 text-[rgba(90,103,95,0.4)]" />
              <p className="font-medium">شخصی پیدا نشد</p>
              <p className="text-sm text-muted-foreground">
                جستجو روی نام، شماره تماس و توضیحات اعمال می‌شود — با کلمه دیگری امتحان کنید
              </p>
              <Button variant="outline" onClick={() => setQ("")} className="mt-2">
                پاک کردن جستجو
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <HandCoins className="h-10 w-10 text-[rgba(90,103,95,0.4)]" />
              <p className="font-medium">بدهی‌ای ثبت نشده</p>
              <p className="text-sm text-muted-foreground">بدهکاران و طلبکاران خود را با عکس رسید ثبت کنید</p>
              <Button onClick={() => setAddOpen(true)} className="mt-2 bg-emerald-700 hover:bg-emerald-800">
                <Plus className="ml-1 h-4 w-4" /> ثبت بدهی
              </Button>
            </CardContent>
          </Card>
        )
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {data.map((g) => (
            <PersonCard key={g.key} group={g} linkedTxs={allTxs || []} />
          ))}
        </div>
      )}

      {addOpen && <DebtDialog open={addOpen} onOpenChange={setAddOpen} />}
      <ToastPortalHelper />
    </div>
  );
}

function ToastPortalHelper() {
  // برای سازگاری رندر سمت کلاینت
  return null;
}
