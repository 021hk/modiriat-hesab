// پل ارتباط با پلاگین بومی HesabSms (اندروید) — فقط در APK واقعی کار می‌کند
import { registerPlugin, Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

export interface NativeSms {
  id: string;
  sender: string;
  body: string;
  date: number; // epoch ms
}

export interface HesabSmsPluginInterface {
  checkPermissions(): Promise<{ sms: string }>;
  requestPermissions(): Promise<{ sms: string }>;
  readInbox(options: { since: number; limit?: number }): Promise<{ messages: NativeSms[] }>;
  addListener(
    eventName: "smsReceived",
    listenerFunc: (sms: NativeSms) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
  removeAllListeners(): Promise<void>;
}

export const HesabSms = registerPlugin<HesabSmsPluginInterface>("HesabSms");

export function isNativeAndroid(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

export type SmsPermState = "granted" | "denied" | "prompt" | "unknown";

export async function getSmsPermission(): Promise<SmsPermState> {
  if (!isNativeAndroid()) return "granted"; // در وب نیازی به دسترسی پیامک نیست
  try {
    const res = await HesabSms.checkPermissions();
    const state = (res?.sms || "unknown") as SmsPermState;
    // "prompt-with-rationale" هم مثل prompt رفتار می‌کند
    if ((state as string) === "prompt-with-rationale") return "prompt";
    return state;
  } catch {
    return "unknown";
  }
}

export async function requestSmsPermission(): Promise<SmsPermState> {
  if (!isNativeAndroid()) return "granted";
  try {
    const res = await HesabSms.requestPermissions();
    const state = (res?.sms || "unknown") as SmsPermState;
    if ((state as string) === "prompt-with-rationale") return "prompt";
    return state;
  } catch {
    return "unknown";
  }
}

export async function readInboxSince(since: number, limit = 400): Promise<NativeSms[]> {
  if (!isNativeAndroid()) return [];
  const res = await HesabSms.readInbox({ since, limit });
  return res?.messages || [];
}
