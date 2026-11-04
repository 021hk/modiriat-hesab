// تست لاگ تشخیصی Gemini (v2.15.1) — اجرا: bun scripts/test-gemini-log.ts
// حلقهٔ ثبت/خواندن/پاک‌کردن + سقف ۱۵۰ رکورد + ماسک کلید + بریدهٔ بدنهٔ خطا + پروکسی فقط-https
// + اتصال به gemini.ts: خطای شبکه و خطای HTTP باید در لاگ ثبت شوند (بدون لو رفتن کلید)

import {
  clearGeminiLog,
  clipBody,
  formatLogTime,
  geminiLogToText,
  GEMINI_LOG_LIMIT,
  maskKey,
  pushGeminiLog,
  readGeminiLog,
} from "../src/lib/ai/gemini-log";
import { listGeminiModels, callGemini, normalizeProxyUrl, type AiChatMessage } from "../src/lib/ai/gemini";

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

// ─── maskKey / clipBody / formatLogTime ───

check("ماسک کلید بلند", maskKey("AIzaSyABCDEF1234567890xyz"), "AIza…0xyz");
check("ماسک کلید کوتاه", maskKey("abc123"), "…c123");
check("ماسک کلید خالی", maskKey(""), "…");
check("بریدهٔ بدنه: فشرده‌سازی فاصله", clipBody("  خطای   چند\nخطی  "), "خطای چند خطی");
check("بریدهٔ بدنه: سقف ۲۰۰", clipBody("x".repeat(500)).length, 200);
check("زمان لاگ قالب HH:MM:SS", /^\d{2}:\d{2}:\d{2}$/.test(formatLogTime(new Date(2026, 0, 1, 9, 5, 3))), true);
check("زمان لاگ صفر پیش", formatLogTime(new Date(2026, 0, 1, 9, 5, 3)), "09:05:03");

// ─── پروکسی فقط https (اسکن گوگل‌پلی) ───

check("پروکسی: https سالم", normalizeProxyUrl("https://p.example.com"), "https://p.example.com");
check("پروکسی: http رد می‌شود", normalizeProxyUrl("http://p.example.com"), null);
check("پروکسی: بدون پروتکل رد می‌شود", normalizeProxyUrl("p.example.com"), null);

// ─── حلقهٔ ثبت/خواندن/سقف/پاک‌کردن ───

clearGeminiLog();
check("لاگ خالی", readGeminiLog().length, 0);

pushGeminiLog({ level: "info", phase: "system", msg: "اول" });
pushGeminiLog({ level: "error", phase: "list", msg: "دوم", detail: "status=403" });
pushGeminiLog({ level: "ok", phase: "probe", msg: "سوم" });
{
  const log = readGeminiLog();
  check("سه رکورد ثبت شد", log.length, 3);
  check("تازه‌ترین اول", log[0].msg, "سوم");
  check("ترتیب معکوس کامل", log.map((e) => e.msg), ["سوم", "دوم", "اول"]);
  check("جزئیات حفظ شد", log[1].detail, "status=403");
}

// سقف: ۱۶۰ رکورد → حداکثر ۱۵۰ تا می‌ماند
for (let i = 0; i < 160; i++) {
  pushGeminiLog({ level: "info", phase: "call", msg: `r${i}` });
}
check("سقف حلقه", readGeminiLog().length <= GEMINI_LOG_LIMIT, true);
check("سقف دقیق ۱۵۰", readGeminiLog().length, GEMINI_LOG_LIMIT);
check("قدیمی‌ترین حذف شده", readGeminiLog().some((e) => e.msg === "اول"), false);

clearGeminiLog();
check("پاک‌کردن کامل", readGeminiLog().length, 0);

// ─── متن کپی ───

pushGeminiLog({ level: "error", phase: "list", msg: "خطای HTTP ۴۰۳", detail: "host=x | API key not valid" });
{
  const text = geminiLogToText();
  check("متن: سرصفحه", text.startsWith("لاگ تشخیصی Gemini"), true);
  check("متن: برچسب سطح خطا", text.includes("ERR  LIST"), true);
  check("متن: پیام فارسی", text.includes("خطای HTTP ۴۰۳"), true);
  check("متن: جزئیات", text.includes("API key not valid"), true);
  check("متن: برچسب سطح موفق", /OK\s{2,}CALL/.test(geminiLogToText([{ id: 1, t: Date.now(), level: "ok", phase: "call", msg: "m" }])), true);
}
clearGeminiLog();

// ─── اتصال به gemini.ts — خطای شبکه باید لاگ شود ───

const realFetch = globalThis.fetch;

// کل fetchها رد می‌شوند: لیست مدل‌ها ۲ تلاش + آزمون گوگل → حداقل ۳ رکورد خطا/هشدار
(globalThis as { fetch: unknown }).fetch = (async () => {
  throw new TypeError("Failed to fetch");
}) as typeof fetch;

{
  const KEY = "AIzaSyORIGINALKEY1234567890";
  const r = await listGeminiModels(KEY);
  check("لیست مدل‌ها: شکست شبکه", r.ok, false);
  const log = readGeminiLog();
  check("لاگ: تلاش‌های ناموفق ثبت شد", log.some((e) => e.level === "warn" && e.phase === "list"), true);
  check("لاگ: خطای نهایی ثبت شد", log.some((e) => e.level === "error" && e.msg.includes("هر ۲ تلاش بی‌پاسخ")), true);
  check("لاگ: آزمون گوگل ثبت شد", log.some((e) => e.phase === "probe" && e.level === "warn"), true);
  // امنیت: کلید کامل هرگز در لاگ نمی‌آید
  const text = geminiLogToText(log);
  check("امنیت: کلید کامل در لاگ نیست", text.includes(KEY), false);
  check("امنیت: کلید ماسک‌شده در لاگ است", text.includes("AIza…7890") || text.includes("AIza…"), true);
}

// حالت HTTP 403 — بدنهٔ خطا باید در لاگ بیاید
(globalThis as { fetch: unknown }).fetch = (async () =>
  new Response(JSON.stringify({ error: { message: "API key not valid. Please pass a valid API key." } }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  })) as typeof fetch;

{
  clearGeminiLog();
  await listGeminiModels("AIzaSyBROKEN000000000000");
  const log = readGeminiLog();
  check("لاگ: خطای 403 ثبت شد", log.some((e) => e.level === "error" && e.phase === "list" && e.msg.includes("HTTP 403")), true);
  check("لاگ: کد وضعیت در پیام", log.some((e) => e.phase === "list" && e.msg.includes("403")), true);
  check("لاگ: قطعهٔ بدنهٔ خطا", log.some((e) => (e.detail || "").includes("API key not valid")), true);
}

// callGemini با شبکهٔ قطع → رکورد سیستمی «متوقف شد»
(globalThis as { fetch: unknown }).fetch = (async () => {
  throw new TypeError("Failed to fetch");
}) as typeof fetch;

{
  clearGeminiLog();
  const HIST: AiChatMessage[] = [{ role: "user", text: "سلام" }];
  await callGemini({ apiKey: "AIzaSyNETFAIL000000000000", systemPrompt: "s", history: HIST });
  const log = readGeminiLog();
  check("لاگ callGemini: شروع درخواست", log.some((e) => e.phase === "system" && e.msg.includes("درخواست جدید گفتگو")), true);
  check("لاگ callGemini: توقف شبکه", log.some((e) => e.level === "error" && e.phase === "system" && e.msg.includes("قطع شبکه")), true);
  check("لاگ callGemini: تلاش مجدد ثبت شد", log.some((e) => e.msg.includes("تلاش مجدد")), true);
}

(globalThis as { fetch: unknown }).fetch = realFetch;
clearGeminiLog();

console.log(`\nنتیجه: ${pass} موفق، ${failCount} ناموفق`);
if (failCount > 0) process.exit(1);
