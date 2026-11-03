// ─── یادآور اعلان اقساط و چک‌ها (v2.14) ───
// روی گوشی (APK) با @capacitor/local-notifications اعلان زمان‌بندی می‌شود:
// «۲ روز قبل سررسید» + تنظیمات کاربر (تعداد روز، ساعت اعلان، روشن/خاموش).
// منطق محاسبه زمان اعلان خالص و قابل‌تست است؛ لایه بومی جدا.

import { Capacitor } from "@capacitor/core";
import { LocalNotifications, type ScheduleOptions } from "@capacitor/local-notifications";
import type { Installment, NotifSettings } from "@/lib/client-api";
import { DEFAULT_NOTIF_SETTINGS } from "@/lib/client-api";

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

/** آیا این دستگاه APK اندروید است؟ (در مرورگر اعلان زمان‌بندی‌شده نداریم) */
export function notifSupported(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

/**
 * زمان (epoch ms) اعلان برای سررسید مشخص — خالص و قابل‌تست.
 * قانون: سررسید منهای daysBefore روز، در ساعت hour همان روز.
 * اگر آن زمان گذشته باشد ولی سررسید آینده باشد → «الان + ۱ دقیقه» (کاربر همان لحظه باخبر شود)
 * اگر سررسید گذشته باشد → null (اعلانی لازم نیست)
 */
export function computeNotifyAt(
  dueDateMs: number,
  now: number,
  daysBefore: number,
  hour: number
): number | null {
  if (!Number.isFinite(dueDateMs)) return null;
  if (dueDateMs <= now) return null; // سررسید گذشته
  const db = Number.isFinite(daysBefore) && daysBefore > 0 ? Math.floor(daysBefore) : 0;
  const h = Number.isFinite(hour) ? Math.min(23, Math.max(0, Math.floor(hour))) : DEFAULT_NOTIF_SETTINGS.hour;
  // نیمه‌شبِ روزِ اعلان به وقت محلی: روز سررسید − db روز
  const due = new Date(dueDateMs);
  due.setHours(0, 0, 0, 0);
  let notify = due.getTime() - db * DAY_MS + h * 60 * 60 * 1000;
  if (notify <= now) {
    // زمان اعلان گذشته ولی سررسید آینده است → همان اول کار اطلاع بده
    notify = now + MIN_MS;
  }
  // اعلان بعد از سررسید بی‌معناست (فقط برای همان روز سررسید یا قبلش)
  const dueEnd = due.getTime() + DAY_MS;
  if (notify >= dueEnd) return null;
  return notify;
}

/**
 * شناسه عددی پایدار برای اعلان هر قسط — با همان id دوباره زمان‌بندی شود، قبلی جایگزین می‌شود
 * (بدون اعلان تکراری). 31-bit مثبت.
 */
export function installmentNotifId(id: string): number {
  let hash = 5381;
  const s = `inst:${id}`;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) + hash + s.charCodeAt(i)) & 0x7fffffff;
  return hash;
}

export interface InstallmentLike {
  id: string;
  title: string;
  kind: "installment" | "check";
  amount: number;
  dueDate: string;
  paid?: boolean;
}

/** متن اعلان فارسی — خالص و قابل‌تست */
export function buildNotifText(inst: InstallmentLike, daysBefore: number, fmtAmount: (rial: number) => string): { title: string; body: string } {
  const kindLabel = inst.kind === "check" ? "چک" : "قسط";
  const dayLabel =
    daysBefore <= 0
      ? "امروز"
      : `${numberToPersian(daysBefore)} روز قبل`;
  return {
    title: `⏰ یادآور ${kindLabel}`,
    body: `«${inst.title}» — ${dayLabel} سررسید می‌شود. مبلغ: ${fmtAmount(inst.amount)} ریال`,
  };
}

export function numberToPersian(n: number): string {
  return String(Math.round(n)).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

/** چند روز تا سررسید مانده؟ (بر اساس تاریخ، نه ساعت) — منفی = گذشته */
export function daysUntilDue(dueDateMs: number, now: number): number {
  const a = new Date(dueDateMs);
  a.setHours(0, 0, 0, 0);
  const b = new Date(now);
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / DAY_MS);
}

export interface SchedulePlan {
  id: number;
  at: number;
  title: string;
  body: string;
}

/**
 * برنامهٔ اعلان‌ها برای همه اقساط پرداخت‌نشده با سررسید آینده — خالص و قابل‌تست.
 * حداکثر ۴۰ اعلان (محدودیت منطقی اندروید برای آلارم‌های دقیق).
 */
export function planInstallmentNotifications(
  installments: InstallmentLike[],
  settings: Pick<NotifSettings, "enabled" | "daysBefore" | "hour">,
  now: number,
  fmtAmount: (rial: number) => string
): SchedulePlan[] {
  if (!settings.enabled) return [];
  const plans: SchedulePlan[] = [];
  const sorted = [...installments]
    .filter((i) => !i.paid && Number.isFinite(new Date(i.dueDate).getTime()))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  for (const inst of sorted) {
    if (plans.length >= 40) break;
    const at = computeNotifyAt(new Date(inst.dueDate).getTime(), now, settings.daysBefore, settings.hour);
    if (at == null) continue;
    const { title, body } = buildNotifText(inst, daysUntilDue(new Date(inst.dueDate).getTime(), at), fmtAmount);
    plans.push({ id: installmentNotifId(inst.id), at, title, body });
  }
  return plans;
}

// ─── لایه بومی (فقط APK اندروید) ───

export async function checkNotifPermission(): Promise<"granted" | "denied" | "prompt"> {
  if (!notifSupported()) return "granted";
  try {
    const res = await LocalNotifications.checkPermissions();
    const s = res.display || "prompt";
    if (s === "granted" || s === "denied" || s === "prompt") return s;
    return "prompt";
  } catch {
    return "prompt";
  }
}

export async function requestNotifPermission(): Promise<"granted" | "denied" | "prompt"> {
  if (!notifSupported()) return "granted";
  try {
    const res = await LocalNotifications.requestPermissions();
    const s = res.display || "prompt";
    if (s === "granted" || s === "denied" || s === "prompt") return s;
    return "prompt";
  } catch {
    return "prompt";
  }
}

/** اجرای برنامهٔ اعلان‌ها — همهٔ اعلان‌های قبلی برنامه پاک و طبق تنظیمات فعلی زمان‌بندی می‌شوند */
export async function applyNotificationPlan(plans: SchedulePlan[]): Promise<number> {
  if (!notifSupported()) return 0;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((n) => ({ id: n.id })),
      });
    }
    if (plans.length === 0) return 0;
    const opts: ScheduleOptions = {
      notifications: plans.map((p) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        schedule: { at: new Date(p.at), allowWhileIdle: true },
        // آیکون کوچک نوار وضعیت — آیکون پیش‌فرض برنامه
        actionTypeId: "",
        extra: { kind: "installment" },
      })),
    };
    await LocalNotifications.schedule(opts);
    return plans.length;
  } catch {
    return 0;
  }
}

/** اعلان آزمایشی فوری — برای تست از تنظیمات */
export async function fireTestNotification(): Promise<boolean> {
  if (!notifSupported()) return false;
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 900000001,
          title: "🔔 اعلان آزمایشی حساب‌یار",
          body: "یادآور اقساط فعال شد — سررسیدها را برای شما اعلام می‌کنیم.",
          schedule: { at: new Date(Date.now() + 2000), allowWhileIdle: true },
          actionTypeId: "",
          extra: { kind: "test" },
        },
      ],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * همگام‌سازی کامل اعلان‌ها — بعد از تغییر اقساط یا تنظیمات، و هنگام باز شدن برنامه.
 * تنظیمات و اقساط را از لایه داده محلی می‌خواند و برنامهٔ اعلان را جایگزین می‌کند.
 */
export async function syncInstallmentNotifications(): Promise<number> {
  if (!notifSupported()) return 0;
  try {
    // import دیرهنگام — از وابستگی دایره‌ای جلوگیری می‌کند و در تست‌ها هم امن است
    const { api, DEFAULT_NOTIF_SETTINGS: DEF_NOTIF } = await import("@/lib/client-api");
    const [settings, installments] = await Promise.all([
      api.get<{ notif?: NotifSettings }>("/api/settings"),
      api.get<Installment[]>("/api/installments"),
    ]);
    const notif = { ...DEF_NOTIF, ...(settings.notif || {}) };
    const plans = planInstallmentNotifications(installments, notif, Date.now(), (rial) =>
      String(Math.round(rial)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    );
    return applyNotificationPlan(plans);
  } catch {
    return 0;
  }
}
