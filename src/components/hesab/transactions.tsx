"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Plus, MoreVertical, Pencil, Trash2, Search, MessageSquareText, HandCoins, Check, X, Download, Wand2 } from "lucide-react";
import { api, type Transaction, type Category, type BankAccount, type Debt, type AutoCatRule } from "@/lib/client-api";
import {
  autoKind,
  kindLabel,
  kindSentence,
  personKey,
  personKindsOfDirection,
  txDirection,
  txKindOf,
  type TxKind,
} from "@/lib/debt-utils";
import { flattenCategoryTree } from "@/lib/category-tree";
import { matchAutoCatRule, describeRule } from "@/lib/auto-cat";
import { buildXlsx } from "@/lib/excel-export";
import {
  dateToJalaliParts,
  jalaliPartsToIso,
  jalaliMonthLength,
  JALALI_MONTH_NAMES,
} from "@/lib/jalali";
import {
  formatMoneyPlain,
  formatMoneyU,
  parseMoneyInput,
  formatDateFa,
  currencyLabel,
  toDisplayAmount,
  toStoredAmount,
} from "@/lib/format";

// انتخابگر تاریخ/ساعت جلالی — سال ← ماه ← روز ← ساعت (ترتیب درست برای کاربر ایرانی)
// تاریخ دقیق (با ساعت) ذخیره می‌شود تا ترتیب تراکنش‌ها درست باشد
function JalaliDateTimePicker({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const parts = dateToJalaliParts(new Date(value));
  const [jy, setJy] = useState(parts.jy);
  const [jm, setJm] = useState(parts.jm);
  const [jd, setJd] = useState(parts.jd);
  const [hhmm, setHhmm] = useState(
    () => `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`
  );

  const dayLen = jalaliMonthLength(jy, jm);
  const effDay = Math.min(jd, dayLen);
  const [h, m] = hhmm.split(":").map((x) => Number(x) || 0);

  const emit = (ny: number, nm: number, nd: number) => {
    onChange(jalaliPartsToIso(ny, nm, Math.min(nd, jalaliMonthLength(ny, nm)), h, m));
  };

  const years: number[] = [];
  for (let y = parts.jy + 1; y >= parts.jy - 20; y--) years.push(y);

  const selectCls = "h-9 text-xs";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <div className="grid gap-1">
          <Label className="text-[11px] text-muted-foreground">سال</Label>
          <Select value={String(jy)} onValueChange={(v) => { setJy(Number(v)); emit(Number(v), jm, effDay); }}>
            <SelectTrigger className={selectCls}><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-56">
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y.toLocaleString("fa-IR", { useGrouping: false })}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label className="text-[11px] text-muted-foreground">ماه</Label>
          <Select value={String(jm)} onValueChange={(v) => { setJm(Number(v)); emit(jy, Number(v), effDay); }}>
            <SelectTrigger className={selectCls}><SelectValue /></SelectTrigger>
            <SelectContent>
              {JALALI_MONTH_NAMES.map((name, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label className="text-[11px] text-muted-foreground">روز</Label>
          <Select value={String(effDay)} onValueChange={(v) => { setJd(Number(v)); emit(jy, jm, Number(v)); }}>
            <SelectTrigger className={selectCls}><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-56">
              {Array.from({ length: dayLen }, (_, i) => i + 1).map((d) => (
                <SelectItem key={d} value={String(d)}>{d.toLocaleString("fa-IR", { useGrouping: false })}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-1">
        <Label className="text-[11px] text-muted-foreground">ساعت</Label>
        <Input
          type="time"
          dir="ltr"
          className="text-left"
          value={hhmm}
          onChange={(e) => {
            setHhmm(e.target.value);
            const [nh, nm2] = e.target.value.split(":").map((x) => Number(x) || 0);
            onChange(jalaliPartsToIso(jy, jm, effDay, nh, nm2));
          }}
        />
      </div>
    </div>
  );
}

// ─── خروجی اکسل تراکنش‌ها (v2.13) ───
// xlsx کاملاً آفلاین ساخته می‌شود (بدون کتابخانه خارجی) — شیت راست‌به‌چپ با سرستون بولد
function buildTxWorkbook(txs: Transaction[], categories: Category[]): Uint8Array {
  const catLabel = new Map<string, string>();
  for (const { category: c, label } of flattenCategoryTree(categories)) catLabel.set(c.id, label);
  const pad = (n: number) => String(n).padStart(2, "0");
  const rows: (string | number)[][] = [
    ["تاریخ", "ساعت", "نوع", "عنوان", "بابت", "مبلغ", "دسته", "حساب", "شخص", "منبع"],
  ];
  for (const t of txs) {
    const p = dateToJalaliParts(new Date(t.date));
    rows.push([
      `${p.jy}/${pad(p.jm)}/${pad(p.jd)}`,
      `${pad(p.hour)}:${pad(p.minute)}`,
      txDirection(t) === "out" ? "برداشت" : "واریز",
      kindLabel(txKindOf(t)),
      t.purpose || "",
      toDisplayAmount(t.amount),
      t.categoryId ? catLabel.get(t.categoryId) || "بدون دسته" : "بدون دسته",
      t.bankAccount?.name || "",
      t.debtName || "",
      t.source === "sms" ? "پیامک" : "دستی",
    ]);
  }
  return buildXlsx([
    { name: "تراکنش‌ها", rows, colWidths: [12, 8, 9, 18, 24, 14, 16, 14, 14, 8] },
  ]);
}

function downloadBytes(bytes: Uint8Array, fileName: string, mime: string): void {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function TxDialog({
  open,
  onOpenChange,
  editing,
  categories,
  accounts,
  preset,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Transaction | null;
  categories: Category[];
  accounts: BankAccount[];
  preset?: { type?: "income" | "expense"; amount?: number; purpose?: string; bankAccountId?: string; personName?: string } | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [type, setType] = useState<"income" | "expense">(preset?.type || editing?.type || "expense");
  const [amount, setAmount] = useState(
    preset?.amount
      ? formatMoneyPlain(toDisplayAmount(preset.amount))
      : editing
        ? formatMoneyPlain(toDisplayAmount(editing.amount))
        : ""
  );
  const [purpose, setPurpose] = useState(preset?.purpose || editing?.purpose || "");
  const [categoryId, setCategoryId] = useState(editing?.categoryId || "");
  const [bankAccountId, setBankAccountId] = useState(preset?.bankAccountId || editing?.bankAccountId || "");
  const [dateIso, setDateIso] = useState(editing?.date || new Date().toISOString());

  // ─── ثبت یکتا: هر تراکنش فقط «یک» هویت دارد ───
  // plain = هزینه/درآمد خالص (در آمار مالی حساب می‌شود)
  // person = بابت شخص (بدهی/طلب) — عنوانش از علامت باقی‌مانده همان شخص خودکار تشخیص داده می‌شود
  const [regMode, setRegMode] = useState<"plain" | "person">(
    preset?.personName || editing?.debtId ? "person" : "plain"
  );
  const [personName, setPersonName] = useState(preset?.personName || editing?.debtName || "");
  const [manualKind, setManualKind] = useState<TxKind | null>(null);

  // دسته‌بندی خودکار با مبلغ (v2.13) — اگر کاربر خودش دسته انتخاب نکرده باشد
  const [autoCatId, setAutoCatId] = useState<string | null>(null);

  const { data: existingDebts } = useQuery<Debt[]>({
    queryKey: ["debts"],
    queryFn: () => api.get("/api/debts"),
    enabled: open,
  });
  // همه تراکنش‌ها — برای محاسبه باقی‌مانده فعلی شخص (مبنای تشخیص خودکار عنوان)
  const { data: allTxs } = useQuery<Transaction[]>({
    queryKey: ["transactions", "all"],
    queryFn: () => api.get("/api/transactions?limit=500"),
    enabled: open && regMode === "person",
  });

  const personSuggestions = Array.from(new Set((existingDebts || []).map((d) => d.name).filter(Boolean)));

  const { data: autoCatRules } = useQuery<AutoCatRule[]>({
    queryKey: ["auto-cat-rules"],
    queryFn: () => api.get("/api/auto-cat-rules"),
    enabled: open,
  });

  // شخص انتخابی (با نرمال‌سازی نام) + باقی‌مانده فعلی او
  const person = useMemo(() => {
    const key = personKey(personName);
    if (!key) return null;
    return (existingDebts || []).find((d) => personKey(d.name) === key) || null;
  }, [existingDebts, personName]);

  const personNet = useMemo(() => {
    if (!person) return 0;
    let out = 0;
    let inn = 0;
    for (const t of allTxs || []) {
      if (t.debtId !== person.id || t.id === editing?.id) continue;
      if (txDirection(t) === "out") out += t.amount || 0;
      else inn += t.amount || 0;
    }
    return (person.openingBalance || 0) + out - inn;
  }, [person, allTxs, editing]);

  const direction: "out" | "in" = type === "expense" ? "out" : "in";
  const autoKindVal = autoKind(direction, personNet);
  // انتخاب دستی فقط از انواع شخص‌دارِ همین جهت؛ با تغییر نوع یا شخص، دوباره خودکار
  const validPersonKinds = personKindsOfDirection(direction);
  const finalKind: TxKind = manualKind && validPersonKinds.includes(manualKind) ? manualKind : autoKindVal;

  const switchType = (t: "income" | "expense") => {
    setType(t);
    setManualKind(null);
  };
  const switchMode = (m: "plain" | "person") => {
    setRegMode(m);
    setManualKind(null);
  };
  const changePersonName = (v: string) => {
    setPersonName(v);
    setManualKind(null);
  };

  const displayAmount = formatMoneyU(toStoredAmount(parseMoneyInput(amount)));
  const willBeSentence = kindSentence(regMode === "person" ? finalKind : direction === "out" ? "expense" : "income", personName.trim(), displayAmount, currencyLabel());
  const personKindOptions: { v: TxKind; label: string }[] = validPersonKinds.map((k) => ({ v: k, label: kindLabel(k) }));

  const mutation = useMutation({
    mutationFn: async () => {
      const isPerson = regMode === "person" && personName.trim().length > 0;
      const body: Record<string, unknown> = {
        type,
        amount: toStoredAmount(parseMoneyInput(amount)),
        purpose: purpose || null,
        categoryId: isPerson ? null : categoryId === "none" ? null : categoryId || null,
        bankAccountId: bankAccountId === "none" ? null : bankAccountId || null,
        date: dateIso,
      };
      // در حالت «هزینه/درآمد» اتصال به شخص حذف می‌شود (هویت یکتا)
      if (!isPerson) body.debtId = null;
      const saved: Transaction = editing
        ? await api.put<Transaction>(`/api/transactions/${editing.id}`, body)
        : await api.post<Transaction>("/api/transactions", body);
      // اتصال به شخص بعد از ثبت — kind نهایی در سرور از باقی‌مانده شخص تشخیص داده می‌شود
      if (isPerson) {
        await api.post(`/api/transactions/${saved.id}/link-debt`, {
          personName: personName.trim(),
          ...(manualKind && validPersonKinds.includes(manualKind) ? { kind: manualKind } : {}),
        });
      }
      return saved;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["debts"] });
      toast({ title: editing ? "تراکنش ویرایش شد" : "تراکنش ثبت شد" });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  const filteredCats = categories.filter((c) => c.type === type);
  // زیرشاخه‌ها با تودرتو و ترتیب درختی در فهرست انتخاب دیده می‌شوند
  const flatCats = flattenCategoryTree(filteredCats);
  const isPersonMode = regMode === "person";
  const canSave = parseMoneyInput(amount) > 0 && (!isPersonMode || personName.trim().length > 0);

  // دسته‌بندی خودکار با مبلغ: با تغییر مبلغ/نوع، اگر قانونی بخواند و کاربر دسته‌ای
  // انتخاب نکرده باشد (یا دستهٔ قبلی هم خودکار گذاشته شده باشد)، دستهٔ قانون اعمال می‌شود
  const autoCatRule = useMemo(() => {
    if (editing || isPersonMode) return null;
    const amt = toStoredAmount(parseMoneyInput(amount));
    if (!(amt > 0)) return null;
    const valid = new Set(categories.filter((c) => c.type === type).map((c) => c.id));
    return matchAutoCatRule(amt, type, autoCatRules, valid);
  }, [amount, type, autoCatRules, editing, isPersonMode, categories]);

  useEffect(() => {
    if (!autoCatRule) return;
    setCategoryId((cur) => (!cur || cur === autoCatId ? autoCatRule.categoryId : cur));
    setAutoCatId(autoCatRule.categoryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCatRule]);

  const autoCatApplied = !editing && !isPersonMode && !!autoCatRule && (categoryId === autoCatRule.categoryId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? "ویرایش تراکنش" : "ثبت تراکنش جدید"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 max-h-[75dvh] overflow-y-auto pl-1">
          {/* جهت پول */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => switchType("expense")}
              className={`rounded-xl border-2 p-3 text-sm font-medium transition ${
                type === "expense"
                  ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                  : "border-border text-muted-foreground"
              }`}
            >
              − برداشت (خروج پول)
            </button>
            <button
              type="button"
              onClick={() => switchType("income")}
              className={`rounded-xl border-2 p-3 text-sm font-medium transition ${
                type === "income"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-border text-muted-foreground"
              }`}
            >
              + واریز (ورود پول)
            </button>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="amount">مبلغ ({currencyLabel()})</Label>
            <Input
              id="amount"
              inputMode="numeric"
              placeholder="مثلاً ۲۵۰,۰۰۰"
              value={amount ? formatMoneyPlain(parseMoneyInput(amount)) : ""}
              onChange={(e) => {
                const raw = e.target.value.replace(/[\d,۰-۹]/g, "");
                if (raw && !/^[0-9]*$/.test(raw.replace(/[٬,،\s]/g, ""))) return;
                setAmount(e.target.value);
              }}
              className="text-left text-lg font-bold tabular-nums-persian"
              dir="ltr"
            />
          </div>

          {/* نوع ثبت — فقط یکی: هزینه/درآمد یا بدهی/طلب */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => switchMode("plain")}
              className={`rounded-xl border-2 p-3 text-sm font-medium transition ${
                !isPersonMode
                  ? "border-slate-500 bg-slate-100 text-slate-800 dark:bg-slate-900/60 dark:text-slate-200"
                  : "border-border text-muted-foreground"
              }`}
            >
              {type === "expense" ? "هزینه" : "درآمد"}
              <span className="block text-[10px] opacity-70">در آمار هزینه/درآمد حساب می‌شود</span>
            </button>
            <button
              type="button"
              onClick={() => switchMode("person")}
              className={`rounded-xl border-2 p-3 text-sm font-medium transition ${
                isPersonMode
                  ? "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  : "border-border text-muted-foreground"
              }`}
            >
              بدهی یا طلب
              <span className="block text-[10px] opacity-70">وصل به شخص — عنوان خودکار</span>
            </button>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="purpose">بابت چه چیزی؟ (اختیاری)</Label>
            <Input
              id="purpose"
              placeholder="مثلاً: خرید ماهانه خواربار"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </div>

          {!isPersonMode ? (
            <div className="grid gap-2">
              <Label>دسته‌بندی</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب دسته" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون دسته</SelectItem>
                  {flatCats.map(({ category: c, label }) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                        {label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="rounded-lg bg-muted/60 p-2 text-[11px] leading-5 text-muted-foreground">{willBeSentence}</p>
              {autoCatApplied && autoCatRule && (
                <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px] leading-5 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <Wand2 className="h-3.5 w-3.5 shrink-0" />
                  دسته «{categories.find((c) => c.id === autoCatRule.categoryId)?.name || "—"}» خودکار بر اساس مبلغ انتخاب شد — {describeRule(autoCatRule, (n) => formatMoneyPlain(toDisplayAmount(n)), currencyLabel())}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>شخص (بدهکار یا طلبکار)</Label>
              <Input
                placeholder="نام شخص (مثلاً: علی)"
                value={personName}
                onChange={(e) => changePersonName(e.target.value)}
                list="tx-person-suggestions"
              />
              <datalist id="tx-person-suggestions">
                {personSuggestions.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              {personName.trim() ? (
                <div className="space-y-2">
                  {/* عنوان ثبت — خودکار از علامت باقی‌مانده شخص؛ فقط با «تشخیص دستی» قابل تغییر */}
                  <div className="flex items-center justify-between gap-2 rounded-lg border-2 border-amber-400 bg-amber-50 px-2.5 py-2 dark:border-amber-700 dark:bg-amber-950/40">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                      <Check className="h-3.5 w-3.5" />
                      عنوان ثبت: «{kindLabel(finalKind)}»
                    </span>
                    <button
                      type="button"
                      onClick={() => setManualKind((k) => (k ? null : finalKind === personKindOptions[0].v ? personKindOptions[1].v : personKindOptions[0].v))}
                      className="shrink-0 text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      {manualKind ? "بازگشت به تشخیص خودکار" : "تشخیص دستی"}
                    </button>
                  </div>
                  {manualKind && (
                    <div className="grid grid-cols-2 gap-2">
                      {personKindOptions.map((o) => (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() => setManualKind(o.v)}
                          className={`flex items-center justify-center gap-1.5 rounded-lg border-2 px-2 py-2 text-xs font-medium transition ${
                            finalKind === o.v
                              ? "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {finalKind === o.v && <Check className="h-3.5 w-3.5" />}
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="rounded-lg bg-muted/60 p-2 text-[11px] leading-5 text-muted-foreground">
                    {willBeSentence}
                  </p>
                </div>
              ) : (
                <p className="rounded-lg bg-muted/60 p-2 text-[11px] leading-5 text-muted-foreground">
                  نام شخص را وارد کنید — عنوان ثبت (پرداخت بدهی، پرداخت قرض، دریافت طلب یا دریافت بدهی) از باقی‌ماندهٔ
                  فعلی او خودکار تشخیص داده می‌شود: مثبت = طلب، منفی = بدهی
                </p>
              )}
              {editing?.debtId && (
                <button
                  type="button"
                  onClick={() => switchMode("plain")}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                  حذف اتصال به «{editing.debtName}» و ثبت به‌عنوان {type === "expense" ? "هزینه" : "درآمد"}
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {isPersonMode && (
              <div className="grid gap-2">
                <Label>وضعیت فعلی شخص</Label>
                <div className="rounded-lg border px-3 py-2 text-xs">
                  {person ? (
                    <span className={personNet > 0 ? "text-amber-700 dark:text-amber-300" : personNet < 0 ? "text-orange-700 dark:text-orange-300" : "text-emerald-700 dark:text-emerald-300"}>
                      {personNet > 0
                        ? `طلب ${formatMoneyU(personNet)} ${currencyLabel()}`
                        : personNet < 0
                          ? `بدهی ${formatMoneyU(-personNet)} ${currencyLabel()}`
                          : "تسویه"}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">شخص جدید — بدون سابقه</span>
                  )}
                </div>
              </div>
            )}
            <div className={`grid gap-2 ${!isPersonMode ? "col-span-2" : ""}`}>
              <Label>حساب بانکی</Label>
              <Select value={bankAccountId} onValueChange={setBankAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب حساب" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون حساب</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>تاریخ و ساعت</Label>
            <JalaliDateTimePicker value={dateIso} onChange={setDateIso} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !canSave}
            className="bg-emerald-700 hover:bg-emerald-800"
          >
            {mutation.isPending ? "..." : editing ? "ذخیره تغییرات" : "ثبت تراکنش"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Transactions({ categories, accounts }: { categories: Category[]; accounts: BankAccount[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [preset, setPreset] = useState<{ type?: "income" | "expense"; amount?: number; purpose?: string; bankAccountId?: string; personName?: string } | null>(null);
  // هر بار باز شدن دیالوگ یک شماره جدید — با key باعث نصب مجدد می‌شود تا داده‌های
  // تراکنش در حال ویرایش همیشه از نو در فرم بنشیند (قبلاً فرم خالی/کهنه می‌ماند)
  const [openSeq, setOpenSeq] = useState(0);

  const params = new URLSearchParams();
  if (typeFilter !== "all") params.set("type", typeFilter);
  if (catFilter !== "all") params.set("categoryId", catFilter);
  if (q) params.set("q", q);
  const { data, isLoading } = useQuery<Transaction[]>({
    queryKey: ["transactions", typeFilter, catFilter, q],
    queryFn: () => api.get(`/api/transactions?${params.toString()}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/transactions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast({ title: "تراکنش حذف شد" });
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  const openNew = (p?: { type?: "income" | "expense"; amount?: number; purpose?: string; bankAccountId?: string; personName?: string } | null) => {
    setEditing(null);
    setPreset(p || null);
    setOpenSeq((s) => s + 1);
    setDialogOpen(true);
  };

  const openEdit = (tx: Transaction) => {
    setPreset(null);
    setEditing(tx);
    setOpenSeq((s) => s + 1);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* نوار ابزار */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => openNew(null)} className="bg-emerald-700 hover:bg-emerald-800">
          <Plus className="ml-1 h-4 w-4" /> تراکنش جدید
        </Button>
        <div className="flex flex-wrap rounded-lg border p-1">
          {[
            { v: "all", label: "همه" },
            { v: "income", label: "واریز" },
            { v: "expense", label: "برداشت" },
            { v: "debt", label: "بدهی/طلب" },
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => setTypeFilter(o.v)}
              className={`rounded-md px-3 py-1 text-xs transition ${
                typeFilter === o.v ? "bg-emerald-700 text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="همه دسته‌ها" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه دسته‌ها</SelectItem>
            {flattenCategoryTree(categories).map(({ category: c, label }) => (
              <SelectItem key={c.id} value={c.id}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-40">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="جستجو در بابت..." value={q} onChange={(e) => setQ(e.target.value)} className="pr-9" />
        </div>
        {/* خروجی اکسل — همان لیستِ فعلی با فیلترها و جستجوی فعال */}
        <Button
          variant="outline"
          onClick={() => {
            if (!data || data.length === 0) return;
            const bytes = buildTxWorkbook(data, categories);
            downloadBytes(
              bytes,
              `hesab-transactions-${new Date().toISOString().slice(0, 10)}.xlsx`,
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
            toast({ title: "خروجی اکسل آماده شد", description: `${formatMoneyPlain(data.length)} تراکنش در فایل ذخیره شد` });
          }}
          disabled={!data || data.length === 0}
        >
          <Download className="ml-1 h-4 w-4" /> خروجی اکسل
        </Button>
      </div>

      {/* لیست */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="font-medium">هنوز تراکنشی ثبت نشده</p>
            <p className="text-sm text-muted-foreground">اولین هزینه یا درآمد خود را ثبت کنید</p>
            <Button onClick={() => openNew(null)} className="mt-2 bg-emerald-700 hover:bg-emerald-800">
              <Plus className="ml-1 h-4 w-4" /> ثبت تراکنش
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.map((tx) => {
            const kind = txKindOf(tx);
            const isPersonTx = Boolean(tx.debtId);
            const rowTitle =
              tx.purpose ||
              (isPersonTx
                ? `${kindLabel(kind)}${tx.debtName ? ` — ${tx.debtName}` : ""}`
                : tx.category?.name || (tx.type === "income" ? "درآمد" : "هزینه"));
            return (
            <Card key={tx.id} className="py-0">
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold ${
                      tx.type === "income"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                        : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
                    }`}
                  >
                    {tx.type === "income" ? "+" : "−"}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      {rowTitle}
                      {tx.source === "sms" && <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {formatDateFa(tx.date)}
                      {isPersonTx && (
                        <Badge variant="outline" className="h-4 gap-1 border-amber-300 px-1.5 text-[10px] text-amber-700 dark:border-amber-800 dark:text-amber-400">
                          <HandCoins className="h-2.5 w-2.5" />
                          {kindLabel(kind)}
                        </Badge>
                      )}
                      {!isPersonTx && tx.category && (
                        <Badge variant="secondary" className="h-4 gap-1 px-1.5 text-[10px]">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tx.category.color }} />
                          {tx.category.name}
                        </Badge>
                      )}
                      {tx.debtName && (
                        <Badge variant="outline" className="h-4 gap-1 px-1.5 text-[10px] text-amber-700 dark:text-amber-400">
                          <HandCoins className="h-2.5 w-2.5" />
                          {tx.debtName}
                        </Badge>
                      )}
                      {tx.bankAccount && <span>• {tx.bankAccount.name}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={`text-base font-bold tabular-nums-persian ${
                      tx.type === "income" ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatMoneyU(tx.amount)}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(tx)}>
                        <Pencil className="ml-2 h-4 w-4" /> ویرایش
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => {
                          if (confirm("این تراکنش حذف شود؟")) deleteMutation.mutate(tx.id);
                        }}
                      >
                        <Trash2 className="ml-2 h-4 w-4" /> حذف
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Card>
            );
          })}
        </div>
      )}

      <TxDialog
        key={openSeq}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        categories={categories}
        accounts={accounts}
        preset={preset}
      />
    </div>
  );
}

export { TxDialog };
