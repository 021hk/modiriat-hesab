"use client";
// تب تنظیمات — حالت روز/شب، واحد پول (ریال/تومان)، پشتیبان‌گیری، درباره
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sun, Moon, Monitor, Coins, Info, SunMoon } from "lucide-react";
import { Backup } from "@/components/hesab/backup";
import {
  currencyLabel,
  setCurrencyUnit,
  useCurrencyUnit,
  type CurrencyUnit,
} from "@/lib/format";

const APP_VERSION = "۲.۷.۰";

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

export function Settings() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <ThemeSection />
      <CurrencySection />
      <Backup />
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
