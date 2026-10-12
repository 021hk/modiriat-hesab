// ─── دسته‌بندی خودکار تراکنش بر اساس مبلغ (v2.13) ───
// کاربر در تنظیمات قانون تعریف می‌کند: عدد مشخص یا محدوده مبلغ + دسته انتخابی
// هر تراکنشِ هزینه/درآمد که دسته‌ای نداشته باشد، اگر مبلغش با یک قانون بخواند
// خودکار در همان دسته ثبت می‌شود. خالص و قابل‌تست — بدون وابستگی به UI/DB.

export interface AutoCatRule {
  id: string;
  label: string | null;
  flow: "expense" | "income";
  match: "exact" | "range";
  exact: number | null; // به ریال
  min: number | null; // به ریال — کران پایین محدوده (اختیاری)
  max: number | null; // به ریال — کران بالای محدوده (اختیاری)
  categoryId: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** آیا مبلغ (ریال) با این قانون می‌خواند؟ قوانین ناقص/غیرفعال هرگز match نمی‌شوند */
export function ruleMatchesAmount(rule: AutoCatRule, amountRial: number): boolean {
  if (!rule || rule.enabled === false) return false;
  if (!(rule.flow === "expense" || rule.flow === "income")) return false;
  if (!(amountRial > 0)) return false;
  if (rule.match === "exact") {
    return typeof rule.exact === "number" && rule.exact > 0 && amountRial === rule.exact;
  }
  if (rule.match === "range") {
    const hasMin = typeof rule.min === "number" && rule.min > 0;
    const hasMax = typeof rule.max === "number" && rule.max > 0;
    if (!hasMin && !hasMax) return false; // محدوده بدون هیچ کران بی‌معناست
    if (hasMin && amountRial < (rule.min as number)) return false;
    if (hasMax && amountRial > (rule.max as number)) return false;
    return true;
  }
  return false;
}

/**
 * اولین قانون فعالِ همان جهت (هزینه/درآمد) که مبلغ با آن بخواند — به ترتیب آرایه (اولویت).
 * categoryId باید در دسته‌های فعلی وجود داشته باشد (validIds) وگرنه قانون نادیده گرفته می‌شود.
 */
export function matchAutoCatRule(
  amountRial: number,
  flow: "expense" | "income",
  rules: AutoCatRule[] | null | undefined,
  validIds?: Set<string>
): AutoCatRule | null {
  for (const rule of rules || []) {
    if (!ruleMatchesAmount(rule, amountRial)) continue;
    if (rule.flow !== flow) continue;
    if (validIds && rule.categoryId && !validIds.has(rule.categoryId)) continue;
    return rule;
  }
  return null;
}

/** اعتبارسنجی قانون ورودی از فرم — رشته خطای فارسی یا null (یعنی معتبر) */
export function validateAutoCatRuleInput(
  body: Record<string, unknown>
): { flow: "expense" | "income"; match: "exact" | "range"; exact: number | null; min: number | null; max: number | null } | string {
  const flow = body.flow === "income" ? "income" : body.flow === "expense" ? "expense" : null;
  if (!flow) return "نوع قانون باید هزینه یا درآمد باشد";
  if (!body.categoryId || typeof body.categoryId !== "string") return "انتخاب دسته الزامی است";
  const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  if (body.match === "exact") {
    const exact = num(body.exact);
    if (exact <= 0) return "عدد مشخص باید بزرگ‌تر از صفر باشد";
    return { flow, match: "exact", exact, min: null, max: null };
  }
  if (body.match === "range") {
    const min = num(body.min);
    const max = num(body.max);
    if (min <= 0 && max <= 0) return "حداقل یکی از دو کران محدوده باید بزرگ‌تر از صفر باشد";
    if (min > 0 && max > 0 && min > max) return "کران پایین محدوده نباید از کران بالا بزرگ‌تر باشد";
    return { flow, match: "range", exact: null, min: min > 0 ? min : null, max: max > 0 ? max : null };
  }
  return "حالت تطبیق باید «عدد مشخص» یا «محدوده» باشد";
}

/** توصیف فارسی قانون برای نمایش در لیست — fmt اعداد را به واحد نمایش می‌سازد */
export function describeRule(rule: AutoCatRule, fmt: (rial: number) => string, unit: string): string {
  const scope =
    rule.match === "exact"
      ? `دقیقاً ${fmt(rule.exact || 0)} ${unit}`
      : rule.min && rule.max
        ? `از ${fmt(rule.min)} تا ${fmt(rule.max)} ${unit}`
        : rule.min
          ? `از ${fmt(rule.min)} ${unit} به بالا`
          : `تا ${fmt(rule.max || 0)} ${unit}`;
  const flowLabel = rule.flow === "expense" ? "هزینه" : "درآمد";
  return `${flowLabel} ${scope}`;
}
