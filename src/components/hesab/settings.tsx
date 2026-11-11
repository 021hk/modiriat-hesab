"use client";
// تب تنظیمات — حالت روز/شب، واحد پول (ریال/تومان)، دسته‌بندی خودکار با مبلغ، پشتیبان‌گیری، به‌روزرسانی، درباره
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Sun, Moon, MoonStar, Monitor, Coins, Info, SunMoon, RefreshCw, Download, CheckCircle2, AlertTriangle, ExternalLink, Wand2, Plus, Pencil, Trash2, Sparkles, BellRing, Volume2, ShieldCheck, Loader2, Copy, ScrollText } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import {
  fetchLatestRelease,
  isNewerVersion,
  downloadReleaseApk,
  type ReleaseInfo,
} from "@/lib/app-update";
import { openExternalUrl } from "@/lib/native-sms";
import { testGeminiConnection, cachedGeminiModel, resetGeminiModelCache, splitApiKeys, readGeminiProxy, setGeminiProxy } from "@/lib/ai/gemini";
import { readGeminiLog, clearGeminiLog, geminiLogToText, GEMINI_LOG_EVENT, type GeminiLogEntry } from "@/lib/ai/gemini-log";
import { ACCENTS, SPECIALS, applyAccent, applySpecial, readStoredAccent, readStoredSpecial, type AccentId, type SpecialId } from "@/lib/theme";
import { checkNotifPermission, requestNotifPermission, syncInstallmentNotifications, fireTestNotification, notifSupported } from "@/lib/notifications";
import type { AppSettings, NotifSettings } from "@/lib/client-api";

const APP_VERSION = "۲.۱۶.۰";

function ThemeSection() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [accent, setAccent] = useState<AccentId>("sabz");
  const [special, setSpecial] = useState<SpecialId>("none");
  useEffect(() => {
    setMounted(true);
    setAccent(readStoredAccent() ?? "sabz");
    setSpecial(readStoredSpecial() ?? "none");
  }, []);

  const options: { value: string; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "روشن", icon: Sun },
    { value: "dark", label: "تاریک", icon: Moon },
    { value: "system", label: "سیستمی", icon: Monitor },
  ];

  const pickAccent = (id: AccentId) => {
    setAccent(id);
    applyAccent(id);
  };
  const pickSpecial = (id: SpecialId) => {
    setSpecial(id);
    applySpecial(id, (v) => setTheme(v));
  };
  // شرط (v2.15): تم مشکی کامل فقط با حالت تاریک معنا دارد — روشن/سیستمی غیرفعال می‌شوند
  const meshkiLocksLight = special === "meshki";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <SunMoon className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
          تم و رنگ‌بندی
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* حالت روز و شب */}
        <div>
          <p className="mb-2 text-sm font-medium">حالت روز و شب</p>
          {meshkiLocksLight && (
            <p className="mb-2 rounded-lg bg-muted/60 p-2 text-[11px] leading-5 text-muted-foreground">
              ⬛ با تم «مشکی کامل»، حالت شب خودکار و الزامی است — برای حالت روشن اول تم ویژه را روی «معمولی» بگذارید.
            </p>
          )}
          <div className="grid grid-cols-3 gap-2">
            {options.map((o) => {
              const active = mounted && theme === o.value;
              const locked = meshkiLocksLight && o.value !== "dark";
              return (
                <button
                  key={o.value}
                  type="button"
                  title={locked ? "در تم مشکی کامل فقط حالت شب فعال است" : undefined}
                  onClick={() => {
                    if (locked) return;
                    setTheme(o.value);
                  }}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-sm font-medium transition ${
                    locked
                      ? "cursor-not-allowed border-border/50 text-muted-foreground/40"
                      : active
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "border-border text-muted-foreground hover:border-emerald-300 dark:hover:border-emerald-800"
                  }`}
                >
                  <o.icon className="h-5 w-5" />
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* رنگ اصلی برنامه */}
        <div>
          <p className="mb-2 text-sm font-medium">رنگ اصلی برنامه</p>
          <div className="grid grid-cols-5 gap-2">
            {ACCENTS.map((a) => {
              const active = mounted && accent === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  title={a.hint}
                  onClick={() => pickAccent(a.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 text-[11px] font-medium transition ${
                    active
                      ? "border-emerald-600 text-emerald-800 dark:border-emerald-500 dark:text-emerald-300"
                      : "border-border text-muted-foreground hover:border-emerald-300 dark:hover:border-emerald-800"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full shadow-inner ${
                      active ? "ring-2 ring-emerald-600 ring-offset-2 ring-offset-background dark:ring-emerald-400" : ""
                    }`}
                    style={{ backgroundColor: a.swatch }}
                  >
                    {active && <CheckCircle2 className="h-4 w-4 text-white drop-shadow" />}
                  </span>
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* تم‌های ویژه */}
        <div>
          <p className="mb-2 text-sm font-medium">تم ویژه</p>
          <div className="grid grid-cols-3 gap-2">
            {SPECIALS.map((s) => {
              const active = mounted && special === s.id;
              const Icon = s.id === "meshki" ? MoonStar : s.id === "kahkeshani" ? Sparkles : RefreshCw;
              return (
                <button
                  key={s.id}
                  type="button"
                  title={s.hint}
                  onClick={() => pickSpecial(s.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-[11px] font-medium transition ${
                    active
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : "border-border text-muted-foreground hover:border-emerald-300 dark:hover:border-emerald-800"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {s.label}
                </button>
              );
            })}
          </div>
          {mounted && special !== "none" && (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {special === "kahkeshani"
                ? "✨ تم کهکشانی فعال شد — خودکار: در حالت شب فضای تیره با ستاره‌های روشن، در حالت روشن صفحهٔ سفید با ستاره‌های رنگی به رنگ تم."
                : "⬛ تم مشکی کامل فعال شد — پس‌زمینهٔ کاملاً سیاه (مناسب OLED)؛ حالت شب هم خودکار فعال شد."}
            </p>
          )}
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

// ─── دستیار هوشمند (Gemini) — v2.14، فعال/غیرفعال + تست اتصال از v2.14.2 ───

function AiSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["app-settings"],
    queryFn: () => api.get("/api/settings"),
  });
  const [keyInput, setKeyInput] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [activeModel, setActiveModel] = useState<string | null>(null);

  useEffect(() => {
    setActiveModel(cachedGeminiModel());
  }, []);

  const save = useMutation({
    mutationFn: (geminiApiKey: string | null) => api.put("/api/settings", { geminiApiKey }),
    onSuccess: (_data, geminiApiKey) => {
      // کلید عوض شد — مدل کش‌شدهٔ قبلی ممکن است برای کلید جدید معتبر نباشد
      resetGeminiModelCache();
      setActiveModel(null);
      setTestMsg(null);
      qc.invalidateQueries({ queryKey: ["app-settings"] });
      setKeyInput(null);
      const n = splitApiKeys(geminiApiKey || "").length;
      toast({
        title: n > 1 ? `کلیدها ذخیره شد (${n.toLocaleString("fa-IR", { useGrouping: false })} کلید)` : "کلید ذخیره شد",
        description: n > 1 ? "اگر یک کلید خطا بدهد، بعدی خودکار امتحان می‌شود" : "گوی هوشمند حالا فعال است — روی گوی سبز بزن",
      });
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  const saveAi = useMutation({
    mutationFn: (patch: { aiEnabled?: boolean; speakReplies?: boolean }) => api.put("/api/settings", { ai: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app-settings"] }),
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  const runTest = async () => {
    const key = (keyInput !== null ? keyInput : saved).trim();
    if (!key) {
      toast({ title: "اول کلید را وارد کنید", variant: "destructive" });
      return;
    }
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await testGeminiConnection(key);
      setTestMsg({ ok: res.ok, text: res.message });
      if (res.ok) setActiveModel(res.model);
    } finally {
      setTesting(false);
    }
  };

  const saved = settings?.geminiApiKey || "";
  const shown = keyInput !== null ? keyInput : saved;
  const ai = settings?.ai;
  const aiEnabled = ai ? ai.aiEnabled !== false : true;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
          دستیار هوشمند (Gemini)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* فعال / غیرفعال — از v2.14.2 در تنظیمات */}
        <label className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <span className="min-w-0">
            <span className="block text-sm font-medium">فعال بودن دستیار هوشمند</span>
            <span className="mt-0.5 block text-[11px] leading-5 text-muted-foreground">
              خاموش کنید تا گوی سبز شناور روی صفحه نشان داده نشود
            </span>
          </span>
          <Switch
            checked={aiEnabled}
            onCheckedChange={(v) => saveAi.mutate({ aiEnabled: v })}
            disabled={saveAi.isPending}
            className="shrink-0"
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <span className="min-w-0">
            <span className="block text-sm font-medium">خواندن پاسخ با صدا</span>
            <span className="mt-0.5 block text-[11px] leading-5 text-muted-foreground">
              پاسخ دستیار بلند خوانده شود (داخل گفتگو هم می‌توانید عوض کنید)
            </span>
          </span>
          <Switch
            checked={ai ? Boolean(ai.speakReplies) : false}
            onCheckedChange={(v) => saveAi.mutate({ speakReplies: v })}
            disabled={saveAi.isPending}
            className="shrink-0"
          />
        </label>
        <p className="text-xs leading-5 text-muted-foreground">
          گوی سبز شناور روی صفحه دستیار گفتگوی شماست: دستور بده — مثل «مبالغ بین ۱۰۰ تا ۵۰۰ هزار تومان رو ببر تو
          هزینه‌های جاری» — تا خودش انجام بدهد. برای فعال‌سازی، کلید رایگان Gemini لازم است.
        </p>
        {/* چند کلید (v2.15): هر خط یک کلید — روی خطای کلید، بعدی خودکار امتحان می‌شود */}
        <div className="relative">
          <Textarea
            dir="ltr"
            rows={showKey ? 4 : 3}
            className="resize-none text-left font-mono text-xs"
            placeholder={showKey ? "AIza...\nAIza... — هر کلید در یک خط" : "AIza... — کلیدها (هر کلید در یک خط)"}
            value={shown}
            onChange={(e) => setKeyInput(e.target.value)}
          />
          <Button
            variant="outline"
            size="icon"
            className="absolute left-1 top-1 h-7 w-7"
            onClick={() => setShowKey((v) => !v)}
            aria-label="نمایش کلیدها"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
          </Button>
        </div>
        {showKey && (
          <p className="text-[11px] leading-5 text-muted-foreground">⚠️ کلیدها را در جایی عمومی کپی نکنید — نمایش خاموش را بزنید بعد از دیدن.</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="bg-emerald-700 hover:bg-emerald-800"
            disabled={keyInput === null || save.isPending}
            onClick={() => save.mutate(keyInput?.trim() || null)}
          >
            ذخیره کلیدها
          </Button>
          <Button variant="outline" size="sm" disabled={testing} onClick={() => void runTest()}>
            {testing ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <RefreshCw className="ml-1 h-4 w-4" />}
            تست اتصال
          </Button>
          {saved && (
            <Button variant="outline" size="sm" onClick={() => save.mutate(null)} disabled={save.isPending}>
              حذف کلیدها
            </Button>
          )}
          {saved && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {splitApiKeys(saved).length > 1
                ? `فعال — ${splitApiKeys(saved).length.toLocaleString("fa-IR", { useGrouping: false })} کلید — پایان آخرین: …${splitApiKeys(saved).slice(-1)[0].slice(-4)}`
                : `فعال — پایان کلید: …${saved.slice(-4)}`}
            </span>
          )}
        </div>
        {testMsg && (
          <p
            className={`rounded-lg p-2.5 text-[11px] leading-5 ${
              testMsg.ok
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
            }`}
          >
            {testMsg.text}
          </p>
        )}
        {activeModel && (
          <p className="text-[11px] text-muted-foreground" dir="ltr">
            مدل فعال روی این دستگاه: <span className="font-mono">{activeModel}</span>
          </p>
        )}
        <button
          type="button"
          onClick={() => void openExternalUrl("https://aistudio.google.com/apikey")}
          className="flex items-center gap-1 text-[11px] text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
        >
          <ExternalLink className="h-3 w-3" />
          گرفتن کلید رایگان از aistudio.google.com/apikey
        </button>
        {/* پروکسی شخصی (v2.15) — دور زدن محدودیت منطقه‌ای گوگل */}
        <div className="rounded-xl border p-3">
          <p className="text-sm font-medium">پروکسی شخصی (اختیاری)</p>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            اگر VPN هم جواب نمی‌دهد، آدرس یک پروکسی واسط (مثل Cloudflare Worker خودتان) را وارد کنید؛
            درخواست‌ها به جای گوگل به آن می‌روند و مسیر همان <span dir="ltr" className="font-mono">/v1beta/…</span> است. خالی = اتصال مستقیم. آدرس باید با <span dir="ltr" className="font-mono">https://</span> شروع شود.
          </p>
          <ProxyRow />
        </div>
        {/* لاگ تشخیصی (v2.15.1) — ببینیم اتصال دقیقاً کجا و چرا می‌شکند */}
        <GeminiLogViewer />
        <p className="rounded-lg bg-muted/60 p-2.5 text-[11px] leading-5 text-muted-foreground">
          امنیت: کلیدها فقط روی خود دستگاه ذخیره می‌شوند. برای پاسخ به دستورها، متن درخواست به سرور Gemini
          (مستقیم یا از پروکسی شما) می‌رود؛ داده‌های حساس شما (شماره‌ها و جزئیات) خارج نمی‌شوند. اگر «مدل پیدا نشد» دیدید،
          دکمهٔ تست اتصال خودش بهترین مدل فعالِ کلیدهای شما را پیدا و ذخیره می‌کند.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── نمایشگر لاگ اتصال Gemini (v2.15.1) — تشخیص علت قطعی ───

function GeminiLogViewer() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<GeminiLogEntry[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => setEntries(readGeminiLog());
    update();
    window.addEventListener(GEMINI_LOG_EVENT, update);
    return () => window.removeEventListener(GEMINI_LOG_EVENT, update);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(geminiLogToText());
      toast({ title: "لاگ کپی شد", description: "متن کپی‌شده را برای بررسی بفرستید" });
    } catch {
      toast({ title: "کپی نشد — دستگاه اجازه نداد", variant: "destructive" });
    }
  };

  const dotColor: Record<string, string> = {
    ok: "bg-emerald-500",
    info: "bg-sky-500",
    warn: "bg-amber-500",
    error: "bg-red-500",
  };

  return (
    <div className="rounded-xl border p-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <ScrollText className="h-4 w-4" />
          لاگ اتصال (تشخیصی)
          {entries.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums">
              {entries.length.toLocaleString("fa-IR", { useGrouping: false })}
            </span>
          )}
        </span>
        <span className="text-[10px] text-muted-foreground">{open ? "بستن ▲" : "باز کردن ▼"}</span>
      </button>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
        اگر دستیار وصل نشد، اینجا نوشته شده دقیقاً کجای مسیر شکسته. اول «تست اتصال» را بزنید، بعد لاگ را کپی و بفرستید.
      </p>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={entries.length === 0} onClick={() => void copy()}>
              <Copy className="ml-1 h-3.5 w-3.5" />
              کپی لاگ
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={entries.length === 0}
              onClick={() => {
                clearGeminiLog();
                setEntries([]);
              }}
            >
              <Trash2 className="ml-1 h-3.5 w-3.5" />
              پاک کردن
            </Button>
          </div>
          {entries.length === 0 ? (
            <p className="rounded-lg bg-muted/60 p-2 text-[11px] text-muted-foreground">هنوز لاگی نیست — بعد از زدن «تست اتصال» اینجا پر می‌شود.</p>
          ) : (
            <ul className="max-h-60 space-y-1.5 overflow-y-auto rounded-lg bg-muted/40 p-2">
              {entries.map((e) => (
                <li key={e.id} className="flex items-start gap-1.5">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColor[e.level] || "bg-muted-foreground"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] leading-5">{e.msg}</span>
                    <span className="block text-[10px] leading-4 text-muted-foreground">
                      {new Date(e.t).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      {e.detail ? (
                        <span dir="ltr" className="ml-1 inline-block break-all font-mono text-[9px]">
                          {e.detail}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ردیف ورودی پروکسی شخصی Gemini (v2.15) ───

function ProxyRow() {
  const { toast } = useToast();
  const [proxyInput, setProxyInput] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    setCurrent(readGeminiProxy());
  }, []);

  const shown = proxyInput !== null ? proxyInput : current || "";

  return (
    <div className="mt-2 space-y-2">
      <Input
        dir="ltr"
        className="text-left font-mono text-xs"
        placeholder="https://my-gemini-proxy.workers.dev"
        value={shown}
        onChange={(e) => setProxyInput(e.target.value)}
      />
      {proxyInput !== null && /^http:\/\//i.test(proxyInput.trim()) && (
        <p className="text-[11px] leading-5 text-red-600 dark:text-red-400">
          آدرس پروکسی باید با https:// شروع شود — اتصال رمزنشده (http) به دلیل امنیت پذیرفته نمی‌شود.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={proxyInput === null}
          onClick={() => {
            setGeminiProxy(proxyInput);
            setCurrent(readGeminiProxy());
            setProxyInput(null);
            toast({ title: readGeminiProxy() ? "پروکسی ذخیره شد ✓" : "پروکسی پاک شد — اتصال مستقیم به گوگل" });
          }}
        >
          ذخیره پروکسی
        </Button>
        {current && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setGeminiProxy(null);
              setCurrent(null);
              setProxyInput(null);
              toast({ title: "پروکسی پاک شد — اتصال مستقیم به گوگل" });
            }}
          >
            حذف
          </Button>
        )}
        {current && (
          <span className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> فعال: <span dir="ltr" className="font-mono">{current}</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ─── یادآور اقساط و چک‌ها — v2.14 ───

function NotificationsSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["app-settings"],
    queryFn: () => api.get("/api/settings"),
  });
  const [perm, setPerm] = useState<"granted" | "denied" | "prompt">("prompt");

  useEffect(() => {
    void checkNotifPermission().then(setPerm);
  }, []);

  const notif = settings?.notif;

  const update = useMutation({
    mutationFn: (patch: Partial<NotifSettings>) => api.put("/api/settings", { notif: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-settings"] });
      void syncInstallmentNotifications();
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  const ask = async () => {
    const res = await requestNotifPermission();
    setPerm(res);
    if (res === "granted") {
      toast({ title: "اجازه اعلان داده شد ✓", description: "سررسیدها ۲ روز قبل اعلام می‌شوند" });
      void syncInstallmentNotifications();
    } else if (res === "denied") {
      toast({ title: "اجازه اعلان رد شد", description: "از تنظیمات گوشی ← برنامهٔ حساب‌یار فعال کنید", variant: "destructive" });
    }
  };

  const test = async () => {
    const ok = await fireTestNotification();
    toast(ok ? { title: "اعلان آزمایشی ارسال شد — ۲ ثانیه دیگر می‌رسد" } : { title: "در مرورگر اعلان آزمایشی نداریم — در APK امتحان کنید", variant: "destructive" });
  };

  const dayOptions = [
    { v: 0, label: "روز سررسید" },
    { v: 1, label: "۱ روز قبل" },
    { v: 2, label: "۲ روز قبل (پیشنهادی)" },
    { v: 3, label: "۳ روز قبل" },
    { v: 5, label: "۵ روز قبل" },
    { v: 7, label: "۱ هفته قبل" },
  ];
  const hourOptions = [8, 9, 10, 12, 15, 18, 20, 21].map((h) => ({ v: h, label: `${h.toLocaleString("fa-IR", { useGrouping: false })}:۰۰` }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
          یادآور اقساط و چک‌ها
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm">یادآور اعلان سررسید</span>
          <Switch
            checked={notif?.enabled ?? true}
            onCheckedChange={(v) => update.mutate({ enabled: v })}
            aria-label="یادآور اعلان"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">چه زمانی اعلان بدهد؟</Label>
            <Select
              value={String(notif?.daysBefore ?? 2)}
              onValueChange={(v) => update.mutate({ daysBefore: Number(v) })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dayOptions.map((o) => (
                  <SelectItem key={o.v} value={String(o.v)}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">ساعت اعلان</Label>
            <Select value={String(notif?.hour ?? 9)} onValueChange={(v) => update.mutate({ hour: Number(v) })}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {hourOptions.map((o) => (
                  <SelectItem key={o.v} value={String(o.v)}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl border p-3">
          <div className="min-w-0 pl-2">
            <div className="text-sm">هشدار قرمز کمبود موجودی</div>
            <p className="text-[11px] leading-4 text-muted-foreground">
              اگر موجودی حساب مرتبط کمتر از مبلغ قسط باشد، با رنگ قرمز هشدار بده
            </p>
          </div>
          <Switch
            checked={notif?.lowBalanceWarn ?? true}
            onCheckedChange={(v) => update.mutate({ lowBalanceWarn: v })}
            aria-label="هشدار کمبود موجودی"
          />
        </div>

        {notifSupported() ? (
          <div className="flex flex-wrap items-center gap-2">
            {perm !== "granted" && (
              <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={() => void ask()}>
                اجازه اعلان از گوشی
              </Button>
            )}
            {perm === "granted" && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> اجازه اعلان فعال است
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => void test()}>
              اعلان آزمایشی
            </Button>
          </div>
        ) : (
          <p className="rounded-lg bg-muted/60 p-2.5 text-[11px] leading-5 text-muted-foreground">
            یادآور اعلان در اپلیکیشن اندروید (APK) کار می‌کند — در نسخهٔ مرورگر فقط هشدار داخل برنامه فعال است.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function Settings() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <ThemeSection />
      <CurrencySection />
      <AutoCatSection />
      <AiSection />
      <NotificationsSection />
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
