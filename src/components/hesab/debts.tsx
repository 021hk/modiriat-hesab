"use client";

// ─── بخش بدهی/طلب — مدل شخص‌محور (v2.12) ───
// معیار طلب/بدهی = «شخص» و علامت «باقی‌مانده» او است:
//   باقی‌مانده = مانده اولیه + گردش بدهی (پرداخت‌های شما به او) − گردش طلب (دریافت‌های شما از او)
//   مثبت → طلب | منفی → بدهی | صفر → تسویه
// کارت هر شخص: ۱) نام  ۲) گردش بدهی و گردش طلب  ۳) وضعیت نهایی — و «ریز جزئیات» با چقد پرداخت و چقد برداشت

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  ArrowDownLeft,
  ArrowUpRight,
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
  searchTokens,
  matchesAllTokens,
} from "@/lib/format";
import {
  personKey,
  summarizePersonFromTxns,
  kindLabel,
  txKindOf,
  txDirection,
  type PersonSummary,
} from "@/lib/debt-utils";

// ─── گروه‌بندی اشخاص (پس از مهاجرت معمولاً یک رکورد = یک شخص؛ برای اطمینان هم‌نام‌ها یکی می‌شوند) ───

type PersonGroup = { key: string; name: string; records: Debt[] };

function groupPersons(persons: Debt[] | null | undefined): PersonGroup[] {
  const map = new Map<string, PersonGroup>();
  for (const d of persons || []) {
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
  return [...map.values()];
}

function groupOpening(g: PersonGroup): number {
  return g.records.reduce((s, r) => s + (r.openingBalance || 0), 0);
}

function groupSummary(g: PersonGroup, allTxs: Transaction[] | null | undefined): PersonSummary {
  const ids = new Set(g.records.map((r) => r.id));
  const ptx = (allTxs || []).filter((t) => t.debtId && ids.has(t.debtId));
  return summarizePersonFromTxns(groupOpening(g), ptx);
}

// ─── دیالوگ افزودن/ویرایش شخص ───

type PersonFormState = {
  name: string;
  phone: string;
  openingSign: "claim" | "debt";
  openingAmount: string;
  description: string;
};

function PersonDialog({
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
  const ob = editing?.openingBalance || 0;
  const [form, setForm] = useState<PersonFormState>({
    name: editing?.name || "",
    phone: editing?.phone || "",
    openingSign: ob >= 0 ? "claim" : "debt",
    openingAmount: editing ? formatMoneyPlain(toDisplayAmount(Math.abs(ob))) : "",
    description: editing?.description || "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const opening = toStoredAmount(parseMoneyInput(form.openingAmount)) * (form.openingSign === "claim" ? 1 : -1);
      const body = {
        name: form.name,
        phone: form.phone || null,
        description: form.description || null,
        openingBalance: opening,
      };
      if (editing) return api.put(`/api/debts/${editing.id}`, body);
      return api.post("/api/debts", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debts"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast({ title: editing ? "شخص ویرایش شد" : "شخص ثبت شد" });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? "ویرایش شخص" : "شخص جدید"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 max-h-[75dvh] overflow-y-auto pl-1">
          <div className="grid gap-2">
            <Label>نام شخص</Label>
            <Input
              placeholder="مثلاً: علی محمدی"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          {/* مانده اولیه — فقط اگر قبل از استفاده از برنامه چیزی بدهکار/طلبکار بوده */}
          <div className="rounded-xl border p-3">
            <Label className="text-xs">مانده اولیه (اختیاری)</Label>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              اگر قبل از ثبت تراکنش‌ها چیزی بین شما و این شخص مانده، همین‌جا وارد کنید — باقی‌مانده از همین + تراکنش‌ها
              حساب می‌شود.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, openingSign: "claim" })}
                className={`rounded-xl border-2 p-2 text-xs font-medium transition ${
                  form.openingSign === "claim"
                    ? "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    : "border-border text-muted-foreground"
                }`}
              >
                طلب اولیه
                <span className="block text-[10px] opacity-70">او به من بدهکار است</span>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, openingSign: "debt" })}
                className={`rounded-xl border-2 p-2 text-xs font-medium transition ${
                  form.openingSign === "debt"
                    ? "border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300"
                    : "border-border text-muted-foreground"
                }`}
              >
                بدهی اولیه
                <span className="block text-[10px] opacity-70">من به او بدهکارم</span>
              </button>
            </div>
            <Input
              inputMode="numeric"
              dir="ltr"
              className="mt-2 text-left font-bold tabular-nums-persian"
              placeholder="۰"
              value={form.openingAmount ? formatMoneyPlain(parseMoneyInput(form.openingAmount)) : ""}
              onChange={(e) => setForm({ ...form, openingAmount: e.target.value })}
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
            disabled={mutation.isPending || !form.name.trim()}
            className="bg-emerald-700 hover:bg-emerald-800"
          >
            {mutation.isPending ? "..." : editing ? "ذخیره تغییرات" : "ثبت"}
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

// ─── کارت شخص ───
// ترتیب نمایش مثل دفتر: ۱) نام شخص  ۲) گردش بدهی و گردش طلب  ۳) وضعیت نهایی (طلب دارید یا بدهی دارید)
function PersonCard({
  group,
  allTxs,
  onQuickTx,
  onEdit,
}: {
  group: PersonGroup;
  allTxs: Transaction[] | null | undefined;
  onQuickTx?: (preset: { personName: string; type: "income" | "expense" }) => void;
  onEdit: (person: Debt) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [viewImg, setViewImg] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const records = group.records;
  const primary = records[0];
  const summary = groupSummary(group, allTxs);

  // تراکنش‌های متصل به این شخص — عنوان هرکدام (kind) از علامت باقی‌ماندهِ زمان ثبت آمده است
  const linked = useMemo(() => {
    const ids = new Set(records.map((r) => r.id));
    return (allTxs || [])
      .filter((t) => t.debtId && ids.has(t.debtId))
      .sort((a, b) => (a.date > b.date ? -1 : 1));
  }, [records, allTxs]);

  const attachments = useMemo(() => records.flatMap((r) => r.attachments || []), [records]);

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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/debts/${id}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "شخص حذف شد" });
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

  const netAbs = Math.abs(summary.net);
  const statusBadge =
    summary.status === "claim"
      ? {
          cls: "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300",
          label: `طلب دارید — ${formatMoneyU(netAbs)} ${currencyLabel()}`,
        }
      : summary.status === "debt"
        ? {
            cls: "bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-900/40 dark:text-orange-300",
            label: `بدهی دارید — ${formatMoneyU(netAbs)} ${currencyLabel()}`,
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

  return (
    <Card className="py-0 overflow-hidden">
      <div
        className={`h-1.5 w-full ${
          summary.status === "claim" ? "bg-amber-400" : summary.status === "debt" ? "bg-orange-400" : "bg-emerald-400"
        }`}
      />
      <CardContent className="p-4">
        {/* ۱) نام شخص + وضعیت نهایی از علامت باقی‌مانده */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold text-lg ${avatarCls}`}>
              {group.name.trim().charAt(0) || "؟"}
            </div>
            <div>
              <span className="text-base font-bold">{group.name}</span>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <Badge className={statusBadge.cls}>{statusBadge.label}</Badge>
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
              <DropdownMenuItem onClick={() => onEdit(primary)}>
                <Pencil className="ml-2 h-4 w-4" /> ویرایش شخص
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onQuickTx?.({ personName: group.name, type: "expense" })}>
                <ArrowUpRight className="ml-2 h-4 w-4" /> ثبت پرداخت به او (برداشت)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onQuickTx?.({ personName: group.name, type: "income" })}>
                <ArrowDownLeft className="ml-2 h-4 w-4" /> ثبت دریافت از او (واریز)
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => {
                  if (
                    confirm(
                      `حذف «${group.name}»؟ تراکنش‌های متصل به او حذف نمی‌شوند و به‌عنوان هزینه/درآمد ساده باقی می‌مانند.`
                    )
                  )
                    deleteMutation.mutate(primary.id);
                }}
              >
                <Trash2 className="ml-2 h-4 w-4" /> حذف شخص
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ۲) گردش بدهی و گردش طلب */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-orange-50 px-3 py-2 dark:bg-orange-950/30">
            <div className="text-[11px] text-muted-foreground">گردش بدهی — پرداخت‌های شما به او</div>
            <div className="mt-0.5 text-sm font-bold text-orange-700 tabular-nums-persian dark:text-orange-300">
              {formatMoneyU(summary.turnDebt)} <span className="text-[10px] font-normal">{currencyLabel()}</span>
            </div>
          </div>
          <div className="rounded-xl bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
            <div className="text-[11px] text-muted-foreground">گردش طلب — دریافت‌های شما از او</div>
            <div className="mt-0.5 text-sm font-bold text-amber-700 tabular-nums-persian dark:text-amber-300">
              {formatMoneyU(summary.turnClaim)} <span className="text-[10px] font-normal">{currencyLabel()}</span>
            </div>
          </div>
        </div>

        {/* مانده اولیه — اگر باشد در باقی‌مانده حساب می‌شود */}
        {summary.openingBalance !== 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            مانده اولیه:{" "}
            <span className="font-bold tabular-nums-persian">{formatMoneyU(Math.abs(summary.openingBalance))}</span>{" "}
            {currencyLabel()} ({summary.openingBalance > 0 ? "طلب اولیه" : "بدهی اولیه"})
          </p>
        )}

        {primary.description && <p className="mt-2 text-sm text-muted-foreground">{primary.description}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {primary.phone && (
            <a href={`tel:${primary.phone}`} className="flex items-center gap-1 hover:text-emerald-700">
              <Phone className="h-3 w-3" /> <span dir="ltr">{primary.phone}</span>
            </a>
          )}
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

        {/* ۴) ریز جزئیات — چقد پرداخت و چقد برداشت شده */}
        {detailsOpen && (
          <div className="mt-3 space-y-3 rounded-xl border bg-muted/30 p-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-red-50 px-3 py-2 dark:bg-red-950/30">
                <div className="text-[11px] text-muted-foreground">چقد پرداخت شده — پولی که به او داده‌اید</div>
                <div className="text-sm font-bold text-red-600 tabular-nums-persian dark:text-red-300">
                  {formatMoneyU(summary.turnDebt)} <span className="text-[10px] font-normal">{currencyLabel()}</span>
                  <span className="mr-1 text-[10px] font-normal text-muted-foreground">— {formatMoney(summary.paidCount)} مورد</span>
                </div>
              </div>
              <div className="rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30">
                <div className="text-[11px] text-muted-foreground">چقد برداشت شده — پولی که از او گرفته‌اید</div>
                <div className="text-sm font-bold text-emerald-700 tabular-nums-persian dark:text-emerald-300">
                  {formatMoneyU(summary.turnClaim)} <span className="text-[10px] font-normal">{currencyLabel()}</span>
                  <span className="mr-1 text-[10px] font-normal text-muted-foreground">— {formatMoney(summary.receivedCount)} مورد</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] leading-5 text-muted-foreground">
              باقی‌مانده = مانده اولیه + گردش بدهی − گردش طلب ={" "}
              <span
                className={`font-bold tabular-nums-persian ${
                  summary.status === "debt"
                    ? "text-orange-700 dark:text-orange-300"
                    : summary.status === "claim"
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-emerald-700 dark:text-emerald-300"
                }`}
              >
                {formatMoneyU(netAbs)} {currencyLabel()} {summary.status === "debt" ? "بدهی" : summary.status === "claim" ? "طلب" : "تسویه"}
              </span>
            </p>

            {linked.length > 0 ? (
              <div className="divide-y rounded-lg bg-background px-3">
                {linked.map((t) => {
                  const kind = txKindOf(t);
                  const dir = txDirection(t);
                  return (
                    <div key={t.id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-2">
                      <Badge
                        variant="outline"
                        className="border-amber-300 text-[10px] text-amber-700 dark:border-amber-800 dark:text-amber-300"
                      >
                        <HandCoins className="ml-1 h-2.5 w-2.5" />
                        {kindLabel(kind)}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground tabular-nums-persian">{formatDateFa(t.date)}</span>
                      <span
                        className={`text-sm font-bold tabular-nums-persian ${
                          dir === "out" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        {dir === "out" ? "−" : "+"} {formatMoneyU(t.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs leading-5 text-muted-foreground">
                هنوز تراکنشی برای این شخص ثبت نشده — از تب «تراکنش‌ها» با گزینه «بدهی یا طلب» واریز و برداشت این شخص را با
                عنوان خودکار (پرداخت بدهی، پرداخت قرض، دریافت طلب یا دریافت بدهی) ثبت کنید.
              </p>
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
    </Card>
  );
}

// ─── کارت «تشخیص خودکار وضعیت» — از باقی‌مانده همه اشخاص، مستقل از فیلتر و جستجو ───
function DebtsSummary({ persons, txs }: { persons: Debt[]; txs: Transaction[] | null | undefined }) {
  const agg = useMemo(() => {
    let totalReceivable = 0; // مجموع طلب شما از دیگران
    let totalPayable = 0; // مجموع بدهی شما به دیگران
    let claimantPeople = 0;
    let debtorPeople = 0;
    for (const g of groupPersons(persons)) {
      const s = groupSummary(g, txs);
      if (s.net > 0) {
        totalReceivable += s.net;
        claimantPeople++;
      } else if (s.net < 0) {
        totalPayable += -s.net;
        debtorPeople++;
      }
    }
    return { totalReceivable, totalPayable, claimantPeople, debtorPeople };
  }, [persons, txs]);

  const net = agg.totalReceivable - agg.totalPayable;
  const hasAny = agg.totalReceivable > 0 || agg.totalPayable > 0;
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
              text: <>فعلاً طلب یا بدهی فعالی ندارید</>,
            };

  return (
    <Card className="py-0 overflow-hidden">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">وضعیت فعلی شما</span>
          <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
            تشخیص خودکار از باقی‌مانده اشخاص
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30">
            <div className="text-xs text-muted-foreground">طلب از دیگران</div>
            <div className="mt-0.5 text-lg font-bold text-amber-700 tabular-nums-persian dark:text-amber-300">
              {formatMoneyU(agg.totalReceivable)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {agg.claimantPeople > 0
                ? `${formatMoney(agg.claimantPeople)} نفر به شما بدهکارند`
                : "هیچ‌کس به شما بدهکار نیست"}
            </div>
          </div>
          <div className="rounded-xl bg-orange-50 p-3 dark:bg-orange-950/30">
            <div className="text-xs text-muted-foreground">بدهی به دیگران</div>
            <div className="mt-0.5 text-lg font-bold text-orange-700 tabular-nums-persian dark:text-orange-300">
              {formatMoneyU(agg.totalPayable)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {agg.debtorPeople > 0
                ? `به ${formatMoney(agg.debtorPeople)} نفر بدهکارید`
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

export function Debts({ onQuickTx }: { onQuickTx?: (preset: { personName: string; type: "income" | "expense" }) => void }) {
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editFor, setEditFor] = useState<Debt | null>(null);

  // همه اشخاص + همه تراکنش‌ها یک‌بار خوانده می‌شود؛ باقی‌مانده/فیلتر/جستجو سمت کلاینت (داده محلی کم‌حجم است)
  const { data: allDebts, isLoading } = useQuery<Debt[]>({
    queryKey: ["debts", "all"],
    queryFn: () => api.get("/api/debts"),
  });
  const { data: allTxs } = useQuery<Transaction[]>({
    queryKey: ["transactions", "all"],
    queryFn: () => api.get("/api/transactions?limit=500"),
  });

  const tokens = useMemo(() => searchTokens(q), [q]);

  const groups = useMemo(() => groupPersons(allDebts), [allDebts]);

  // ترتیب: اشخاصِ دارای باقی‌مانده اول، بعد بر اساس جدیدترین فعالیت
  const sortedGroups = useMemo(() => {
    const withNet = groups.map((g) => ({ g, s: groupSummary(g, allTxs) }));
    withNet.sort((a, b) => {
      const aActive = a.s.net !== 0 ? 0 : 1;
      const bActive = b.s.net !== 0 ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return Math.abs(b.s.net) - Math.abs(a.s.net);
    });
    return withNet.map((x) => x.g);
  }, [groups, allTxs]);

  // فیلترها روی «شخص» و بر اساس علامت باقی‌مانده او اعمال می‌شود
  const data = useMemo(() => {
    let list = sortedGroups;
    if (tokens.length > 0) {
      list = list.filter((g) =>
        g.records.some((r) => matchesAllTokens([r.name, r.phone, r.description].filter(Boolean).join(" "), tokens))
      );
    } else if (filter === "claim") {
      list = list.filter((g) => groupSummary(g, allTxs).net > 0);
    } else if (filter === "debt") {
      list = list.filter((g) => groupSummary(g, allTxs).net < 0);
    } else if (filter === "settled") {
      list = list.filter((g) => groupSummary(g, allTxs).net === 0);
    }
    return list;
  }, [sortedGroups, allTxs, filter, tokens]);

  const filters = [
    { v: "all", label: "همه" },
    { v: "claim", label: "طلب‌دارها" },
    { v: "debt", label: "بدهی‌دارها" },
    { v: "settled", label: "تسویه‌شده" },
  ];

  return (
    <div className="space-y-4">
      {/* تشخیص خودکار: الان طلب داریم یا بدهی داریم — از علامت باقی‌مانده اشخاص */}
      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : (
        <DebtsSummary persons={allDebts || []} txs={allTxs} />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setAddOpen(true)} className="bg-emerald-700 hover:bg-emerald-800">
          <Plus className="ml-1 h-4 w-4" /> شخص جدید
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

      {/* راهنمای ستون‌ها — گردش بدهی/گردش طلب و معیار وضعیت */}
      <p className="-mt-1 text-[11px] leading-5 text-muted-foreground">
        گردش بدهی = جمع پرداخت‌های شما به شخص • گردش طلب = جمع دریافت‌های شما از شخص • باقی‌مانده = مانده اولیه + گردش
        بدهی − گردش طلب؛ مثبت یعنی طلب و منفی یعنی بدهی.
      </p>

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
              <p className="font-medium">هنوز شخصی ثبت نشده</p>
              <p className="text-sm text-muted-foreground">
                با دکمه «شخص جدید» اضافه کنید یا در تب «تراکنش‌ها» گزینه «بدهی یا طلب» را انتخاب کنید — شخص خودکار ساخته
                می‌شود
              </p>
              <Button onClick={() => setAddOpen(true)} className="mt-2 bg-emerald-700 hover:bg-emerald-800">
                <Plus className="ml-1 h-4 w-4" /> شخص جدید
              </Button>
            </CardContent>
          </Card>
        )
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {data.map((g) => (
            <PersonCard
              key={g.key}
              group={g}
              allTxs={allTxs}
              onQuickTx={onQuickTx}
              onEdit={(p) => setEditFor(p)}
            />
          ))}
        </div>
      )}

      {addOpen && <PersonDialog open={addOpen} onOpenChange={setAddOpen} />}
      {editFor && <PersonDialogWrapper person={editFor} open={!!editFor} onOpenChange={(v) => !v && setEditFor(null)} />}
    </div>
  );
}

// wrapper برای جلوگیری از مشکل state در dialog ویرایش
function PersonDialogWrapper({ person, open, onOpenChange }: { person: Debt; open: boolean; onOpenChange: (v: boolean) => void }) {
  if (!open) return null;
  return <PersonDialog open={open} onOpenChange={onOpenChange} editing={person} />;
}
