"use client";
// تب تنظیمات — حالت روز/شب، واحد پول (ریال/تومان)، پشتیبان‌گیری، به‌روزرسانی، درباره
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Monitor, Coins, Info, SunMoon, RefreshCw, Download, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { Backup } from "@/components/hesab/backup";
import {
  currencyLabel,
  setCurrencyUnit,
  useCurrencyUnit,
  type CurrencyUnit,
} from "@/lib/format";
import {
  fetchLatestRelease,
  isNewerVersion,
  downloadReleaseApk,
  type ReleaseInfo,
} from "@/lib/app-update";

const APP_VERSION = "۲.۱۰.۰";

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

export function Settings() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <ThemeSection />
      <CurrencySection />
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
