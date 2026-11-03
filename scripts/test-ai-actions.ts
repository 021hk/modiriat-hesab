// تست دستیار هوشمند (v2.14) — اجرا: bun scripts/test-ai-actions.ts
// توابع خالص: parseAiResponse، validateAiAction، describeAiAction، خطاهای Gemini، دستور سیستم
import {
  parseAiResponse,
  geminiErrorToPersian,
  buildSystemPrompt,
  buildDataContext,
} from "../src/lib/ai/gemini";
import { validateAiAction, validateAiActions, describeAiAction } from "../src/lib/ai/actions";

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

// ─── parseAiResponse ───

const p1 = parseAiResponse('{"reply":"انجام شد","actions":[{"type":"create_rule"}]}');
check("JSON ساده", [p1.reply, p1.actions.length], ["انجام شد", 1]);

const p2 = parseAiResponse('```json\n{"reply":"سلام","actions":[]}\n```');
check("JSON داخل ```", [p2.reply, p2.actions.length], ["سلام", 0]);

const p3 = parseAiResponse('بفرمایید: {"reply":"چشم","actions":[]} پایان');
check("متن اضافه دور JSON", p3.reply, "چشم");

const p4 = parseAiResponse("پاسخ بدون JSON");
check("بدون JSON → خطا", p4.error != null && p4.reply.length > 0, true);

const p5 = parseAiResponse('{"actions":[{"type":"categorize_by_range"}]}');
check("بدون reply ولی با action → خطا ندارد", p5.error, undefined);

const p6 = parseAiResponse('{"reply":"فقط حرف","actions":"نه"}');
check("actions غیرآرایه → خالی", p6.actions.length, 0);

// ─── validateAiAction ───

const v1 = validateAiAction({ type: "categorize_by_range", flow: "expense", categoryId: "c1", min: 1000000, max: 5000000 });
check("categorize_by_range معتبر", typeof v1 === "object" && v1.min === 1000000 && v1.max === 5000000, true);

const v2 = validateAiAction({ type: "categorize_by_range", flow: "expense", categoryId: "c1" });
check("categorize بدون مبلغ → خطا", typeof v2, "string");

const v3 = validateAiAction({ type: "categorize_by_range", categoryId: "c1", min: 100 });
check("بدون flow → خطا", typeof v3, "string");

const v4 = validateAiAction({ type: "categorize_by_range", flow: "expense", categoryId: "c1", min: 500, max: 100 });
check("محدودهٔ برعکس → خطا", typeof v4, "string");

const v5 = validateAiAction({ type: "categorize_by_range", flow: "expense", categoryId: "c1", min: 0, max: 0 });
check("مبلغ صفر → خطا", typeof v5, "string");

const v6 = validateAiAction({ type: "create_rule", flow: "income", categoryId: "c2", exact: 1500000 });
check("create_rule با عدد مشخص", typeof v6 === "object" && v6.match === "exact" && v6.exact === 1500000, true);

const v7 = validateAiAction({ type: "create_rule", flow: "income", categoryId: "c2", min: 100, max: 900 });
check("create_rule محدوده", typeof v7 === "object" && v7.match === "range", true);

const v8 = validateAiAction({ type: "add_transaction", txType: "expense", amount: 250000 });
check("add_transaction معتبر", typeof v8 === "object" && v8.amount === 250000, true);

const v9 = validateAiAction({ type: "add_transaction", txType: "expense", amount: -5 });
check("مبلغ منفی تراکنش → خطا", typeof v9, "string");

const v10 = validateAiAction({ type: "add_installment", title: "قسط وام", amount: 5000000, dueDate: new Date(Date.now() + 864e5).toISOString(), kind: "installment" });
check("add_installment معتبر", typeof v10 === "object" && v10.kind === "installment", true);

const v11 = validateAiAction({ type: "add_installment", title: "چک", amount: 100, dueDate: "نامعتبر" });
check("تاریخ نامعتبر قسط → خطا", typeof v11, "string");

const v12 = validateAiAction({ type: "unknown_thing" });
check("نوع ناشناخته → خطا", typeof v12, "string");

// overwrite
const v13 = validateAiAction({ type: "categorize_by_range", flow: "expense", categoryId: "c1", exact: 500000, overwrite: true });
check("overwrite:true حفظ می‌شود", typeof v13 === "object" && v13.overwrite === true, true);

// validateAiActions — حداکثر و جداسازی خطاها
const batch = validateAiActions([
  { type: "create_rule", flow: "expense", categoryId: "c1", exact: 1000 },
  { type: "bogus" },
  { type: "categorize_by_range", flow: "income", categoryId: "c2", max: 777000 },
]);
check("دسته‌بندی دستهٔ معتبر/خطا", [batch.actions.length, batch.errors.length], [2, 1]);

// ─── describeAiAction ───

const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const d1 = describeAiAction({ type: "categorize_by_range", flow: "expense", categoryId: "c1", min: 1000000, max: 5000000 } as never, fmt);
check("توصیف محدوده", d1.includes("بین 1,000,000 تا 5,000,000"), true);
const d2 = describeAiAction({ type: "add_installment", title: "چک اجاره", kind: "check", amount: 9000 } as never, fmt);
check("توصیف چک", d2.includes("چک") && d2.includes("چک اجاره"), true);

// ─── geminiErrorToPersian ───

check("کلید نامعتبر", geminiErrorToPersian(400, '{"error":{"status":"INVALID_ARGUMENT","message":"API key not valid"}}').includes("کلید"), true);
check("محدودیت ۴۲۹", geminiErrorToPersian(429, "").includes("۴۲۹") || geminiErrorToPersian(429, "").includes("زیاد"), true);
check("خطای سرور ۵۰۰", geminiErrorToPersian(500, "").includes("در دسترس نیست"), true);

// ─── دستور سیستم و زمینه ───

const sp = buildSystemPrompt("2026-10-12T00:00:00Z");
check("دستور سیستم شامل قرار داد JSON", sp.includes('"reply"') && sp.includes('"actions"'), true);
check("دستور سیستم شامل هر ۴ اقدام", ["categorize_by_range", "create_rule", "add_transaction", "add_installment"].every((t) => sp.includes(t)), true);
check("دستور سیستم شامل تبدیل تومان→ریال", sp.includes("۱۰ ریال"), true);

const ctx = buildDataContext({
  accounts: [{ id: "a1", name: "ملت جاری", bankName: "ملت", balance: 1000 }],
  categories: [{ id: "c1", name: "خواربار", type: "expense" }],
  stats: { totalBalance: 5000, monthIncome: 100, monthExpense: 50 },
  installments: [{ id: "i1", title: "قسط وام", kind: "installment", amount: 700, dueDate: "2026-10-15", paid: false }],
  rules: [],
});
check("زمینه شامل دسته‌ها و حساب‌ها", ctx.includes("خواربار") && ctx.includes("ملت جاری"), true);
check("زمینه شامل اقساط", ctx.includes("قسط وام"), true);

console.log(`\nنتایج: ${pass} درست، ${failCount} غلط`);
if (failCount > 0) process.exit(1);
