// تست انتخاب مدل Gemini (v2.14.2) — اجرا: bun scripts/test-gemini-models.ts
// فقط توابع خالص: parseModelsList، pickGeminiModel، geminiErrorToPersian

import { parseModelsList, pickGeminiModel, geminiErrorToPersian } from "../src/lib/ai/gemini";

let pass = 0;
let failCount = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
  } else {
    failCount++;
    console.log(`✗ ${name}\n   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`);
  }
}

// ─── parseModelsList ───

const sample = {
  models: [
    { name: "models/gemini-2.0-flash", supportedGenerationMethods: ["generateContent", "countTokens"] },
    { name: "models/gemini-2.5-pro", supportedGenerationMethods: ["generateContent"] },
    { name: "models/embedding-001", supportedGenerationMethods: ["embedContent"] },
    { name: "models/gemini-flash-latest" }, // بدون فیلد روش → پیش‌فرض قابل‌استفاده
    { description: "بدون نام" },
  ],
};

const parsed = parseModelsList(sample);
check("پیشوند models/ حذف شد", parsed[0].name, "gemini-2.0-flash");
check("روش generate تشخیص داده شد", parsed[0].supportsGenerate, true);
check("embedding → غیرقابل‌استفاده", parsed[2].supportsGenerate, false);
check("بدون روش → پیش‌فرض قابل‌استفاده", parsed[3].supportsGenerate, true);
check("مدل بی‌نام حذف شد", parsed.length, 4);
check("ورودی خراب → خالی", parseModelsList({ nope: 1 }), []);
check("ورودی null → خالی", parseModelsList(null), []);

// ─── pickGeminiModel ───

// ترجیح اولویت ثابت
const pick1 = pickGeminiModel([
  { name: "gemini-1.5-flash", supportsGenerate: true },
  { name: "gemini-2.0-flash", supportsGenerate: true },
  { name: "gemini-2.5-flash", supportsGenerate: true },
]);
check("اولویت: gemini-2.0-flash اول است", pick1, "gemini-2.0-flash");

// مدل‌های ترجیحی نیستند → هر flash
const pick2 = pickGeminiModel([
  { name: "gemini-9.9-flash-beta", supportsGenerate: true },
  { name: "gemini-9.9-pro", supportsGenerate: true },
]);
check("بدون ترجیحی → هر flash", pick2, "gemini-9.9-flash-beta");

// flash هم نیست → اولین قابل‌استفاده
const pick3 = pickGeminiModel([
  { name: "gemini-9.9-pro", supportsGenerate: true },
  { name: "embedding-001", supportsGenerate: false },
]);
check("بدون flash → اولین generateContent", pick3, "gemini-9.9-pro");

// فقط مدل‌های غیرقابل‌استفاده → null
check("هیچ مدل قابل‌استفاده‌ای نیست → null", pickGeminiModel([{ name: "embedding-001", supportsGenerate: false }]), null);
check("فهرست خالی → null", pickGeminiModel([]), null);

// مدل‌های غیر generate حذف می‌شوند حتی اگر در ترجیح باشند
const pick4 = pickGeminiModel([
  { name: "gemini-2.0-flash", supportsGenerate: false },
  { name: "gemini-2.5-flash", supportsGenerate: true },
]);
check("ترجیحیِ غیر generate رد می‌شود", pick4, "gemini-2.5-flash");

// ─── geminiErrorToPersian ───

check("۴۰۴ به تست اتصال ارجاع می‌دهد", geminiErrorToPersian(404, "").includes("تست اتصال"), true);
check("کلید نامعتبر", geminiErrorToPersian(400, '{"error":"API_KEY_INVALID"}').includes("نامعتبر"), true);
check("سقف درخواست", geminiErrorToPersian(429, "").includes("زیاد"), true);
check("خطای سرور", geminiErrorToPersian(503, "").includes("در دسترس نیست"), true);
check("خطای عمومی با کد", geminiErrorToPersian(418, "").includes("418"), true);

console.log(`\nنتایج: ${pass} درست، ${failCount} غلط`);
if (failCount > 0) process.exit(1);
