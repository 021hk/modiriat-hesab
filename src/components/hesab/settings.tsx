"use client";
// تب تنظیمات — حالت روز/شب، واحد پول (ریال/تومان)، دسته‌بندی خودکار با مبلغ، پشتیبان‌گیری، به‌روزرسانی، درباره
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Sun, Moon, Monitor, Coins, Info, SunMoon, RefreshCw, Download, CheckCircle2, AlertTriangle, ExternalLink, Wand2, Plus, Pencil, Trash2 } from "lucide-react";
import { Backup } from "@/components/hesab/backup";
import {
  currencyLabel,
  setCurrencyUnit,
  useCurrencyUnit,
  parseMoneyInput,
  toStoredAmount,
  toDisplayAmount,
  formatMoneyPlain,
  type CurrencyUnit,
} from "@/lib/format";
import { flattenCategoryTree } from "@/lib/category-tree";
import { describeRule, type AutoCatRule } from "@/lib/auto-cat";
import { api, type Category } from "@/lib/client-api";
import {
  fetchLatestRelease,
  isNewerVersion,
  downloadReleaseApk,
  type ReleaseInfo,
} from "@/lib/app-update";

const APP_VERSION = "۲.۱۳.۰";

function ThemeSection() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const options: { value: string; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "روشن", icon: Sun },
    { value: "dark", label: "تاریک", icon: Moon },
    { value: "system", label: "سیستمی", icon: Monitor },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <SunMoon className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
          حالت روز و شب
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-6 text-muted-foreground">
          ظاهر برنامه را انتخاب کنید. در حالت «سیستمی» برنامه با تنظیم شب/روز خود گوشی هماهنگ می‌شود.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {options.map((o) => {
            const active = mounted && theme === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setTheme(o.value)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-sm font-medium transition ${
                  active
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : "border-border text-muted-foreground hover:border-emerald-300 dark:hover:border-emerald-800"
                }`}
              >
                <o.icon className="h-5 w-5" />
                {o.label}
                {active && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">فعال</span>}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function CurrencySection() {
  const unit = useCurrencyUnit();

  const options: { value: CurrencyUnit; label: string; hint: string }[] = [
    { value: "toman", label: "تومان", hint: "مبلغ‌ها یک رقم کمتر (یک صفر کمتر از ریال)" },
    { value: "rial", label: "ریال", hint: "واحد اصلی پیامک‌های بانکی" },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Coins className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
          واحد پول
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-6 text-muted-foreground">
          همه مبالغ به‌صورت ریال ذخیره می‌شوند (پیامک بانک‌ها ریال است) و فقط نحوه نمایش بر اساس این تنظیم
          تبدیل می‌شود — تومان یک صفر کمتر از ریال است.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {options.map((o) => {
            const active = unit === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setCurrencyUnit(o.value)}
                className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-right transition ${
                  active
                    ? "border-emerald-600 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/50"
                    : "border-border hover:border-emerald-300 dark:hover:border-emerald-800"
                }`}
              >
                <span className={`text-sm font-bold ${active ? "text-emerald-800 dark:text-emerald-300" : ""}`}>
                  {o.label} {active && "✓"}
                </span>
                <span className="text-[11px] leading-4 text-muted-foreground">{o.hint}</span>
              </button>
            );
          })}
        </div>
        <div className="rounded-xl bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
          مثال: پیامک برداشت «-473,000 ریال» — در حالت تومان به‌صورت ۴۷,۳۰۰ تومان نمایش داده می‌شود و
          در حالت ریال همان ۴۷۳,۰۰۰ ریال. واحد فعلی: <b>{currencyLabel(unit)}</b>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── به‌روزرسانی از درون برنامه ───

function UpdateSection() {
  const [state, setState] = useState<"checking" | "latest" | "available" | "error">("checking");
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const [downloading, setDownloading] = useState(false);

  const check = async () => {
    setState("checking");
    setErrMsg("");
    try {
      const r = await fetchLatestRelease();
      setRelease(r);
      setState(isNewerVersion(r.version, APP_VERSION) ? "available" : "latest");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "خطای نامشخص");
      setState("error");
    }
  };

  // بررسی خودکار هنگام باز کردن تنظیمات
  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDownload = async () => {
    if (!release) return;
    setDownloading(true);
    try {
      await downloadReleaseApk(release);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <RefreshCw className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
          به‌روزرسانی برنامه
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">نسخه فعلی:</span>
          <span className="font-bold tabular-nums-persian">{APP_VERSION}</span>
        </div>

        {state === "checking" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            در حال بررسی نسخه جدید...
          </p>
        )}

        {state === "latest" && (
          <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            برنامه شما به‌روز است — آخرین نسخه منتشرشده همین است.
          </p>
        )}

        {state === "available" && release && (
          <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-800 dark:bg-emerald-950/40">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-300">
              <Download className="h-4 w-4" />
              نسخه جدید {release.version.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)])} موجود است!
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              دکمه زیر، فایل نصب (APK) را در مرورگر گوشی باز می‌کند. بعد از دانلود، فایل را از نوار
              اعلان‌ها باز کنید و اجازه نصب بدهید. تمام داده‌ها و تنظیمات شما حفظ می‌شود.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={onDownload} disabled={downloading || !release.apkUrl} className="bg-emerald-700 hover:bg-emerald-800">
                <Download className="ml-1 h-4 w-4" />
                {downloading ? "در حال باز کردن..." : "دانلود نسخه جدید"}
              </Button>
              <Button variant="outline" onClick={() => release.htmlUrl && window.open(release.htmlUrl, "_blank")}>
                <ExternalLink className="ml-1 h-4 w-4" />
                توضیحات نسخه
              </Button>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              بررسی به‌روزرسانی ناموفق بود (اینترنت؟) {errMsg && <span className="text-xs text-muted-foreground">— {errMsg}</span>}
            </p>
          </div>
        )}

        <Button variant="outline" size="sm" onClick={check} disabled={state === "checking"}>
          <RefreshCw className={`ml-1 h-4 w-4 ${state === "checking" ? "animate-spin" : ""}`} />
          بررسی مجدد
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── دسته‌بندی خودکار با مبلغ (v2.13) ───
// قانون = عدد مشخص یا محدوده مبلغ + دسته؛ تراکنش هزینه/درآمد بدون دسته، خودکار در دستهٔ قانون ثبت می‌شود

const fmtDisplay = (rial: number) => formatMoneyPlain(toDisplayAmount(rial));

function AutoCatRuleDialog({
  editing,
  categories,
  onClose,
}: {
  editing: AutoCatRule | null;
  categories: Category[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [flow, setFlow] = useState<"expense" | "income">(editing?.flow || "expense");
  const [matchMode, setMatchMode] = useState<"exact" | "range">(editing?.match || "exact");
  const [exact, setExact] = useState(editing?.exact ? fmtDisplay(editing.exact) : "");
  const [min, setMin] = useState(editing?.min ? fmtDisplay(editing.min) : "");
  const [max, setMax] = useState(editing?.max ? fmtDisplay(editing.max) : "");
  const [categoryId, setCategoryId] = useState(editing?.categoryId || "");

  const flatCats = flattenCategoryTree(categories.filter((c) => c.type === flow));
  const chosenCat = categories.find((c) => c.id === categoryId);

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      editing
        ? api.put(`/api/auto-cat-rules/${editing.id}`, body)
        : api.post("/api/auto-cat-rules", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auto-cat-rules"] });
      onClose();
    },
  });

  const money = (s: string) => toStoredAmount(parseMoneyInput(s));
  const canSave =
    !!categoryId &&
    (matchMode === "exact"
      ? parseMoneyInput(exact) > 0
      : parseMoneyInput(min) > 0 || parseMoneyInput(max) > 0);

  const scopeText =
    matchMode === "exact"
      ? `دقیقاً ${formatMoneyPlain(parseMoneyInput(exact) || 0)} ${currencyLabel()}`
      : parseMoneyInput(min) > 0 && parseMoneyInput(max) > 0
        ? `از ${formatMoneyPlain(parseMoneyInput(min))} تا ${formatMoneyPlain(parseMoneyInput(max))} ${currencyLabel()}`
        : parseMoneyInput(min) > 0
          ? `از ${formatMoneyPlain(parseMoneyInput(min))} ${currencyLabel()} به بالا`
          : `تا ${formatMoneyPlain(parseMoneyInput(max))} ${currencyLabel()}`;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? "ویرایش قانون" : "قانون دسته‌بندی خودکار"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {/* نوع تراکنش */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setFlow("expense");
                setCategoryId("");
              }}
              className={`rounded-xl border-2 p-2.5 text-sm font-medium transition ${
                flow === "expense"
                  ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                  : "border-border text-muted-foreground"
              }`}
            >
              هزینه (برداشت)
            </button>
            <button
              type="button"
              onClick={() => {
                setFlow("income");
                setCategoryId("");
              }}
              className={`rounded-xl border-2 p-2.5 text-sm font-medium transition ${
                flow === "income"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-border text-muted-foreground"
              }`}
            >
              درآمد (واریز)
            </button>
          </div>

          {/* حالت تطبیق */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMatchMode("exact")}
              className={`rounded-xl border-2 p-2.5 text-sm font-medium transition ${
                matchMode === "exact"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-border text-muted-foreground"
              }`}
            >
              عدد مشخص
              <span className="block text-[10px] opacity-70">مثلاً دقیقاً ۵۰۰٬۰۰۰</span>
            </button>
            <button
              type="button"
              onClick={() => setMatchMode("range")}
              className={`rounded-xl border-2 p-2.5 text-sm font-medium transition ${
                matchMode === "range"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-border text-muted-foreground"
              }`}
            >
              محدوده
              <span className="block text-[10px] opacity-70">مثلاً از ۱۰۰ تا ۹۹۹ هزار</span>
            </button>
          </div>

          {matchMode === "exact" ? (
            <div className="grid gap-2">
              <Label>مبلغ ({currencyLabel()})</Label>
              <Input
                inputMode="numeric"
                placeholder="مثلاً ۵۰۰,۰۰۰"
                value={exact ? formatMoneyPlain(parseMoneyInput(exact)) : ""}
                onChange={(e) => setExact(e.target.value)}
                className="text-left text-lg font-bold tabular-nums-persian"
                dir="ltr"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label>از ({currencyLabel()})</Label>
                <Input
                  inputMode="numeric"
                  placeholder="۱۰۰,۰۰۰"
                  value={min ? formatMoneyPlain(parseMoneyInput(min)) : ""}
                  onChange={(e) => setMin(e.target.value)}
                  className="text-left tabular-nums-persian"
                  dir="ltr"
                />
              </div>
              <div className="grid gap-2">
                <Label>تا ({currencyLabel()})</Label>
                <Input
                  inputMode="numeric"
                  placeholder="۹۹۹,۰۰۰"
                  value={max ? formatMoneyPlain(parseMoneyInput(max)) : ""}
                  onChange={(e) => setMax(e.target.value)}
                  className="text-left tabular-nums-persian"
                  dir="ltr"
                />
              </div>
            </div>
          )}

          {/* دسته هدف */}
          <div className="grid gap-2">
            <Label>دستهٔ مقصد</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="انتخاب دسته" />
              </SelectTrigger>
              <SelectContent>
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
          </div>

          {/* پیش‌نمایش زنده */}
          {categoryId && canSave && (
            <p className="rounded-lg bg-emerald-50 p-2 text-[11px] leading-5 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              هر «{flow === "expense" ? "هزینه" : "درآمد"}» با مبلغ {scopeText} خودکار در دستهٔ «{chosenCat?.name}» ثبت می‌شود — مگر خودتان دستهٔ دیگری انتخاب کنید.
            </p>
          )}
          {mutation.isError && (
            <p className="rounded-lg bg-red-50 p-2 text-[11px] text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {(mutation.error as Error).message}
            </p>
          )}
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
                flow,
                match: matchMode,
                exact: matchMode === "exact" ? money(exact) : null,
                min: matchMode === "range" ? money(min) : null,
                max: matchMode === "range" ? money(max) : null,
                categoryId,
              })
            }
          >
            {editing ? "ذخیره تغییرات" : "افزودن قانون"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AutoCatSection() {
  const qc = useQueryClient();
  const { data: rules, isLoading } = useQuery<AutoCatRule[]>({
    queryKey: ["auto-cat-rules"],
    queryFn: () => api.get("/api/auto-cat-rules"),
  });
  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/api/categories"),
  });
  const [dialogFor, setDialogFor] = useState<AutoCatRule | "new" | null>(null);

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.put(`/api/auto-cat-rules/${id}`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auto-cat-rules"] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.del(`/api/auto-cat-rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auto-cat-rules"] }),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Wand2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
          دسته‌بندی خودکار با مبلغ
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs leading-5 text-muted-foreground">
          قانون بسازید: یک عدد مشخص یا یک محدودهٔ مبلغ + دستهٔ مقصد. هر تراکنش «هزینه یا درآمد» که خودتان برایش دسته
          انتخاب نکرده باشید، اگر مبلغش با قانون بخواند، خودکار در همان دسته ثبت می‌شود — هم ثبت دستی و هم پیامک‌های
          بانکی. تراکنش‌های بدهی/طلب شامل قوانین نمی‌شوند.
        </p>

        {isLoading ? (
          <p className="text-xs text-muted-foreground">در حال بارگذاری…</p>
        ) : !rules || rules.length === 0 ? (
          <p className="rounded-xl bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
            هنوز قانونی نساخته‌اید. مثلاً: «هزینهٔ دقیقاً ۵۰۰ هزار تومان ← خواربار» تا خریدهای ماهانه خودکار دسته‌بندی شوند.
          </p>
        ) : (
          <div className="space-y-2">
            {rules.map((r) => {
              const cat = (categories || []).find((c) => c.id === r.categoryId);
              return (
                <div key={r.id} className="flex items-center gap-2 rounded-xl border p-2.5">
                  <Switch
                    checked={r.enabled}
                    onCheckedChange={(v) => toggle.mutate({ id: r.id, enabled: v })}
                    aria-label="فعال/غیرفعال"
                  />
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-medium ${r.enabled ? "" : "line-through opacity-60"}`}>
                      {describeRule(r, fmtDisplay, currencyLabel())}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cat?.color || "#999" }} />
                      {cat ? cat.name : "دستهٔ حذف‌شده"}
                      {r.label ? ` — ${r.label}` : ""}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDialogFor(r)} aria-label="ویرایش">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600 hover:text-red-700"
                    onClick={() => del.mutate(r.id)}
                    aria-label="حذف"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <Button variant="outline" size="sm" onClick={() => setDialogFor("new")}>
          <Plus className="ml-1 h-4 w-4" /> قانون جدید
        </Button>
      </CardContent>

      {dialogFor && (
        <AutoCatRuleDialog
          editing={dialogFor === "new" ? null : dialogFor}
          categories={categories || []}
          onClose={() => setDialogFor(null)}
        />
      )}
    </Card>
  );
}

export function Settings() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <ThemeSection />
      <CurrencySection />
      <AutoCatSection />
      <Backup />
      <UpdateSection />
      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold">
            <Info className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            درباره حساب‌یار
          </div>
          <ul className="list-inside list-disc space-y-1.5 text-xs leading-5 text-muted-foreground">
            <li>نسخه {APP_VERSION} — برنامه کاملاً آفلاین؛ همه داده‌ها فقط روی خود دستگاه ذخیره می‌شوند.</li>
            <li>در نسخه اندروید، پیامک‌های بانکی به‌صورت خودکار خوانده و واریز/برداشت ثبت می‌شود.</li>
            <li>برای انتقال داده به گوشی یا کامپیوتر دیگر، از بخش پشتیبان‌گیری استفاده کنید.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
