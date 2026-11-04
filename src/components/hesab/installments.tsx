"use client";
// ─── تب اقساط و چک‌ها (v2.14) ───
// ثبت قسط/چک با تاریخ سررسید جلالی + یادآور اعلان گوشی (۲ روز قبل — قابل تنظیم)
// + هشدار قرمز وقتی موجودی حساب مرتبط کمتر از مبلغ قسط باشد
// پرداخت قسط می‌تواند همزمان یک تراکنش هزینه در همان حساب ثبت کند.

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  CalendarClock,
  Banknote,
  AlertTriangle,
  Check,
  RotateCcw,
  Landmark,
} from "lucide-react";
import { api, type Installment, type BankAccount, type Stats, type NotifSettings } from "@/lib/client-api";
import { JalaliDateTimePicker } from "@/components/hesab/jalali-picker";
import {
  PLAN_RATE_TYPES,
  PLAN_RATE_LABEL,
  PLAN_RATE_HINT,
  computeInstallmentAmounts,
  planSummary,
  type PlanRateType,
} from "@/lib/installment-plan";
import {
  formatMoneyPlain,
  formatMoneyU,
  parseMoneyInput,
  currencyLabel,
  toDisplayAmount,
  toStoredAmount,
  formatDateFa,
} from "@/lib/format";
import { daysUntilDue, syncInstallmentNotifications, notifSupported } from "@/lib/notifications";

type StatusFilter = "upcoming" | "overdue" | "paid" | "all";
type KindFilter = "all" | "installment" | "check";

const statusLabel: Record<StatusFilter, string> = {
  upcoming: "پیش‌رو",
  overdue: "سررسید گذشته",
  paid: "پرداخت‌شده",
  all: "همه",
};

// ─── فرم افزودن/ویرایش قسط یا چک ───

function InstallmentDialog({
  editing,
  accounts,
  onClose,
}: {
  editing: Installment | null;
  accounts: BankAccount[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [kind, setKind] = useState<"installment" | "check">(editing?.kind || "installment");
  const [title, setTitle] = useState(editing?.title || "");
  const [amount, setAmount] = useState(editing?.amount ? formatMoneyPlain(toDisplayAmount(editing.amount)) : "");
  const [dueDate, setDueDate] = useState(editing?.dueDate || new Date(Date.now() + 30 * 864e5).toISOString());
  const [counterparty, setCounterparty] = useState(editing?.counterparty || "");
  const [bankAccountId, setBankAccountId] = useState(editing?.bankAccountId || "none");

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      editing ? api.put(`/api/installments/${editing.id}`, body) : api.post("/api/installments", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["installments"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      void syncInstallmentNotifications();
      toast({ title: editing ? "ویرایش شد" : "ثبت شد", description: "یادآور اعلان هم به‌روزرسانی شد" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  const money = toStoredAmount(parseMoneyInput(amount));
  const canSave = title.trim().length > 0 && money > 0;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? "ویرایش" : kind === "check" ? "چک جدید" : "قسط جدید"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          {/* نوع: قسط یا چک */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setKind("installment")}
              className={`rounded-xl border-2 p-2.5 text-sm font-medium transition ${
                kind === "installment"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-border text-muted-foreground"
              }`}
            >
              🗓 قسط
            </button>
            <button
              type="button"
              onClick={() => setKind("check")}
              className={`rounded-xl border-2 p-2.5 text-sm font-medium transition ${
                kind === "check"
                  ? "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  : "border-border text-muted-foreground"
              }`}
            >
              🧾 چک
            </button>
          </div>

          <div className="grid gap-2">
            <Label>عنوان</Label>
            <Input
              placeholder={kind === "check" ? "مثلاً چک شماره ۱۲۳ — فروشگاه" : "مثلاً قسط وام مسکن"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>مبلغ ({currencyLabel()})</Label>
            <Input
              inputMode="numeric"
              dir="ltr"
              className="text-left text-lg font-bold tabular-nums-persian"
              placeholder="۵٬۰۰۰٬۰۰۰"
              value={amount ? formatMoneyPlain(parseMoneyInput(amount)) : ""}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>تاریخ سررسید</Label>
            <JalaliDateTimePicker value={dueDate} onChange={setDueDate} showTime={false} />
          </div>

          <div className="grid gap-2">
            <Label>بانک / طرف حساب (اختیاری)</Label>
            <Input
              placeholder="مثلاً بانک مسکن، آقای رضایی"
              value={counterparty || ""}
              onChange={(e) => setCounterparty(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>حساب مرتبط (برای هشدار موجودی و ثبت پرداخت)</Label>
            <Select value={bankAccountId} onValueChange={setBankAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="انتخاب حساب" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون حساب</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} — {a.bankName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button
            className="bg-emerald-700 hover:bg-emerald-800"
            disabled={!canSave || mutation.isPending}
            onClick={() =>
              mutation.mutate({
                kind,
                title: title.trim(),
                amount: money,
                dueDate,
                counterparty: counterparty || null,
                bankAccountId: bankAccountId === "none" ? null : bankAccountId,
              })
            }
          >
            {editing ? "ذخیره تغییرات" : "ثبت"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── قسط‌بندی وام (v2.14.2) — N قسط با نرخ نزولی/ثابت/سعودی + سررسید خودکار شمسی ───

function PlanDialog({ accounts, onClose }: { accounts: BankAccount[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [principal, setPrincipal] = useState("");
  const [count, setCount] = useState("");
  const [rate, setRate] = useState("");
  const [rateType, setRateType] = useState<PlanRateType>("nozoli");
  const [firstDue, setFirstDue] = useState(new Date(Date.now() + 30 * 864e5).toISOString());
  const [counterparty, setCounterparty] = useState("");
  const [bankAccountId, setBankAccountId] = useState("none");

  const principalRial = toStoredAmount(parseMoneyInput(principal));
  const countNum = Math.floor(parseMoneyInput(count)); // ارقام فارسی هم قبول است
  const rateNum = parseMoneyInput(rate) || 0;

  const amounts = useMemo(
    () =>
      principalRial > 0 && countNum >= 1 && countNum <= 120
        ? computeInstallmentAmounts(principalRial, countNum, rateNum, rateType)
        : [],
    [principalRial, countNum, rateNum, rateType]
  );
  const summary = useMemo(
    () => (amounts.length > 0 ? planSummary(amounts, principalRial) : null),
    [amounts, principalRial]
  );

  const mutation = useMutation({
    mutationFn: () =>
      api.post<{ created: number; totalPayable: number; totalInterest: number }>("/api/installments/plan", {
        title: title.trim(),
        principal: principalRial,
        count: countNum,
        annualRate: rateNum,
        rateType,
        firstDueDate: firstDue,
        counterparty: counterparty || null,
        bankAccountId: bankAccountId === "none" ? null : bankAccountId,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["installments"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      void syncInstallmentNotifications();
      toast({
        title: `${res.created.toLocaleString("fa-IR", { useGrouping: false })} قسط ساخته شد ✓`,
        description: "یادآور اعلان سررسیدها هم فعال شد",
      });
      onClose();
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  const canSave = title.trim().length > 0 && amounts.length > 0 && !mutation.isPending;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            قسط‌بندی وام
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="grid gap-2">
            <Label>عنوان طرح</Label>
            <Input placeholder="مثلاً وام مسکن بانک مسکن" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label>مبلغ اصل وام ({currencyLabel()})</Label>
            <Input
              inputMode="numeric"
              dir="ltr"
              className="text-left text-lg font-bold tabular-nums-persian"
              placeholder="۳۰۰٬۰۰۰٬۰۰۰"
              value={principal ? formatMoneyPlain(parseMoneyInput(principal)) : ""}
              onChange={(e) => setPrincipal(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>تعداد اقساط</Label>
              <Input
                inputMode="numeric"
                dir="ltr"
                className="text-left font-bold tabular-nums-persian"
                placeholder="۳۵"
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>نرخ سود سالانه (٪) — اختیاری</Label>
              <Input
                inputMode="decimal"
                dir="ltr"
                className="text-left font-bold tabular-nums-persian"
                placeholder="۲۳"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>نوع نرخ</Label>
            <div className="grid gap-1.5">
              {PLAN_RATE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setRateType(t)}
                  className={`rounded-xl border-2 p-2.5 text-right transition ${
                    rateType === t
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  <span className="block text-sm font-medium">{PLAN_RATE_LABEL[t]}</span>
                  <span className="mt-0.5 block text-[11px] leading-4 opacity-80">{PLAN_RATE_HINT[t]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>تاریخ اولین سررسید — روزهای بعد همان روزِ ماه</Label>
            <JalaliDateTimePicker value={firstDue} onChange={setFirstDue} showTime={false} />
            <p className="text-[11px] leading-4 text-muted-foreground">
              مثلاً ۱۵ مهر → بعدی‌ها ۱۵ آبان، ۱۵ آذر و… (اعلان یادآور هر قسط خودکار فعال می‌شود)
            </p>
          </div>

          {summary && (
            <div className="rounded-xl bg-muted/60 p-3 text-xs leading-6">
              <div className="mb-1 font-bold text-emerald-800 dark:text-emerald-300">پیش‌نمایش جدول اقساط</div>
              <div className="flex justify-between gap-2">
                <span>تعداد قسط</span>
                <b className="tabular-nums-persian">{summary.count.toLocaleString("fa-IR", { useGrouping: false })}</b>
              </div>
              <div className="flex justify-between gap-2">
                <span>قسط اول / آخر</span>
                <b className="tabular-nums-persian">
                  {formatMoneyU(summary.first)} / {formatMoneyU(summary.last)}
                </b>
              </div>
              {rateNum > 0 && (
                <div className="flex justify-between gap-2">
                  <span>کمترین / بیشترین قسط</span>
                  <b className="tabular-nums-persian">
                    {formatMoneyU(summary.min)} / {formatMoneyU(summary.max)}
                  </b>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span>جمع سود</span>
                <b className="tabular-nums-persian text-amber-700 dark:text-amber-400">{formatMoneyU(summary.totalInterest)}</b>
              </div>
              <div className="flex justify-between gap-2">
                <span>جمع پرداخت (اصل + سود)</span>
                <b className="tabular-nums-persian">{formatMoneyU(summary.totalPayable)}</b>
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label>بانک / طرف حساب (اختیاری)</Label>
            <Input placeholder="مثلاً بانک مسکن" value={counterparty || ""} onChange={(e) => setCounterparty(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label>حساب مرتبط (برای هشدار موجودی و ثبت پرداخت)</Label>
            <Select value={bankAccountId} onValueChange={setBankAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="انتخاب حساب" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون حساب</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} — {a.bankName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button className="bg-emerald-700 hover:bg-emerald-800" disabled={!canSave} onClick={() => mutation.mutate()}>
            ساخت اقساط
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── پنجرهٔ پرداخت قسط (+ ثبت همزمان تراکنش هزینه) ───

function PayDialog({
  inst,
  accounts,
  onClose,
}: {
  inst: Installment;
  accounts: BankAccount[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [asExpense, setAsExpense] = useState(!!inst.bankAccountId);
  const accountId = inst.bankAccountId || accounts[0]?.id || "none";

  const mutation = useMutation({
    mutationFn: async () => {
      if (asExpense && inst.bankAccountId) {
        await api.post("/api/transactions", {
          type: "expense",
          amount: inst.amount,
          purpose: `پرداخت ${inst.kind === "check" ? "چک" : "قسط"} — ${inst.title}`,
          bankAccountId: inst.bankAccountId,
          date: new Date().toISOString(),
        });
      }
      await api.put(`/api/installments/${inst.id}`, { paid: true });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["installments"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
      void syncInstallmentNotifications();
      toast({ title: "پرداخت ثبت شد ✓" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>ثبت پرداخت</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1 text-sm">
          <p>
            «{inst.title}» — مبلغ{" "}
            <b className="tabular-nums-persian">{formatMoneyU(inst.amount)}</b>
          </p>
          {inst.bankAccountId ? (
            <label className="flex items-start gap-2 rounded-xl border p-3">
              <Checkbox checked={asExpense} onCheckedChange={(v) => setAsExpense(v === true)} className="mt-0.5" />
              <span className="text-xs leading-5">
                همزمان یک <b>تراکنش هزینه</b> در حساب «
                {accounts.find((a) => a.id === inst.bankAccountId)?.name || "—"}» ثبت شود (از موجودی کم می‌شود)
              </span>
            </label>
          ) : (
            <p className="rounded-lg bg-muted/60 p-2.5 text-[11px] leading-5 text-muted-foreground">
              این مورد به حساب بانکی وصل نیست — فقط علامت پرداخت می‌خورد.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button className="bg-emerald-700 hover:bg-emerald-800" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            پرداخت شد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── کارت هر قسط/چک ───

function InstallmentCard({
  inst,
  balances,
  lowBalanceWarn,
  onEdit,
  onPay,
  onUnpay,
}: {
  inst: Installment;
  balances: Map<string, number>;
  lowBalanceWarn: boolean;
  onEdit: () => void;
  onPay: () => void;
  onUnpay: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const del = useMutation({
    mutationFn: () => api.del(`/api/installments/${inst.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["installments"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      void syncInstallmentNotifications();
      toast({ title: "حذف شد" });
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });
  // حذف طرح قسط‌بندی وام (v2.14.2) + حذف کامل حتی پرداخت‌شده‌ها (v2.14.3)
  const delPlan = useMutation({
    mutationFn: (all: boolean) => api.del<{ deleted: number; keptPaid: number }>(`/api/installments/plan/${inst.planId}${all ? "?all=1" : ""}`),
    onSuccess: (res, all) => {
      qc.invalidateQueries({ queryKey: ["installments"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      void syncInstallmentNotifications();
      toast({
        title: all ? "طرح کامل حذف شد" : "طرح حذف شد",
        description: all
          ? `${res.deleted.toLocaleString("fa-IR", { useGrouping: false })} قسط از کل طرح حذف شد${res.keptPaid > 0 ? " (شامل پرداخت‌شده‌ها)" : ""}`
          : `${res.deleted.toLocaleString("fa-IR", { useGrouping: false })} قسط باقی‌مانده حذف شد${res.keptPaid > 0 ? " — پرداخت‌شده‌ها ماندند" : ""}`,
      });
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  const dueMs = new Date(inst.dueDate).getTime();
  const days = daysUntilDue(dueMs, Date.now());
  const isCheck = inst.kind === "check";
  const kindWord = isCheck ? "چک" : "قسط";

  const lowBalance =
    !inst.paid &&
    lowBalanceWarn &&
    inst.bankAccountId != null &&
    balances.has(inst.bankAccountId) &&
    (balances.get(inst.bankAccountId) || 0) < inst.amount;

  const dueTone =
    inst.paid
      ? "text-muted-foreground"
      : days < 0
        ? "text-red-600 dark:text-red-400"
        : days <= 2
          ? "text-amber-600 dark:text-amber-400"
          : "text-muted-foreground";

  const relative =
    inst.paid
      ? "پرداخت شده"
      : days === 0
        ? "امروز سررسید است!"
        : days > 0
          ? `${days.toLocaleString("fa-IR", { useGrouping: false })} روز مانده`
          : `${Math.abs(days).toLocaleString("fa-IR", { useGrouping: false })} روز گذشته`;

  return (
    <Card className={lowBalance ? "border-red-300 dark:border-red-800" : undefined}>
      <CardContent className="space-y-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge className={isCheck ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"}>
                {kindWord}
              </Badge>
              {inst.planCount && inst.planIndex ? (
                <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
                  قسط {inst.planIndex.toLocaleString("fa-IR", { useGrouping: false })} از {inst.planCount.toLocaleString("fa-IR", { useGrouping: false })}
                </Badge>
              ) : null}
              {inst.paid && <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400">پرداخت‌شده</Badge>}
              {!inst.paid && days < 0 && <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">سررسید گذشته</Badge>}
              {!inst.paid && days >= 0 && days <= 2 && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">نزدیک</Badge>}
            </div>
            <h3 className="mt-1.5 truncate text-sm font-bold">{inst.title}</h3>
            <p className="text-[11px] text-muted-foreground">
              {inst.counterparty ? `${inst.counterparty}` : ""}
              {inst.counterparty && inst.bankAccount ? " — " : ""}
              {inst.bankAccount ? inst.bankAccount.name : ""}
            </p>
          </div>
          <div className="shrink-0 text-left">
            <div className="text-base font-black tabular-nums-persian text-emerald-800 dark:text-emerald-300">
              {formatMoneyU(inst.amount)}
            </div>
            <div className={`text-[11px] font-medium ${dueTone}`}>{relative}</div>
            <div className="text-[10px] tabular-nums-persian text-muted-foreground">{formatDateFa(inst.dueDate)}</div>
          </div>
        </div>

        {lowBalance && (
          <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-2.5 text-xs leading-5 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <b>موجودی کافی نیست!</b> موجودی حساب «{inst.bankAccount?.name}»{" "}
              {formatMoneyU(balances.get(inst.bankAccountId!) || 0)} است؛ {kindWord} {formatMoneyU(inst.amount)} دارد.
            </span>
          </div>
        )}

        {!inst.paid && !inst.bankAccountId && notifSupported() && (
          <p className="text-[10px] text-muted-foreground">یادآور اعلان فعال است — برای هشدار موجودی، حساب مرتبط را وصل کنید.</p>
        )}

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {inst.paid ? (
            <Button variant="outline" size="sm" onClick={onUnpay}>
              <RotateCcw className="ml-1 h-3.5 w-3.5" /> برگرداندن به پیش‌رو
            </Button>
          ) : (
            <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={onPay}>
              <Check className="ml-1 h-3.5 w-3.5" /> پرداخت شد
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="ml-1 h-3.5 w-3.5" /> ویرایش
          </Button>
          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => del.mutate()} disabled={del.isPending}>
            <Trash2 className="ml-1 h-3.5 w-3.5" /> حذف
          </Button>
          {inst.planId && !inst.paid && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700"
              disabled={delPlan.isPending}
              onClick={() => {
                if (window.confirm("همهٔ قسط‌های پرداخت‌نشدهٔ این طرح حذف شود؟ (پرداخت‌شده‌ها می‌مانند)")) delPlan.mutate(false);
              }}
            >
              <Trash2 className="ml-1 h-3.5 w-3.5" /> حذف باقی‌ماندهٔ طرح
            </Button>
          )}
          {inst.planId && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700"
              disabled={delPlan.isPending}
              onClick={() => {
                if (window.confirm("حذف کامل طرح؟ تمام اقساط این طرح — حتی پرداخت‌شده‌ها — برای همیشه پاک می‌شوند.")) delPlan.mutate(true);
              }}
            >
              <Trash2 className="ml-1 h-3.5 w-3.5" /> حذف کامل طرح
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── تب اصلی ───

export function Installments() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("upcoming");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [dialogFor, setDialogFor] = useState<Installment | "new" | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [payFor, setPayFor] = useState<Installment | null>(null);

  const { data: installments, isLoading } = useQuery<Installment[]>({
    queryKey: ["installments"],
    queryFn: () => api.get("/api/installments"),
  });
  const { data: accounts } = useQuery<BankAccount[]>({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get("/api/bank-accounts"),
  });
  const { data: stats } = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: () => api.get("/api/stats"),
  });
  const { data: settings } = useQuery<{ notif: NotifSettings }>({
    queryKey: ["app-settings"],
    queryFn: () => api.get("/api/settings"),
  });

  // موجودی هر حساب — از آمار (پیامک بانک یا محاسبه‌شده)
  const balances = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of stats?.accountSummaries || []) m.set(s.id, s.balance);
    return m;
  }, [stats]);

  const unpay = useMutation({
    mutationFn: (id: string) => api.put(`/api/installments/${id}`, { paid: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["installments"] });
      void syncInstallmentNotifications();
    },
  });

  const filtered = useMemo(() => {
    let rows = installments || [];
    const now = Date.now();
    if (kindFilter !== "all") rows = rows.filter((r) => r.kind === kindFilter);
    if (statusFilter === "paid") rows = rows.filter((r) => r.paid);
    else if (statusFilter === "upcoming") rows = rows.filter((r) => !r.paid && new Date(r.dueDate).getTime() >= now);
    else if (statusFilter === "overdue") rows = rows.filter((r) => !r.paid && new Date(r.dueDate).getTime() < now);
    return rows;
  }, [installments, statusFilter, kindFilter]);

  const pending = (installments || []).filter((i) => !i.paid);
  const nextDue = pending
    .filter((i) => new Date(i.dueDate).getTime() >= Date.now())
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
  const soon = pending.filter((i) => {
    const d = daysUntilDue(new Date(i.dueDate).getTime(), Date.now());
    return d >= 0 && d <= (settings?.notif.daysBefore ?? 2);
  });
  const overdue = pending.filter((i) => new Date(i.dueDate).getTime() < Date.now());

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* خلاصهٔ بالای تب */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-[11px] text-muted-foreground">پرداخت‌نشده</div>
            <div className="text-lg font-black tabular-nums-persian">{pending.length.toLocaleString("fa-IR", { useGrouping: false })}</div>
          </CardContent>
        </Card>
        <Card className={overdue.length > 0 ? "border-red-300 dark:border-red-800" : undefined}>
          <CardContent className="p-3 text-center">
            <div className="text-[11px] text-muted-foreground">سررسید گذشته</div>
            <div className={`text-lg font-black tabular-nums-persian ${overdue.length > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
              {overdue.length.toLocaleString("fa-IR", { useGrouping: false })}
            </div>
          </CardContent>
        </Card>
        <Card className={soon.length > 0 ? "border-amber-300 dark:border-amber-800" : undefined}>
          <CardContent className="p-3 text-center">
            <div className="text-[11px] text-muted-foreground">نزدیک سررسید</div>
            <div className={`text-lg font-black tabular-nums-persian ${soon.length > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
              {soon.length.toLocaleString("fa-IR", { useGrouping: false })}
            </div>
          </CardContent>
        </Card>
      </div>

      {nextDue && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CalendarClock className="h-4 w-4 shrink-0" />
          <span>
            نزدیک‌ترین سررسید: <b>{nextDue.title}</b> — {formatMoneyU(nextDue.amount)} در{" "}
            {formatDateFa(nextDue.dueDate)}
          </span>
        </div>
      )}

      {/* نوار ابزار */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(["upcoming", "overdue", "paid", "all"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              statusFilter === s
                ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-border text-muted-foreground"
            }`}
          >
            {statusLabel[s]}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        {(["all", "installment", "check"] as KindFilter[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKindFilter(k)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              kindFilter === k
                ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-border text-muted-foreground"
            }`}
          >
            {k === "all" ? "قسط و چک" : k === "installment" ? "قسط" : "چک"}
          </button>
        ))}
        <Button variant="outline" size="sm" onClick={() => setPlanOpen(true)}>
          <Landmark className="ml-1 h-4 w-4" /> قسط‌بندی وام
        </Button>
        <Button variant="outline" size="sm" className="mr-auto" onClick={() => setDialogFor("new")}>
          <Plus className="ml-1 h-4 w-4" /> {kindFilter === "check" ? "چک جدید" : "قسط/چک جدید"}
        </Button>
      </div>

      {/* لیست */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-muted/60 p-6 text-center text-sm leading-6 text-muted-foreground">
          <Banknote className="mx-auto mb-2 h-7 w-7 opacity-50" />
          {statusFilter === "upcoming"
            ? "قسط یا چکی برای سررسید آینده ندارید."
            : statusFilter === "paid"
              ? "هنوز چیزی پرداخت نشده."
              : statusFilter === "overdue"
                ? "سررسی گذشته ندارید — عالی! ✓"
                : "هنوز قسط یا چکی ثبت نکرده‌اید. با دکمهٔ بالا اولین مورد را اضافه کنید."}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((inst) => (
            <InstallmentCard
              key={inst.id}
              inst={inst}
              balances={balances}
              lowBalanceWarn={settings?.notif.lowBalanceWarn ?? true}
              onEdit={() => setDialogFor(inst)}
              onPay={() => setPayFor(inst)}
              onUnpay={() => unpay.mutate(inst.id)}
            />
          ))}
        </div>
      )}

      {dialogFor && (
        <InstallmentDialog
          editing={dialogFor === "new" ? null : dialogFor}
          accounts={accounts || []}
          onClose={() => setDialogFor(null)}
        />
      )}
      {planOpen && <PlanDialog accounts={accounts || []} onClose={() => setPlanOpen(false)} />}
      {payFor && (
        <PayDialog inst={payFor} accounts={accounts || []} onClose={() => setPayFor(null)} />
      )}
    </div>
  );
}
