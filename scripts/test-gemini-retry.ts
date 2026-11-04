// تست سرعت و پایداری Gemini (v2.14.3) — اجرا: bun scripts/test-gemini-retry.ts
// buildGeminiBody (خاموش‌کردن تفکر ۲.۵) + تلاش مجدد شبکهٔ خودکار callGemini با fetch قلابی

import {
  buildGeminiBody,
  callGemini,
  GEMINI_NET_ATTEMPTS,
  GEMINI_NET_FAIL_MSG,
  listGeminiModels,
  networkFailMessage,
  probeGoogleReachable,
  resetGeminiModelCache,
  type AiChatMessage,
} from "../src/lib/ai/gemini";

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

const HIST: AiChatMessage[] = [{ role: "user", text: "سلام" }];

// ─── buildGeminiBody ───

const b20 = buildGeminiBody("gemini-2.0-flash", "sys", HIST);
const gen20 = b20.generationConfig as Record<string, unknown>;
check("2.0 بدون thinkingConfig", "thinkingConfig" in gen20, false);
check("2.0 responseMimeType", gen20.responseMimeType, "application/json");
check("2.0 maxOutputTokens", gen20.maxOutputTokens, 1024);

const b25 = buildGeminiBody("gemini-2.5-flash", "sys", HIST);
const gen25 = b25.generationConfig as Record<string, unknown>;
check("2.5 با thinkingConfig", JSON.stringify(gen25.thinkingConfig), JSON.stringify({ thinkingBudget: 0 }));

const blite = buildGeminiBody("gemini-2.5-flash-lite", "sys", HIST);
check("2.5-lite هم thinkingConfig خاموش", "thinkingConfig" in (blite.generationConfig as object), true);

const b15 = buildGeminiBody("gemini-1.5-flash", "sys", HIST);
check("1.5 بدون thinkingConfig", "thinkingConfig" in (b15.generationConfig as object), false);

const contents = b20.contents as { role: string; parts: { text: string }[] }[];
check("contents از history", contents[0].parts[0].text, "سلام");

// ─── callGemini: تلاش مجدد شبکه ───

resetGeminiModelCache();
const realFetch = globalThis.fetch;

// حالت ۱: شبکه هر بار قطع — باید GEMINI_NET_ATTEMPTS بار fetch صدا زده شود و پیام فارسی بیاید
let netCalls = 0;
(globalThis as { fetch: unknown }).fetch = (async () => {
  netCalls++;
  throw new TypeError("Failed to fetch");
}) as typeof fetch;

{
  const r = await callGemini({ apiKey: "k", systemPrompt: "s", history: HIST });
  check("شبکه قطع: تعداد تلاش", netCalls, GEMINI_NET_ATTEMPTS);
  check("شبکه قطع: پیام فارسی", r.ok === false && r.text === GEMINI_NET_FAIL_MSG, true);
}

// حالت ۲: دوبار قطع، بار سوم جواب — باید موفق شود (تلاش مجدد کار می‌کند)
let flaky = 0;
(globalThis as { fetch: unknown }).fetch = (async () => {
  flaky++;
  if (flaky < 3) throw new TypeError("Failed to fetch");
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"reply":"باشه","actions":[]}' }] } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}) as typeof fetch;

{
  const r = await callGemini({ apiKey: "k", systemPrompt: "s", history: HIST });
  check("قطع موقت: موفق شد", r.ok, true);
  check("قطع موقت: دقیقاً ۳ تلاش", flaky, 3);
}

// حالت ۳: پاسخ HTTP خطا (۴۲۹) — بدون تکرار شبکه، پیام فارسی سقف مصرف
let httpCalls = 0;
(globalThis as { fetch: unknown }).fetch = (async () => {
  httpCalls++;
  return new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429 });
}) as typeof fetch;

{
  const r = await callGemini({ apiKey: "k", systemPrompt: "s", history: HIST });
  check("429: فقط یک فراخوانی", httpCalls, 1);
  check("429: پیام سقف مصرف", r.ok === false && r.text.includes("زیاد شده"), true);
}

(globalThis as { fetch: unknown }).fetch = realFetch;
resetGeminiModelCache();

// ─── تشخیص قطعی (v2.14.4) ───

// پیام تحریم منطقه‌ای (گوگل در دسترس است ولی Gemini نه) — باید VPN را بگوید
const msgBlocked = networkFailMessage(true);
check("تحریم: پیام VPN", msgBlocked.includes("VPN") && msgBlocked.includes("IP ایران"), true);
// پیام قطعی اینترنت
const msgNet = networkFailMessage(false);
check("قطعی اینترنت: پیام اینترنت", msgNet.includes("اینترنت") && !msgNet.includes("IP ایران"), true);
// دو پیام متمایز باشند
check("دو پیام متمایز", msgBlocked !== msgNet, true);

// تست اتصال وقتی Gemini جواب نمی‌دهد ولی پروب گوگل موفق است → پیام تحریم/VPN
(globalThis as { fetch: unknown }).fetch = (async (_url: string | URL | Request) => {
  const u = typeof _url === "string" ? _url : _url instanceof URL ? _url.href : String(_url);
  if (u.includes("generate_204")) return new Response(null, { status: 204 });
  throw new TypeError("Failed to fetch");
}) as typeof fetch;
{
  const r = await listGeminiModels("k");
  check("تست اتصال: تشخیص تحریم", r.ok === false && r.message === networkFailMessage(true), true);
  const probe = await probeGoogleReachable();
  check("پروب گوگل: در دسترس", probe, true);
}

// وقتی حتی گوگل هم در دسترس نیست → پیام قطعی اینترنت
(globalThis as { fetch: unknown }).fetch = (async () => {
  throw new TypeError("Failed to fetch");
}) as typeof fetch;
{
  const r = await listGeminiModels("k");
  check("تست اتصال: تشخیص قطعی اینترنت", r.ok === false && r.message === networkFailMessage(false), true);
  const probe = await probeGoogleReachable();
  check("پروب گوگل: در دسترس نیست", probe, false);
}

(globalThis as { fetch: unknown }).fetch = realFetch;

console.log(`\nنتیجه: ${pass} درست، ${failCount} غلط`);
process.exit(failCount > 0 ? 1 : 0);
