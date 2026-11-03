// ─── دستیار هوشمند حساب‌یار (v2.14) — اتصال به Gemini ───
// گوی سبز شناور → گفتگو (تایپ/صدا) → مدل دستور را می‌فهمد و «اقدام» برمی‌گرداند:
// مثلاً «مبالغ بین ۱۰۰ تا ۵۰۰ هزار رو ببر تو هزینه‌های جاری» → categorize_by_range
// همهٔ اقدام‌ها روی دادهٔ محلی خود دستگاه اجرا می‌شوند؛ فقط متن درخواست به Gemini می‌رود.

export const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

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
  if (status === 404) return "مدل Gemini پیدا نشد — ممکن است نام مدل تغییر کرده باشد.";
  if (status >= 500) return "سرور Gemini فعلاً در دسترس نیست — کمی بعد دوباره امتحان کنید.";
  return "خطا در ارتباط با Gemini" + (status ? ` (کد ${status})` : "");
}

export interface GeminiCallResult {
  ok: boolean;
  text: string; // پاسخ خام مدل یا پیام خطا
}

/** فراخوانی Gemini — فقط متن درخواست و زمینهٔ خلاصه می‌رود؛ هیچ دادهٔ حساسی خارج نمی‌شود */
export async function callGemini(opts: {
  apiKey: string;
  systemPrompt: string;
  history: AiChatMessage[];
}): Promise<GeminiCallResult> {
  const body = {
    system_instruction: { parts: [{ text: opts.systemPrompt }] },
    contents: opts.history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  };
  let res: Response;
  try {
    res = await fetch(GEMINI_URL(GEMINI_MODEL), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": opts.apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, text: "اتصال اینترنت برقرار نشد — برای دستیار هوشمند به اینترنت نیاز است." };
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, text: geminiErrorToPersian(res.status, t) };
  }
  try {
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      promptFeedback?: { blockReason?: string };
    };
    const parts = json.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || "").join("").trim();
    if (!text) {
      const blocked = json.promptFeedback?.blockReason;
      return { ok: false, text: blocked ? `درخواست توسط Gemini مسدود شد (${blocked})` : "پاسخی از Gemini نرسید — دوباره امتحان کنید." };
    }
    return { ok: true, text };
  } catch {
    return { ok: false, text: "پاسخ Gemini قابل خواندن نبود — دوباره امتحان کنید." };
  }
}
