// ─── دستیار هوشمند حساب‌یار (v2.14) — اتصال به Gemini ───
// گوی سبز شناور → گفتگو (تایپ/صدا) → مدل دستور را می‌فهمد و «اقدام» برمی‌گرداند:
// مثلاً «مبالغ بین ۱۰۰ تا ۵۰۰ هزار رو ببر تو هزینه‌های جاری» → categorize_by_range
// همهٔ اقدام‌ها روی دادهٔ محلی خود دستگاه اجرا می‌شوند؛ فقط متن درخواست به Gemini می‌رود.

// چندمدلی (v2.14.2): گوگل مدل‌ها را بازنشسته می‌کند — روی 404 مدل بعدی امتحان می‌شود
// و مدلی که جواب داد کش می‌شود تا درخواست بعدی مستقیم همان برود.
export const GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-1.5-flash",
] as const;

export const GEMINI_MODEL = GEMINI_MODELS[0]; // پیش‌فرض — برای سازگاری قدیمی
const GEMINI_URL = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const GEMINI_LIST_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_CACHE_KEY = "hesab-yar:gemini-model";
// اتصال‌های ایران/VPN گاهی قطع‌ووصل می‌شوند — هر تلاش حداکثر ۳۰ ثانیه و کل ۳ بار امتحان می‌شود
export const GEMINI_TIMEOUT_MS = 30000;
export const GEMINI_NET_ATTEMPTS = 3;
export const GEMINI_NET_FAIL_MSG =
  "پاسخی از سرور Gemini نرسید — برنامه ۳ بار تلاش خودکار کرد. " +
  "گوگل دسترسی سرورهای Gemini را از ایران محدود کرده است؛ روشن بودن VPN (با سرور خارجی) ضروری است. " +
  "اینترنت را هم بررسی کنید و دوباره امتحان کنید.";

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
  try {
    await fetch(GOOGLE_PROBE_URL, { mode: "no-cors", cache: "no-store", signal: ac.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** ساخت بدنهٔ درخواست — خالص و قابل‌تست */
export function buildGeminiBody(model: string, systemPrompt: string, history: AiChatMessage[]): Record<string, unknown> {
  const generationConfig: Record<string, unknown> = {
    temperature: 0.3,
    maxOutputTokens: 1024,
    responseMimeType: "application/json",
  };
  // فقط مدل‌های ۲.۵ حالت «تفکر» دارند که پاسخ را خیلی کند می‌کند — خاموشش می‌کنیم (v2.14.3)
  if (/2\.5/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
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
    return localStorage.getItem(MODEL_CACHE_KEY);
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

/** از فهرست مدل‌های موجود، بهترین مدل flash را انتخاب می‌کند — خالص و قابل‌تست */
export function pickGeminiModel(available: GeminiModelInfo[]): string | null {
  const usable = available.filter((m) => m.supportsGenerate).map((m) => m.name);
  if (usable.length === 0) return null;
  for (const pref of GEMINI_MODELS) if (usable.includes(pref)) return pref;
  const flash = usable.find((n) => n.includes("flash"));
  if (flash) return flash;
  return usable[0];
}

/** مدل روی این دستگاه که در تماس قبلی جواب داده */
export function cachedGeminiModel(): string | null {
  return readCachedModel();
}

/** پاک کردن مدل کش‌شده — بعد از تغییر کلید یا خطای 404 */
export function resetGeminiModelCache(): void {
  writeCachedModel(null);
}

/**
 * فهرست مدل‌های مجاز این کلید را از گوگل می‌گیرد — برای «تست اتصال» و انتخاب خودکار مدل.
 */
export async function listGeminiModels(apiKey: string): Promise<{ ok: boolean; models: GeminiModelInfo[]; message: string }> {
  let res: Response | null = null;
  for (let attempt = 0; attempt < 2 && !res; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort("timeout"), 15000);
    try {
      res = await fetch(GEMINI_LIST_URL, { headers: { "x-goog-api-key": apiKey }, signal: ac.signal });
    } catch {
      if (attempt === 0) await sleep(900);
    } finally {
      clearTimeout(timer);
    }
  }
  if (!res) {
    // تشخیص دقیق (v2.14.4): گوگل در دسترس است ولی Gemini نه → تحریم منطقه‌ای؛ وگرنه قطعی اینترنت
    const googleOk = await probeGoogleReachable();
    return { ok: false, models: [], message: networkFailMessage(googleOk) };
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, models: [], message: geminiErrorToPersian(res.status, t) };
  }
  try {
    const models = parseModelsList(await res.json());
    if (models.length === 0) return { ok: false, models: [], message: "هیچ مدلی برای این کلید در دسترس نیست — کلید جدیدی از aistudio.google.com/apikey بگیرید." };
    return { ok: true, models, message: "اتصال موفق" };
  } catch {
    return { ok: false, models: [], message: "پاسخ Gemini قابل خواندن نبود — دوباره امتحان کنید." };
  }
}

export interface GeminiTestResult {
  ok: boolean;
  model: string | null; // مدل انتخاب‌شده (در صورت موفقیت) — کش هم می‌شود
  message: string; // پیام فارسی برای نمایش
}

/** دکمه «تست اتصال» تنظیمات — کلید را می‌آزماید و مدل مناسب را پیدا و کش می‌کند */
export async function testGeminiConnection(apiKey: string): Promise<GeminiTestResult> {
  const key = String(apiKey || "").trim();
  if (!key) return { ok: false, model: null, message: "اول کلید Gemini را وارد و ذخیره کنید." };
  const res = await listGeminiModels(key);
  if (!res.ok) return { ok: false, model: null, message: res.message };
  const model = pickGeminiModel(res.models);
  if (!model) return { ok: false, model: null, message: "هیچ مدلی با این کلید قابل استفاده نیست — کلید جدیدی بگیرید." };
  writeCachedModel(model);
  return { ok: true, model, message: `اتصال موفق است ✓ — مدل «${model}» آماده گفتگو است.` };
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

/** خطاهای رایج Gemini به پیام فارسی قابل‌فهم */
export function geminiErrorToPersian(status: number, body: string): string {
  const b = String(body || "");
  if (status === 400 && /API[_ ]?key|API_KEY_INVALID/i.test(b)) return "کلید Gemini نامعتبر است — از تنظیمات کلید درست را وارد کنید.";
  if (status === 401 || status === 403) return "دسترسی به Gemini رد شد — کلید API را در تنظیمات بررسی کنید.";
  if (status === 429) return "تعداد درخواست‌های Gemini زیاد شده — چند لحظه بعد دوباره امتحان کنید.";
  if (status === 404) return "مدل Gemini در دسترس نیست — برنامه خودش مدل دیگری را امتحان می‌کند؛ اگر ادامه داشت، از دکمهٔ «تست اتصال» در تنظیمات مدل فعال را پیدا کنید.";
  if (status >= 500) return "سرور Gemini فعلاً در دسترس نیست — کمی بعد دوباره امتحان کنید.";
  return "خطا در ارتباط با Gemini" + (status ? ` (کد ${status})` : "");
}

export interface GeminiCallResult {
  ok: boolean;
  text: string; // پاسخ خام مدل یا پیام خطا
}

/**
 * یک فراخوانی مدل با سقف زمانی (v2.14.3) — خطای شبکه null برمی‌گرداند.
 */
async function doCallOnce(model: string, body: Record<string, unknown>, apiKey: string): Promise<{ status: number; ok: boolean; text: string } | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort("timeout"), GEMINI_TIMEOUT_MS);
  try {
    const res = await fetch(GEMINI_URL(model), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    if (res.ok) {
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        promptFeedback?: { blockReason?: string };
      };
      const parts = json.candidates?.[0]?.content?.parts || [];
      const text = parts.map((p) => p.text || "").join("").trim();
      if (!text) {
        const blocked = json.promptFeedback?.blockReason;
        return { status: res.status, ok: false, text: blocked ? `درخواست توسط Gemini مسدود شد (${blocked})` : "پاسخی از Gemini نرسید — دوباره امتحان کنید." };
      }
      return { status: res.status, ok: true, text };
    }
    const t = await res.text().catch(() => "");
    return { status: res.status, ok: false, text: geminiErrorToPersian(res.status, t) };
  } catch {
    return null; // خطای شبکه یا تایم‌اوت — بیرون دوباره امتحان/گزارش می‌شود
  } finally {
    clearTimeout(timer);
  }
}

/** تلاش مجدد خودکار روی خطای شبکه (بدون پاسخ HTTP) — v2.14.3 */
async function doCallWithRetry(model: string, body: Record<string, unknown>, apiKey: string, attempts = GEMINI_NET_ATTEMPTS): Promise<{ status: number; ok: boolean; text: string } | null> {
  for (let i = 0; i < attempts; i++) {
    const r = await doCallOnce(model, body, apiKey);
    if (r !== null) return r; // پاسخ HTTP (حتی خطا) — تکرار شبکه لازم نیست
    if (i < attempts - 1) await sleep(900 * (i + 1)); // ۰٫۹ و ۱٫۸ ثانیه انتظار
  }
  return null;
}

/**
 * فراخوانی generateContent با جای‌گردی مدل (v2.14.2) + تایم‌اوت و تلاش مجدد شبکه (v2.14.3، v2.14.4):
 * ۱) اول مدل کش‌شدهٔ دستگاه یا پیش‌فرض (۳ تلاش برای شبکه)؛ ۲) روی خطای 404 («مدل نیست»)
 * کش پاک و بهترین مدل از فهرست واقعی کلید انتخاب می‌شود؛ ۳) اگر فهرست نشد، لیست ثابت
 * یکی‌یکی امتحان می‌شود. مدل موفق کش می‌شود تا تماس بعدی مستقیم برود.
 */
export async function callGemini(opts: {
  apiKey: string;
  systemPrompt: string;
  history: AiChatMessage[];
}): Promise<GeminiCallResult> {
  // ۱) مدل کش‌شده یا پیش‌فرض — با تلاش مجدد شبکه
  const first = readCachedModel() || GEMINI_MODEL;
  const body = buildGeminiBody(first, opts.systemPrompt, opts.history);
  const r = await doCallWithRetry(first, body, opts.apiKey);
  if (r?.ok) {
    writeCachedModel(first);
    return { ok: true, text: r.text };
  }
  if (r === null) return { ok: false, text: GEMINI_NET_FAIL_MSG };

  // ۲) فقط 404 یعنی «مدل نیست» → بقیهٔ خطاها مستقیم گزارش می‌شوند (کلید/سقف/...)
  if (r.status !== 404) return { ok: false, text: r.text };
  writeCachedModel(null);

  // ۳) فهرست واقعی مدل‌های مجاز این کلید
  const listed = await listGeminiModels(opts.apiKey);
  if (listed.ok) {
    const pick = pickGeminiModel(listed.models);
    if (pick && pick !== first) {
      const r2 = await doCallOnce(pick, buildGeminiBody(pick, opts.systemPrompt, opts.history), opts.apiKey);
      if (r2?.ok) {
        writeCachedModel(pick);
        return { ok: true, text: r2.text };
      }
      if (r2 && r2.status !== 404) return { ok: false, text: r2.text };
    }
  }

  // ۴) لیست ثابت — هر مدلی که 404 نداد (بدون تکرار شبکه تا طولانی نشود)
  for (const m of GEMINI_MODELS) {
    if (m === first) continue;
    const r3 = await doCallOnce(m, buildGeminiBody(m, opts.systemPrompt, opts.history), opts.apiKey);
    if (r3?.ok) {
      writeCachedModel(m);
      return { ok: true, text: r3.text };
    }
    if (r3 && r3.status !== 404) return { ok: false, text: r3.text };
  }
  return { ok: false, text: "هیچ مدل Gemini با این کلید پاسخ نداد — از دکمهٔ «تست اتصال» در تنظیمات وضعیت کلید و مدل‌های فعال را ببینید." };
}
