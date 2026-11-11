// ─── دستیار هوشمند حساب‌یار (v2.14) — اتصال به Gemini ───
// گوی سبز شناور → گفتگو (تایپ/صدا) → مدل دستور را می‌فهمد و «اقدام» برمی‌گرداند:
// مثلاً «مبالغ بین ۱۰۰ تا ۵۰۰ هزار رو ببر تو هزینه‌های جاری» → categorize_by_range
// همهٔ اقدام‌ها روی دادهٔ محلی خود دستگاه اجرا می‌شوند؛ فقط متن درخواست به Gemini می‌رود.

// چندمدلی (v2.14.2): گوگل مدل‌ها را بازنشسته می‌کند — روی 404 مدل بعدی امتحان می‌شود
// و مدلی که جواب داد کش می‌شود تا درخواست بعدی مستقیم همان برود.
// لاگ تشخیصی (v2.15.1): هر گام اتصال در «لاگ اتصال» تنظیمات ثبت می‌شود تا علت قطعی پیدا شود.
import { clipBody, maskKey, pushGeminiLog } from "./gemini-log";

export const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.8-flash-lite",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
] as const;

export const GEMINI_MODEL = GEMINI_MODELS[0]; // پیش‌فرض — نسل فعلی گوگل (قدیمی‌ها آخر برای کلیدهای قدیمی)

// ─── پروکسی شخصی (v2.15) ───
// چون گوگل دسترسی Gemini را از ایران محدود کرده و بعضی VPNها هم IPهایشان مسدود است،
// کاربر می‌تواند آدرس یک «پروکسی شخصی» (مثلاً Cloudflare Worker خودش) را وارد کند؛
// در این حالت همهٔ درخواست‌ها به جای گوگل به این آدرس می‌روند و مسیر همان است (/v1beta/...).
export const GEMINI_DEFAULT_BASE = "https://generativelanguage.googleapis.com";
export const PROXY_STORAGE_KEY = "hesab-yar:gemini-proxy";

/** پاک‌سازی آدرس پروکسی — خالص و قابل‌تست: فقط https (سازگار با اسکن امنیتی گوگل‌پلی؛
 *  http یعنی ترافیک رمزنشده و در WebView با مبدأ https هم به‌هرحال مسدود است) */
export function normalizeProxyUrl(raw: string | null | undefined): string | null {
  const s = String(raw || "").trim().replace(/\/+$/, "");
  if (!/^https:\/\/[^\s/]+/i.test(s)) return null;
  return s;
}

export function readGeminiProxy(): string | null {
  try {
    return normalizeProxyUrl(localStorage.getItem(PROXY_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function setGeminiProxy(raw: string | null): void {
  try {
    const v = normalizeProxyUrl(raw);
    if (v) localStorage.setItem(PROXY_STORAGE_KEY, v);
    else localStorage.removeItem(PROXY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** پایهٔ همهٔ فراخوانی‌های Gemini — پروکسی شخصی یا مستقیم گوگل */
export function geminiBase(): string {
  return readGeminiProxy() || GEMINI_DEFAULT_BASE;
}

export function usingProxy(): boolean {
  return readGeminiProxy() !== null;
}

const GEMINI_URL = (model: string) => `${geminiBase()}/v1beta/models/${model}:generateContent`;
const GEMINI_LIST_URL = () => `${geminiBase()}/v1beta/models`;
const MODEL_CACHE_KEY = "hesab-yar:gemini-model";
// اتصال‌های ایران/VPN گاهی قطع‌ووصل می‌شوند — هر تلاش حداکثر ۴۵ ثانیه (v2.16: مدل‌های متفکرِ جدید
// گاهی بیشتر از ۳۰ ثانیه طول می‌کشند — لاگ کاربر timeout روی 30716ms را نشان می‌داد)
export const GEMINI_TIMEOUT_MS = 45000;
export const GEMINI_NET_ATTEMPTS = 3;
export const GEMINI_NET_FAIL_MSG =
  "پاسخی از سرور Gemini نرسید — برنامه ۳ بار تلاش خودکار کرد. " +
  "گوگل دسترسی سرورهای Gemini را از ایران محدود کرده است؛ روشن بودن VPN (با سرور خارجی) ضروری است. " +
  "اگر VPN هم جواب نمی‌دهد، در تنظیمات «پروکسی شخصی» را تنظیم کنید.";

/** قطعی وقتی پروکسی شخصی تنظیم شده (v2.15) */
export const PROXY_NET_FAIL_MSG =
  "پروکسی شخصی تنظیم‌شده پاسخ نمی‌دهد — آدرس پروکسی را در تنظیمات بررسی کنید، یا آن را پاک کنید تا مستقیم به گوگل وصل شود (با VPN).";

/** چند کلید از یک ورودی — خالص و قابل‌تست (هر خط یا ویرگول یک کلید؛ تکرارها حذف می‌شوند) */
export function splitApiKeys(raw: string | null | undefined): string[] {
  return Array.from(
    new Set(
      String(raw || "")
        .split(/[\s,;،؛]+/)
        .map((k) => k.trim())
        .filter((k) => k.length >= 10)
    )
  );
}

// تشخیص علت قطعی (v2.14.4): اگر گوگل جواب داد ولی Gemini نه، یعنی تحریم منطقه‌ای است (VPN لازم است)
export const GOOGLE_PROBE_URL = "https://www.google.com/generate_204";

/** پیام خطای شبکه بر اساس دسترس‌پذیری گوگل — خالص و قابل‌تست */
export function networkFailMessage(googleReachable: boolean): string {
  return googleReachable
    ? "اینترنت وصل است ولی سرور Gemini جواب نمی‌دهد — گوگل دسترسی Gemini را از IP ایران محدود کرده است. VPN را روشن کنید (سرور خارجی) و دوباره «تست اتصال» را بزنید."
    : "اتصال به اینترنت برقرار نشد — اینترنت دستگاه را بررسی کنید؛ در ایران برای دسترسی به سرورهای گوگل معمولاً VPN هم لازم است.";
}

/** آزمون سریع دسترسی عمومی به گوگل (no-cors — فقط رسیدن پاسخ شبکه مهم است) */
export async function probeGoogleReachable(timeoutMs = 7000): Promise<boolean> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort("timeout"), timeoutMs);
  const t0 = Date.now();
  try {
    await fetch(GOOGLE_PROBE_URL, { mode: "no-cors", cache: "no-store", signal: ac.signal });
    pushGeminiLog({ level: "ok", phase: "probe", msg: "گوگل در دسترس است — اینترنت دستگاه کار می‌کند", detail: `${Date.now() - t0}ms` });
    return true;
  } catch (e) {
    pushGeminiLog({ level: "warn", phase: "probe", msg: "گوگل در دسترس نیست — اتصال اینترنت مشکل دارد", detail: `${Date.now() - t0}ms ${abortReason(e, ac)}` });
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** میزبان پایهٔ فعلی (پروکسی یا گوگل) برای جزئیات لاگ */
function safeHost(base: string): string {
  try {
    return new URL(base).host;
  } catch {
    return base;
  }
}

/** علت رد شدن fetch — تایم‌اوت یا خطای شبکه */
function abortReason(e: unknown, ac: AbortController): string {
  const r = ac.signal.reason as unknown;
  if (r === "timeout" || r === "TimeoutError") return "timeout";
  const m = e instanceof Error ? e.message : String(e ?? "error");
  return /abort/i.test(m) ? "abort" : m.slice(0, 80);
}

/** ساخت بدنهٔ درخواست — خالص و قابل‌تست */
export function buildGeminiBody(model: string, systemPrompt: string, history: AiChatMessage[]): Record<string, unknown> {
  const generationConfig: Record<string, unknown> = {
    temperature: 0.3,
    maxOutputTokens: 1024,
    responseMimeType: "application/json",
  };
  // فقط مدل‌های ۲.۵ به بالا حالت «تفکر» دارند که پاسخ را خیلی کند می‌کند — خاموشش می‌کنیم
  // (v2.15.2: بررسی عددی نسخه — gemini-3.8 هم شامل می‌شود؛ نام‌های مستعار بدون نسخه دست نمی‌خورند)
  const vm = /(\d+)\.(\d+)/.exec(model);
  const ver = vm ? { major: parseInt(vm[1], 10), minor: parseInt(vm[2], 10) } : null;
  if (ver && (ver.major > 2 || (ver.major === 2 && ver.minor >= 5))) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  return {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    generationConfig,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function readCachedModel(): string | null {
  try {
    const v = localStorage.getItem(MODEL_CACHE_KEY);
    // نسخه‌های قدیمی برنامه مدل‌های بازنشسته (۲.۵ و قبل) را کش کرده‌اند —
    // از لاگ کاربر: تست اتصال مدل «gemini-2.5-flash» را کش کرده بود و بعد هر بار ۴۰۴ می‌خورد (v2.16)
    if (v && RETIRED_MODEL_RE.test(v)) {
      localStorage.removeItem(MODEL_CACHE_KEY);
      pushGeminiLog({ level: "info", phase: "system", msg: `کش مدل بازنشسته «${v}» پاک شد — مدل فعال خودکار پیدا می‌شود`, detail: "retired-model cache cleanup" });
      return null;
    }
    return v;
  } catch {
    return null;
  }
}

function writeCachedModel(model: string | null): void {
  try {
    if (model) localStorage.setItem(MODEL_CACHE_KEY, model);
    else localStorage.removeItem(MODEL_CACHE_KEY);
  } catch {
    // ignore
  }
}

export interface GeminiModelInfo {
  name: string; // مثلاً "models/gemini-2.0-flash" یا "gemini-2.0-flash"
  supportsGenerate: boolean;
}

// مدل‌های بازنشستهٔ گوگل (از لاگ کاربر: «no longer available to new users») — نباید کش شوند (v2.16)
export const RETIRED_MODEL_RE = /^gemini-(1\.0|1\.5|2\.0|2\.5)[.-]/;

/** پاسخ GET /v1beta/models → فهرست مدل‌های قابل‌استفاده — خالص و قابل‌تست */
export function parseModelsList(json: unknown): GeminiModelInfo[] {
  const models = (json as { models?: { name?: string; supportedGenerationMethods?: string[] }[] })?.models;
  if (!Array.isArray(models)) return [];
  return models
    .filter((m) => typeof m?.name === "string")
    .map((m) => ({
      name: m.name!.replace(/^models\//, ""),
      supportsGenerate: Array.isArray(m.supportedGenerationMethods)
        ? m.supportedGenerationMethods.includes("generateContent")
        : true,
    }));
}

/** مدل روی این دستگاه که در تماس قبلی جواب داده */
export function cachedGeminiModel(): string | null {
  return readCachedModel();
}

/** مدل‌های غیرگفتگویی از کاندیدها حذف می‌شوند */
const NON_CHAT_MODEL = /embed|aqa|imagen|image|veo|tts|audio|live|native|gemma/i;

/** رتبهٔ نسخه برای مرتب‌سازی — جدیدتر اول، سپس flash، سپس بدون پسوند آزمایشی */
function modelRank(name: string): { major: number; minor: number; penalty: number } {
  const m = /(\d+)\.(\d+)/.exec(name);
  let penalty = 0;
  if (/lite/i.test(name)) penalty += 1;
  if (/pro/i.test(name)) penalty += 1; // flash مقدم بر pro در نسخهٔ برابر
  if (/preview|exp/i.test(name)) penalty += 3;
  if (!m) penalty += 5; // نام‌های مستعار (مثل flash-latest) بعد از نسخه‌دارهای پایدار
  return { major: m ? parseInt(m[1], 10) : 0, minor: m ? parseInt(m[2], 10) : 0, penalty };
}

/**
 * از فهرست مدل‌های موجود، ترتیب امتحانِ هوشمند می‌سازد (v2.15.2):
 * ۱) مدل‌های ترجیحی سرِ فهرست، ۲) بعدی‌ها از نسخهٔ جدید به قدیم (flash مقدم بر pro/lite).
 * لیست گوگل گاهی مدل‌های بازنشسته را هم نشان می‌دهد — پینگ واقعی در «تست اتصال» جبران می‌کند.
 */
export function orderModelCandidates(available: GeminiModelInfo[]): string[] {
  const usable = Array.from(new Set(available.filter((m) => m.supportsGenerate).map((m) => m.name)));
  const chat = usable.filter((n) => /gemini/i.test(n) && /flash|pro/i.test(n) && !NON_CHAT_MODEL.test(n));
  const prefs = (GEMINI_MODELS as readonly string[]).filter((p) => chat.includes(p));
  const rest = chat.filter((n) => !(GEMINI_MODELS as readonly string[]).includes(n));
  rest.sort((a, b) => {
    const ra = modelRank(a);
    const rb = modelRank(b);
    if (ra.major !== rb.major) return rb.major - ra.major;
    if (ra.minor !== rb.minor) return rb.minor - ra.minor;
    if (ra.penalty !== rb.penalty) return ra.penalty - rb.penalty;
    return a.localeCompare(b);
  });
  return [...prefs, ...rest];
}

/** بهترین مدل flash از فهرست — همان سرِ ترتیب هوشمند */
export function pickGeminiModel(available: GeminiModelInfo[]): string | null {
  const all = orderModelCandidates(available);
  if (all.length === 0) {
    // هیچ مدل گفتگویی نبود — مثل قبل اولین generateContent را بده
    const usable = available.filter((m) => m.supportsGenerate).map((m) => m.name);
    return usable.length > 0 ? usable[0] : null;
  }
  return all[0];
}

/** پیشنهاد مدل جایگزین از متن خطای 404 گوگل — «use models/gemini-3.8-flash» (v2.15.2) */
export function suggestedModelFromError(body: string): string | null {
  const m = /use models\/([a-z0-9._-]+)/i.exec(String(body || ""));
  return m ? m[1] : null;
}

/** پاک کردن مدل کش‌شده — بعد از تغییر کلید یا خطای 404 */
export function resetGeminiModelCache(): void {
  writeCachedModel(null);
}

/**
 * فهرست مدل‌های مجاز این کلید را از گوگل می‌گیرد — برای «تست اتصال» و انتخاب خودکار مدل.
 */
export async function listGeminiModels(apiKey: string, keyLabel?: string): Promise<{ ok: boolean; models: GeminiModelInfo[]; message: string }> {
  const label = keyLabel || maskKey(apiKey);
  const hostName = safeHost(geminiBase());
  const t0 = Date.now();
  let res: Response | null = null;
  let lastErr = "";
  for (let attempt = 0; attempt < 2 && !res; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort("timeout"), 15000);
    try {
      res = await fetch(GEMINI_LIST_URL(), { headers: { "x-goog-api-key": apiKey }, signal: ac.signal });
      pushGeminiLog({ level: "info", phase: "list", msg: `فهرست مدل‌ها — پاسخ HTTP ${res.status} برای ${label}`, detail: `host=${hostName} ${Date.now() - t0}ms` });
    } catch (e) {
      lastErr = abortReason(e, ac);
      pushGeminiLog({ level: "warn", phase: "list", msg: `تلاش ${attempt + 1} از ۲ — سرور جواب نداد (${label})`, detail: `host=${hostName} ${Date.now() - t0}ms ${lastErr}` });
      if (attempt === 0) await sleep(900);
    } finally {
      clearTimeout(timer);
    }
  }
  if (!res) {
    pushGeminiLog({ level: "error", phase: "list", msg: "اتصال به سرور برقرار نشد — هر ۲ تلاش بی‌پاسخ بود", detail: `host=${hostName} ${lastErr}` });
    // با پروکسی شخصی، آزمون گوگل معنا ندارد — خطای خود پروکسی گزارش می‌شود (v2.15)
    if (usingProxy()) return { ok: false, models: [], message: PROXY_NET_FAIL_MSG };
    // تشخیص دقیق: گوگل در دسترس است ولی Gemini نه → تحریم منطقه‌ای؛ وگرنه قطعی اینترنت
    const googleOk = await probeGoogleReachable();
    return { ok: false, models: [], message: networkFailMessage(googleOk) };
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    pushGeminiLog({ level: "error", phase: "list", msg: `خطای HTTP ${res.status} در گرفتن فهرست مدل‌ها`, detail: `host=${hostName} | ${clipBody(t)}` });
    return { ok: false, models: [], message: geminiErrorToPersian(res.status, t) };
  }
  try {
    const models = parseModelsList(await res.json());
    if (models.length === 0) {
      pushGeminiLog({ level: "error", phase: "list", msg: "سرور فهرست مدل‌ها را خالی برگرداند", detail: `host=${hostName}` });
      return { ok: false, models: [], message: "هیچ مدلی برای این کلید در دسترس نیست — کلید جدیدی از aistudio.google.com/apikey بگیرید." };
    }
    pushGeminiLog({ level: "ok", phase: "list", msg: `فهرست مدل‌ها رسید — ${models.length} مدل برای ${label}`, detail: `host=${hostName} ${Date.now() - t0}ms` });
    return { ok: true, models, message: "اتصال موفق" };
  } catch {
    pushGeminiLog({ level: "error", phase: "list", msg: "پاسخ فهرست مدل‌ها قابل خواندن نبود", detail: `host=${hostName}` });
    return { ok: false, models: [], message: "پاسخ Gemini قابل خواندن نبود — دوباره امتحان کنید." };
  }
}

export interface GeminiTestResult {
  ok: boolean;
  model: string | null; // مدل انتخاب‌شده (در صورت موفقیت) — کش هم می‌شود
  message: string; // پیام فارسی برای نمایش
}

/** بدنهٔ سبک برای آزمودن واقعی مدل در «تست اتصال» — پینگ ۱۶ توکنی (v2.15.2) */
const PING_BODY: Record<string, unknown> = {
  contents: [{ role: "user", parts: [{ text: "ping" }] }],
  generationConfig: { maxOutputTokens: 16 },
};

/** دکمه «تست اتصال» تنظیمات — همهٔ کلیدها را می‌آزماید و مدل مناسب را پیدا و کش می‌کند (چند کلید: v2.15) */
export async function testGeminiConnection(apiKey: string): Promise<GeminiTestResult> {
  const keys = splitApiKeys(apiKey);
  if (keys.length === 0) return { ok: false, model: null, message: "اول کلید Gemini را وارد و ذخیره کنید." };
  pushGeminiLog({
    level: "info",
    phase: "system",
    msg: `«تست اتصال» شروع شد — ${keys.length} کلید`,
    detail: usingProxy() ? `proxy=${safeHost(geminiBase())}` : "proxy=off (مستقیم به گوگل)",
  });
  const results = await Promise.all(keys.map((k, i) => listGeminiModels(k, `کلید ${(i + 1).toLocaleString("fa-IR", { useGrouping: false })}`)));
  const okIdx = results.findIndex((r) => r.ok);
  if (okIdx === -1) {
    const firstFail = results.find((r) => !r.ok);
    pushGeminiLog({ level: "error", phase: "system", msg: "تست اتصال ناموفق — هیچ کلیدی وصل نشد", detail: `keys=${keys.length}` });
    return { ok: false, model: null, message: firstFail?.message || "هیچ مدلی با این کلیدها قابل استفاده نیست — کلید جدیدی بگیرید." };
  }
  // مدل انتخابی باید واقعاً پاسخ بدهد — لیست گوگل گاهی مدل‌های بازنشسته را هم نشان می‌دهد (v2.15.2)
  // پینگ سبک (حداکثر ۴ کاندید، ۱۶ توکن): اولین مدلی که واقعاً جواب داد برنده است.
  const candidates = orderModelCandidates(results[okIdx].models).slice(0, 4);
  const testKey = keys[okIdx];
  let model: string | null = null;
  let pingTried = false;
  for (const cand of candidates) {
    const ping = await doCallOnce(cand, PING_BODY, testKey);
    if (ping === null) break; // شبکه/تایم‌اوت — ادامهٔ پینگ بی‌فایده است
    pingTried = true;
    if (ping.ok) {
      model = cand;
      break;
    }
    if (ping.status === 401 || ping.status === 403 || ping.status === 429) break; // مشکل از کلید است نه مدل
    // 404 (بازنشسته) / 503 (شلوغ) و بقیه → کاندید بعدی لیست
  }
  let pingNote = "";
  if (model) {
    pushGeminiLog({ level: "ok", phase: "system", msg: `مدل «${model}» با پینگ واقعی تأیید شد`, detail: "test-connection ping ok" });
    pingNote = " (آزموده شد)";
  } else {
    // پینگ ممکن نشد — مثل قبل از سرِ ترتیب فهرست انتخاب می‌شود
    model = pickGeminiModel(results[okIdx].models);
    if (model && pingTried) {
      pushGeminiLog({ level: "warn", phase: "system", msg: `پینگ مدل‌ها موفق نشد — مدل «${model}» فقط از فهرست انتخاب شد`, detail: "ping failed for all candidates" });
    }
  }
  if (!model) {
    pushGeminiLog({ level: "error", phase: "system", msg: "هیچ مدلی برای این کلید قابل استفاده نبود", detail: `models=${results[okIdx].models.length}` });
    return { ok: false, model: null, message: "هیچ مدلی با این کلیدها قابل استفاده نیست — کلید جدیدی بگیرید." };
  }
  writeCachedModel(model);
  const okCount = results.filter((r) => r.ok).length;
  pushGeminiLog({ level: "ok", phase: "system", msg: `تست اتصال موفق — مدل «${model}» انتخاب و کش شد`, detail: `${okCount}/${keys.length} کلید سالم` });
  const keyInfo =
    keys.length > 1
      ? ` کلیدها: ${okCount.toLocaleString("fa-IR", { useGrouping: false })} سالم از ${keys.length.toLocaleString("fa-IR", { useGrouping: false })}.`
      : "";
  return { ok: true, model, message: `اتصال موفق است ✓ — مدل «${model}»${pingNote} آماده گفتگو است.${keyInfo}` };
}

export interface AiChatMessage {
  role: "user" | "model";
  text: string;
}

/** ساخت دستور سیستم برای مدل — خالص و قابل‌تست */
export function buildSystemPrompt(todayIso: string): string {
  return [
    "تو «دستیار حساب‌یار» هستی؛ دستیار مالی یک برنامهٔ مدیریت حساب، هزینه، بدهی، اقساط و چک.",
    "کاربر فارسی صحبت می‌کند؛ پاسخ‌ها همیشه فارسی، کوتاه، دوستانه و بدون کد اضافه باشند.",
    "",
    "قرارداد پاسخ (خیلی مهم):",
    'همیشه فقط و فقط یک JSON معتبر برگردان، بدون ``` و بدون متن اضافه، با این شکل:',
    '{"reply": "پاسخ فارسی به کاربر", "actions": [{"type": "...", ...}]}',
    "اگر اقدامی لازم نیست، actions را خالی بده [].",
    "",
    "اقدام‌های مجاز (amount و مبلغ‌ها همیشه به «ریال»):",
    '۱) {"type":"categorize_by_range","flow":"expense|income","categoryId":"...","exact": عدد؟، "min": عدد؟، "max": عدد؟، "overwrite": true|false}',
    "   انتقال دستهٔ تراکنش‌های موجود: مبلغ exact یا بازهٔ min/max (هر دو اختیاری ولی حداقل یکی).",
    "   پیش‌فرض فقط تراکنش‌های «بدون دسته» تغییر می‌کنند؛ اگر کاربر گفت «همه» یا «دسته‌های قبلی هم عوض شود» → overwrite:true.",
    '۲) {"type":"create_rule","flow":"expense|income","categoryId":"...","match":"exact|range","exact": عدد؟، "min": عدد؟، "max": عدد؟، "label": "نام قانون؟"}',
    "   ساختن قانون دائمی دسته‌بندی خودکار با مبلغ (برای تراکنش‌های آینده).",
    '۳) {"type":"add_transaction","txType":"expense|income","amount":عدد,"purpose":"بابت","categoryId":"...؟","bankAccountId":"...؟","date":"ISO؟"}',
    '۴) {"type":"add_installment","title":"عنوان","kind":"installment|check","amount":عدد,"dueDate":"ISO تاریخ سررسید","counterparty":"بانک/طرف حساب؟","bankAccountId":"...؟"}',
    "",
    "قواعد:",
    "- categoryId حتماً باید یکی از id های دسته‌های «زمینهٔ برنامه» باشد؛ اگر دستهٔ مناسب نبود، در reply بپرس یا نامش را پیشنهاد بده و action نده.",
    "- برای سؤال‌های آماری (موجودی، هزینهٔ ماه، بدهی‌ها، اقساط نزدیک) فقط از زمینهٔ برنامه جواب بده و action نده.",
    "- اعداد فارسی/تومانی کاربر را به ریال تبدیل کن (۱ تومان = ۱۰ ریال؛ «۵۰۰ هزار تومان» = ۵٬۰۰۰٬۰۰۰ ریال).",
    "- در reply نتیجهٔ اقدام را با عدد خوانا (تومان یا ریال همان‌طور که کاربر گفته) اعلام کن.",
    "- اگر درخواست مبهم است، یک سؤال کوتاه بپرس و action نده.",
    "- تاریخ امروز: " + todayIso,
  ].join("\n");
}

/** افزودن زمینهٔ دادهٔ برنامه به دستور سیستم — خالص و قابل‌تست */
export function buildDataContext(data: {
  accounts: { id: string; name: string; bankName: string; balance: number }[];
  categories: { id: string; name: string; type: "income" | "expense" }[];
  stats: { totalBalance: number; monthIncome: number; monthExpense: number };
  installments: { id: string; title: string; kind: string; amount: number; dueDate: string; paid: boolean }[];
  rules: { id: string; flow: string; match: string; exact: number | null; min: number | null; max: number | null; categoryId: string }[];
}): string {
  return [
    "زمینهٔ برنامهٔ کاربر (JSON) — برای تصمیم‌گیری از این استفاده کن:",
    JSON.stringify(
      {
        حساب‌ها: data.accounts.map((a) => ({ id: a.id, نام: a.name, بانک: a.bankName, موجودی_ریال: a.balance })),
        دسته‌ها: data.categories.map((c) => ({ id: c.id, نام: c.name, نوع: c.type === "income" ? "درآمد" : "هزینه" })),
        آمار: {
          موجودی_کل_ریال: data.stats.totalBalance,
          درآمد_این_ماه_ریال: data.stats.monthIncome,
          هزینه_این_ماه_ریال: data.stats.monthExpense,
        },
        اقساط_و_چک_های_پرداخت_نشده: data.installments,
        قوانین_دسته‌بندی_خودکار: data.rules,
      },
      null,
      1
    ),
  ].join("\n");
}

/** پاسخ خام مدل → { reply, actions } — خالص و قابل‌تست (تحمل ``` و متن اضافه) */
export function parseAiResponse(raw: string): { reply: string; actions: Record<string, unknown>[]; error?: string } {
  let text = String(raw || "").trim();
  // حذف محصورکنندهٔ کد
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  // اگر مدل متن قبل/بعد JSON گذاشت، اولین { تا آخرین } را بردار
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start > -1 && end > start) text = text.slice(start, end + 1);
  try {
    const obj = JSON.parse(text) as { reply?: unknown; actions?: unknown };
    const reply = typeof obj.reply === "string" ? obj.reply : "";
    const actions = Array.isArray(obj.actions) ? (obj.actions as Record<string, unknown>[]).filter((a) => a && typeof a === "object") : [];
    if (!reply && actions.length === 0) return { reply: "", actions: [], error: "پاسخ مدل خالی بود" };
    return { reply, actions };
  } catch {
    return { reply: String(raw || "").trim() || "پاسخ نامفهوم بود", actions: [], error: "پاسخ مدل JSON معتبر نبود" };
  }
}

/** پیام اختصاصی وقتی سهمیهٔ همهٔ مدل‌ها با کلید فعلی پر شده (v2.16) */
export const GEMINI_QUOTA_FAIL_MSG =
  "سهمیهٔ رایگان این کلید Gemini تمام شده است — سهمیهٔ هر مدل جداست و برنامه همه را امتحان کرد. " +
  "سهمیهٔ رایگان روزانه محدود است؛ چند ساعت بعد دوباره امتحان کنید، یا کلید دوم رایگان از aistudio.google.com/apikey بگیرید و در تنظیمات اضافه کنید.";

/** خطاهای رایج Gemini به پیام فارسی قابل‌فهم */
export function geminiErrorToPersian(status: number, body: string): string {
  const b = String(body || "");
  if (status === 400 && /API[_ ]?key|API_KEY_INVALID/i.test(b)) return "کلید Gemini نامعتبر است — از تنظیمات کلید درست را وارد کنید.";
  if (status === 401 || status === 403) return "دسترسی به Gemini رد شد — کلید API را در تنظیمات بررسی کنید.";
  if (status === 429) {
    // دو حالت متفاوت: سقف روزانه/سهمیه (quota) یا فقط سرعت زیاد (rate limit) — v2.16
    if (/quota|billing|plan|current_quota/i.test(b)) {
      return "سهمیهٔ رایگان این مدل/کلید تمام شده است — برنامه مدل دیگر را امتحان می‌کند (سهمیهٔ هر مدل جداست)؛ اگر ادامه داشت، بعداً دوباره امتحان کنید.";
    }
    return "تعداد درخواست‌های Gemini زیاد شده — چند لحظه بعد دوباره امتحان کنید.";
  }
  if (status === 404) return "مدل Gemini در دسترس نیست — برنامه خودش مدل دیگری را امتحان می‌کند؛ اگر ادامه داشت، از دکمهٔ «تست اتصال» در تنظیمات مدل فعال را پیدا کنید.";
  if (status >= 500) return "سرور Gemini فعلاً در دسترس نیست — کمی بعد دوباره امتحان کنید.";
  return "خطا در ارتباط با Gemini" + (status ? ` (کد ${status})` : "");
}

export interface GeminiCallResult {
  ok: boolean;
  text: string; // پاسخ خام مدل یا پیام خطا
}

function hasThinkingConfig(body: Record<string, unknown>): boolean {
  const g = body.generationConfig as Record<string, unknown> | undefined;
  return !!g && g.thinkingConfig != null;
}

function stripThinkingConfig(body: Record<string, unknown>): Record<string, unknown> {
  const g = { ...((body.generationConfig as Record<string, unknown>) || {}) };
  delete g.thinkingConfig;
  return { ...body, generationConfig: g };
}

/**
 * یک فراخوانی مدل با سقف زمانی (v2.14.3) — خطای شبکه null برمی‌گرداند.
 * v2.15.2: بدنهٔ خام خطا (rawBody) برای استخراج پیشنهاد مدل گوگل + تلاشِ بدون thinkingConfig روی 400.
 */
async function doCallOnce(model: string, body: Record<string, unknown>, apiKey: string): Promise<{ status: number; ok: boolean; text: string; rawBody?: string } | null> {
  let current = body;
  // حداکثر ۲ دور — دور دوم فقط وقتی مدل thinkingConfig را نپذیرد (400 با متن thinking)
  for (let pass = 0; pass < 2; pass++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort("timeout"), GEMINI_TIMEOUT_MS);
    const t0 = Date.now();
    try {
      const res = await fetch(GEMINI_URL(model), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(current),
        signal: ac.signal,
      });
      const ms = Date.now() - t0;
      if (res.ok) {
        const json = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
          promptFeedback?: { blockReason?: string };
        };
        const parts = json.candidates?.[0]?.content?.parts || [];
        const text = parts.map((p) => p.text || "").join("").trim();
        if (!text) {
          const blocked = json.promptFeedback?.blockReason;
          const msg = blocked ? `درخواست توسط Gemini مسدود شد (${blocked})` : "پاسخی از Gemini نرسید — دوباره امتحان کنید.";
          pushGeminiLog({ level: "error", phase: "call", msg, detail: `model=${model} status=${res.status} ${ms}ms` });
          return { status: res.status, ok: false, text: msg };
        }
        pushGeminiLog({ level: "ok", phase: "call", msg: `پاسخ مدل «${model}» رسید`, detail: `status=200 ${ms}ms` });
        return { status: res.status, ok: true, text };
      }
      const t = await res.text().catch(() => "");
      // بعضی مدل‌ها thinkingConfig را قبول نمی‌کنند — یک بار بدون آن امتحان می‌شود (v2.15.2)
      if (pass === 0 && res.status === 400 && /thinking/i.test(t) && hasThinkingConfig(current)) {
        pushGeminiLog({ level: "info", phase: "call", msg: `مدل «${model}» thinkingConfig را نپذیرفت — یک بار بدون آن امتحان می‌شود`, detail: clipBody(t, 120) });
        current = stripThinkingConfig(current);
        continue;
      }
      const persian = geminiErrorToPersian(res.status, t);
      pushGeminiLog({ level: "error", phase: "call", msg: persian, detail: `model=${model} status=${res.status} ${ms}ms | ${clipBody(t)}` });
      return { status: res.status, ok: false, text: persian, rawBody: t };
    } catch (e) {
      // خطای شبکه یا تایم‌اوت — بیرون دوباره امتحان/گزارش می‌شود
      pushGeminiLog({ level: "warn", phase: "call", msg: `مدل «${model}» پاسخ نداد (خطای شبکه یا تایم‌اوت)`, detail: `${Date.now() - t0}ms ${abortReason(e, ac)}` });
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/** تلاش مجدد خودکار روی خطای شبکه (بدون پاسخ HTTP) — v2.14.3 */
async function doCallWithRetry(model: string, body: Record<string, unknown>, apiKey: string, attempts = GEMINI_NET_ATTEMPTS): Promise<{ status: number; ok: boolean; text: string; rawBody?: string } | null> {
  for (let i = 0; i < attempts; i++) {
    if (i > 0) pushGeminiLog({ level: "info", phase: "call", msg: `تلاش مجدد ${(i + 1).toLocaleString("fa-IR", { useGrouping: false })} از ${attempts.toLocaleString("fa-IR", { useGrouping: false })} برای مدل «${model}»` });
    const r = await doCallOnce(model, body, apiKey);
    if (r !== null) return r; // پاسخ HTTP (حتی خطا) — تکرار شبکه لازم نیست
    if (i < attempts - 1) await sleep(900 * (i + 1)); // ۰٫۹ و ۱٫۸ ثانیه انتظار
  }
  pushGeminiLog({ level: "error", phase: "call", msg: `مدل «${model}» بعد از ${attempts.toLocaleString("fa-IR", { useGrouping: false })} تلاش پاسخ نداد`, detail: usingProxy() ? `proxy=${safeHost(geminiBase())}` : "host=generativelanguage.googleapis.com" });
  return null;
}

/**
 * کل زنجیرهٔ مدل را با «یک کلید» امتحان می‌کند — خروجی: موفق، خطای شبکه، یا خطای کلید.
 */
async function tryWithKey(
  apiKey: string,
  opts: { systemPrompt: string; history: AiChatMessage[] }
): Promise<{ ok: boolean; text: string; network?: boolean; keyError?: boolean }> {
  // ۱) مدل کش‌شده یا پیش‌فرض — با تلاش مجدد شبکه
  const first = readCachedModel() || GEMINI_MODEL;
  const body = buildGeminiBody(first, opts.systemPrompt, opts.history);
  const r = await doCallWithRetry(first, body, apiKey);
  if (r?.ok) {
    writeCachedModel(first);
    return { ok: true, text: r.text };
  }
  if (r === null) {
    pushGeminiLog({ level: "error", phase: "call", msg: usingProxy() ? "پروکسی شخصی پاسخ نداد" : "سرور Gemini هر ۳ تلاش را بی‌پاسخ گذاشت", detail: `key=${maskKey(apiKey)} host=${safeHost(geminiBase())}` });
    return { ok: false, text: usingProxy() ? PROXY_NET_FAIL_MSG : GEMINI_NET_FAIL_MSG, network: true };
  }

  // خطای مربوط به «کلید» → کلید بعدی امتحان می‌شود (چند کلید: v2.15)
  // v2.16: ۴۲۹ دیگر کلید را رد نمی‌کند — سهمیهٔ هر مدل جداست؛ اول مدل‌های دیگر همین کلید امتحان می‌شود
  // (لاگ کاربر: ۴۲۹ روی gemini-3.8-flash کل زنجیره را می‌بست)
  const hardKeyError = r.status === 401 || r.status === 403 || (r.status === 400 && r.text.includes("کلید"));
  if (hardKeyError) return { ok: false, text: r.text, keyError: true };
  let sawQuota = false;
  if (r.status === 429) {
    sawQuota = true;
    pushGeminiLog({ level: "warn", phase: "call", msg: `سهمیهٔ مدل «${first}» پر شده — مدل‌های دیگر امتحان می‌شوند (سهمیهٔ هر مدل جداست)`, detail: "HTTP 429 → rotate" });
  }

  // ۲) 404 یعنی «مدل بازنشسته شده» و 503 یعنی «مدل شلوغ است» — هر دو → مدل دیگری امتحان می‌شود (v2.15.2)
  const modelGone = r.status === 404;
  const modelBusy = r.status === 503;
  if (!modelGone && !modelBusy && !sawQuota) return { ok: false, text: r.text };
  if (modelGone) writeCachedModel(null);

  // ۳) پیشنهاد خودکار گوگل در متن خطا — «use models/gemini-3.8-flash» → اول همان امتحان می‌شود (v2.15.2)
  const suggestion = modelGone ? suggestedModelFromError(r.rawBody || "") : null;
  if (suggestion) {
    pushGeminiLog({ level: "info", phase: "call", msg: `گوگل مدل جایگزین پیشنهاد داد: «${suggestion}» — اول همان امتحان می‌شود`, detail: "suggestion from 404 body" });
  }

  // ۴) ترتیب هوشمند: پیشنهاد گوگل → مدل‌های فهرست واقعی کلید (نسخهٔ جدید اول) → لیست ثابت
  const listed = await listGeminiModels(apiKey);
  const candidates: string[] = [];
  if (suggestion) candidates.push(suggestion);
  if (listed.ok) {
    for (const c of orderModelCandidates(listed.models)) {
      if (c !== first && !candidates.includes(c)) candidates.push(c);
    }
  }
  for (const pref of GEMINI_MODELS) {
    if (pref !== first && !candidates.includes(pref)) candidates.push(pref);
  }

  // ۵) امتحان ترتیبی — 404/503/429 مدل → بعدی؛ 401/403 → کلید بعدی؛ بقیه → گزارش
  for (const m of candidates.slice(0, 6)) {
    const r2 = await doCallOnce(m, buildGeminiBody(m, opts.systemPrompt, opts.history), apiKey);
    if (r2?.ok) {
      writeCachedModel(m);
      return { ok: true, text: r2.text };
    }
    if (r2 === null) {
      return { ok: false, text: usingProxy() ? PROXY_NET_FAIL_MSG : GEMINI_NET_FAIL_MSG, network: true };
    }
    if (r2.status === 401 || r2.status === 403) {
      return { ok: false, text: r2.text, keyError: true };
    }
    if (r2.status === 429) {
      sawQuota = true;
      pushGeminiLog({ level: "warn", phase: "call", msg: `سهمیهٔ مدل «${m}» هم پر شده — مدل بعدی`, detail: "HTTP 429 → next" });
      continue;
    }
    // 404/503 و بقیهٔ خطاهای مدل → کاندید بعدی
  }
  if (sawQuota) {
    pushGeminiLog({ level: "error", phase: "call", msg: "سهمیهٔ همهٔ مدل‌های این کلید پر شده بود", detail: "all models 429" });
    return { ok: false, text: GEMINI_QUOTA_FAIL_MSG, keyError: true };
  }
  return { ok: false, text: "هیچ مدل Gemini با این کلید پاسخ نداد — از دکمهٔ «تست اتصال» در تنظیمات وضعیت کلید و مدل‌های فعال را ببینید." };
}

/**
 * فراخوانی generateContent (v2.14.2 جای‌گردی مدل، v2.14.3 تایم‌اوت/تلاش مجدد، v2.15 چند کلید + پروکسی):
 * - همهٔ کلیدهای واردشده (هر خط/ویرگول یک کلید) به‌ترتیب امتحان می‌شوند؛ روی خطای کلید
 *   (نامعتبر/دسترسی رد شده/سقف مصرف) سراغ کلید بعدی می‌رود.
 * - درخواست‌ها به پروکسی شخصی (اگر تنظیم باشد) وگرنه مستقیم به گوگل می‌روند.
 * - روی 404 بهترین مدل از فهرست واقعی کلید انتخاب و کش می‌شود.
 */
export async function callGemini(opts: {
  apiKey: string;
  systemPrompt: string;
  history: AiChatMessage[];
}): Promise<GeminiCallResult> {
  const keys = splitApiKeys(opts.apiKey);
  if (keys.length === 0) return { ok: false, text: "اول کلید Gemini را در تنظیمات وارد و ذخیره کنید." };
  pushGeminiLog({
    level: "info",
    phase: "system",
    msg: `درخواست جدید گفتگو — ${keys.length.toLocaleString("fa-IR", { useGrouping: false })} کلید`,
    detail: usingProxy() ? `proxy=${safeHost(geminiBase())}` : "proxy=off (مستقیم به گوگل)",
  });
  let lastKeyError = "";
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (keys.length > 1) {
      pushGeminiLog({ level: "info", phase: "key", msg: `کلید ${(i + 1).toLocaleString("fa-IR", { useGrouping: false })} از ${keys.length.toLocaleString("fa-IR", { useGrouping: false })} امتحان می‌شود`, detail: `key=${maskKey(key)}` });
    }
    const r = await tryWithKey(key, opts);
    if (r.ok) {
      pushGeminiLog({ level: "ok", phase: "system", msg: "درخواست گفتگو با موفقیت انجام شد" });
      return { ok: true, text: r.text };
    }
    if (r.network) {
      pushGeminiLog({ level: "error", phase: "system", msg: "درخواست به علت قطع شبکه/پروکسی متوقف شد — کلید دیگر هم کمکی نمی‌کند" });
      return { ok: false, text: r.text }; // قطعی شبکه/پروکسی — کلید دیگر کمک نمی‌کند
    }
    if (r.keyError) {
      lastKeyError = r.text;
      if (i < keys.length - 1) {
        pushGeminiLog({ level: "warn", phase: "key", msg: `کلید ${(i + 1).toLocaleString("fa-IR", { useGrouping: false })} خطا داد — رفتن به کلید بعدی`, detail: `key=${maskKey(key)}` });
      }
      continue; // کلید بعدی
    }
    pushGeminiLog({ level: "error", phase: "system", msg: "درخواست گفتگو ناموفق بود" });
    return { ok: false, text: r.text }; // خطای دیگر (مسدودسازی/پاسخ خالی/...) — گزارش می‌شود
  }
  pushGeminiLog({ level: "error", phase: "key", msg: "هیچ‌کدام از کلیدها پاسخ نداد", detail: `keys=${keys.length}` });
  return { ok: false, text: lastKeyError || "هیچ‌کدام از کلیدهای Gemini پاسخ نداد — از «تست اتصال» در تنظیمات وضعیت را ببینید." };
}
